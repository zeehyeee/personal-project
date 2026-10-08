// 캡처 여러 장에서 읽은 값 → 저장할 세션·구간 + 확인 화면 안내
// 아무 순서·아무 화면이나 섞여 와도 된다. 같은 종목에서 운동 시간이 같은 값끼리 한 세션으로 묶는다.
import { inferDate } from '../dates.js';
import { findMissingLaps } from '../swim.js';
import { SPORT_META } from '../sports.js';

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
  const findGroup = (sport, duration) => groups.find((g) => g.sport === sport && near(g.duration_sec, duration));
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
    const { kind, sport, image, duration_sec, pool_length_m, ...rest } = it;
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
    const g = (it.duration_sec != null && findGroup(it.sport, it.duration_sec))
      || groups.find((x) => x.sport === it.sport && x.fields.start_time === it.start_time)
      || (groups.filter((x) => x.sport === it.sport).length === 1 ? groups.find((x) => x.sport === it.sport) : null);
    if (g) {
      if (!g.fields.date) g.fields.date = date;
      if (!g.fields.start_time) g.fields.start_time = it.start_time;
    } else if (it.duration_sec != null) {
      add(it.sport, it.duration_sec, { date, start_time: it.start_time }, 'header');
    }
  }

  // 4) 수영 구간: 같은 구간 번호는 합친다 (시간 화면 + 스트로크 화면, 겹치는 스크롤)
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
  const laps = [...lapMap.values()].sort((a, b) => a.lap_no - b.lap_no);
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
      source: 'capture',
    };
    let sessionLaps = [];
    if (g === lapOwner) {
      sessionLaps = laps.map((l) => ({ session_id: id, ...l }));
      warnings.push(...lapWarnings(session, laps));
    } else if (g.sport === 'swim' && !laps.length) {
      warnings.push('수영 구간 화면이 없어 페이스·SWOLF·영법별 기록은 비어 있어요.');
    }
    return { session, laps: sessionLaps, warnings, needsDate: !dateInfo || dateInfo.needsConfirm };
  });

  sessions.sort((a, b) => (a.session.date + a.session.start_time).localeCompare(b.session.date + b.session.start_time));
  return { sessions, notes };
}

function lapWarnings(session, laps) {
  const out = [];
  const expected = session.swim_laps ?? laps[laps.length - 1].lap_no;
  const range = (rs) => rs.map(([a, b]) => (a === b ? `${a}` : `${a}~${b}`)).join(', ');
  const missing = findMissingLaps(laps.map((l) => l.lap_no), expected);
  if (missing.length) out.push(`구간 ${range(missing)}이 없어요. 구간 화면을 스크롤해서 더 올려주세요.`);
  const noTime = laps.filter((l) => l.time_sec == null).map((l) => l.lap_no);
  const noStroke = laps.filter((l) => l.strokes == null).map((l) => l.lap_no);
  if (noTime.length === laps.length) out.push('구간 시간 화면이 없어 페이스를 계산할 수 없어요.');
  else if (noTime.length) out.push(`구간 ${range(toRanges(noTime))}의 시간이 없어요.`);
  if (noStroke.length === laps.length) out.push('구간 스트로크 화면이 없어 SWOLF를 계산할 수 없어요.');
  else if (noStroke.length) out.push(`구간 ${range(toRanges(noStroke))}의 스트로크가 없어요.`);
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
