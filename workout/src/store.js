// 데이터 저장소. 지금은 브라우저 localStorage, 나중에 Google Sheets 로 바꾼다.
// 화면 코드는 이 인터페이스(load / addSessions / deleteSessions / saveSettings)만 쓴다.
// Sheets 로 바꿔도 같은 모양을 유지하도록 모든 메서드는 Promise 를 돌려준다.
import { DEFAULT_SETTINGS } from './sports.js';
import { demoData } from './demo.js';

const KEY = 'workout-log:v1';
// 예시 데이터를 바꿀 때 올린다 (2: 실제 기록으로 교체, 3: 운동 강도 추가)
const DEMO_VERSION = 3;

export function createLocalStore(storage = globalThis.localStorage) {
  const read = () => {
    try {
      const raw = storage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // 손상된 값이면 새로 시작한다
    }
    return null;
  };
  const write = (db) => storage.setItem(KEY, JSON.stringify(db));

  const current = () => {
    let db = read();
    if (!db) {
      // 처음 열면 예시 데이터를 넣어 화면을 확인할 수 있게 한다
      db = { ...demoData(), settings: {}, demoVersion: DEMO_VERSION };
      write(db);
    } else if (db.demoVersion !== DEMO_VERSION && db.sessions.some((x) => x.source === 'demo')) {
      // 예전 예시 데이터는 새 예시로 바꾼다. 직접 입력·캡처 기록은 그대로 둔다
      const old = new Set(db.sessions.filter((x) => x.source === 'demo').map((x) => x.id));
      const demo = demoData();
      db.sessions = [...db.sessions.filter((x) => !old.has(x.id)), ...demo.sessions];
      db.laps = [...db.laps.filter((l) => !old.has(l.session_id)), ...demo.laps];
      db.demoVersion = DEMO_VERSION;
      write(db);
    }
    return db;
  };

  return {
    async load() {
      const db = current();
      return {
        sessions: db.sessions,
        laps: db.laps,
        settings: { ...DEFAULT_SETTINGS, ...db.settings },
      };
    },
    async addSessions(sessions, laps = []) {
      const db = current();
      db.sessions.push(...sessions);
      db.laps.push(...laps);
      write(db);
    },
    async deleteSessions(ids) {
      const drop = new Set(ids);
      const db = current();
      db.sessions = db.sessions.filter((s) => !drop.has(s.id));
      db.laps = db.laps.filter((l) => !drop.has(l.session_id));
      write(db);
    },
    // 백업: 시트 연동 전까지 휴대폰 브라우저에만 있으니 파일로 보관할 수 있게
    async exportAll() {
      const db = current();
      return { app: 'workout-log', version: 1, exported_at: new Date().toISOString(), sessions: db.sessions, laps: db.laps, settings: db.settings };
    },
    async importAll(data) {
      if (!data || !Array.isArray(data.sessions) || !Array.isArray(data.laps)) throw new Error('운동 기록 백업 파일이 아니에요.');
      write({ sessions: data.sessions, laps: data.laps, settings: data.settings ?? {}, demoVersion: DEMO_VERSION });
    },
    async saveSettings(patch) {
      const db = current();
      db.settings = { ...db.settings, ...patch };
      write(db);
    },
  };
}

export function hasDemo(sessions) {
  return sessions.some((s) => s.source === 'demo');
}

export function demoIds(sessions) {
  return sessions.filter((s) => s.source === 'demo').map((s) => s.id);
}
