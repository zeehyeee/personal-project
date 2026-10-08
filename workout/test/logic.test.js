import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streak, monthActiveDays } from '../src/streak.js';
import { inferDate, weekStart, weekOfMonth, weekDates } from '../src/dates.js';
import { weeklyBaseline, monthlyBaseline, diffTone, changeRate } from '../src/compare.js';
import { habitIndex } from '../src/habit.js';
import { findDuplicate } from '../src/duplicate.js';
import { parseClock } from '../src/format.js';

test('스트릭: 오늘 포함 연속 일수', () => {
  assert.deepEqual(streak(['2026-10-05', '2026-10-06', '2026-10-07'], '2026-10-07'), { days: 3, untilYesterday: false });
});

test('스트릭: 오늘 기록이 없으면 어제까지 N일', () => {
  assert.deepEqual(streak(['2026-10-04', '2026-10-05', '2026-10-06'], '2026-10-07'), { days: 3, untilYesterday: true });
});

test('스트릭: 어제도 없으면 0', () => {
  assert.deepEqual(streak(['2026-10-05'], '2026-10-07'), { days: 0, untilYesterday: false });
});

test('이번 달 운동일 수 (중복 날짜·다른 달 제외)', () => {
  assert.equal(monthActiveDays(['2026-09-30', '2026-10-01', '2026-10-01', '2026-10-06'], '2026-10-07'), 2);
});

test('연도 추정: 요일이 맞는 가장 최근 과거', () => {
  assert.deepEqual(inferDate(10, 6, '화', '2026-10-07'), { date: '2026-10-06', needsConfirm: false });
  // 연초에 받은 12월 캡처는 작년
  assert.deepEqual(inferDate(12, 30, '화', '2026-01-03'), { date: '2025-12-30', needsConfirm: false });
  // 요일이 안 맞으면 확인 요청
  assert.equal(inferDate(10, 6, '월', '2026-10-07').needsConfirm, true);
});

test('주는 일요일 시작, 1일이 든 행이 1주차', () => {
  assert.equal(weekStart('2026-10-07'), '2026-10-04');
  assert.equal(weekOfMonth('2026-10-01', 2026, 10), 1);
  assert.equal(weekOfMonth('2026-10-04', 2026, 10), 2);
  assert.equal(weekOfMonth('2026-09-29', 2026, 10), 1);
  assert.deepEqual(weekDates('2026-10-04').slice(0, 2), ['2026-10-04', '2026-10-05']);
});

test('평소 대비: 직전 4주 / 3개월 평균', () => {
  const byWeek = { '2026-09-27': 100, '2026-09-20': 80, '2026-09-13': 0, '2026-09-06': 60 };
  assert.equal(weeklyBaseline((from) => byWeek[from] ?? 0, '2026-10-04'), 60);
  const byMonth = { '2026-09': 30, '2026-08': 20, '2026-07': 10 };
  assert.equal(monthlyBaseline((m) => byMonth[m] ?? 0, '2026-10'), 20);
  assert.deepEqual(diffTone(72, 60), { diff: 12, tone: 'up' });
  assert.equal(diffTone(60, 60).tone, 'same');
  assert.equal(changeRate(120, 100), 0.2);
  assert.equal(changeRate(5, 0), null);
});

test('습관 지수: 각 항목 최대 1', () => {
  assert.equal(habitIndex({ activeDays: 5, sportCount: 4, minutes: 150 }), 100);
  assert.equal(habitIndex({ activeDays: 7, sportCount: 4, minutes: 400 }), 100);
  assert.equal(habitIndex({ activeDays: 3, sportCount: 2, minutes: 75 }), 30 + 10 + 15);
});

test('중복: 시작 시각이 있으면 시작 시각, 없으면 운동 시간 ±1분', () => {
  const existing = [
    { date: '2026-10-02', sport: 'run', start_time: '19:28', duration_sec: 1131 },
    { date: '2026-10-03', sport: 'walk', start_time: '', duration_sec: 1800 },
  ];
  assert.ok(findDuplicate({ date: '2026-10-02', sport: 'run', start_time: '19:28', duration_sec: 1 }, existing));
  assert.equal(findDuplicate({ date: '2026-10-02', sport: 'run', start_time: '20:00', duration_sec: 1131 }, existing), null);
  assert.ok(findDuplicate({ date: '2026-10-03', sport: 'walk', start_time: '08:00', duration_sec: 1840 }, existing));
  assert.equal(findDuplicate({ date: '2026-10-03', sport: 'walk', duration_sec: 1900 }, existing), null);
});

test('mm:ss 파싱', () => {
  assert.equal(parseClock('18:51'), 1131);
  assert.equal(parseClock('1:06:23'), 3983);
  assert.equal(parseClock('abc'), null);
});

test('종목별 운동량 표기 단위', async () => {
  const { sportAmount } = await import('../src/sports.js');
  assert.equal(sportAmount({ sport: 'walk', duration_sec: 1500 }), '25분');
  assert.equal(sportAmount({ sport: 'run', distance_m: 3490 }), '3.49km');
  assert.equal(sportAmount({ sport: 'bike', duration_sec: 1200, distance_m: 4300 }), '20분');
  assert.equal(sportAmount({ sport: 'swim', distance_m: 450 }), '450m');
});

test('월 캘린더 격자: 2026년 10월은 5주, 9/27 시작', async () => {
  const { monthGrid } = await import('../src/dates.js');
  const weeks = monthGrid(2026, 10);
  assert.equal(weeks.length, 5);
  assert.equal(weeks[0][0], '2026-09-27');
  assert.equal(weeks[4][6], '2026-10-31');
  // 2026년 2월은 일요일 시작, 28일 → 4주
  assert.equal(monthGrid(2026, 2).length, 4);
});

test('타일용 시간·거리 표기', async () => {
  const { formatMinutes, formatDistance } = await import('../src/format.js');
  assert.equal(formatMinutes(1891), '32분');
  assert.equal(formatMinutes(3983), '1시간 6분');
  assert.equal(formatMinutes(3600), '1시간');
  assert.equal(formatDistance('run', 3490), '3.49km');
  assert.equal(formatDistance('swim', 1025), '1,025m');
  assert.equal(formatDistance('walk', null), '');
});

test('주간 라벨: 토요일이 속한 달 기준', async () => {
  const { weekLabel } = await import('../src/dates.js');
  assert.deepEqual(weekLabel('2026-09-27'), { month: 10, week: 1, range: '09.27 ~ 10.03' });
  assert.deepEqual(weekLabel('2026-10-04'), { month: 10, week: 2, range: '10.04 ~ 10.10' });
  assert.deepEqual(weekLabel('2026-09-20'), { month: 9, week: 4, range: '09.20 ~ 09.26' });
});
