// 직접 입력 폼 값 → sessions 행. 화면과 분리해 테스트한다.
import { DEFAULT_SETTINGS, ZONE_KEYS } from './sports.js';

const num = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

// form: { sport, date, start_time, h, m, s, distance, kcal, avg_hr, avg_cadence, swim_laps, swim_total_strokes }
// distance 단위: 수영은 m, 나머지는 km
export function buildManualSession(form, settings = DEFAULT_SETTINGS, id = crypto.randomUUID()) {
  const errors = {};
  const sport = form.sport;
  if (!['walk', 'run', 'bike', 'swim'].includes(sport)) errors.sport = '종목을 골라주세요';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date ?? '')) errors.date = '날짜를 확인해주세요';
  if (form.start_time && !/^\d{2}:\d{2}$/.test(form.start_time)) errors.start_time = '시각을 확인해주세요';

  const [h, m, s] = [form.h, form.m, form.s].map((v) => num(v) ?? 0);
  const duration = h * 3600 + m * 60 + s;
  if (![h, m, s].every((v) => Number.isFinite(v) && v >= 0) || m >= 60 || s >= 60) errors.duration = '시간을 확인해주세요';
  else if (duration <= 0) errors.duration = '운동 시간을 입력해주세요';

  const fields = {};
  for (const key of ['distance', 'kcal', 'avg_hr', 'avg_cadence', 'swim_laps', 'swim_total_strokes', 'pool_length_m', ...ZONE_KEYS]) {
    const v = num(form[key]);
    if (Number.isNaN(v) || (v != null && v < 0)) errors[key] = '숫자를 확인해주세요';
    fields[key] = Number.isNaN(v) ? null : v;
  }
  if (Object.keys(errors).length) return { errors };

  const distance_m = fields.distance == null ? null : sport === 'swim' ? fields.distance : Math.round(fields.distance * 1000);
  // 수영장 길이: 입력값 → 설정의 기본값
  const pool = fields.pool_length_m || Number(settings.pool_length_m) || 25;
  const session = {
    id,
    date: form.date,
    start_time: form.start_time || '',
    sport,
    duration_sec: duration,
    distance_m,
    kcal: fields.kcal,
    avg_hr: fields.avg_hr,
    avg_cadence: sport === 'run' ? fields.avg_cadence : null,
    swim_laps: null,
    swim_total_strokes: null,
    pool_length_m: null,
    ...Object.fromEntries(ZONE_KEYS.map((k) => [k, fields[k]])),
    source: 'manual',
  };
  if (sport === 'swim') {
    // 반복 횟수를 비우면 거리 ÷ 수영장 길이로 채운다
    session.swim_laps = fields.swim_laps ?? (distance_m ? Math.round(distance_m / pool) : null);
    session.swim_total_strokes = fields.swim_total_strokes;
    session.pool_length_m = pool;
  }
  return { session };
}

// 기록 수정: 저장된 기록 → 직접 입력 폼 초안 (거리는 수영 m, 나머지 km)
export function formFromSession(s) {
  const str = (v) => (v == null ? '' : String(v));
  const d = Math.round(s.duration_sec || 0);
  return {
    editId: s.id,
    sport: s.sport,
    date: s.date,
    start_time: s.start_time || '',
    h: str(Math.floor(d / 3600) || ''),
    m: str(Math.floor((d % 3600) / 60) || ''),
    s: str(d % 60 || ''),
    distance: s.distance_m == null ? '' : s.sport === 'swim' ? str(s.distance_m) : str(Math.round(s.distance_m) / 1000),
    kcal: str(s.kcal),
    avg_hr: str(s.avg_hr),
    avg_cadence: str(s.avg_cadence),
    pool_length_m: str(s.pool_length_m),
    swim_laps: str(s.swim_laps),
    swim_total_strokes: str(s.swim_total_strokes),
    ...Object.fromEntries(ZONE_KEYS.map((k) => [k, str(s[k])])),
  };
}

// 수정한 값을 원래 기록에 덮는다. 출처·컨디션·메모, 폼에 칸이 없는 값(저강도, 걷기 케이던스)은 원래 값 유지
export function applyEdit(original, edited) {
  const { source, ...fields } = edited;
  const out = { ...original, ...fields };
  if (edited.sport === original.sport) {
    out.zone_low_min = original.zone_low_min ?? null;
    if (edited.sport !== 'run') out.avg_cadence = original.avg_cadence ?? null;
  }
  return out;
}

// 캡처 확인 화면의 '구간 고치기' 입력 → swim_laps 행. 시간은 '0:46'·'46'(초) 모두 받는다.
// 시간·스트로크가 둘 다 빈 행(채우지 않은 빠진 구간)은 저장하지 않는다
export function lapsFromForm(values, prefix, sessionId) {
  const laps = [];
  const errors = [];
  for (let k = 0; values[`${prefix}.lap.${k}.no`] != null; k++) {
    const v = (name) => String(values[`${prefix}.lap.${k}.${name}`] ?? '').trim();
    const lap_no = Number(v('no'));
    const timeText = v('time'), strokeText = v('strokes');
    if (!timeText && !strokeText) continue;
    let time_sec = null;
    if (timeText) {
      const m = timeText.match(/^(?:(\d+):)?(\d{1,2})$/);
      if (!m || (m[1] != null && Number(m[2]) >= 60)) { errors.push(`구간 ${lap_no} 시간을 0:46처럼 적어주세요`); continue; }
      time_sec = Number(m[1] ?? 0) * 60 + Number(m[2]);
    }
    const strokes = strokeText ? Number(strokeText) : null;
    if (strokes != null && !(Number.isInteger(strokes) && strokes >= 0)) { errors.push(`구간 ${lap_no} 스트로크를 확인해주세요`); continue; }
    laps.push({ session_id: sessionId, lap_no, stroke: v('stroke') || 'freestyle', time_sec, strokes });
  }
  return { laps, errors };
}
