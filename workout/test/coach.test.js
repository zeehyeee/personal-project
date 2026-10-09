import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayCoach } from '../src/coach.js';
import { monthGoals } from '../src/goals.js';
import { growthSeries } from '../src/growth.js';
import { formFromSession, applyEdit, buildManualSession } from '../src/manual.js';
import { groupByDay, groupLapsBySession } from '../src/aggregate.js';
import { demoData } from '../src/demo.js';
import { DEFAULT_SETTINGS } from '../src/sports.js';

const s = (date, sport, min, extra = {}) => ({ id: `${date}${sport}`, date, sport, duration_sec: min * 60, distance_m: null, ...extra });
const daysOf = (list) => groupByDay(list);

test('오늘 카드: 기록이 하나도 없으면 첫 운동 안내', () => {
  const c = todayCoach({}, '2026-10-08');
  assert.equal(c.mood, 'hello');
  assert.equal(c.week.days, 0);
});

test('오늘 카드: 오늘 운동했으면 완료 + 이번 주 진행', () => {
  const c = todayCoach(daysOf([s('2026-10-05', 'walk', 30), s('2026-10-06', 'walk', 30)]), '2026-10-06');
  assert.equal(c.mood, 'happy');
  assert.match(c.text, /오늘 걷기 끝! 이번 주 2\/5일/);
  assert.deepEqual(c.week, { days: 2, daysGoal: 5, minutes: 60, minutesGoal: 150 });
});

test('오늘 카드: 어제까지 연속이면 연속 기록 지키기', () => {
  const c = todayCoach(daysOf([s('2026-10-05', 'walk', 30), s('2026-10-06', 'run', 20)]), '2026-10-07');
  assert.match(c.text, /2일 연속 중.*3일로 이어져요/);
  assert.equal(c.streak, 2);
});

test('오늘 카드: 남은 날을 매일 해야 주 목표면 알려준다', () => {
  // 10/8(목) 기준 남은 날 목~토 3일, 이번 주 2일 → 목표 5일까지 3일
  const c = todayCoach(daysOf([s('2026-10-04', 'walk', 30), s('2026-10-06', 'walk', 30)]), '2026-10-08');
  assert.match(c.text, /목표까지 3일 남았어요/);
});

test('오늘 카드: 수영 5일 이상 쉬었으면 수영 권유', () => {
  const c = todayCoach(daysOf([s('2026-10-01', 'swim', 40)]), '2026-10-06', { ...DEFAULT_SETTINGS, weekly_active_days_goal: 3 });
  assert.equal(c.mood, 'swim');
  assert.match(c.text, /수영 5일 쉬었어요/);
});

test('오늘 카드: 주 시간 목표까지 남은 분을 남은 날로 나눈다', () => {
  // 10/9(금): 남은 날 금·토 2일, 이번 주 60분 → 90분 남음, 하루 45분
  const days = daysOf([s('2026-10-05', 'walk', 30), s('2026-10-06', 'walk', 30), s('2026-10-04', 'walk', 0.5)]);
  const c = todayCoach(days, '2026-10-09', { ...DEFAULT_SETTINGS, weekly_active_days_goal: 3 });
  assert.match(c.text, /오늘 45분이면/);
});

test('이번 달 목표: 종목별 횟수·달성·남은 페이스', () => {
  const days = daysOf([s('2026-10-02', 'run', 20), s('2026-10-06', 'run', 20), s('2026-10-06', 'swim', 40)]);
  const g = monthGoals(days, '2026-10-08', { ...DEFAULT_SETTINGS, monthly_count_goal_swim: 1 });
  const by = Object.fromEntries(g.sports.map((r) => [r.key, r]));
  assert.equal(g.daysLeft, 24);
  assert.equal(by.swim.done, true);
  assert.equal(by.swim.hint, '달성');
  assert.equal(by.run.count, 2);
  assert.equal(by.run.hint, '주 2회면 달성'); // 6회 남음 ÷ (24일/7)
  assert.equal(g.active.count, 2);
  assert.equal(g.sports[0].key, 'swim'); // 수영 > 달리기 > 걷기 > 자전거
});

test('이번 달 목표: 남은 날보다 많이 남으면 어렵다고', () => {
  const g = monthGoals({}, '2026-10-30', { ...DEFAULT_SETTINGS, monthly_count_goal_walk: 5 });
  assert.equal(g.sports.find((r) => r.key === 'walk').hint, '이번 달은 어려워요');
});

test('성장 그래프: 수영 100m 페이스는 낮을수록 좋음, 처음보다 빨라짐', () => {
  const { sessions, laps } = demoData();
  const later = { ...sessions.find((x) => x.sport === 'swim'), id: 'later', date: '2026-10-08' };
  const fast = laps.filter((l) => l.session_id === 'demo-s1006').map((l) => ({ ...l, session_id: 'later', time_sec: l.time_sec - 5 }));
  const days = groupByDay([...sessions, later], groupLapsBySession([...laps, ...fast]));
  const g = growthSeries(days, 'swim', 'swimPace');
  assert.equal(g.points.length, 2);
  assert.equal(g.best.date, '2026-10-08');
  assert.equal(g.summary.better, true);
  assert.match(g.summary.text, /^10월 6일보다 \d+초 빨라졌어요$/);
});

test('성장 그래프: 기록 1개면 요약 없음, 없는 지표는 null', () => {
  const days = groupByDay(demoData().sessions);
  assert.equal(growthSeries(days, 'run', 'distance').summary, null);
  assert.equal(growthSeries(days, 'run', 'nope'), null);
  assert.equal(growthSeries(days, 'run', 'longest').points[0].value, 1131);
});

test('기록 수정: 저장된 기록 → 폼 → 다시 저장하면 같은 값, 출처·메모 유지', () => {
  const orig = { ...demoData().sessions[0], source: 'capture', condition: 'good', memo: '비 옴', zone_low_min: 2 };
  const form = formFromSession(orig);
  assert.equal(form.distance, '2.03');
  assert.equal(form.m, '18');
  assert.equal(form.s, '51');
  const { session } = buildManualSession(form, DEFAULT_SETTINGS, form.editId);
  const merged = applyEdit(orig, session);
  for (const k of ['date', 'start_time', 'duration_sec', 'distance_m', 'kcal', 'avg_hr', 'avg_cadence', 'zone_high_min', 'zone_low_min']) assert.equal(merged[k], orig[k], k);
  assert.equal(merged.source, 'capture');
  assert.equal(merged.memo, '비 옴');
});
