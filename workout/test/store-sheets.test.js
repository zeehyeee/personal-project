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
  const code = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8').replace("const TOKEN = '여기를-나만-아는-비밀번호로-바꾸세요'", "const TOKEN = 't'");
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
