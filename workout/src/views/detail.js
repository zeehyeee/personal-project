// 종목별 상세 화면 (명세 3-4)
// 위계: 1순위 운동 시간(단독 한 줄, 가장 크게) → 2순위 2~3개 → 3순위 작고 회색
import { SPORT_META, STROKE_NAMES, ZONE_KEYS, ZONE_META } from '../sports.js';
import { formatDuration, formatPace } from '../format.js';
import { flagRestLaps } from '../swim.js';
import { lapRows, lapEditRows } from './lap-editor.js';
import { recordsOn } from '../records.js';
import { esc, ICONS, SPORT_ICON, CONDITIONS, dateLabelFull, km, int, dec1, emptyState } from '../ui.js';

const metric = (label, value, unit = '', input = '') =>
  `<div class="m"><span class="m-value">${input || value}${(input || value !== '-') && unit ? `<small>${unit}</small>` : ''}</span><span class="m-label">${label}</span></div>`;
const sub = (label, value, input = '') => `<li><span>${label}</span><span>${input ? `${input}${value}` : value}</span></li>`;

// 보는 화면에서 바로 고치는 숫자 칸 (그날 기록이 1건일 때만. 여러 건을 합친 값은 어느 기록을 고칠지 모호해서)
// scale: 화면 단위 → 저장 단위 (km → m 는 1000)
const inl = (id, field, raw, { scale = 1, decimals = 0 } = {}) => {
  if (!id) return '';
  const v = raw == null ? '' : decimals ? (raw / scale).toFixed(decimals) : String(Math.round(raw / scale));
  return `<input class="inl" data-inline="${field}" data-session="${esc(id)}" data-scale="${scale}" inputmode="decimal" value="${v}" placeholder="-" style="width:${Math.max(2, v.length) + 0.6}ch" aria-label="${field}">`;
};

function levels(day, id) {
  const pace = (v) => (v == null ? '-' : formatPace(v));
  switch (day.sport) {
    case 'swim': {
      const ls = day.swim.lapStats;
      return {
        second: [
          metric('거리', int(day.distance_m), 'm', inl(id, 'distance_m', day.distance_m || null)),
          metric('칼로리', int(day.kcal), 'kcal', inl(id, 'kcal', day.kcal || null)),
          metric('총 반복횟수', int(day.swim.laps), '회', inl(id, 'swim_laps', day.swim.laps || null)),
        ],
        third: [
          sub('수영 페이스 (구간 기준)', ls ? `${pace(ls.pacePer100Sec)} /100m` : '-'),
          sub('평균 SWOLF (휴식 제외)', ls ? dec1(ls.avgSwolf) : '-'),
          sub('평균 심박수', id ? ' bpm' : day.avg_hr == null ? '-' : `${int(day.avg_hr)} bpm`, inl(id, 'avg_hr', day.avg_hr)),
          sub('수영장 길이', id ? 'm' : day.swim.pools.map((p) => `${p}m`).join(' · '), inl(id, 'pool_length_m', day.swim.pools[0])),
        ],
      };
    }
    case 'bike':
      return {
        second: [
          metric('거리', km(day.distance_m), 'km', inl(id, 'distance_m', day.distance_m || null, { scale: 1000, decimals: 2 })),
          metric('칼로리', int(day.kcal), 'kcal', inl(id, 'kcal', day.kcal || null)),
          metric('평균 속도', dec1(day.speed_kmh), 'km/h'),
        ],
        third: [sub('평균 심박수', id ? ' bpm' : day.avg_hr == null ? '-' : `${int(day.avg_hr)} bpm`, inl(id, 'avg_hr', day.avg_hr))],
      };
    default: // run, walk
      return {
        second: [
          metric('거리', km(day.distance_m), 'km', inl(id, 'distance_m', day.distance_m || null, { scale: 1000, decimals: 2 })),
          metric('칼로리', int(day.kcal), 'kcal', inl(id, 'kcal', day.kcal || null)),
          metric('평균 페이스', pace(day.pace_sec_per_km), '/km'),
        ],
        third: [
          sub('평균 심박수', id ? ' bpm' : day.avg_hr == null ? '-' : `${int(day.avg_hr)} bpm`, inl(id, 'avg_hr', day.avg_hr)),
          ...(day.sport === 'run' ? [sub('평균 케이던스', id ? ' spm' : day.avg_cadence == null ? '-' : `${int(day.avg_cadence)} spm`, inl(id, 'avg_cadence', day.avg_cadence))] : []),
        ],
      };
  }
}

// 영법별 기록: 영법이 2개 이상일 때만
function strokeSection(day) {
  const ls = day.swim?.lapStats;
  if (!ls?.showByStroke) return '';
  const rows = ls.byStroke.map((s) => `
    <div class="stroke">
      <div class="stroke-head">
        <b>${esc(STROKE_NAMES[s.stroke] ?? s.stroke)}</b>
        <span>${s.lapCount}회 · ${Math.round(s.share * 100)}%</span>
      </div>
      <div class="bar"><i style="width:${(s.share * 100).toFixed(1)}%"></i></div>
      <ul class="sub">
        ${sub('평균 페이스', `${formatPace(s.pacePer100Sec)} /100m`)}
        ${sub('구간당 스트로크', `${dec1(s.strokesPerLap)}스트로크`)}
        ${sub('평균 SWOLF', dec1(s.avgSwolf))}
      </ul>
    </div>`).join('');
  const medley = ls.byStroke.some((s) => s.stroke === 'medley')
    ? '<p class="note">혼영·기타: 삼성헬스가 한 영법으로 판단하지 못한 구간이에요. 드릴, 킥, 영법을 섞은 연습 등이 여기에 들어가요.</p>'
    : '';
  return `<section class="card"><h2>영법별 기록</h2><p class="muted">반복 횟수 기준 비중</p>${rows}${medley}</section>`;
}

function lapNote(day) {
  const ls = day.swim?.lapStats;
  if (day.sport !== 'swim') return '';
  if (!ls) return '<p class="note">구간 기록이 없어 페이스·SWOLF를 계산하지 못했어요.</p>';
  return ls.restExcluded ? `<p class="note">휴식 포함 ${ls.restExcluded}구간 제외</p>` : '';
}

export function renderDetail(state, date, sport) {
  const day = state.days[date]?.[sport];
  const back = `<button class="icon-btn" data-action="back" aria-label="뒤로">${ICONS.left}</button>`;
  if (!day) {
    return `<div class="detail">${back}<section class="card">${emptyState('기록을 찾을 수 없어요.')}</section></div>`;
  }
  const editId = day.sessionCount === 1 ? day.sessionIds[0] : null;
  const { second, third } = levels(day, editId);
  const prs = recordsOn(state.days, sport, date);
  const badges = prs.length
    ? `<div class="pr-badges">${prs.map((r) => `<span class="pr-badge" title="이전 최고 ${esc(r.previous)}">🏅 ${r.label} 신기록 · ${esc(r.text)}</span>`).join('')}</div>`
    : '';
  return `
    <div class="detail" style="--c: var(--${sport})">
      <div class="detail-head">
        ${back}
        <span class="detail-icon">${SPORT_ICON[sport]}</span>
        <div>
          <h2>${SPORT_META[sport].name}</h2>
          <p class="muted">${dateLabelFull(date)}${day.sessionCount > 1 ? ` · ${day.sessionCount}세션 합산` : ''}</p>
        </div>
      </div>
      ${badges}
      <section class="card">
        <div class="primary">
          <span class="m-label">운동 시간</span>
          <span class="primary-value">${formatDuration(day.duration_sec)}</span>
        </div>
        <div class="secondary">${second.join('')}</div>
        <ul class="sub">${third.join('')}</ul>
        ${lapNote(day)}
        ${editId ? '<p class="note inl-hint">숫자를 눌러 바로 고칠 수 있어요</p>' : ''}
      </section>
      ${noteSection(state, day)}
      ${zoneSection(day)}
      ${strokeSection(day)}
      ${lapSection(state, day)}
      ${sessionList(state, day)}
    </div>`;
}

// 운동 강도: 삼성헬스 심박 구간별 시간. 강도 합보다 운동 시간이 길면 나머지는 '그 외'
function zoneSection(day) {
  const zones = ZONE_KEYS.filter((k) => day[k] > 0).map((k) => ({ ...ZONE_META[k], min: day[k] }));
  if (!zones.length) return '';
  const total = Math.max(day.zone_duration_sec / 60, zones.reduce((a, z) => a + z.min, 0));
  const partial = day.zone_sessions < day.sessionCount;
  const rest = Math.max(0, Math.round(total - zones.reduce((a, z) => a + z.min, 0)));
  const all = rest ? [...zones, { name: '그 외', color: 'var(--grey-200)', min: rest }] : zones;
  const hard = zones.filter((z) => z.name !== '중강도' && z.name !== '저강도').reduce((a, z) => a + z.min, 0);
  return `
    <section class="card">
      <h2>운동 강도</h2>
      <p class="muted">${hard ? `고강도 이상 ${hard}분 · 운동 시간의 ${Math.round((hard / total) * 100)}%` : '심박 구간별 시간'}${partial ? ` · ${day.sessionCount}세션 중 ${day.zone_sessions}세션 기준` : ''}</p>
      <div class="zone-bar">${all.map((z) => `<i style="flex:${z.min}; background:${z.color}"></i>`).join('')}</div>
      <ul class="sub zone-list">${all.map((z) => `<li><span><i class="zdot" style="background:${z.color}"></i>${z.name}</span><span>${z.min}분</span></li>`).join('')}</ul>
    </section>`;
}

// 구간 기록: 삼성헬스 구간 화면처럼 구간마다 영법·값·막대. 시간·스트로크·SWOLF 중 골라 본다
const LAP_METRICS = [['time', '시간'], ['strokes', '스트로크'], ['swolf', 'SWOLF']];
const STROKE_COLOR = { freestyle: '#3182f6', backstroke: '#8b5cf6', breaststroke: '#14b8a6', medley: '#f59e0b', butterfly: '#ec4899' };
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function lapSection(state, day) {
  if (day.sport !== 'swim') return '';
  const mult = Number(state.db.settings.swim_rest_multiplier) || 2;
  const sessions = state.db.sessions.filter((s) => day.sessionIds.includes(s.id)).sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
  const groups = sessions.map((s) => ({
    s,
    laps: flagRestLaps(state.db.laps.filter((l) => l.session_id === s.id).sort((a, b) => a.lap_no - b.lap_no), mult),
  }));
  const editors = groups.map((g) => lapEditCard(g.s, g.laps, groups.length > 1)).join('');
  const withLaps = groups.filter((g) => g.laps.length);
  if (!withLaps.length) return editors;
  return lapView(state, withLaps) + editors;
}

// 구간 채우기·고치기: 구간이 없으면 캡처로 채우거나 직접 입력, 있으면 접어 둔 고치기
function lapEditCard(s, laps, many) {
  const rows = lapRows(laps, s.swim_laps);
  if (!rows.length) return '';
  const empty = !laps.length;
  const form = `
    <form class="lap-form" data-lap-session="${esc(s.id)}" novalidate>
      <ul class="lap-edits">${lapEditRows(rows, 'L')}</ul>
      <span class="field-error" data-error="L.laps"></span>
      <button class="submit" type="submit" style="margin-top:12px; width:100%">구간 저장</button>
    </form>`;
  const pick = `<label class="set-btn">구간 캡처로 채우기<input type="file" class="lap-capture-input" data-session="${esc(s.id)}" accept="image/*" multiple hidden></label>`;
  const when = many && s.start_time ? ` · ${esc(s.start_time)} 세션` : '';
  if (empty) {
    return `
    <section class="card">
      <h2>구간 기록${when}</h2>
      <p class="muted">${s.swim_laps}구간 기록이 없어요. 삼성헬스 구간 화면(시간·스트로크)을 올리면 채워져요.</p>
      ${pick}
      <details class="lap-details"><summary>직접 입력</summary>${form}</details>
    </section>`;
  }
  return `
    <section class="card lap-edit-card">
      <details class="lap-details"><summary>구간 고치기${when}</summary>${form}${pick}</details>
    </section>`;
}

function lapView(state, groups) {
  const metric = state.lapMetric ?? 'time';
  const val = (l) => (metric === 'time' ? l.time_sec : metric === 'strokes' ? l.strokes : l.time_sec != null && l.strokes != null ? l.time_sec + l.strokes : null);
  const fmt = (v) => (v == null ? '-' : metric === 'time' ? mmss(v) : String(v));
  const all = groups.flatMap((g) => g.laps);
  // 막대 길이·평균·최고는 휴식이 섞인 구간을 빼고 (스트로크는 휴식과 무관하니 전부)
  const fair = all.filter((l) => val(l) != null && (metric === 'strokes' || !l.rest));
  const max = Math.max(1, ...fair.map(val));
  const avg = fair.length ? fair.reduce((a, l) => a + val(l), 0) / fair.length : null;
  const best = fair.length ? Math.min(...fair.map(val)) : null;
  const rows = groups.map((g) => `
    ${groups.length > 1 ? `<li class="lap-sep">${esc(g.s.start_time || '')} 세션</li>` : ''}
    ${g.laps.map((l) => {
      const v = val(l);
      const isRest = l.rest && metric !== 'strokes';
      const w = v == null ? 0 : Math.min(100, (v / max) * 100);
      return `<li class="lap ${isRest ? 'rest' : ''}">
        <span class="lap-no">${l.lap_no}</span>
        <span class="lap-bar"><i style="width:${w}%; background:${STROKE_COLOR[l.stroke] ?? 'var(--swim)'}"></i><em>${esc(STROKE_NAMES[l.stroke] ?? l.stroke)}</em></span>
        <span class="lap-val">${fmt(v)}${isRest ? '<small>휴식</small>' : v != null && v === best ? '<small class="best">최고</small>' : ''}</span>
      </li>`;
    }).join('')}`).join('');
  return `
    <section class="card">
      <div class="trend-head">
        <h2>구간 기록</h2>
        <div class="pills" role="tablist">${LAP_METRICS.map(([k, l]) => `<button role="tab" aria-selected="${k === metric}" data-lap-metric="${k}">${l}</button>`).join('')}</div>
      </div>
      <p class="muted">${all.length}구간 · ${avg != null ? `평균 ${fmt(Math.round(avg * 10) / 10 === Math.round(avg) ? Math.round(avg) : Math.round(avg * 10) / 10)}${metric === 'strokes' ? '' : ' (휴식 제외)'}` : ''}</p>
      <ul class="laps">${rows}</ul>
    </section>`;
}

// 컨디션·한 줄 메모: 그날 그 종목의 첫 세션에 저장한다
function noteSection(state, day) {
  const s = daySessions(state, day)[0];
  const chips = CONDITIONS.map(([k, e, label]) => `
    <button type="button" class="cond-btn" aria-pressed="${s.condition === k}" data-condition="${k}" data-session="${esc(s.id)}"><span>${e}</span>${label}</button>`).join('');
  return `
    <section class="card note-card">
      <h2>운동 어땠어요?</h2>
      <div class="conds">${chips}</div>
      <form class="memo-form" id="memo-form" data-session="${esc(s.id)}">
        <span class="field-input"><input name="memo" maxlength="100" autocomplete="off" placeholder="한 줄 메모 (예: 킥판 연습)" value="${esc(s.memo ?? '')}"></span>
        <button class="memo-save" type="submit">저장</button>
      </form>
    </section>`;
}

const daySessions = (state, day) => state.db.sessions
  .filter((s) => day.sessionIds.includes(s.id))
  .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

const SOURCE = { manual: '직접 입력', capture: '캡처', demo: '예시' };

// 잘못 넣은 기록을 고치거나 지울 수 있게 세션 단위로 보여준다
function sessionList(state, day) {
  const rows = daySessions(state, day)
    .map((s) => `
      <li>
        <span>${s.start_time ? esc(s.start_time) + ' · ' : ''}${formatDuration(s.duration_sec)} · ${SOURCE[s.source] ?? esc(s.source)}</span>
        <span><button class="edit" data-edit="${esc(s.id)}">수정</button><button data-delete="${esc(s.id)}">삭제</button></span>
      </li>`).join('');
  return `<section class="sessions"><p class="muted">기록 ${day.sessionCount}건</p><ul>${rows}</ul></section>`;
}
