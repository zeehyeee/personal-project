// 세션 → 일 단위 합산 (명세 4-1)
import { flagRestLaps, swimLapStats } from './swim.js';
import { DEFAULT_SETTINGS } from './sports.js';

const has = (v) => v !== null && v !== undefined && v !== '';
const sum = (rows, key) => rows.reduce((a, r) => a + (has(r[key]) ? Number(r[key]) : 0), 0);

// 값이 있는 세션만 모아 운동 시간 가중 평균
function weightedAvg(sessions, key) {
  let w = 0;
  let total = 0;
  for (const s of sessions) {
    if (!has(s[key]) || !s.duration_sec) continue;
    w += s.duration_sec;
    total += Number(s[key]) * s.duration_sec;
  }
  return w ? total / w : null;
}

// 같은 날짜·같은 종목 세션들을 하나로 합산한다.
// lapsBySession: session_id → swim_laps 행 배열 (수영만)
export function aggregateSessions(sessions, lapsBySession = {}, settings = DEFAULT_SETTINGS) {
  const first = sessions[0];
  const duration = sum(sessions, 'duration_sec');
  // 페이스·속도는 거리가 있는 세션끼리만 시간 ÷ 거리로 다시 계산한다.
  const withDist = sessions.filter((s) => Number(s.distance_m) > 0);
  const distTime = sum(withDist, 'duration_sec');
  const distM = sum(withDist, 'distance_m');

  const result = {
    date: first.date,
    sport: first.sport,
    sessionCount: sessions.length,
    sessionIds: sessions.map((s) => s.id),
    duration_sec: duration,
    distance_m: sum(sessions, 'distance_m'),
    kcal: sum(sessions, 'kcal'),
    pace_sec_per_km: distM ? distTime / (distM / 1000) : null,
    speed_kmh: distTime ? distM / 1000 / (distTime / 3600) : null,
    avg_hr: weightedAvg(sessions, 'avg_hr'),
    avg_cadence: weightedAvg(sessions, 'avg_cadence'),
    // 한 번에 가장 오래 한 세션 (멈추면 삼성헬스가 세션을 나눈다 → '쉬지 않고 N분')
    longest_session_sec: Math.max(...sessions.map((s) => Number(s.duration_sec) || 0)),
  };

  if (first.sport === 'swim') {
    const pool = Number(settings.pool_length_m) || 25;
    const mult = Number(settings.swim_rest_multiplier) || 2;
    // 휴식 판정은 세션별 중앙값으로 하고, 요약은 그날 구간 전체로 다시 계산한다.
    const perSession = sessions.map((s) => flagRestLaps(lapsBySession[s.id] ?? [], mult));
    const laps = perSession.flat();
    result.swim = {
      laps: sum(sessions, 'swim_laps'),
      total_strokes: sum(sessions, 'swim_total_strokes'),
      lapStats: laps.length ? swimLapStats(laps, pool) : null,
      // 쉬지 않고 이어서 수영한 최대 구간 수 (세션 안에서만 센다)
      maxContinuousLaps: Math.max(0, ...perSession.map(continuousLaps)),
    };
  }
  return result;
}

function continuousLaps(flagged) {
  let best = 0, run = 0;
  for (const l of flagged) {
    run = l.rest ? 0 : run + 1;
    best = Math.max(best, run);
  }
  return best;
}

// 전체 세션을 날짜 → 종목 → 합산 결과로 묶는다.
export function groupByDay(sessions, lapsBySession = {}, settings = DEFAULT_SETTINGS) {
  const buckets = new Map();
  for (const s of sessions) {
    const key = `${s.date}|${s.sport}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(s);
  }
  const days = {};
  for (const rows of buckets.values()) {
    const agg = aggregateSessions(rows, lapsBySession, settings);
    (days[agg.date] ??= {})[agg.sport] = agg;
  }
  return days;
}

export function groupLapsBySession(laps) {
  const out = {};
  for (const l of laps) (out[l.session_id] ??= []).push(l);
  for (const list of Object.values(out)) list.sort((a, b) => a.lap_no - b.lap_no);
  return out;
}
