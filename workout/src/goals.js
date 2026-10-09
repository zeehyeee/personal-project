// 이번 달 목표 표 (바다네 곳간의 월 목표·달성 뱃지 방식): 종목별 횟수 + 운동일, 남은 기간에 필요한 페이스
import { SPORTS, DEFAULT_SETTINGS } from './sports.js';
import { addDays, monthKey, parseDate } from './dates.js';

function hint(count, goal, daysLeft) {
  if (count >= goal) return '달성';
  const need = goal - count;
  if (need > daysLeft) return '이번 달은 어려워요';
  const weeks = daysLeft / 7;
  return weeks >= 1 ? `주 ${Math.ceil(need / weeks)}회면 달성` : `${need}회 남음`;
}

// 남은 날은 오늘 포함. 오늘 이미 한 종목은 오늘을 빼고 센다
export function monthGoals(days, today, settings = DEFAULT_SETTINGS) {
  const m = monthKey(today);
  const d = parseDate(today);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const daysLeftFrom = (doneToday) => last - d.getDate() + (doneToday ? 0 : 1);
  const count = (pick) => {
    let n = 0;
    for (let x = `${m}-01`; x <= today; x = addDays(x, 1)) if (days[x] && pick(days[x])) n++;
    return n;
  };
  const row = (key, goal, pick) => {
    const c = count(pick);
    const left = daysLeftFrom(Boolean(days[today] && pick(days[today])));
    return { key, count: c, goal, done: c >= goal, rate: Math.min(1, c / goal), hint: hint(c, goal, left) };
  };
  const activeGoal = Number(settings.monthly_active_days_goal) || 0;
  return {
    daysLeft: last - d.getDate() + 1,
    active: activeGoal ? row('active', activeGoal, (day) => SPORTS.some((s) => day[s])) : null,
    sports: SPORTS.map((s) => [s, Number(settings[`monthly_count_goal_${s}`]) || 0])
      .filter(([, g]) => g > 0)
      .map(([s, g]) => row(s, g, (day) => day[s])),
  };
}
