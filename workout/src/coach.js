// '오늘' 카드: 앱을 열면 맨 위에서 고양이가 오늘 할 일 한 가지를 말해준다 (규칙 기반, API 없음)
// 우선순위: 오늘 한 운동 → 연속 기록 지키기 → 주 목표가 빠듯할 때 → 오래 쉰 수영 → 주 목표 페이스
import { SPORTS, SPORT_META, DEFAULT_SETTINGS } from './sports.js';
import { addDays, weekStart, parseDate } from './dates.js';
import { rangeStats } from './report.js';
import { streak, monthActiveDays } from './streak.js';
import { recordsOn } from './records.js';

const gapDays = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);

export function todayCoach(days, today, settings = DEFAULT_SETTINGS) {
  const dates = Object.keys(days).filter((d) => d <= today && SPORTS.some((s) => days[d][s])).sort();
  const st = streak(dates, today);
  const start = weekStart(today);
  const week = rangeStats(days, start, today);
  const daysGoal = Number(settings.weekly_active_days_goal) || 5;
  const minutesGoal = Number(settings.weekly_minutes_goal) || 150;
  const minutes = Math.round(week.minutes);
  const doneToday = SPORTS.filter((s) => days[today]?.[s]);
  // 오늘을 포함해 이번 주 남은 날
  const daysLeft = 7 - gapDays(start, today);

  const base = {
    week: { days: week.activeDays, daysGoal, minutes, minutesGoal },
    streak: st.days,
    month: { days: monthActiveDays(dates, today), elapsed: Number(today.slice(8)) },
  };
  const say = (mood, text) => ({ ...base, mood, text });

  if (!dates.length) return say('hello', '첫 운동을 기록해볼까요? 캡처 한 장이면 돼요.');

  if (doneToday.length) {
    const names = doneToday.map((s) => SPORT_META[s].name).join('·');
    const prs = doneToday.flatMap((s) => recordsOn(days, s, today));
    if (prs.length) return say('proud', `오늘 ${names} 끝! 신기록도 ${prs.length}개 세웠어요 🏅`);
    if (week.activeDays >= daysGoal) return say('proud', `오늘 ${names} 끝! 이번 주 목표 ${daysGoal}일을 채웠어요 🎉`);
    return say('happy', `오늘 ${names} 끝! 이번 주 ${week.activeDays}/${daysGoal}일이에요.`);
  }

  if (st.untilYesterday && st.days >= 2) return say('cheer', `${st.days}일 연속 중이에요. 오늘 가볍게 걷기 20분이면 ${st.days + 1}일로 이어져요.`);

  const needDays = daysGoal - week.activeDays;
  if (needDays > 0 && needDays === daysLeft) return say('cheer', `이번 주 목표까지 ${needDays}일 남았어요. 오늘부터 매일 하면 달성해요!`);

  const lastSwim = [...dates].reverse().find((d) => days[d].swim);
  if (lastSwim && gapDays(lastSwim, today) >= 5) return say('swim', `수영 ${gapDays(lastSwim, today)}일 쉬었어요. 오늘 물에 들어가 볼까요?`);

  const needMin = minutesGoal - minutes;
  if (needMin > 0) return say('cheer', `이번 주 ${needMin}분 남았어요. 오늘 ${Math.ceil(needMin / daysLeft)}분이면 목표 페이스예요.`);

  return say('happy', '이번 주 목표는 이미 채웠어요. 오늘은 가볍게 움직이거나 푹 쉬어도 좋아요.');
}
