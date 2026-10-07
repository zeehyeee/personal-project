// 10/2 달리기 3세션 (명세 4-1 검증 예)
export const run1002 = [
  { id: 'r1', date: '2026-10-02', sport: 'run', duration_sec: 18 * 60 + 51, distance_m: 2030, kcal: 150, avg_hr: 150 },
  { id: 'r2', date: '2026-10-02', sport: 'run', duration_sec: 7 * 60 + 59, distance_m: 1050, kcal: 60, avg_hr: 140 },
  { id: 'r3', date: '2026-10-02', sport: 'run', duration_sec: 4 * 60 + 41, distance_m: 410, kcal: 30, avg_hr: null },
];

// 10/6 수영 18구간. (재구성 값, src/demo.js 참고)
import { SWIM_1006_LAP_ROWS } from '../src/demo.js';
const rows = SWIM_1006_LAP_ROWS;
export const swim1006Laps = rows.map(([lap_no, stroke, time_sec, strokes]) => ({
  session_id: 's1006', lap_no, stroke, time_sec, strokes,
}));
export const swim1006Session = {
  id: 's1006', date: '2026-10-06', sport: 'swim', duration_sec: 66 * 60 + 23,
  distance_m: 450, kcal: 300, swim_laps: 18, swim_total_strokes: 111,
  avg_pace_sec: 14 * 60 + 45, swim_avg_swolf: 158,
};
