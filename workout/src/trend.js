// 추이 탭 데이터: 종목(또는 전체) × 기간(일·주·월) 막대 시리즈 (명세 3-3)
import { SPORTS, SPORT_META } from './sports.js';
import { addDays, weekStart, monthKey, addMonths, parseDate } from './dates.js';

// 종목별 막대 값과 단위 (캘린더와 같은 표기): 걷기·자전거=분, 달리기=km, 수영=m, 전체=분
export function metricOf(target) {
  if (target === 'all') return { unit: '분', of: (d) => sumSports(d, (x) => x.duration_sec / 60) };
  const unit = SPORT_META[target].unit;
  if (unit === 'km') return { unit: 'km', of: (d) => (d?.[target] ? d[target].distance_m / 1000 : 0) };
  if (unit === 'm') return { unit: 'm', of: (d) => (d?.[target] ? d[target].distance_m : 0) };
  return { unit: '분', of: (d) => (d?.[target] ? d[target].duration_sec / 60 : 0) };
}

function sumSports(day, f) {
  if (!day) return 0;
  return SPORTS.reduce((a, s) => a + (day[s] ? f(day[s]) : 0), 0);
}

const active = (day, target) => Boolean(day && (target === 'all' ? SPORTS.some((s) => day[s]) : day[target]));

// 기간 목록: 일별은 최근 8주, 주별은 최근 12주, 월별은 최근 12개월 (가로로 넘겨 본다)
export function periods(mode, today) {
  if (mode === 'day') return Array.from({ length: 56 }, (_, i) => { const d = addDays(today, i - 55); return { key: d, start: d, end: d }; });
  if (mode === 'week') {
    const w0 = weekStart(today);
    return Array.from({ length: 12 }, (_, i) => { const s = addDays(w0, (i - 11) * 7); return { key: s, start: s, end: addDays(s, 6) }; });
  }
  const m0 = monthKey(today);
  return Array.from({ length: 12 }, (_, i) => {
    const m = addMonths(m0, i - 11);
    const [y, mm] = m.split('-').map(Number);
    const last = new Date(y, mm, 0).getDate();
    return { key: m, start: `${m}-01`, end: `${m}-${String(last).padStart(2, '0')}` };
  });
}

// days: groupByDay 결과. 반환: 막대들 + 평균(기록 있는 기간 기준) + 최댓값
export function buildSeries(days, target, mode, today) {
  const { unit, of } = metricOf(target);
  const bars = periods(mode, today).map((p) => {
    let value = 0, activeDays = 0, sessions = 0;
    for (let d = p.start; d <= p.end && d <= today; d = addDays(d, 1)) {
      value += of(days[d]);
      if (active(days[d], target)) {
        activeDays++;
        sessions += target === 'all' ? SPORTS.reduce((a, s) => a + (days[d]?.[s]?.sessionCount ?? 0), 0) : days[d][target].sessionCount;
      }
    }
    return { ...p, value, activeDays, sessions, future: p.start > today };
  });
  const withData = bars.filter((b) => b.activeDays > 0);
  const average = withData.length ? withData.reduce((a, b) => a + b.value, 0) / withData.length : 0;
  const max = Math.max(average, ...bars.map((b) => b.value));
  return { unit, bars, average, max };
}

// 직전 기간 대비 증감률 (이전 값이 0이면 null)
export function changeFromPrevious(bars, index) {
  const prev = bars[index - 1];
  if (!prev || !prev.value) return null;
  return (bars[index].value - prev.value) / prev.value;
}

// 이번 달 요약: 누적, 운동한 날, 전월 대비
export function monthSummary(days, target, today) {
  const { unit, of } = metricOf(target);
  const sum = (m, until) => {
    let v = 0, n = 0;
    for (let d = `${m}-01`; monthKey(d) === m && d <= until; d = addDays(d, 1)) {
      v += of(days[d]);
      if (active(days[d], target)) n++;
    }
    return { value: v, activeDays: n };
  };
  const cur = sum(monthKey(today), today);
  const prevMonth = addMonths(monthKey(today), -1);
  const prev = sum(prevMonth, `${prevMonth}-31`);
  return { unit, ...cur, previous: prev.value, change: prev.value ? (cur.value - prev.value) / prev.value : null };
}

export function formatAmount(value, unit) {
  if (unit === 'km') return `${value.toFixed(2)}km`;
  if (unit === 'm') return `${Math.round(value).toLocaleString('ko-KR')}m`;
  const total = Math.round(value);
  if (total >= 60) return `${Math.floor(total / 60)}시간${total % 60 ? ` ${total % 60}분` : ''}`;
  return `${total}분`;
}

export function periodLabel(bar, mode) {
  const d = parseDate(bar.start);
  if (mode === 'day') return `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`;
  if (mode === 'week') {
    const e = parseDate(bar.end);
    return `${d.getMonth() + 1}.${d.getDate()} ~ ${e.getMonth() + 1}.${e.getDate()}`;
  }
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}
