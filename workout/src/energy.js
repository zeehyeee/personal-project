// 실제 운동 시간과 칼로리 다시 계산
// - 수영: 삼성헬스 운동 시간에는 출발 전·끝난 뒤 멈춤 버튼까지의 대기가 들어간다. 구간 기록으로 앞뒤 대기만 뺀다
// - 칼로리: 몸무게를 넣으면 MET × 몸무게(kg) × 운동 시간(시간)으로 다시 계산한다 (삼성헬스 값이 너무 크게 나와서)

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// 수영 운동 시간: 앞뒤 대기만 뺀다 (중간에 벽에서 쉰 시간은 달리기·걷기처럼 운동 시간에 둔다)
// - 시작 전: 첫 구간에는 시작 버튼을 누르고 출발하기까지 기다린 시간이 들어간다 → 평소 구간 시간을 넘는 만큼
// - 끝난 뒤: 마지막 구간 이후 멈춤 버튼까지의 시간 = 기록된 시간 − 구간 시간 합 (빠진 구간은 평소 구간 시간으로)
// flaggedLaps: flagRestLaps 결과. 구간이 없으면 null (알 수 없음 → 기록된 시간 그대로)
export function swimActiveSec(session, flaggedLaps) {
  const total = Number(session.duration_sec) || 0;
  const times = flaggedLaps.filter((l) => l.time_sec != null && !l.rest).map((l) => l.time_sec);
  if (!times.length || !total) return null;
  const typical = median(times);
  const missing = Math.max(0, (Number(session.swim_laps) || 0) - flaggedLaps.length);
  const lapSum = flaggedLaps.reduce((a, l) => a + (l.time_sec ?? typical), 0) + missing * typical;
  const after = Math.max(0, total - lapSum);
  const first = [...flaggedLaps].sort((x, y) => x.lap_no - y.lap_no)[0];
  const before = first?.rest ? first.time_sec - typical : 0;
  return Math.round(Math.max(typical, total - after - before));
}

// 실제로 헤엄친 시간: 중간에 쉰 시간도 뺀다 (칼로리 계산용). 휴식이 섞인 구간은 평소 구간 시간으로 센다
export function swimMovingSec(session, flaggedLaps) {
  const times = flaggedLaps.filter((l) => l.time_sec != null && !l.rest).map((l) => l.time_sec);
  if (!times.length) return null;
  const typical = median(times);
  const missing = Math.max(0, (Number(session.swim_laps) || 0) - flaggedLaps.length);
  const sec = flaggedLaps.reduce((a, l) => a + (l.rest || l.time_sec == null ? typical : l.time_sec), 0) + missing * typical;
  return Math.round(Math.min(sec, Number(session.duration_sec) || sec));
}

// 수영 칼로리: 헤엄친 시간은 속도별 수영 MET, 중간에 쉰 시간은 물속에 서 있는 정도(2.0 MET)로.
// 출발 전·끝난 뒤 대기는 넣지 않는다. 구간이 없으면 운동 시간 전체를 수영 MET 로
export const REST_MET = 2.0;
export function estimateSwimKcal(distanceM, activeSec, movingSec, weightKg) {
  if (!(weightKg > 0) || !(activeSec > 0)) return null;
  if (movingSec == null) return estimateKcal('swim', distanceM, activeSec, weightKg);
  const restSec = Math.max(0, activeSec - movingSec);
  return Math.round((metOf('swim', distanceM, movingSec) * movingSec + REST_MET * restSec) * weightKg / 3600);
}

// 운동 강도(MET). 속도가 있으면 속도로, 없으면 종목 기본값
// 걷기·달리기: ACSM 산소 소비 공식, 자전거·수영: 신체활동 MET 표(Compendium) 구간
export function metOf(sport, distanceM, activeSec) {
  const v = distanceM > 0 && activeSec > 0 ? distanceM / (activeSec / 60) : null; // m/분
  if (sport === 'walk') return v ? (3.5 + 0.1 * v) / 3.5 : 3.5;
  if (sport === 'run') return v ? (3.5 + 0.2 * v) / 3.5 : 8;
  if (sport === 'bike') {
    if (!v) return 5.8;
    const kmh = (v * 60) / 1000;
    return kmh < 16 ? 4 : kmh < 19 ? 6.8 : kmh < 22 ? 8 : kmh < 25.5 ? 10 : 12;
  }
  if (sport === 'swim') return !v ? 5.8 : v < 20 ? 5.8 : v < 35 ? 8.3 : 9.8;
  return 4;
}

export function estimateKcal(sport, distanceM, activeSec, weightKg) {
  if (!(weightKg > 0) || !(activeSec > 0)) return null;
  return Math.round(metOf(sport, distanceM, activeSec) * weightKg * (activeSec / 3600));
}
