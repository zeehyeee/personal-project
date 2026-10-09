// 주간 리포트 (명세 3-5) + 규칙 기반 인사이트 '이번 주 나의 변화'. API 호출 없음.
import { SPORTS, SPORT_META, STROKE_NAMES, DEFAULT_SETTINGS } from './sports.js';
import { addDays, weekDates, weekLabel, parseDate } from './dates.js';
import { habitIndex } from './habit.js';
import { streak } from './streak.js';
import { formatPace, formatMinutes } from './format.js';
import { recordsOn } from './records.js';

// 기간(from~to, to 포함) 합계. hardMinutes: 고강도 이상(최대+고강도) 분, zoneDays: 강도 기록이 있는 날
export function rangeStats(days, from, to) {
  const out = { minutes: 0, activeDays: 0, distance_m: 0, kcal: 0, hardMinutes: 0, zoneDays: 0, sports: {} };
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const day = days[d];
    if (!day) continue;
    let any = false;
    for (const s of SPORTS) {
      const x = day[s];
      if (!x) continue;
      any = true;
      out.minutes += x.duration_sec / 60;
      out.distance_m += x.distance_m || 0;
      out.kcal += x.kcal || 0;
      out.hardMinutes += (x.zone_max_min || 0) + (x.zone_high_min || 0);
      const t = (out.sports[s] ??= { minutes: 0, distance_m: 0, kcal: 0, days: 0 });
      t.minutes += x.duration_sec / 60;
      t.distance_m += x.distance_m || 0;
      t.kcal += x.kcal || 0;
      t.days++;
    }
    if (any) out.activeDays++;
    if (SPORTS.some((s) => day[s]?.zone_sessions)) out.zoneDays++;
  }
  return out;
}

export function weekHabit(days, start, settings = DEFAULT_SETTINGS) {
  const r = rangeStats(days, start, addDays(start, 6));
  return habitIndex({ activeDays: r.activeDays, sportCount: Object.keys(r.sports).length, minutes: r.minutes }, settings);
}

// 평소 = 직전 4주 평균
function baseline(days, start) {
  const weeks = [1, 2, 3, 4].map((i) => rangeStats(days, addDays(start, -7 * i), addDays(start, -7 * i + 6)));
  const avg = (k) => weeks.reduce((a, w) => a + w[k], 0) / 4;
  // 강도 평소값은 강도 기록이 있는 주만으로 (강도를 안 올린 주까지 0으로 섞지 않게)
  const zoneWeeks = weeks.filter((w) => w.zoneDays > 0);
  return {
    minutes: avg('minutes'), activeDays: avg('activeDays'), distance_m: avg('distance_m'), kcal: avg('kcal'),
    hardMinutes: zoneWeeks.length ? zoneWeeks.reduce((a, w) => a + w.hardMinutes, 0) / zoneWeeks.length : null,
    hasData: weeks.some((w) => w.activeDays > 0),
  };
}

export function weeklyReport(days, start, today, settings = DEFAULT_SETTINGS) {
  const end = addDays(start, 6);
  const cur = rangeStats(days, start, end > today ? today : end);
  const base = baseline(days, start);
  const top = Object.entries(cur.sports).sort((a, b) => b[1].minutes - a[1].minutes)[0];
  const headline = top ? `${SPORT_META[top[0]].name} 비중이 높았던 한 주` : start <= today ? '쉬어간 한 주' : '아직 오지 않은 주';

  const strip = weekDates(start).map((date) => {
    const n = SPORTS.filter((s) => days[date]?.[s]).length;
    return { date, level: n === 0 ? 'none' : n === 4 ? 'full' : 'some', today: date === today, future: date > today };
  });

  const diff = (k) => (base.hasData ? cur[k] - base[k] : null);
  const stats = [
    { key: 'minutes', label: '운동 시간', value: formatMinutes(cur.minutes * 60), diff: diff('minutes'), diffText: (v) => `${v > 0 ? '+' : v < 0 ? '-' : ''}${formatMinutes(Math.abs(v) * 60)}` },
    { key: 'activeDays', label: '활동일', value: `${cur.activeDays}/7일`, diff: diff('activeDays'), diffText: (v) => `${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}일` },
    { key: 'distance_m', label: '총 이동거리', value: `${(cur.distance_m / 1000).toFixed(1)}km`, diff: diff('distance_m'), diffText: (v) => `${v > 0 ? '+' : ''}${(v / 1000).toFixed(1)}km` },
    { key: 'kcal', label: '총 칼로리', value: `${Math.round(cur.kcal).toLocaleString('ko-KR')}kcal`, diff: diff('kcal'), diffText: (v) => `${v > 0 ? '+' : ''}${Math.round(v)}kcal` },
  ].map((s) => ({ ...s, tone: s.diff == null || Math.abs(s.diff) < 0.05 ? 'same' : s.diff > 0 ? 'up' : 'down', diffLabel: s.diff == null ? '평소 기록이 아직 없어요' : Math.abs(s.diff) < 0.05 ? '평소와 같아요' : `평소보다 ${s.diffText(s.diff)}` }));

  const sports = SPORTS.filter((s) => cur.sports[s]).map((s) => ({
    sport: s,
    ...cur.sports[s],
    share: cur.minutes ? cur.sports[s].minutes / cur.minutes : 0,
  })).sort((a, b) => b.minutes - a.minutes);

  // 습관 지수: 최근 6주
  const habit = [5, 4, 3, 2, 1, 0].map((i) => {
    const s = addDays(start, -7 * i);
    return { start: s, label: i === 0 ? '이번 주' : `${i}주 전`, score: weekHabit(days, s, settings) };
  });
  const score = habit[5].score;
  const vs4 = score - habit[1].score;

  return { label: weekLabel(start), headline, strip, stats, sports, habit, score, vs4, insights: insights(days, start, today, cur, base) };
}

// 받침 유무로 을/를
const eul = (word) => {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return word + (code >= 0 && code <= 11171 && code % 28 ? '을' : '를');
};

// ── 이번 주 나의 변화 (규칙 기반) ───────────────────
// 시간·거리 말고 '어떻게 늘었는지'를 우선한다: 새 영법, 스트로크 감소, 쉬지 않고 한 구간·시간, 누적 이정표
function insights(days, start, today, cur, base) {
  const end = addDays(start, 6) > today ? today : addDays(start, 6);
  const dates = Object.keys(days).sort();
  const before = dates.filter((d) => d < start);
  const inWeek = dates.filter((d) => d >= start && d <= end);
  const recent = before.filter((d) => d >= addDays(start, -28));
  const out = [];
  const push = (icon, text, tone = 'good', weight = 1) => out.push({ icon, text, tone, weight });

  if (!inWeek.length) {
    if (start <= today) push('🌱', '이번 주 첫 운동을 기록해보세요.', 'neutral');
    return out;
  }

  // 수영
  // 오리발 낀 날은 스트로크·페이스 비교에서 뺀다
  const swimLaps = (ds) => ds.flatMap((d) => (days[d].swim?.swim?.lapStats && !days[d].swim.fins ? [days[d].swim] : []));
  const wSwim = swimLaps(inWeek);
  if (wSwim.length) {
    const seenStrokes = new Set(swimLaps(before).flatMap((x) => x.swim.lapStats.byStroke.map((b) => b.stroke)));
    // 혼영은 삼성헬스가 영법을 판단하지 못한 구간(드릴·킥·연습)이라 '새 영법'에서 뺀다
    const newStrokes = [...new Set(wSwim.flatMap((x) => x.swim.lapStats.byStroke.map((b) => b.stroke)))].filter((s) => s !== 'medley' && !seenStrokes.has(s));
    if (before.some((d) => days[d].swim) && newStrokes.length) push('🆕', `${eul(newStrokes.map((s) => STROKE_NAMES[s] ?? s).join('·'))} 새로 시작했어요.`, 'good', 3);

    const strokesPerLap = (list, stroke) => {
      let n = 0, sum = 0;
      for (const x of list) for (const b of x.swim.lapStats.byStroke) if (b.stroke === stroke && b.strokesPerLap != null) { n += b.lapCount; sum += b.strokesPerLap * b.lapCount; }
      return n ? sum / n : null;
    };
    const rSwim = swimLaps(recent);
    for (const stroke of ['freestyle', 'backstroke', 'breaststroke']) {
      const now = strokesPerLap(wSwim, stroke), prev = strokesPerLap(rSwim, stroke);
      if (now != null && prev != null && prev - now >= 0.3) push('🌊', `${STROKE_NAMES[stroke]} 구간당 스트로크가 ${prev.toFixed(1)} → ${now.toFixed(1)}로 줄었어요.`, 'good', 3);
    }
    const pace = (list) => {
      const v = list.map((x) => x.swim.lapStats.pacePer100Sec).filter((p) => p != null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const pNow = pace(wSwim), pPrev = pace(rSwim);
    if (pNow != null && pPrev != null && pPrev - pNow >= 3) push('⏱️', `수영 페이스가 ${formatPace(pPrev)} → ${formatPace(pNow)}/100m로 빨라졌어요.`, 'good', 2);
  }

  // 달리기: 한 번에 쉬지 않고 달린 시간
  const longest = (ds) => Math.max(0, ...ds.map((d) => days[d].run?.longest_session_sec ?? 0));
  const runNow = longest(inWeek), runBest = longest(before);
  if (runNow && before.some((d) => days[d].run) && runNow > runBest) push('🏃', `한 번에 ${formatMinutes(runNow)} 동안 쉬지 않고 달렸어요. 최고 기록이에요.`, 'good', 3);

  // 오랜만에·처음 한 종목
  const firsts = [];
  for (const s of SPORTS.filter((x) => cur.sports[x])) {
    const last = [...before].reverse().find((d) => days[d][s]);
    if (!last) { if (before.length) firsts.push(SPORT_META[s].name); }
    else if (last < addDays(start, -28)) push('👋', `오랜만에 ${eul(SPORT_META[s].name)} 했어요.`, 'good', 1);
  }
  if (firsts.length) push('✨', `${firsts.join('·')} 기록이 처음 생겼어요.`, 'good', 2);

  // 누적 이정표 (이번 주에 넘었을 때)
  const total = (s, until) => dates.filter((d) => d <= until).reduce((a, d) => a + (days[d][s]?.distance_m ?? 0), 0);
  const marks = { run: [10, 25, 50, 100, 200, 500], swim: [1, 5, 10, 25, 50, 100] };
  for (const [s, list] of Object.entries(marks)) {
    const was = total(s, addDays(start, -1)) / 1000, now = total(s, end) / 1000;
    const crossed = list.filter((m) => was < m && now >= m).pop();
    if (crossed) push('🎉', `${SPORT_META[s].name} 누적 ${crossed}km를 넘었어요. (지금까지 ${now.toFixed(1)}km)`, 'good', 2);
  }
  // 수영 N개월차 (첫 수영 이후)
  const firstSwim = dates.find((d) => days[d].swim);
  if (firstSwim && cur.sports.swim) {
    const a = parseDate(firstSwim), b = parseDate(end);
    const months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1;
    if (months >= 2) push('📅', `수영 ${months}개월차예요.`, 'neutral', 1);
  }

  // 이번 주 신기록
  const prs = inWeek.flatMap((d) => SPORTS.flatMap((s) => recordsOn(days, s, d).map((r) => `${SPORT_META[s].name} ${r.label}(${r.text})`)));
  if (prs.length) push('🏅', `신기록 ${prs.length}개: ${prs.slice(0, 3).join(', ')}${prs.length > 3 ? ' 외' : ''}`, 'good', 4);

  // 운동 강도: 고강도 이상 시간과 평소 대비
  if (cur.zoneDays) {
    const h = Math.round(cur.hardMinutes);
    if (base.hardMinutes != null && Math.abs(h - base.hardMinutes) >= 5) {
      const d = Math.round(h - base.hardMinutes);
      push(d > 0 ? '💪' : '🧘', `고강도 이상 운동 ${h}분, 평소보다 ${d > 0 ? '+' : ''}${d}분${d > 0 ? '이에요.' : '이에요. 가볍게 회복한 주예요.'}`, d > 0 ? 'good' : 'neutral', 2);
    } else if (h > 0) push('💪', `이번 주 고강도 이상 운동 ${h}분이에요.`, 'neutral', 1);
  }

  // 습관: 연속 일수, 평소 대비 활동일
  const st = streak(dates.filter((d) => d <= end), end > today ? today : end);
  if (st.days >= 3) push('🔥', `${st.days}일 연속 운동 중이에요.`, 'good', 2);
  if (base.hasData) {
    const d = cur.activeDays - base.activeDays;
    if (d >= 1) push('📈', `평소보다 ${Math.round(d)}일 더 운동했어요.`, 'good', 1);
    else if (d <= -1 && end < today) push('🌙', `평소보다 운동한 날이 ${Math.round(-d)}일 적었어요. 다음 주엔 하루만 더 해볼까요?`, 'attention', 1);
  }
  if (!out.length) push('👍', `이번 주 ${cur.activeDays}일 운동했어요.`, 'neutral');

  return out.sort((a, b) => b.weight - a.weight).slice(0, 4);
}
