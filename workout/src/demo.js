// 예시 데이터. 화면 확인용이며 source: 'demo' 로 표시해 한 번에 지울 수 있다.
// ⚠️ 10/6 수영 구간은 명세의 집계값을 만족하도록 재구성한 값이다. (실제 캡처 값 아님)
// 10/2 달리기 세션 3개는 명세 4-1 검증 예의 값, 나머지 수치는 임의값이다.

const F = 'freestyle';
const B = 'backstroke';
export const SWIM_1006_LAP_ROWS = [
  [1, F, 564, 8], [2, F, 40, 4], [3, F, 44, 5], [4, F, 45, 5], [5, F, 46, 5],
  [6, F, 47, 5], [7, F, 48, 5], [8, B, 48, 7], [9, B, 49, 7], [10, F, 172, 7],
  [11, B, 51, 8], [12, B, 52, 7], [13, B, 61, 8], [14, F, 50, 5], [15, F, 52, 4],
  [16, F, 1124, 8], [17, B, 190, 8], [18, F, 67, 5],
];

const session = (s) => ({
  start_time: '', distance_m: null, kcal: null, avg_pace_sec: null, avg_speed_kmh: null,
  avg_hr: null, avg_cadence: null, swim_laps: null, swim_avg_swolf: null,
  swim_total_strokes: null, source: 'demo', ...s,
});

export function demoData() {
  const sessions = [
    session({ id: 'demo-w1003', date: '2026-10-03', start_time: '08:10', sport: 'walk', duration_sec: 2400, distance_m: 2800, kcal: 120, avg_hr: 98, avg_cadence: 112 }),
    session({ id: 'demo-w1004', date: '2026-10-04', start_time: '18:30', sport: 'walk', duration_sec: 1800, distance_m: 2100, kcal: 90, avg_hr: 95, avg_cadence: 108 }),
    session({ id: 'demo-b1005', date: '2026-10-05', start_time: '07:40', sport: 'bike', duration_sec: 2700, distance_m: 9800, kcal: 210, avg_hr: 118 }),
    session({ id: 'demo-r1', date: '2026-10-02', start_time: '19:28', sport: 'run', duration_sec: 1131, distance_m: 2030, kcal: 150, avg_hr: 152, avg_cadence: 158 }),
    session({ id: 'demo-r2', date: '2026-10-02', start_time: '19:51', sport: 'run', duration_sec: 479, distance_m: 1050, kcal: 62, avg_hr: 147, avg_cadence: 155 }),
    session({ id: 'demo-r3', date: '2026-10-02', start_time: '20:02', sport: 'run', duration_sec: 281, distance_m: 410, kcal: 30, avg_hr: 141, avg_cadence: 150 }),
    session({ id: 'demo-s1006', date: '2026-10-06', start_time: '19:05', sport: 'swim', duration_sec: 3983, distance_m: 450, kcal: 310, avg_pace_sec: 885, avg_hr: 121, swim_laps: 18, swim_avg_swolf: 158, swim_total_strokes: 111 }),
    session({ id: 'demo-w1006', date: '2026-10-06', start_time: '12:20', sport: 'walk', duration_sec: 1500, distance_m: 1700, kcal: 75, avg_hr: 97, avg_cadence: 110 }),
    session({ id: 'demo-b1006', date: '2026-10-06', start_time: '08:05', sport: 'bike', duration_sec: 1200, distance_m: 4300, kcal: 95, avg_hr: 112 }),
  ];
  const laps = SWIM_1006_LAP_ROWS.map(([lap_no, stroke, time_sec, strokes]) => ({
    session_id: 'demo-s1006', lap_no, stroke, time_sec, strokes,
  }));
  return { sessions, laps };
}
