import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weeklyReport, rangeStats, weekHabit } from '../src/report.js';
import { groupByDay, groupLapsBySession } from '../src/aggregate.js';
import { demoData } from '../src/demo.js';

const demo = demoData();
const days = groupByDay(demo.sessions, groupLapsBySession(demo.laps));
const today = '2026-10-08';

test('10월 2주차(10/4~10/10): 수영 비중, 통계, 종목별', () => {
  const r = weeklyReport(days, '2026-10-04', today);
  assert.equal(r.label.week, 2);
  assert.equal(r.headline, '수영 비중이 높았던 한 주');
  assert.equal(r.stats[1].value, '1/7일');
  assert.equal(r.sports.map((s) => s.sport).join(), 'swim,walk,bike');
  assert.equal(r.strip.find((d) => d.date === '2026-10-06').level, 'some');
  // 직전 4주에 10/2 달리기 하루 → 평소 활동일 0.25
  assert.equal(r.stats[1].diffLabel, '평소보다 +0.8일');
});

test('평소 기록이 없으면 안내', () => {
  const r = weeklyReport(days, '2026-09-27', today);
  assert.equal(r.stats[0].diffLabel, '평소 기록이 아직 없어요');
});

test('습관 지수: 6주, 이번 주 점수', () => {
  const r = weeklyReport(days, '2026-10-04', today);
  assert.equal(r.habit.length, 6);
  // 1일/5일×50 + 3종목/4×20 + (66+25+12분=103분)/150×30
  const mins = (3983 + 1526 + 706) / 60;
  assert.equal(r.score, Math.round(0.2 * 50 + 0.75 * 20 + (mins / 150) * 30));
  assert.equal(weekHabit(days, '2026-09-27'), r.habit[4].score);
});

test('인사이트: 처음 생긴 종목, 첫 운동 안내', () => {
  const r = weeklyReport(days, '2026-10-04', today);
  assert.ok(r.insights.some((i) => i.text === '수영·걷기·자전거 기록이 처음 생겼어요.'));
  assert.ok(r.insights.length <= 4);
  const empty = weeklyReport(days, '2026-09-20', today);
  assert.equal(empty.headline, '쉬어간 한 주');
  assert.ok(empty.insights[0].text.includes('첫 운동'));
});

test('인사이트: 스트로크 감소, 새 영법, 쉬지 않고 이어 수영, 쉬지 않고 달리기', () => {
  // 지난주 수영(자유형만, 구간당 7스트로크, 연속 3구간) → 이번 주 10/6 실제 기록
  const s = [
    ...demo.sessions,
    { id: 'p', date: '2026-09-29', sport: 'swim', duration_sec: 1200, distance_m: 100, source: 'manual' },
    { id: 'r0', date: '2026-09-22', sport: 'run', duration_sec: 600, distance_m: 1000, source: 'manual' },
  ];
  const prevLaps = [1, 2, 3, 4].map((n) => ({ session_id: 'p', lap_no: n, stroke: 'freestyle', time_sec: n === 4 ? 300 : 50, strokes: 7 }));
  const d = groupByDay(s, groupLapsBySession([...demo.laps, ...prevLaps]));
  const text = weeklyReport(d, '2026-10-04', today).insights.map((i) => i.text).join('\n');
  assert.match(text, /배영을 새로 시작했어요/);
  assert.match(text, /자유형 구간당 스트로크가 7\.0 → 5\.5로 줄었어요/);
  assert.match(text, /처음으로 8구간을 쉬지 않고 수영했어요/);
  const runText = weeklyReport(d, '2026-09-27', today).insights.map((i) => i.text).join('\n');
  assert.match(runText, /한 번에 19분 동안 쉬지 않고 달렸어요/);
});

test('기간 합계', () => {
  const r = rangeStats(days, '2026-10-02', '2026-10-02');
  assert.equal(r.distance_m, 3490);
  assert.equal(r.activeDays, 1);
});

test('조사: 을/를', async () => {
  const days2 = groupByDay([
    { id: 'a', date: '2026-08-01', sport: 'run', duration_sec: 600, source: 'manual' },
    { id: 'b', date: '2026-10-05', sport: 'run', duration_sec: 600, source: 'manual' },
  ]);
  const t = weeklyReport(days2, '2026-10-04', today).insights.map((i) => i.text).join();
  assert.match(t, /오랜만에 달리기를 했어요/);
});
