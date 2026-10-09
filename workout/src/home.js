// 캘린더 아래 카드 하나: 새 주가 시작되면 '지난주 리포트 도착'(열어보면 사라짐),
// 그 뒤에는 '지난주 이맘때와 비교' + 기록에서 찾은 제안 한 줄 (규칙 기반)
import { addDays, weekStart, weekLabel, parseDate } from './dates.js';
import { rangeStats, weeklyReport } from './report.js';
import { formatMinutes } from './format.js';

const gapDays = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
// 수영장에 있던 1분당 수영한 거리: 쉬는 시간이 줄수록 커진다 (삼성헬스 값 그대로라 추정 없음)
export const swimRate = (d) => (!d?.fins && d?.distance_m > 0 && d.duration_sec > 0 ? d.distance_m / (d.duration_sec / 60) : null);

export function homeCard(days, today, { seenWeek = null, settings } = {}) {
  const ws = weekStart(today);
  const last = addDays(ws, -7);
  if (seenWeek !== last && rangeStats(days, last, addDays(last, 6)).activeDays > 0) {
    const r = weeklyReport(days, last, today, settings);
    const { month, week } = weekLabel(last);
    return { kind: 'report', week: last, title: `${month}월 ${week}주차 리포트가 도착했어요`, sub: `${r.headline} · 습관 지수 ${r.score}점` };
  }
  const off = gapDays(ws, today);
  const cur = rangeStats(days, ws, today);
  const prev = rangeStats(days, last, addDays(last, off));
  const diff = Math.round(cur.minutes - prev.minutes);
  let title;
  if (!cur.minutes && !prev.minutes) title = '이번 주 첫 운동을 기다리고 있어요';
  else if (Math.abs(diff) < 5) title = '지난주 이맘때와 비슷하게 하고 있어요';
  else title = `지난주 이맘때보다 ${diff > 0 ? '+' : '-'}${formatMinutes(Math.abs(diff) * 60)}`;
  return {
    kind: 'pace',
    week: ws,
    tone: diff >= 5 ? 'up' : diff <= -5 ? 'down' : 'same',
    title,
    sub: `운동일 ${prev.activeDays}일 → ${cur.activeDays}일`,
    tip: suggestion(days, today),
  };
}

// 기록에서 찾은 분석 한 줄. 좋은 변화 → 고칠 점 순 (없으면 null → 카드는 운동일 비교를 보여준다)
export function suggestion(days, today) {
  const dates = Object.keys(days).filter((d) => d <= today).sort();
  const swims = dates.filter((d) => swimRate(days[d].swim) != null);
  if (swims.length >= 3) {
    const latest = swims.at(-1);
    const before = swims.slice(0, -1).map((d) => swimRate(days[d].swim));
    const avg = before.reduce((a, b) => a + b, 0) / before.length;
    const now = swimRate(days[latest].swim);
    if (gapDays(latest, today) <= 7 && now >= avg * 1.1) {
      return `수영 분당 ${now.toFixed(1)}m · 평소(${avg.toFixed(1)}m)보다 덜 쉬었어요`;
    }
  }
  // 최근 2주 달리기 강도: 강도 기록이 있는 달리기의 고강도 이상 비율
  let hard = 0, total = 0, runs = 0;
  for (const d of dates.filter((x) => x >= addDays(today, -13))) {
    const r = days[d].run;
    if (!r?.zone_sessions) continue;
    runs++;
    hard += (r.zone_max_min || 0) + (r.zone_high_min || 0);
    total += r.zone_duration_sec / 60;
  }
  if (runs >= 2 && total > 0 && hard / total >= 0.6) {
    return `달리기 ${Math.round((hard / total) * 100)}%가 고강도 · 다음엔 천천히 오래 뛰어봐요`;
  }
  // 쉰 날·오래 쉰 수영은 '오늘' 칸에서 이미 말하므로 여기선 분석만
  return null;
}
