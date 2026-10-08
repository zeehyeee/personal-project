// 신기록(PR): 저장된 이력과 비교해 앱이 직접 판정한다 (명세 4-2). 삼성헬스의 최고값 필드는 쓰지 않는다.
// 하루(종목별 합산) 단위로 비교하고, 처음 기록은 신기록으로 치지 않는다.
import { formatDuration, formatPace } from './format.js';

const swimOk = (d) => d.swim?.lapStats && d.swim.lapStats.lapCount - d.swim.lapStats.restExcluded >= 4;

// higher: 클수록 좋은 기록인지
export const RECORD_METRICS = {
  duration: { label: '최장 시간', higher: true, get: (d) => d.duration_sec, text: (v) => formatDuration(v) },
  distance: { label: '최장 거리', higher: true, get: (d) => d.distance_m || null, text: (v, s) => (s === 'swim' ? `${Math.round(v)}m` : `${(v / 1000).toFixed(2)}km`) },
  pace: {
    label: '최고 페이스', higher: false,
    get: (d) => (d.sport === 'run' || d.sport === 'walk') && d.distance_m >= 1000 ? d.pace_sec_per_km : null,
    text: (v) => `${formatPace(v)}/km`,
  },
  speed: { label: '최고 속도', higher: true, get: (d) => (d.sport === 'bike' && d.distance_m >= 2000 ? d.speed_kmh : null), text: (v) => `${v.toFixed(1)}km/h` },
  swimPace: { label: '최고 페이스', higher: false, get: (d) => (swimOk(d) ? d.swim.lapStats.pacePer100Sec : null), text: (v) => `${formatPace(v)}/100m` },
  swolf: { label: '최저 SWOLF', higher: false, get: (d) => (swimOk(d) ? d.swim.lapStats.avgSwolf : null), text: (v) => v.toFixed(1) },
  continuous: { label: '최다 연속 구간', higher: true, get: (d) => d.swim?.maxContinuousLaps || null, text: (v) => `${v}구간` },
};

export const METRICS_BY_SPORT = {
  swim: ['distance', 'duration', 'swimPace', 'swolf', 'continuous'],
  run: ['distance', 'duration', 'pace'],
  walk: ['distance', 'duration', 'pace'],
  bike: ['distance', 'duration', 'speed'],
};

const better = (m, a, b) => (m.higher ? a > b : a < b);

// 그날 그 종목이 세운 신기록 목록
export function recordsOn(days, sport, date) {
  const day = days[date]?.[sport];
  if (!day) return [];
  const before = Object.keys(days).filter((d) => d < date && days[d][sport]).map((d) => days[d][sport]);
  const out = [];
  for (const key of METRICS_BY_SPORT[sport]) {
    const m = RECORD_METRICS[key];
    const v = m.get(day);
    if (v == null) continue;
    const prev = before.map(m.get).filter((x) => x != null);
    if (!prev.length) continue;
    const best = prev.reduce((a, b) => (better(m, b, a) ? b : a));
    if (better(m, v, best)) out.push({ key, label: m.label, value: v, text: m.text(v, sport), previous: m.text(best, sport) });
  }
  return out;
}

// 종목별 역대 최고 기록과 그 날짜
export function bestRecords(days, sport) {
  const list = Object.keys(days).sort().filter((d) => days[d][sport]);
  return METRICS_BY_SPORT[sport].map((key) => {
    const m = RECORD_METRICS[key];
    let best = null;
    for (const date of list) {
      const v = m.get(days[date][sport]);
      if (v != null && (best == null || better(m, v, best.value))) best = { date, value: v };
    }
    return best && { key, label: m.label, ...best, text: m.text(best.value, sport) };
  }).filter(Boolean);
}
