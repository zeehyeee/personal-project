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
const TEXT = ['id', 'date', 'start_time', 'sport', 'source', 'session_id', 'stroke', 'condition', 'memo', 'gear'];

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

// 대기 중인 변경 합치기: 같은 기록을 여러 번 고치면 마지막 상태만 한 번 보낸다
// - 기록 수정: 아직 안 보낸 '추가'에 들어 있으면 그 안의 기록을 바꾸고, 아니면 앞선 같은 기록 수정을 지운다
// - 구간 바꾸기: 아직 안 보낸 '추가'에 들어 있으면 그 구간을 바꾸고, 아니면 앞선 같은 세션 구간 바꾸기를 지운다
// - 설정: 앞선 설정 저장에 합친다
export function coalesce(queue, op, sendingSeq = null) {
  const waiting = (o) => o.seq == null || o.seq !== sendingSeq;
  const q = [...queue];
  const addIdx = (id) => q.findIndex((o) => waiting(o) && o.action === 'addSessions' && o.sessions.some((s) => s.id === id));
  if (op.action === 'updateSession') {
    const i = addIdx(op.session.id);
    if (i >= 0) {
      q[i] = { ...q[i], sessions: q[i].sessions.map((s) => (s.id === op.session.id ? op.session : s)) };
      return q;
    }
    return [...q.filter((o) => !(waiting(o) && o.action === 'updateSession' && o.session.id === op.session.id)), op];
  }
  if (op.action === 'setLaps') {
    const i = addIdx(op.session_id);
    if (i >= 0) {
      q[i] = { ...q[i], laps: [...q[i].laps.filter((l) => l.session_id !== op.session_id), ...op.laps] };
      return q;
    }
    return [...q.filter((o) => !(waiting(o) && o.action === 'setLaps' && o.session_id === op.session_id)), op];
  }
  if (op.action === 'saveSettings') {
    const i = q.findLastIndex((o) => waiting(o) && o.action === 'saveSettings');
    if (i >= 0) {
      q[i] = { ...q[i], patch: { ...q[i].patch, ...op.patch } };
      return q;
    }
  }
  return [...q, op];
}

export function createSyncedStore(local, client, storage = globalThis.localStorage) {
  const status = { online: null, pending: 0, lastSync: null, error: null };
  const queue = () => { try { return JSON.parse(storage.getItem(PENDING_KEY)) ?? []; } catch { return []; } };
  const setQueue = (q) => { storage.setItem(PENDING_KEY, JSON.stringify(q)); status.pending = q.length; };
  // 보내는 중인 변경(맨 앞)은 건드리지 않고, 아직 대기 중인 변경끼리는 합친다
  let sending = null; // 지금 보내는 변경의 seq
  const enqueue = (op) => setQueue(coalesce(queue(), { ...op, seq: Date.now() + Math.random() }, sending));
  const real = (sessions) => sessions.filter((s) => s.source !== 'demo');

  // 보내기는 한 번에 하나만 (겹치면 같은 변경을 두 번 보낸다). 보내는 중에 쌓인 변경도 이어서 보낸다
  let flushing = null;
  async function sendAll() {
    let q;
    while ((q = queue()).length) {
      const op = q[0];
      sending = op.seq ?? null;
      try {
        await client.send(op);
      } catch (err) {
        status.online = false;
        status.error = err.message;
        return false;
      } finally {
        sending = null;
      }
      // 보낸 것만 뺀다 (보내는 동안 뒤에 쌓이거나 합쳐진 변경은 그대로)
      const rest = queue();
      setQueue(op.seq != null ? rest.filter((o) => o.seq !== op.seq) : rest.slice(1));
    }
    status.online = true;
    status.error = null;
    return true;
  }
  const flush = () => (flushing ??= sendAll().finally(() => { flushing = null; }));

  return {
    status,
    // 휴대폰 사본만 바로 읽기 (고친 뒤 화면을 즉시 다시 그릴 때. 시트는 뒤에서 맞춘다)
    snapshot: () => local.load(),
    // 뒤에서 보내는 중인 변경이 끝날 때까지 기다리기 (테스트·연결 끊기 전)
    settle: () => flush(),
    async load() {
      // 아직 시트로 못 보낸 변경이 있으면 시트 내용으로 덮지 않는다 (덮으면 방금 고친 것이 되돌아간다)
      if (!(await flush())) {
        status.pending = queue().length;
        return local.load();
      }
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
      flush();
    },
    async updateSession(session) {
      await local.updateSession(session);
      if (session.source !== 'demo') enqueue({ action: 'updateSession', session });
      flush();
    },
    async setLaps(sessionId, laps) {
      await local.setLaps(sessionId, laps);
      enqueue({ action: 'setLaps', session_id: sessionId, laps });
      flush();
    },
    async deleteSessions(ids) {
      await local.deleteSessions(ids);
      enqueue({ action: 'deleteSessions', ids });
      flush();
    },
    async saveSettings(patch) {
      await local.saveSettings(patch);
      enqueue({ action: 'saveSettings', patch });
      flush();
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
