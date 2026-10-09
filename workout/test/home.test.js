import { test } from 'node:test';
import assert from 'node:assert/strict';
import { homeCard, suggestion, swimRate } from '../src/home.js';
import { groupByDay } from '../src/aggregate.js';

const s = (date, sport, min, extra = {}) => ({ id: `${date}${sport}${min}`, date, sport, duration_sec: min * 60, distance_m: null, ...extra });

test('새 주: 지난주 기록이 있으면 리포트 도착, 열어 보면 지난주 이맘때 비교로', () => {
  const days = groupByDay([s('2026-10-02', 'run', 30), s('2026-10-04', 'walk', 20), s('2026-10-06', 'walk', 40)]);
  const a = homeCard(days, '2026-10-06');
  assert.equal(a.kind, 'report');
  assert.equal(a.week, '2026-09-27');
  const b = homeCard(days, '2026-10-06', { seenWeek: '2026-09-27' });
  assert.equal(b.kind, 'pace');
  // 이번 주 일~화 60분 vs 지난주 일~화 0분
  assert.equal(b.title, '지난주 이맘때보다 +1시간');
  assert.equal(b.sub, '운동일 0일 → 2일');
  assert.equal(b.tone, 'up');
});

test('제안: 수영 분당 거리가 평소보다 10% 넘게 늘면 칭찬 (실제 기록: 10/3 14.7m)', () => {
  const days = groupByDay([
    s('2026-09-27', 'swim', 64.8, { distance_m: 675 }),
    s('2026-09-29', 'swim', 42.8, { distance_m: 400 }),
    s('2026-10-03', 'swim', 69.8, { distance_m: 1025 }),
  ]);
  assert.equal(swimRate(days['2026-10-03'].swim).toFixed(1), '14.7');
  assert.match(suggestion(days, '2026-10-04'), /수영 분당 14\.7m로 평소\(9\.9m\)보다/);
});

test('제안: 최근 2주 달리기가 60% 넘게 고강도면 천천히 오래 (실제 기록 9/28·10/1)', () => {
  const days = groupByDay([
    s('2026-09-28', 'run', 26.4, { zone_max_min: 11, zone_high_min: 15, zone_mid_min: 2 }),
    s('2026-10-01', 'run', 25.7, { zone_max_min: 5, zone_high_min: 14, zone_mid_min: 1 }),
  ]);
  assert.match(suggestion(days, '2026-10-02'), /최근 달리기의 \d+%가 고강도예요/);
});

test('제안: 수영 4일 이상 쉬면 권유, 기록이 없으면 null', () => {
  assert.match(suggestion(groupByDay([s('2026-10-01', 'swim', 40, { distance_m: 500 })]), '2026-10-06'), /수영한 지 5일/);
  assert.equal(suggestion({}, '2026-10-06'), null);
});
