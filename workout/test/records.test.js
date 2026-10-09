import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordsOn, bestRecords } from '../src/records.js';
import { groupByDay, groupLapsBySession } from '../src/aggregate.js';
import { demoData } from '../src/demo.js';

const demo = demoData();
const extra = [
  { id: 'r-old', date: '2026-09-20', sport: 'run', duration_sec: 900, distance_m: 2000, source: 'manual' },
  { id: 'r-short', date: '2026-09-25', sport: 'run', duration_sec: 120, distance_m: 600, source: 'manual' }, // 1km 미만: 페이스 비교 제외
  { id: 's-old', date: '2026-09-29', sport: 'swim', duration_sec: 1800, distance_m: 300, source: 'manual' },
];
const oldLaps = Array.from({ length: 8 }, (_, i) => ({ session_id: 's-old', lap_no: i + 1, stroke: 'freestyle', time_sec: 60, strokes: 7 }));
const days = groupByDay([...demo.sessions, ...extra], groupLapsBySession([...demo.laps, ...oldLaps]));

test('처음 기록은 신기록이 아니다', () => {
  const only = groupByDay(demo.sessions, groupLapsBySession(demo.laps));
  assert.deepEqual(recordsOn(only, 'swim', '2026-10-06'), []);
});

test('달리기 10/2: 최장 거리·최장 시간 신기록, 페이스는 이전(7분30초/km)보다 느려 아님', () => {
  const r = recordsOn(days, 'run', '2026-10-02');
  assert.deepEqual(r.map((x) => x.key), ['distance', 'duration']);
  assert.equal(r[0].text, '3.49km');
  assert.equal(r[0].previous, '2.00km');
});

test('수영 10/6: 최장 거리·최장 시간·최저 SWOLF(55.7 < 67) 신기록', () => {
  const r = recordsOn(days, 'swim', '2026-10-06');
  assert.deepEqual(r.map((x) => x.key), ['distance', 'duration', 'swolf']);
});

test('역대 최고 기록', () => {
  const b = bestRecords(days, 'run');
  assert.equal(b.find((x) => x.key === 'distance').date, '2026-10-02');
  assert.equal(b.find((x) => x.key === 'pace').date, '2026-09-20');
});

test('오리발 낀 날은 페이스·SWOLF 신기록·비교에서 빠진다 (거리·시간은 그대로)', async () => {
  const { groupByDay, groupLapsBySession } = await import('../src/aggregate.js');
  const { demoData } = await import('../src/demo.js');
  const { sessions, laps } = demoData();
  const swim = sessions.find((x) => x.sport === 'swim');
  const later = { ...swim, id: 'f', date: '2026-10-08', distance_m: 500, gear: 'fins' };
  const fast = laps.filter((l) => l.session_id === swim.id).map((l) => ({ ...l, session_id: 'f', time_sec: l.time_sec - 10, strokes: 3 }));
  const d = groupByDay([...sessions, later], groupLapsBySession([...laps, ...fast]));
  assert.equal(d['2026-10-08'].swim.fins, true);
  assert.deepEqual(recordsOn(d, 'swim', '2026-10-08').map((r) => r.key), ['distance']);
});
