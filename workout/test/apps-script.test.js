// apps-script/Code.gs 를 가짜 스프레드시트 위에서 실행해 본다 (Apps Script는 이 환경에서 못 돌려서)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function fakeSpreadsheet() {
  const sheets = {};
  const makeSheet = (name) => {
    const grid = []; // grid[r][c], 0부터
    const sh = {
      name,
      grid,
      getLastRow: () => grid.length,
      getMaxRows: () => 1000,
      setFrozenRows() {},
      appendRow: (row) => grid.push([...row]),
      deleteRow: (r) => grid.splice(r - 1, 1),
      deleteRows: (r, n) => grid.splice(r - 1, n),
      getRange: (r, c, nr = 1, nc = 1) => ({
        setNumberFormat() {},
        setValue(v) { while (grid.length < r) grid.push([]); grid[r - 1][c - 1] = v; },
        setValues(vals) {
          vals.forEach((row, i) => {
            while (grid.length < r + i) grid.push([]);
            row.forEach((v, j) => { grid[r - 1 + i][c - 1 + j] = v; });
          });
        },
        getValues() {
          return Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => grid[r - 1 + i]?.[c - 1 + j] ?? ''));
        },
      }),
    };
    return sh;
  };
  return {
    sheets,
    getSheetByName: (n) => sheets[n] ?? null,
    insertSheet: (n) => (sheets[n] = makeSheet(n)),
  };
}

function load() {
  const ss = fakeSpreadsheet();
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Session: { getScriptTimeZone: () => 'Asia/Seoul' },
    Utilities: { formatDate: () => '' },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => JSON.parse(t) }) },
  };
  vm.createContext(ctx);
  const code = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8').replace("const TOKEN = ''", "const TOKEN = 't'");
  vm.runInContext(code + '\nthis.doGet = doGet; this.doPost = doPost;', ctx);
  const post = (body) => ctx.doPost({ postData: { contents: JSON.stringify({ token: 't', ...body }) } });
  const read = () => ctx.doGet({ parameter: { token: 't', action: 'read' } });
  return { ss, post, read, ctx };
}

const s1 = { id: 'a', date: '2026-10-06', start_time: '20:04', sport: 'swim', duration_sec: 3983, distance_m: 450, kcal: null, source: 'capture' };
const laps = [{ session_id: 'a', lap_no: 1, stroke: 'freestyle', time_sec: 564, strokes: 6 }, { session_id: 'a', lap_no: 2, stroke: 'freestyle', time_sec: 40, strokes: 4 }];

test('토큰이 틀리면 거절', () => {
  const { ctx } = load();
  assert.equal(ctx.doGet({ parameter: { token: 'x', action: 'read' } }).ok, false);
  assert.equal(ctx.doPost({ postData: { contents: '{"token":"x","action":"addSessions"}' } }).ok, false);
});

test('TOKEN 을 비워 두면 비밀번호 없이 읽고 쓴다', () => {
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => null, insertSheet: () => ({ getLastRow: () => 1, getMaxRows: () => 10, setFrozenRows() {}, getRange: () => ({ setValues() {}, setNumberFormat() {} }) }) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Session: { getScriptTimeZone: () => 'Asia/Seoul' },
    Utilities: { formatDate: () => '' },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ setMimeType: () => JSON.parse(t) }) },
  };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8') + '\nthis.doGet = doGet;', ctx);
  assert.equal(ctx.doGet({ parameter: { action: 'read' } }).ok, true);
});

test('추가 → 읽기, 같은 id 재전송은 중복 안 됨', () => {
  const { post, read } = load();
  assert.equal(post({ action: 'addSessions', sessions: [s1], laps }).ok, true);
  post({ action: 'addSessions', sessions: [s1], laps });
  const { data } = read();
  assert.equal(data.sessions.length, 1);
  assert.equal(data.sessions[0].date, '2026-10-06');
  assert.equal(data.sessions[0].kcal, null);
  assert.equal(data.laps.length, 2);
});

test('삭제는 구간도 함께, 설정은 키별 갱신', () => {
  const { post, read } = load();
  post({ action: 'addSessions', sessions: [s1, { ...s1, id: 'b' }], laps });
  post({ action: 'deleteSessions', ids: ['a'] });
  post({ action: 'saveSettings', patch: { pool_length_m: 25 } });
  post({ action: 'saveSettings', patch: { pool_length_m: 50, weekly_minutes_goal: 200 } });
  const { data } = read();
  assert.deepEqual(data.sessions.map((s) => s.id), ['b']);
  assert.equal(data.laps.length, 0);
  assert.deepEqual(data.settings, { pool_length_m: 50, weekly_minutes_goal: 200 });
});

test('전체 바꾸기(백업 불러오기)', () => {
  const { post, read } = load();
  post({ action: 'addSessions', sessions: [s1], laps });
  post({ action: 'replaceAll', sessions: [{ ...s1, id: 'z' }], laps: [], settings: { pool_length_m: 12.5 } });
  const { data } = read();
  assert.deepEqual(data.sessions.map((s) => s.id), ['z']);
  assert.equal(data.settings.pool_length_m, 12.5);
});
