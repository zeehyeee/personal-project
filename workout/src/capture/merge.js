// 캡처 여러 장에서 읽은 값 → 저장할 세션·구간 + 확인 화면 안내
// 아무 순서·아무 화면이나 섞여 와도 된다. 같은 종목에서 운동 시간이 같은 값끼리 한 세션으로 묶는다.
import { inferDate } from '../dates.js';
import { findMissingLaps } from '../swim.js';
import { SPORT_META, ZONE_KEYS } from '../sports.js';

const SAME_DURATION_SEC = 2;
const near = (a, b) => a != null && b != null && Math.abs(a - b) <= SAME_DURATION_SEC;

function resolveDate(d, today) {
  if (!d) return null;
  return inferDate(d.month, d.day, d.weekday, today);
}

// items: extractImage 결과를 모두 이어 붙인 배열 ({ kind, sport, ... })
export function mergeCaptures(items, { today, newId = () => crypto.randomUUID() }) {
  const groups = []; // { sport, duration_sec, date, start_time, fields, sources:Set }
  const notes = [];
  const findGroup = (sport, duration, tol) => groups.find((g) => g.sport === sport && (tol ? Math.abs(g.duration_sec - duration) <= tol : near(g.duration_sec, duration)));
  // 헤더의 `오전 10:40 - 오전 11:49` 안에 들어가는 세션 (운동 시간 ≤ 총 시간, 쉰 시간은 20분까지)
  const byWindow = (sport, start, end) => {
    if (!start || !end) return null;
    const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    const win = ((mins(end) - mins(start) + 1440) % 1440) * 60;
    const fit = groups.filter((g) => g.sport === sport && !g.fields.date && g.duration_sec <= win + 60 && g.duration_sec >= win - 1200);
    return fit.sort((a, b) => (win - a.duration_sec) - (win - b.duration_sec))[0] ?? null;
  };
  const add = (sport, duration, patch, source) => {
    let g = findGroup(sport, duration);
    if (!g) groups.push((g = { sport, duration_sec: duration, fields: {}, sources: new Set() }));
    for (const [k, v] of Object.entries(patch)) if (v != null && g.fields[k] == null) g.fields[k] = v;
    g.sources.add(source);
    return g;
  };

  // 1) 전체보기: 날짜·시작 시각·운동 시간 (세션의 뼈대)
  for (const it of items.filter((i) => i.kind === 'daily')) {
    const date = resolveDate(it.date, today);
    for (const row of it.rows) {
      const sport = row.sport ?? it.sport;
      if (!sport) continue;
      add(sport, row.duration_sec, { date, start_time: row.start_time, distance_m: row.distance_m, kcal: row.kcal }, 'daily');
    }
    if (it.sessionCount && it.rows.length < it.sessionCount) {
      notes.push(`${SPORT_META[it.sport]?.name ?? ''} 세션 ${it.sessionCount}개 중 ${it.rows.length}개만 보였어요. 전체보기를 스크롤해서 한 장 더 올려주세요.`);
    }
  }

  // 2) 상세정보: 칼로리·심박 등. 운동 시간이 없는 조각(아래쪽만 캡처)은 그 종목 세션이 하나일 때만 붙인다
  for (const it of items.filter((i) => i.kind === 'detail' && i.sport)) {
    const { kind, sport, image, duration_sec, ...rest } = it;
    if (sport !== 'swim') delete rest.pool_length_m;
    if (sport !== 'run') delete rest.avg_cadence;
    if (duration_sec != null) add(sport, duration_sec, rest, 'detail');
    else {
      const same = groups.filter((g) => g.sport === sport);
      if (same.length === 1) Object.entries(rest).forEach(([k, v]) => { if (same[0].fields[k] == null) same[0].fields[k] = v; });
    }
  }

  // 3) 결과 헤더: 날짜·시작 시각. 운동 시간이나 시작 시각으로 세션을 찾는다
  for (const it of items.filter((i) => i.kind === 'header' && i.sport)) {
    const date = resolveDate(it.date, today);
    const tol = it.duration_has_sec === false ? 60 : 0;
    const g = (it.duration_sec != null && findGroup(it.sport, it.duration_sec, tol))
      || groups.find((x) => x.sport === it.sport && x.fields.start_time === it.start_time)
      || byWindow(it.sport, it.start_time, it.end_time)
      || (groups.filter((x) => x.sport === it.sport).length === 1 ? groups.find((x) => x.sport === it.sport) : null);
    if (g) {
      if (!g.fields.date) g.fields.date = date;
      if (!g.fields.start_time) g.fields.start_time = it.start_time;
    } else if (it.duration_sec != null) {
      add(it.sport, it.duration_sec, { date, start_time: it.start_time }, 'header');
    }
  }

  // 3-1) 운동 강도: 시간 정보가 없어 같은 종목 세션 중 강도 합이 운동 시간 안에 드는 세션에 붙인다(여럿이면 가장 긴 세션)
  for (const it of items.filter((i) => i.kind === 'zones')) {
    const { kind, sport, image, ...zones } = it;
    const total = Object.values(zones).reduce((a, b) => a + b, 0);
    const fits = groups.filter((g) => g.sport === sport && g.duration_sec / 60 + 1 >= total).sort((a, b) => b.duration_sec - a.duration_sec);
    if (fits[0]) Object.entries(zones).forEach(([k, v]) => { if (fits[0].fields[k] == null) fits[0].fields[k] = v; });
  }

  // 4) 수영 구간
  const laps = mergeLapItems(items);
  const swims = groups.filter((g) => g.sport === 'swim');
  let lapOwner = null;
  if (laps.length) {
    const maxLap = laps[laps.length - 1].lap_no;
    lapOwner = swims.length === 1 ? swims[0] : swims.find((g) => g.fields.swim_laps === maxLap) ?? null;
    if (!swims.length) notes.push('수영 구간은 읽었지만 수영 요약이나 전체보기 캡처가 없어 저장할 수 없어요.');
    else if (!lapOwner) notes.push('수영이 여러 번이라 구간이 어느 수영인지 알 수 없어요. 수영 한 번씩 나눠서 올려주세요.');
  }

  const sessions = groups.map((g) => {
    const f = g.fields;
    const warnings = [];
    const dateInfo = f.date ?? null;
    if (!dateInfo) warnings.push('날짜를 찾지 못했어요. 날짜를 확인해주세요.');
    else if (dateInfo.needsConfirm) warnings.push('요일이 맞지 않아요. 날짜를 확인해주세요.');
    const id = newId();
    const session = {
      id,
      date: dateInfo?.date ?? today,
      start_time: f.start_time ?? '',
      sport: g.sport,
      duration_sec: g.duration_sec,
      distance_m: f.distance_m ?? null,
      kcal: f.kcal ?? null,
      avg_hr: f.avg_hr ?? null,
      avg_cadence: g.sport === 'run' ? f.avg_cadence ?? null : null,
      swim_laps: g.sport === 'swim' ? f.swim_laps ?? null : null,
      swim_total_strokes: g.sport === 'swim' ? f.swim_total_strokes ?? null : null,
      pool_length_m: g.sport === 'swim' ? f.pool_length_m ?? null : null,
      ...zoneFields(f),
      source: 'capture',
    };
    if (g.sport === 'swim') {
      const fix = checkSwimDistance(session, g === lapOwner ? laps : []);
      if (fix) {
        session.distance_m = fix.distance;
        warnings.push(fix.warning);
      }
    }
    let sessionLaps = [];
    if (g === lapOwner) {
      sessionLaps = laps.map((l) => ({ session_id: id, ...l }));
      warnings.push(...lapWarnings(session, laps));
    } else if (g.sport === 'swim' && !laps.length) {
      warnings.push('수영 구간 화면이 없어 페이스·SWOLF·영법별 기록은 비어 있어요.');
    }
    // 칼로리가 운동 시간에 비해 말이 안 되게 크면(예: 92 kcal 옆 숫자가 붙어 92163) 확인 요청
    const kcalOdd = session.kcal != null && session.duration_sec > 0 && session.kcal / (session.duration_sec / 60) > 25;
    if (kcalOdd) warnings.push(`칼로리 ${session.kcal}kcal는 운동 시간에 비해 너무 커요. 아래에서 확인해주세요.`);
    return { session, laps: sessionLaps, warnings, needsDate: !dateInfo || dateInfo.needsConfirm, needsEdit: kcalOdd };
  });

  sessions.sort((a, b) => (a.session.date + a.session.start_time).localeCompare(b.session.date + b.session.start_time));
  return { sessions, notes };
}

// 수영 구간: 같은 구간 번호는 합친다 (시간 화면 + 스트로크 화면, 겹치는 스크롤)
export function mergeLapItems(items) {
  const lapMap = new Map();
  for (const it of items.filter((i) => i.kind === 'laps')) {
    for (const r of it.rows) {
      const lap = lapMap.get(r.lap_no) ?? { lap_no: r.lap_no, stroke: r.stroke, time_sec: null, strokes: null };
      if (it.metric === 'time' && lap.time_sec == null) lap.time_sec = r.value;
      if (it.metric === 'strokes' && lap.strokes == null) lap.strokes = r.value;
      lap.stroke ??= r.stroke;
      lapMap.set(r.lap_no, lap);
    }
  }
  return [...lapMap.values()].sort((a, b) => a.lap_no - b.lap_no);
}

const zoneFields = (f) => Object.fromEntries(ZONE_KEYS.map((k) => [k, f[k] ?? null]));

// 수영 거리 확인: 반복 횟수 × 수영장 길이와 크게 다르면 OCR 이 잘못 읽은 것 (예: 675m → 6m)
export function checkSwimDistance(session, laps = []) {
  const count = session.swim_laps ?? (laps.length ? laps[laps.length - 1].lap_no : null);
  if (!count) return null;
  const pool = session.pool_length_m || 25;
  const expected = count * pool;
  const d = session.distance_m;
  if (d != null && d >= expected * 0.5 && d <= expected * 1.5) return null;
  return {
    distance: expected,
    warning: d == null
      ? `거리를 찾지 못해 ${count}구간 × ${pool}m = ${expected}m로 넣었어요. 확인해주세요.`
      : `거리를 ${d}m로 읽었는데 ${count}구간 × ${pool}m(${expected}m)와 달라 ${expected}m로 고쳤어요. 확인해주세요.`,
  };
}

function lapWarnings(session, laps) {
  const out = [];
  const expected = session.swim_laps ?? laps[laps.length - 1].lap_no;
  const range = (rs) => rs.map(([a, b]) => (a === b ? `${a}` : `${a}~${b}`)).join(', ');
  const missing = findMissingLaps(laps.map((l) => l.lap_no), expected);
  if (missing.length) out.push(`구간 ${range(missing)}이 없어요. 구간 화면을 더 올리거나 아래 '구간 고치기'에서 넣어주세요.`);
  const noTime = laps.filter((l) => l.time_sec == null).map((l) => l.lap_no);
  const noStroke = laps.filter((l) => l.strokes == null).map((l) => l.lap_no);
  if (noTime.length === laps.length) out.push('구간 시간 화면이 없어 페이스를 계산할 수 없어요.');
  else if (noTime.length) out.push(`구간 ${range(toRanges(noTime))}의 시간이 없어요. 아래 '구간 고치기'에서 바로 넣을 수 있어요.`);
  if (noStroke.length === laps.length) out.push('구간 스트로크 화면이 없어 SWOLF를 계산할 수 없어요.');
  else if (noStroke.length) out.push(`구간 ${range(toRanges(noStroke))}의 스트로크가 없어요. 아래 '구간 고치기'에서 바로 넣을 수 있어요.`);
  const sum = laps.reduce((a, l) => a + (l.strokes ?? 0), 0);
  if (!noStroke.length && !missing.length && session.swim_total_strokes != null && sum !== session.swim_total_strokes) {
    out.push(`구간 스트로크 합(${sum})이 요약의 총 스트로크(${session.swim_total_strokes})와 달라요. 숫자를 확인해주세요.`);
  }
  return out;
}

function toRanges(nums) {
  const r = [];
  for (const n of nums) {
    const last = r[r.length - 1];
    if (last && last[1] === n - 1) last[1] = n;
    else r.push([n, n]);
  }
  return r;
}
