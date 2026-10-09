// 첫 화면 맨 위: 연속 기록(크게) + 이번 주 7일 + 오늘 할 일 한 줄 (규칙 기반, API 없음)
// 한 줄 우선순위: 오늘 한 운동 → 연속 기록 이어가기 → 오래 쉰 수영 → 며칠 쉬었는지
import { SPORTS, SPORT_META } from './sports.js';
import { weekDates, weekStart, parseDate } from './dates.js';
import { streak, monthActiveDays } from './streak.js';
import { recordsOn } from './records.js';

const gapDays = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);

export function todayCoach(days, today) {
  const active = (d) => SPORTS.some((s) => days[d]?.[s]);
  const dates = Object.keys(days).filter((d) => d <= today && active(d)).sort();
  const st = streak(dates, today);
  const week = weekDates(weekStart(today)).map((date) => ({ date, done: active(date), today: date === today, future: date > today }));
  const doneToday = SPORTS.filter((s) => days[today]?.[s]);

  const base = {
    streak: st.days,
    streakUntilYesterday: st.untilYesterday,
    week,
    weekDays: week.filter((d) => d.done).length,
    month: { days: monthActiveDays(dates, today), elapsed: Number(today.slice(8)) },
  };
  const say = (text) => ({ ...base, text });

  if (!dates.length) return say('첫 운동을 기록해볼까요? 캡처 한 장이면 돼요.');

  if (doneToday.length) {
    const names = doneToday.map((s) => SPORT_META[s].name).join('·');
    const prs = doneToday.flatMap((s) => recordsOn(days, s, today));
    return say(prs.length ? `오늘 ${names} 완료! 신기록도 ${prs.length}개 세웠어요.` : `오늘 ${names} 완료! 잘했어요.`);
  }

  if (st.untilYesterday) return say(`오늘도 운동하면 ${st.days + 1}일 연속이에요.`);

  const lastSwim = [...dates].reverse().find((d) => days[d].swim);
  if (lastSwim && gapDays(lastSwim, today) >= 5) return say(`수영한 지 ${gapDays(lastSwim, today)}일 됐어요. 오늘 수영 어때요?`);

  const rest = gapDays(dates.at(-1), today) - 1;
  return say(rest >= 2 ? `${rest}일 쉬었어요. 오늘 가볍게 걸어볼까요?` : '오늘 운동하면 연속 기록이 다시 시작돼요.');
}
