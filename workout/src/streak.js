// 스트릭: 하루에 어떤 종목이든 기록이 1개 이상 있으면 운동한 날이다.
import { addDays, monthKey } from './dates.js';

export function streak(activeDates, todayStr) {
  const set = new Set(activeDates);
  const countFrom = (start) => {
    let n = 0;
    for (let d = start; set.has(d); d = addDays(d, -1)) n++;
    return n;
  };
  if (set.has(todayStr)) return { days: countFrom(todayStr), untilYesterday: false };
  const yesterday = addDays(todayStr, -1);
  // 오늘 기록이 아직 없으면 끊지 않고 `어제까지 N일`로 보여준다.
  if (set.has(yesterday)) return { days: countFrom(yesterday), untilYesterday: true };
  return { days: 0, untilYesterday: false };
}

export function monthActiveDays(activeDates, todayStr) {
  const month = monthKey(todayStr);
  return new Set(activeDates.filter((d) => monthKey(d) === month && d <= todayStr)).size;
}
