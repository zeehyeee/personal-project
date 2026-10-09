/**
 * 운동 기록 ↔ 구글 시트 연동 (Apps Script 웹 앱)
 * 바다네 곳간과 같은 방식: 시트에 붙은 Apps Script를 웹 앱으로 배포하고 앱이 그 주소로 읽고 쓴다.
 *
 * 설치
 * 1) 새 구글 시트 → 확장 프로그램 → Apps Script → 이 파일 내용을 붙여넣기
 * 2) 배포 → 새 배포 → 유형: 웹 앱 / 실행: 나 / 액세스: 모든 사용자 → 배포 → 웹 앱 URL 복사
 * 3) 바다네 체육관 앱 → 설정 → 구글 시트 연결에 URL 입력
 * (선택) 아래 TOKEN 에 문장을 넣으면 앱 설정에도 같은 비밀번호를 넣어야 읽고 쓸 수 있다. 비워 두면 주소만으로 연결
 * 시트 탭(sessions, swim_laps, settings)은 처음 요청 때 자동으로 만든다.
 */
const TOKEN = ''; // 비워 두면 비밀번호 없이 (바다네 곳간과 같은 방식)

const SHEETS = {
  sessions: ['id', 'date', 'start_time', 'sport', 'duration_sec', 'distance_m', 'kcal', 'avg_hr', 'avg_cadence',
    'swim_laps', 'swim_total_strokes', 'pool_length_m', 'zone_max_min', 'zone_high_min', 'zone_mid_min', 'zone_low_min',
    'source', 'saved_at', 'condition', 'memo'],
  swim_laps: ['session_id', 'lap_no', 'stroke', 'time_sec', 'strokes'],
  settings: ['key', 'value'],
};
// 날짜·시각이 시트에서 날짜 형식으로 바뀌지 않게 글자로 둔다
const TEXT_COLUMNS = { sessions: ['id', 'date', 'start_time', 'sport', 'source', 'saved_at', 'condition', 'memo'], swim_laps: ['session_id', 'stroke'], settings: ['key'] };

// 편집기에서 ▶실행으로 눌러도 오류 없이 시트 탭을 만들고 결과를 보여준다 (그때는 e 가 없다)
function doGet(e) {
  const p = (e && e.parameter) || { action: 'read', token: TOKEN };
  if (TOKEN && p.token !== TOKEN) return json_({ ok: false, error: 'token' });
  if (p.action === 'read') return json_({ ok: true, data: readAll_() });
  return json_({ ok: false, error: 'unknown action' });
}

// 쓰기는 POST(본문 JSON). 앱은 Content-Type 없이 보내 브라우저 사전 요청(CORS preflight)을 피한다
function doPost(e) {
  let body;
  try { body = JSON.parse(e && e.postData ? e.postData.contents : ''); } catch (err) { return json_({ ok: false, error: 'bad json' }); }
  if (TOKEN && body.token !== TOKEN) return json_({ ok: false, error: 'token' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (body.action === 'addSessions') addSessions_(body.sessions || [], body.laps || []);
    else if (body.action === 'updateSession') updateSession_(body.session || {});
    else if (body.action === 'setLaps') setLaps_(body.session_id, body.laps || []);
    else if (body.action === 'deleteSessions') deleteSessions_(body.ids || []);
    else if (body.action === 'saveSettings') saveSettings_(body.patch || {});
    else if (body.action === 'replaceAll') replaceAll_(body.sessions || [], body.laps || [], body.settings || {});
    else return json_({ ok: false, error: 'unknown action' });
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    const head = SHEETS[name];
    sh.getRange(1, 1, 1, head.length).setValues([head]);
    (TEXT_COLUMNS[name] || []).forEach((c) => sh.getRange(1, head.indexOf(c) + 1, sh.getMaxRows(), 1).setNumberFormat('@'));
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < SHEETS[name].length) {
    // 예전 버전으로 만든 시트: 뒤에 새 칸(컨디션·메모 등) 머리글을 붙인다
    const head = SHEETS[name];
    sh.getRange(1, 1, 1, head.length).setValues([head]);
    (TEXT_COLUMNS[name] || []).forEach((c) => sh.getRange(1, head.indexOf(c) + 1, sh.getMaxRows(), 1).setNumberFormat('@'));
  }
  return sh;
}

function rows_(name) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const head = SHEETS[name];
  const tz = Session.getScriptTimeZone();
  return sh.getRange(2, 1, last - 1, head.length).getValues().map((r) => {
    const o = {};
    head.forEach((h, i) => {
      let v = r[i];
      // 혹시 날짜·시각으로 바뀐 칸은 글자로 되돌린다
      if (v instanceof Date) v = Utilities.formatDate(v, tz, h === 'start_time' ? 'HH:mm' : 'yyyy-MM-dd');
      o[h] = v === '' ? null : v;
    });
    return o;
  });
}

function readAll_() {
  const settings = {};
  rows_('settings').forEach((r) => { if (r.key) settings[r.key] = r.value; });
  return { sessions: rows_('sessions'), laps: rows_('swim_laps'), settings: settings };
}

function append_(name, objects) {
  if (!objects.length) return;
  const head = SHEETS[name];
  const sh = sheet_(name);
  const values = objects.map((o) => head.map((h) => (o[h] === null || o[h] === undefined ? '' : o[h])));
  sh.getRange(sh.getLastRow() + 1, 1, values.length, head.length).setValues(values);
}

function addSessions_(sessions, laps) {
  // 같은 id 가 이미 있으면 건너뛴다 (재전송해도 중복 안 됨)
  const have = {};
  rows_('sessions').forEach((r) => { have[r.id] = true; });
  const fresh = sessions.filter((s) => s.id && !have[s.id]);
  const ids = {};
  fresh.forEach((s) => { ids[s.id] = true; });
  const now = new Date().toISOString();
  append_('sessions', fresh.map((s) => Object.assign({}, s, { saved_at: now })));
  append_('swim_laps', laps.filter((l) => ids[l.session_id]));
}

// 수정·메모: 같은 id 행을 덮어쓴다 (없으면 새로 추가)
function updateSession_(s) {
  if (!s.id) return;
  const sh = sheet_('sessions');
  const head = SHEETS.sessions;
  const last = sh.getLastRow();
  const ids = last < 2 ? [] : sh.getRange(2, 1, last - 1, 1).getValues().map((r) => r[0]);
  const i = ids.indexOf(s.id);
  if (i < 0) return append_('sessions', [Object.assign({}, s, { saved_at: new Date().toISOString() })]);
  const saved = sh.getRange(i + 2, head.indexOf('saved_at') + 1, 1, 1).getValues()[0][0];
  const row = head.map((h) => (h === 'saved_at' ? saved : s[h] === null || s[h] === undefined ? '' : s[h]));
  sh.getRange(i + 2, 1, 1, head.length).setValues([row]);
}

function deleteWhere_(name, col, ids) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return;
  const c = SHEETS[name].indexOf(col) + 1;
  const vals = sh.getRange(2, c, last - 1, 1).getValues();
  const drop = {};
  ids.forEach((id) => { drop[id] = true; });
  for (let i = vals.length - 1; i >= 0; i--) if (drop[vals[i][0]]) sh.deleteRow(i + 2);
}

// 한 세션의 구간 기록을 통째로 바꾼다
function setLaps_(sessionId, laps) {
  if (!sessionId) return;
  deleteWhere_('swim_laps', 'session_id', [sessionId]);
  append_('swim_laps', laps.filter((l) => l.session_id === sessionId));
}

function deleteSessions_(ids) {
  deleteWhere_('swim_laps', 'session_id', ids);
  deleteWhere_('sessions', 'id', ids);
}

function saveSettings_(patch) {
  const sh = sheet_('settings');
  const last = sh.getLastRow();
  const keys = last < 2 ? [] : sh.getRange(2, 1, last - 1, 1).getValues().map((r) => r[0]);
  Object.keys(patch).forEach((k) => {
    const i = keys.indexOf(k);
    if (i >= 0) sh.getRange(i + 2, 2).setValue(patch[k]);
    else { sh.appendRow([k, patch[k]]); keys.push(k); }
  });
}

function replaceAll_(sessions, laps, settings) {
  ['sessions', 'swim_laps', 'settings'].forEach((n) => {
    const sh = sheet_(n);
    if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  });
  addSessions_(sessions, laps);
  saveSettings_(settings);
}

function json_(obj) {
  console.log(JSON.stringify(obj).slice(0, 300));
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
