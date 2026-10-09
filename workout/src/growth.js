// 성장 그래프: 수영·달리기의 '얼마나 늘었나'를 기록마다 점으로 (거리·시간 말고 실력 지표)
import { formatPace, formatMinutes } from './format.js';
import { RECORD_METRICS } from './records.js';

// lower: 낮을수록 좋은 지표 (그래프는 좋아지는 쪽이 위로)
export const GROWTH_METRICS = {
  swim: [
    { key: 'swimPace', label: '100m 페이스', lower: true, get: RECORD_METRICS.swimPace.get, text: (v) => `${formatPace(v)}/100m`, diff: (v) => secs(v) },
    { key: 'swolf', label: 'SWOLF', lower: true, get: RECORD_METRICS.swolf.get, text: (v) => v.toFixed(1), diff: (v) => v.toFixed(1) },
    { key: 'continuous', label: '연속 구간', lower: false, get: RECORD_METRICS.continuous.get, text: (v) => `${v}구간`, diff: (v) => `${v}구간` },
    { key: 'distance', label: '거리', lower: false, get: (d) => d.distance_m || null, text: (v) => `${Math.round(v)}m`, diff: (v) => `${Math.round(v)}m` },
  ],
  run: [
    { key: 'pace', label: 'km 페이스', lower: true, get: RECORD_METRICS.pace.get, text: (v) => `${formatPace(v)}/km`, diff: (v) => secs(v) },
    { key: 'longest', label: '쉬지 않고', lower: false, get: (d) => d.longest_session_sec || null, text: (v) => formatMinutes(v), diff: (v) => formatMinutes(v) },
    { key: 'distance', label: '거리', lower: false, get: (d) => d.distance_m || null, text: (v) => `${(v / 1000).toFixed(2)}km`, diff: (v) => `${(v / 1000).toFixed(2)}km` },
  ],
};

// 초 차이: 60초 이상이면 '1분 9초'
const secs = (v) => { const r = Math.round(v); return r >= 60 ? `${Math.floor(r / 60)}분${r % 60 ? ` ${r % 60}초` : ''}` : `${r}초`; };
const md = (d) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`;
const WORD = { swimPace: ['빨라졌어요', '느려졌어요'], pace: ['빨라졌어요', '느려졌어요'], swolf: ['좋아졌어요', '늘었어요'] };

// 최근 limit개 기록. summary: 첫 점 대비 마지막 점이 좋아졌는지 한 줄로
export function growthSeries(days, sport, key, limit = 20) {
  const m = GROWTH_METRICS[sport]?.find((x) => x.key === key);
  if (!m) return null;
  const points = Object.keys(days).sort()
    .filter((d) => days[d][sport])
    .map((date) => ({ date, value: m.get(days[date][sport]) }))
    .filter((p) => p.value != null)
    .slice(-limit);
  if (!points.length) return { metric: m, points, best: null, summary: null };
  const best = points.reduce((a, p) => ((m.lower ? p.value < a.value : p.value > a.value) ? p : a));
  let summary = null;
  if (points.length >= 2) {
    const delta = points.at(-1).value - points[0].value;
    const better = m.lower ? delta < 0 : delta > 0;
    const [up, down] = WORD[key] ?? ['늘었어요', '줄었어요'];
    summary = Math.abs(delta) < 1e-9 ? { better: null, text: `첫 기록과 같아요` }
      : { better, text: `${md(points[0].date)}보다 ${m.diff(Math.abs(delta))} ${better ? up : down}` };
  }
  return { metric: m, points, best, summary };
}
