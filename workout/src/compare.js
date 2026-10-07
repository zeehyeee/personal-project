// 평소 대비: 주간은 직전 4주 평균, 월간은 직전 3개월 평균 (명세 3-5)
import { addDays, addMonths } from './dates.js';

// metric(fromDate, toDate) → 숫자. toDate 포함.
export function weeklyBaseline(metric, weekStartStr, weeks = 4) {
  let total = 0;
  for (let i = 1; i <= weeks; i++) {
    const start = addDays(weekStartStr, -7 * i);
    total += metric(start, addDays(start, 6));
  }
  return total / weeks;
}

// metric(monthKey) → 숫자
export function monthlyBaseline(metric, monthKeyStr, months = 3) {
  let total = 0;
  for (let i = 1; i <= months; i++) total += metric(addMonths(monthKeyStr, -i));
  return total / months;
}

export function diffTone(current, baseline) {
  const diff = current - baseline;
  return { diff, tone: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same' };
}

// 직전 기간 대비 증감률. 이전 값이 0이면 비율을 내지 않는다.
export function changeRate(current, previous) {
  return previous ? (current - previous) / previous : null;
}
