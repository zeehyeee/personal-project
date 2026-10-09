// 구글 시트 동기화 저장소. 휴대폰에 사본(로컬 저장소)을 두고 시트와 맞춘다.
// - 읽기: 시트(Apps Script 웹 앱)에서 전부 받아 사본을 바꾼다. 실패하면 사본으로 보여준다
// - 쓰기: 사본에 먼저 쓰고 '보낼 목록'에 쌓은 뒤 시트로 보낸다. 실패하면 다음 읽기 때 다시 보낸다
// 예시 데이터(source: demo)는 시트로 보내지 않는다.

const PENDING_KEY = 'workout-log:pending';
const CONFIG_KEY = 'workout-log:sheet';
// 연결 끊기를 누른 기기에서는 자동으로 다시 연결하지 않는다
const OFF_KEY = 'workout-log:sheet-off';

// 바다네 체육관 데이터 베이스 웹 앱 (바다네 곳간처럼 처음부터 채워 두고, 앱을 열면 바로 연결)
export const DEFAULT_SHEET_URL = 'https://script.google.com/macros/s/AKfycby4dYPviXPY2Vp0_gtctjdN3pzOWTz1PU7Ppi-6z3FEReNLRwCwNw8rXW9tgdUzaGGJPw/exec';

const NUMERIC = ['duration_sec', 'distance_m', 'kcal', 'avg_hr', 'avg_cadence', 'swim_laps', 'swim_total_strokes', 'pool_length_m',
  'zone_max_min', 'zone_high_min', 'zone_mid_min', 'zone_low_min', 'lap_no', 'time_sec', 'strokes'];
const TEXT = ['id', 'date', 'start_time', 'sport', 'source', 'session_id', 'stroke', 'condition', 'memo'];

// 시트 값 → 앱 값 (빈칸은 null, 숫자 칸은 숫자, 글자 칸은 글자)
function normalize(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'saved_at') continue;
    if (v === '' || v == null) out[k] = TEXT.includes(k) && k === 'start_time' ? '' : null;
    else if (NUMERIC.includes(k)) out[k] = Number(v);
    else if (TEXT.includes(k)) out[k] = String(v);
    else out[k] = v;
  }
  return out;
}

export function readSheetConfig(storage = globalThis.localStorage) {
  try {
    const c = JSON.parse(storage.getItem(CONFIG_KEY));
    return c?.url ? c : null;
  } catch {
    return null;
  }
}
export function writeSheetConfig(config, storage = globalThis.localStorage) {
  if (config) {
    storage.setItem(CONFIG_KEY, JSON.stringify(config));
    storage.removeItem(OFF_KEY);
  } else {
    storage.removeItem(CONFIG_KEY);
    storage.setItem(OFF_KEY, '1');
  }
}

// 아직 연결한 적 없고 끊지도 않은 기기: 기본 주소로 자동 연결할 설정
export function autoSheetConfig(storage = globalThis.localStorage) {
  if (readSheetConfig(storage) || storage.getItem(OFF_KEY)) return null;
  return { url: DEFAULT_SHEET_URL };
}

export function createSheetClient({ url, token }, fetchImpl = globalThis.fetch) {
  const call = async (res) => {
    const body = await res.json();
    if (!body.ok) throw new Error(body.error === 'token' ? '비밀번호가 맞지 않아요.' : `시트 오류: ${body.error}`);
    return body;
  };
  return {
    async read() {
      return (await call(await fetchImpl(`${url}?action=read${token ? `&token=${encodeURIComponent(token)}` : ''}`))).data;
    },
    // Content-Type 을 붙이지 않아(text/plain) 브라우저 사전 요청 없이 Apps Script 로 보낸다
    async send(op) {
      await call(await fetchImpl(url, { method: 'POST', body: JSON.stringify(token ? { token, ...op } : op) }));
    },
  };
}

export function createSyncedStore(local, client, storage = globalThis.localStorage) {
  const status = { online: null, pending: 0, lastSync: null, error: null };
  const queue = () => { try { return JSON.parse(storage.getItem(PENDING_KEY)) ?? []; } catch { return []; } };
  const setQueue = (q) => { storage.setItem(PENDING_KEY, JSON.stringify(q)); status.pending = q.length; };
  const enqueue = (op) => setQueue([...queue(), op]);
  const real = (sessions) => sessions.filter((s) => s.source !== 'demo');

  async function flush() {
    let q = queue();
    while (q.length) {
      try {
        await client.send(q[0]);
      } catch (err) {
        status.online = false;
        status.error = err.message;
        return false;
      }
      q = q.slice(1);
      setQueue(q);
    }
    return true;
  }

  return {
    status,
    async load() {
      await flush();
      try {
        const data = await client.read();
        await local.importAll({
          sessions: data.sessions.map(normalize),
          laps: data.laps.map(normalize),
          settings: data.settings,
        });
        Object.assign(status, { online: true, lastSync: new Date(), error: null });
      } catch (err) {
        Object.assign(status, { online: false, error: err.message });
      }
      status.pending = queue().length;
      return local.load();
    },
    async addSessions(sessions, laps = []) {
      await local.addSessions(sessions, laps);
      const send = real(sessions);
      const ids = new Set(send.map((s) => s.id));
      if (send.length) enqueue({ action: 'addSessions', sessions: send, laps: laps.filter((l) => ids.has(l.session_id)) });
      await flush();
    },
    async updateSession(session) {
      await local.updateSession(session);
      if (session.source !== 'demo') enqueue({ action: 'updateSession', session });
      await flush();
    },
    async setLaps(sessionId, laps) {
      await local.setLaps(sessionId, laps);
      enqueue({ action: 'setLaps', session_id: sessionId, laps });
      await flush();
    },
    async deleteSessions(ids) {
      await local.deleteSessions(ids);
      enqueue({ action: 'deleteSessions', ids });
      await flush();
    },
    async saveSettings(patch) {
      await local.saveSettings(patch);
      enqueue({ action: 'saveSettings', patch });
      await flush();
    },
    exportAll: () => local.exportAll(),
    async importAll(data) {
      await local.importAll(data);
      enqueue({ action: 'replaceAll', sessions: real(data.sessions), laps: data.laps, settings: data.settings ?? {} });
      await flush();
    },
    // 처음 연결할 때: 휴대폰에만 있던 기록과 설정을 시트로 올린다 (같은 id 는 시트가 건너뛴다)
    async uploadLocal() {
      const db = await local.exportAll();
      const send = real(db.sessions);
      const ids = new Set(send.map((s) => s.id));
      if (send.length) enqueue({ action: 'addSessions', sessions: send, laps: db.laps.filter((l) => ids.has(l.session_id)) });
      if (Object.keys(db.settings ?? {}).length) enqueue({ action: 'saveSettings', patch: db.settings });
      return flush();
    },
  };
}
