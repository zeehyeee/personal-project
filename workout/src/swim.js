// 수영 구간(swim_laps) 기반 계산.
// 구간 1개 = 수영장 길이 1회. 삼성헬스의 평균 페이스·SWOLF는 휴식이 섞여 있어
// 화면 지표는 모두 이 원자료로 다시 계산한다.

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function avg(values) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

// 세션 하나의 구간에 휴식 여부를 표시한다.
// 구간 시간이 그 세션 중앙값 × multiplier 를 넘으면 휴식이 섞인 구간이다.
// 시간이 없는 구간(스트로크 화면만 올린 경우)은 휴식 판정에서 뺀다
export function flagRestLaps(laps, multiplier = 2) {
  const times = laps.map((l) => l.time_sec).filter((t) => t != null);
  const limit = times.length ? median(times) * multiplier : Infinity;
  return laps.map((l) => ({ ...l, rest: l.time_sec != null && l.time_sec > limit }));
}

// 휴식 표시가 끝난 구간들(여러 세션을 합쳐도 됨)을 요약한다.
// 반복 횟수·스트로크는 전 구간, 페이스·SWOLF는 휴식 구간을 뺀 값으로 낸다.
// 시간·스트로크 중 하나가 빠진 구간은 그 값이 필요한 계산에서만 뺀다
// 구간마다 수영장 길이(pool_m)가 다를 수 있다 (25m 풀, 어린이풀). 없으면 poolLengthM
function summarize(laps, poolLengthM) {
  const active = laps.filter((l) => !l.rest);
  const has = (v) => v != null;
  const pool = (l) => l.pool_m || poolLengthM;
  const pace = avg(active.filter((l) => has(l.time_sec)).map((l) => (l.time_sec / pool(l)) * 100));
  const withStrokes = laps.filter((l) => has(l.strokes));
  const totalStrokes = withStrokes.reduce((a, l) => a + l.strokes, 0);
  return {
    lapCount: laps.length,
    distanceM: laps.reduce((a, l) => a + pool(l), 0),
    restExcluded: laps.length - active.length,
    totalStrokes: withStrokes.length ? totalStrokes : null,
    strokesPerLap: withStrokes.length ? totalStrokes / withStrokes.length : null,
    pacePer100Sec: pace,
    avgSwolf: avg(active.filter((l) => has(l.time_sec) && has(l.strokes)).map((l) => l.time_sec + l.strokes)),
  };
}

export function swimLapStats(flaggedLaps, poolLengthM = 25) {
  const total = summarize(flaggedLaps, poolLengthM);
  const groups = new Map();
  for (const lap of flaggedLaps) {
    if (!groups.has(lap.stroke)) groups.set(lap.stroke, []);
    groups.get(lap.stroke).push(lap);
  }
  const byStroke = [...groups].map(([stroke, laps]) => ({
    stroke,
    ...summarize(laps, poolLengthM),
    share: laps.length / flaggedLaps.length,
  }));
  byStroke.sort((a, b) => b.lapCount - a.lapCount);
  return { ...total, byStroke, showByStroke: byStroke.length >= 2 };
}

// 구간 번호가 1..expected 로 빠짐없이 모였는지 확인한다. 빠진 범위를 돌려준다.
export function findMissingLaps(lapNumbers, expected) {
  const have = new Set(lapNumbers);
  const ranges = [];
  for (let n = 1; n <= expected; n++) {
    if (have.has(n)) continue;
    const last = ranges[ranges.length - 1];
    if (last && last[1] === n - 1) last[1] = n;
    else ranges.push([n, n]);
  }
  return ranges;
}
