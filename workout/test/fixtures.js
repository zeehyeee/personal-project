// 10/2 달리기 3세션 (명세 4-1 검증 예)
export const run1002 = [
  { id: 'r1', date: '2026-10-02', sport: 'run', duration_sec: 18 * 60 + 51, distance_m: 2030, kcal: 150, avg_hr: 150 },
  { id: 'r2', date: '2026-10-02', sport: 'run', duration_sec: 7 * 60 + 59, distance_m: 1050, kcal: 60, avg_hr: 140 },
  { id: 'r3', date: '2026-10-02', sport: 'run', duration_sec: 4 * 60 + 41, distance_m: 410, kcal: 30, avg_hr: null },
];

// 10/6 수영 18구간.
// ⚠️ 재구성 데이터: 명세에 적힌 값(휴식 구간 1·10·16·17의 시간, 영법별 구간 수,
// 중앙값 50.5초, 61초·67초 구간, 최고 SWOLF 44 = 40초+4스트로크, 총 스트로크 111,
// 영법별 평균)을 모두 만족하도록 나머지 구간 값을 맞춰 넣은 것이다.
// 실제 캡처의 구간 값을 받으면 교체한다.
const F = 'freestyle';
const B = 'backstroke';
const rows = [
  [1, F, 564, 8], [2, F, 40, 4], [3, F, 44, 5], [4, F, 45, 5], [5, F, 46, 5],
  [6, F, 47, 5], [7, F, 48, 5], [8, B, 48, 7], [9, B, 49, 7], [10, F, 172, 7],
  [11, B, 51, 8], [12, B, 52, 7], [13, B, 61, 8], [14, F, 50, 5], [15, F, 52, 4],
  [16, F, 1124, 8], [17, B, 190, 8], [18, F, 67, 5],
];
export const swim1006Laps = rows.map(([lap_no, stroke, time_sec, strokes]) => ({
  session_id: 's1006', lap_no, stroke, time_sec, strokes,
}));
export const swim1006Session = {
  id: 's1006', date: '2026-10-06', sport: 'swim', duration_sec: 66 * 60 + 23,
  distance_m: 450, kcal: 300, swim_laps: 18, swim_total_strokes: 111,
  avg_pace_sec: 14 * 60 + 45, swim_avg_swolf: 158,
};
