// 실제 운동 시간과 칼로리 다시 계산
// - 수영: 삼성헬스 운동 시간에는 벽에서 쉰 시간·끝내고 멈춘 시간이 들어간다.
//   구간 기록으로 '물속에서 수영한 시간'만 다시 센다 (휴식이 섞인 구간은 평소 구간 시간으로 바꿔 센다)
// - 칼로리: 몸무게를 넣으면 MET × 몸무게(kg) × 운동 시간(시간)으로 다시 계산한다 (삼성헬스 값이 너무 크게 나와서)

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// flaggedLaps: flagRestLaps 결과 (rest 표시). 구간이 없으면 null (알 수 없음 → 기존 시간 그대로)
export function swimActiveSec(session, flaggedLaps) {
  const times = flaggedLaps.filter((l) => l.time_sec != null && !l.rest).map((l) => l.time_sec);
  if (!times.length) return null;
  const typical = median(times);
  let sec = flaggedLaps.reduce((a, l) => a + (l.rest || l.time_sec == null ? typical : l.time_sec), 0);
  // 구간 화면을 다 못 올린 경우: 빠진 구간은 평소 구간 시간으로
  const missing = (Number(session.swim_laps) || 0) - flaggedLaps.length;
  if (missing > 0) sec += missing * typical;
  return Math.round(Math.min(sec, Number(session.duration_sec) || sec));
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
