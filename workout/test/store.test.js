import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLocalStore, demoIds } from '../src/store.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
}

test('처음 열면 예시 데이터와 기본 설정', async () => {
  const store = createLocalStore(memoryStorage());
  const db = await store.load();
  assert.ok(db.sessions.length > 0);
  assert.equal(db.laps.length, 18);
  assert.equal(db.settings.pool_length_m, 25);
});

test('추가·삭제·설정 저장', async () => {
  const storage = memoryStorage();
  const store = createLocalStore(storage);
  let db = await store.load();
  await store.deleteSessions(demoIds(db.sessions));
  db = await store.load();
  assert.equal(db.sessions.length, 0);
  assert.equal(db.laps.length, 0);

  await store.addSessions([{ id: 'x', date: '2026-10-07', sport: 'walk', duration_sec: 600, source: 'manual' }]);
  await store.saveSettings({ weekly_minutes_goal: 200 });
  db = await createLocalStore(storage).load();
  assert.equal(db.sessions.length, 1);
  assert.equal(db.settings.weekly_minutes_goal, 200);
  assert.equal(db.settings.weekly_active_days_goal, 5);
});

test('손상된 저장값이면 새로 시작', async () => {
  const storage = memoryStorage();
  storage.setItem('workout-log:v1', '{not json');
  const db = await createLocalStore(storage).load();
  assert.ok(db.sessions.length > 0);
});

test('예전 예시 데이터는 새 예시로 바꾸고 내 기록은 남긴다', async () => {
  const storage = memoryStorage();
  storage.setItem('workout-log:v1', JSON.stringify({
    sessions: [
      { id: 'demo-w1003', date: '2026-10-03', sport: 'walk', duration_sec: 2400, source: 'demo' },
      { id: 'demo-s1006', date: '2026-10-06', sport: 'swim', duration_sec: 3983, source: 'demo' },
      { id: 'mine', date: '2026-10-08', sport: 'run', duration_sec: 600, source: 'manual' },
    ],
    laps: [{ session_id: 'demo-s1006', lap_no: 1, time_sec: 999 }],
    settings: { weekly_minutes_goal: 200 },
  }));
  const db = await createLocalStore(storage).load();
  assert.equal(db.sessions.some((x) => x.id === 'demo-w1003'), false);
  assert.ok(db.sessions.some((x) => x.id === 'mine'));
  assert.ok(db.sessions.some((x) => x.id === 'demo-s1006'));
  assert.equal(db.laps.length, 18); // 예전 예시 구간은 지우고 새 실제 구간 18개
  assert.equal(db.laps.find((l) => l.lap_no === 1).time_sec, 564);
  assert.equal(db.settings.weekly_minutes_goal, 200);
});
