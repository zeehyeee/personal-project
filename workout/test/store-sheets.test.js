// 앱 동기화 저장소 ↔ Apps Script(Code.gs) 를 가짜 시트로 이어서 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createLocalStore } from '../src/store.js';
import { createSyncedStore, createSheetClient } from '../src/store-sheets.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

// apps-script.test.js 와 같은 가짜 시트 (간단 버전)
function fakeAppsScript() {
  const sheets = {};
  const makeSheet = () => {
    const grid = [];
    return {
      getLastRow: () => grid.length, getMaxRows: () => 1000, setFrozenRows() {},
      getLastColumn: () => Math.max(0, ...grid.map((r) => r.length)),
      appendRow: (row) => grid.push([...row]),
      deleteRow: (r) => grid.splice(r - 1, 1),
      deleteRows: (r, n) => grid.splice(r - 1, n),
      getRange: (r, c, nr = 1, nc = 1) => ({
        setNumberFormat() {},
        setValue(v) { while (grid.length < r) grid.push([]); grid[r - 1][c - 1] = v; },
        setValues(vals) { vals.forEach((row, i) => { while (grid.length < r + i) grid.push([]); row.forEach((v, j) => { grid[r - 1 + i][c - 1 + j] = v; }); }); },
        getValues() { return Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => grid[r - 1 + i]?.[c - 1 + j] ?? '')); },
      }),
    };
  };
  const ss = { getSheetByName: (n) => sheets[n] ?? null, insertSheet: (n) => (sheets[n] = makeSheet()) };
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Session: { getScriptTimeZone: () => 'Asia/Seoul' },
    Utilities: { formatDate: () => '' },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => t }) },
  };
  vm.createContext(ctx);
  const code = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8').replace("const TOKEN = ''", "const TOKEN = 't'");
  vm.runInContext(code + '\nthis.doGet = doGet; this.doPost = doPost;', ctx);
  let down = false;
  const fetchImpl = async (url, opts) => {
    if (down) throw new TypeError('Failed to fetch');
    const text = opts?.method === 'POST'
      ? ctx.doPost({ postData: { contents: opts.body } })
      : ctx.doGet({ parameter: Object.fromEntries(new URL(url).searchParams) });
    return { json: async () => JSON.parse(text) };
  };
  return { fetchImpl, setDown: (v) => { down = v; } };
}

const run = { id: 'm1', date: '2026-10-08', start_time: '07:30', sport: 'run', duration_sec: 1500, distance_m: 3200, kcal: null, source: 'manual' };

test('처음 연결: 내 기록은 시트로, 예시 데이터는 안 보냄. 다시 읽으면 시트 기준', async () => {
  const api = fakeAppsScript();
  const storage = memoryStorage();
  const local = createLocalStore(storage);
  await local.addSessions([run]);
  const store = createSyncedStore(local, createSheetClient({ url: 'https://x/exec', token: 't' }, api.fetchImpl), storage);
  assert.equal(await store.uploadLocal(), true);
  const db = await store.load();
  assert.deepEqual(db.sessions.map((s) => s.id), ['m1']); // 예시 데이터는 사라지고 시트 기록만
  assert.equal(db.sessions[0].duration_sec, 1500);
  assert.equal(db.sessions[0].kcal, null);
  assert.equal(store.status.online, true);
});

test('오프라인이면 휴대폰에 먼저 저장하고, 다음에 열 때 시트로 보낸다', async () => {
  const api = fakeAppsScript();
  const storage = memoryStorage();
  const store = createSyncedStore(createLocalStore(storage), createSheetClient({ url: 'https://x/exec', token: 't' }, api.fetchImpl), storage);
  await store.load();
  api.setDown(true);
  await store.addSessions([run]);
  assert.equal(store.status.pending, 1);
  let db = await store.load();
  assert.equal(store.status.online, false);
  assert.deepEqual(db.sessions.map((s) => s.id), ['m1']); // 사본으로 보여줌
  api.setDown(false);
  db = await store.load();
  assert.equal(store.status.pending, 0);
  assert.deepEqual(db.sessions.map((s) => s.id), ['m1']);
  // 다른 기기에서 처음 열어도 시트에서 받아온다
  const other = createSyncedStore(createLocalStore(memoryStorage()), createSheetClient({ url: 'https://x/exec', token: 't' }, api.fetchImpl), memoryStorage());
  assert.deepEqual((await other.load()).sessions.map((s) => s.id), ['m1']);
});

test('비밀번호가 틀리면 사본으로 보여주고 이유를 알려준다', async () => {
  const api = fakeAppsScript();
  const storage = memoryStorage();
  const store = createSyncedStore(createLocalStore(storage), createSheetClient({ url: 'https://x/exec', token: 'wrong' }, api.fetchImpl), storage);
  await store.load();
  assert.equal(store.status.online, false);
  assert.equal(store.status.error, '비밀번호가 맞지 않아요.');
});

test('기록 수정·메모: 휴대폰과 시트 모두 바뀌고, 구간 기록은 그대로', async () => {
  const api = fakeAppsScript();
  const storage = memoryStorage();
  const store = createSyncedStore(createLocalStore(storage), createSheetClient({ url: 'https://x/exec', token: 't' }, api.fetchImpl), storage);
  await store.load();
  await store.addSessions([run], []);
  await store.updateSession({ ...run, duration_sec: 1600, condition: 'great', memo: '한강' });
  const db = await store.load();
  assert.equal(db.sessions.length, 1);
  assert.equal(db.sessions[0].duration_sec, 1600);
  assert.equal(db.sessions[0].condition, 'great');
  assert.equal(db.sessions[0].memo, '한강');
});

test('기본 시트: 처음 여는 기기는 자동 연결 설정, 연결 끊기를 누른 기기는 자동 연결 안 함', async () => {
  const { autoSheetConfig, writeSheetConfig, readSheetConfig, DEFAULT_SHEET_URL } = await import('../src/store-sheets.js');
  const storage = memoryStorage();
  assert.deepEqual(autoSheetConfig(storage), { url: DEFAULT_SHEET_URL });
  writeSheetConfig({ url: DEFAULT_SHEET_URL }, storage);
  assert.equal(autoSheetConfig(storage), null); // 이미 연결됨
  writeSheetConfig(null, storage);
  assert.equal(readSheetConfig(storage), null);
  assert.equal(autoSheetConfig(storage), null); // 끊은 기기
  writeSheetConfig({ url: DEFAULT_SHEET_URL }, storage);
  writeSheetConfig(null, storage);
  writeSheetConfig({ url: 'https://x/exec' }, storage);
  assert.equal(readSheetConfig(storage).url, 'https://x/exec');
});

test('구간 나중에 채우기·고치기: 그 세션 구간만 통째로 바뀌고 시트에도', async () => {
  const api = fakeAppsScript();
  const storage = memoryStorage();
  const store = createSyncedStore(createLocalStore(storage), createSheetClient({ url: 'https://x/exec', token: 't' }, api.fetchImpl), storage);
  await store.load();
  const swim = { id: 'sw', date: '2026-10-04', sport: 'swim', duration_sec: 5146, distance_m: 775, swim_laps: 2, source: 'capture' };
  await store.addSessions([swim, { ...swim, id: 'other' }], [{ session_id: 'other', lap_no: 1, stroke: 'freestyle', time_sec: 50, strokes: 5 }]);
  await store.setLaps('sw', [{ session_id: 'sw', lap_no: 1, stroke: 'freestyle', time_sec: 60, strokes: 6 }]);
  await store.setLaps('sw', [{ session_id: 'sw', lap_no: 1, stroke: 'backstroke', time_sec: 61, strokes: 9 }, { session_id: 'sw', lap_no: 2, stroke: 'freestyle', time_sec: 55, strokes: 6 }]);
  const db = await store.load();
  assert.deepEqual(db.laps.filter((l) => l.session_id === 'sw').map((l) => [l.lap_no, l.stroke, l.time_sec]), [[1, 'backstroke', 61], [2, 'freestyle', 55]]);
  assert.equal(db.laps.filter((l) => l.session_id === 'other').length, 1);
});
