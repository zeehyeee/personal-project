import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateSessions, groupByDay, groupLapsBySession } from '../src/aggregate.js';
import { formatDuration, formatPace } from '../src/format.js';
import { run1002, swim1006Laps, swim1006Session } from './fixtures.js';

test('달리기 3세션 합산: 31분 31초, 3.49km, 9\'02"/km', () => {
  const day = aggregateSessions(run1002);
  assert.equal(day.sessionCount, 3);
  assert.equal(formatDuration(day.duration_sec), '31분 31초');
  assert.equal(day.distance_m, 3490);
  assert.equal(formatPace(day.pace_sec_per_km), `9'02"`);
  assert.equal(day.kcal, 240);
});

test('심박수는 값이 있는 세션만 운동 시간 가중 평균', () => {
  const day = aggregateSessions(run1002);
  const expected = (150 * 1131 + 140 * 479) / (1131 + 479);
  assert.ok(Math.abs(day.avg_hr - expected) < 1e-9);
});

test('페이스는 거리가 없는 세션을 빼고 계산', () => {
  const day = aggregateSessions([
    { id: 'a', date: '2026-10-02', sport: 'walk', duration_sec: 600, distance_m: 1000 },
    { id: 'b', date: '2026-10-02', sport: 'walk', duration_sec: 300, distance_m: null },
  ]);
  assert.equal(day.duration_sec, 900);
  assert.equal(day.pace_sec_per_km, 600);
});

test('자전거 평균 속도 = 총 거리 ÷ 총 시간', () => {
  const day = aggregateSessions([
    { id: 'a', date: '2026-10-06', sport: 'bike', duration_sec: 1800, distance_m: 6000 },
    { id: 'b', date: '2026-10-06', sport: 'bike', duration_sec: 1800, distance_m: 9000 },
  ]);
  assert.equal(day.speed_kmh, 15);
});

test('가장 긴 한 세션, 쉬지 않고 이어 수영한 구간 수', () => {
  assert.equal(aggregateSessions(run1002).longest_session_sec, 1131);
  const swim = aggregateSessions([swim1006Session], groupLapsBySession(swim1006Laps));
  assert.equal(swim.swim.maxContinuousLaps, 8); // 구간 2~9 (1·10은 휴식)
});

test('운동 강도: 기록 있는 세션만 기준', () => {
  const day = aggregateSessions([{ ...run1002[0], zone_high_min: 12, zone_max_min: 6 }, run1002[1]]);
  assert.equal(day.zone_high_min, 12);
  assert.equal(day.zone_mid_min, null);
  assert.equal(day.zone_duration_sec, 1131);
  assert.equal(day.zone_sessions, 1);
});

test('groupByDay는 날짜·종목별로 묶는다', () => {
  const days = groupByDay(
    [...run1002, swim1006Session],
    groupLapsBySession(swim1006Laps),
  );
  assert.equal(days['2026-10-02'].run.sessionCount, 3);
  assert.equal(days['2026-10-06'].swim.swim.lapStats.lapCount, 18);
});

test('하루 수영 여러 번: 휴식은 세션별 중앙값으로 판정하고 구간 전체로 다시 계산', () => {
  const second = { ...swim1006Session, id: 's2' };
  const secondLaps = [
    { session_id: 's2', lap_no: 1, stroke: 'freestyle', time_sec: 40, strokes: 4 },
    { session_id: 's2', lap_no: 2, stroke: 'freestyle', time_sec: 40, strokes: 4 },
  ];
  const day = aggregateSessions(
    [swim1006Session, second],
    groupLapsBySession([...swim1006Laps, ...secondLaps]),
  );
  const s = day.swim.lapStats;
  assert.equal(s.lapCount, 20);
  assert.equal(s.restExcluded, 4);
  // 휴식 제외 16구간: 700초 + 80초
  assert.equal(formatPace(s.pacePer100Sec), formatPace((780 / 16) * 4));
});
