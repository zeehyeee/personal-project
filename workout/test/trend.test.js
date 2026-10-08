import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSeries, changeFromPrevious, monthSummary, formatAmount, periods } from '../src/trend.js';
import { groupByDay } from '../src/aggregate.js';
import { demoData } from '../src/demo.js';

const days = groupByDay(demoData().sessions);
const today = '2026-10-08';

test('기간 개수와 끝: 일별 56일(오늘까지), 주별 12주, 월별 12개월', () => {
  assert.equal(periods('day', today).length, 56);
  assert.equal(periods('day', today).at(-1).key, today);
  assert.equal(periods('week', today).at(-1).start, '2026-10-04');
  assert.equal(periods('month', today).at(-1).key, '2026-10');
  assert.equal(periods('month', today)[0].key, '2025-11');
});

test('일별 달리기: 10/2 3세션 합산 3.49km, 평균은 기록 있는 날 기준', () => {
  const s = buildSeries(days, 'run', 'day', today);
  const bar = s.bars.find((b) => b.key === '2026-10-02');
  assert.equal(Math.round(bar.value * 100) / 100, 3.49);
  assert.equal(bar.sessions, 3);
  assert.equal(Math.round(s.average * 100) / 100, 3.49);
  assert.equal(s.unit, 'km');
});

test('전체: 모든 종목 운동 시간(분) 합', () => {
  const s = buildSeries(days, 'all', 'day', today);
  const d6 = s.bars.find((b) => b.key === '2026-10-06');
  assert.equal(Math.round(d6.value), Math.round((3983 + 1526 + 706) / 60));
  // 종목별로 나눈 값의 합 = 전체
  assert.equal(Math.round(d6.parts.swim + d6.parts.walk + d6.parts.bike), Math.round(d6.value));
  assert.equal(d6.parts.run, 0);
});

test('주별: 이번 주와 직전 주 대비', () => {
  const s = buildSeries(days, 'all', 'week', today);
  const last = s.bars.length - 1;
  assert.equal(s.bars[last].activeDays, 1); // 10/4~10/10 중 10/6
  assert.equal(s.bars[last - 1].activeDays, 1); // 9/27~10/3 중 10/2
  assert.ok(changeFromPrevious(s.bars, last) > 0);
});

test('이번 달 요약', () => {
  const m = monthSummary(days, 'swim', today);
  assert.equal(m.value, 450);
  assert.equal(m.activeDays, 1);
  assert.equal(m.change, null); // 9월 기록 없음
});

test('표기', () => {
  assert.equal(formatAmount(3.49, 'km'), '3.49km');
  assert.equal(formatAmount(1025, 'm'), '1,025m');
  assert.equal(formatAmount(103.6, '분'), '1시간 44분');
  assert.equal(formatAmount(25.4, '분'), '25분');
});
