// 구간 고치기 줄 (캡처 확인 화면·상세 화면 공용). 이름은 `${prefix}.lap.${k}.no|stroke|time|strokes` → lapsFromForm 이 읽는다
import { STROKE_NAMES } from '../sports.js';
import { findMissingLaps } from '../swim.js';

const mmss = (t) => (t == null ? '' : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);

// 읽은 구간 + 빠진 번호(빈 줄). expected: 총 반복 횟수
export function lapRows(laps, expected) {
  const total = expected ?? (laps.length ? laps[laps.length - 1].lap_no : 0);
  const missing = findMissingLaps(laps.map((l) => l.lap_no), total).flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, k) => a + k));
  return [...laps, ...missing.map((n) => ({ lap_no: n, stroke: 'freestyle', time_sec: null, strokes: null, added: true }))]
    .sort((a, b) => a.lap_no - b.lap_no);
}

export const isBadLap = (l) => l.added || l.time_sec == null || l.strokes == null;

export function lapEditRows(rows, prefix) {
  const options = (cur) => Object.entries(STROKE_NAMES).map(([k, n]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${n}</option>`).join('');
  return rows.map((l, k) => `
    <li class="lap-edit ${isBadLap(l) ? 'bad' : 'ok'}">
      <input type="hidden" name="${prefix}.lap.${k}.no" value="${l.lap_no}">
      <span class="le-no">${l.lap_no}</span>
      <select name="${prefix}.lap.${k}.stroke">${options(l.stroke)}</select>
      <span class="field-input le-in"><input name="${prefix}.lap.${k}.time" value="${mmss(l.time_sec)}" inputmode="numeric" placeholder="0:00"><em>분:초</em></span>
      <span class="field-input le-in"><input name="${prefix}.lap.${k}.strokes" value="${l.strokes ?? ''}" inputmode="numeric" placeholder="-"><em>회</em></span>
    </li>`).join('');
}
