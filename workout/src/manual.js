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
  for (const key of ['distance', 'kcal', 'avg_hr', 'avg_cadence', 'swim_laps', 'swim_total_strokes', ...ZONE_KEYS]) {
    const v = num(form[key]);
    if (Number.isNaN(v) || (v != null && v < 0)) errors[key] = '숫자를 확인해주세요';
    fields[key] = Number.isNaN(v) ? null : v;
  }
  if (Object.keys(errors).length) return { errors };

  const distance_m = fields.distance == null ? null : sport === 'swim' ? fields.distance : Math.round(fields.distance * 1000);
  const pool = Number(settings.pool_length_m) || 25;
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
    ...Object.fromEntries(ZONE_KEYS.map((k) => [k, fields[k]])),
    source: 'manual',
  };
  if (sport === 'swim') {
    // 반복 횟수를 비우면 거리 ÷ 수영장 길이로 채운다
    session.swim_laps = fields.swim_laps ?? (distance_m ? Math.round(distance_m / pool) : null);
    session.swim_total_strokes = fields.swim_total_strokes;
  }
  return { session };
}
