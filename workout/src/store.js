// 데이터 저장소. 지금은 브라우저 localStorage, 나중에 Google Sheets 로 바꾼다.
// 화면 코드는 이 인터페이스(load / addSessions / deleteSessions / saveSettings)만 쓴다.
// Sheets 로 바꿔도 같은 모양을 유지하도록 모든 메서드는 Promise 를 돌려준다.
import { DEFAULT_SETTINGS } from './sports.js';
import { demoData } from './demo.js';

const KEY = 'workout-log:v1';

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
      db = { ...demoData(), settings: {} };
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
