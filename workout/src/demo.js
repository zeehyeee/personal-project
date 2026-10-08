// 예시 데이터: 사용자가 보내준 실제 삼성헬스 기록(10/2 달리기, 10/6 수영·걷기·자전거).
// source: 'demo' 로 표시해 화면에서 한 번에 지울 수 있다.
// 10/2 달리기 둘째·셋째 세션은 칼로리 등 상세 캡처가 없어 시간·거리만 있다.

const F = 'freestyle';
const B = 'backstroke';
// 10/6 수영 18구간 [구간, 영법, 시간(초), 스트로크] — 시간 기준·스트로크 기준 구간 화면에서 읽은 값
export const SWIM_1006_LAP_ROWS = [
  [1, F, 564, 6], [2, F, 40, 4], [3, F, 40, 5], [4, F, 46, 4], [5, F, 61, 5],
  [6, F, 50, 5], [7, F, 48, 5], [8, F, 46, 5], [9, F, 67, 6], [10, B, 172, 8],
  [11, B, 49, 8], [12, B, 56, 9], [13, B, 58, 7], [14, B, 47, 7], [15, B, 51, 6],
  [16, F, 1124, 11], [17, F, 190, 6], [18, F, 41, 4],
];

const session = (s) => ({
  start_time: '', distance_m: null, kcal: null, avg_hr: null, avg_cadence: null,
  swim_laps: null, swim_total_strokes: null,
  zone_max_min: null, zone_high_min: null, zone_mid_min: null, zone_low_min: null, source: 'demo', ...s,
});

export function demoData() {
  const sessions = [
    session({ id: 'demo-r1', date: '2026-10-02', start_time: '19:28', sport: 'run', duration_sec: 1131, distance_m: 2030, kcal: 130, avg_hr: 152, avg_cadence: 140, zone_max_min: 6, zone_high_min: 12, zone_mid_min: 1 }),
    session({ id: 'demo-r2', date: '2026-10-02', start_time: '19:18', sport: 'run', duration_sec: 479, distance_m: 1050 }),
    session({ id: 'demo-r3', date: '2026-10-02', start_time: '19:12', sport: 'run', duration_sec: 281, distance_m: 410 }),
    session({ id: 'demo-s1006', date: '2026-10-06', start_time: '20:04', sport: 'swim', duration_sec: 3983, distance_m: 450, kcal: 517, avg_hr: 120, swim_laps: 18, swim_total_strokes: 111, zone_high_min: 26, zone_mid_min: 30 }),
    session({ id: 'demo-w1006', date: '2026-10-06', start_time: '21:23', sport: 'walk', duration_sec: 1526, distance_m: 1930, kcal: 92, avg_hr: 119 }),
    session({ id: 'demo-b1006', date: '2026-10-06', start_time: '19:20', sport: 'bike', duration_sec: 706, distance_m: 2360, kcal: 52, avg_hr: 129 }),
  ];
  const laps = SWIM_1006_LAP_ROWS.map(([lap_no, stroke, time_sec, strokes]) => ({
    session_id: 'demo-s1006', lap_no, stroke, time_sec, strokes,
  }));
  return { sessions, laps };
}
