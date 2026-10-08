// 종목별 상세 화면 (명세 3-4)
// 위계: 1순위 운동 시간(단독 한 줄, 가장 크게) → 2순위 2~3개 → 3순위 작고 회색
import { SPORT_META, STROKE_NAMES, ZONE_KEYS, ZONE_META } from '../sports.js';
import { formatDuration, formatPace } from '../format.js';
import { flagRestLaps } from '../swim.js';
import { esc, ICONS, SPORT_ICON, dateLabelFull, km, int, dec1 } from '../ui.js';

const metric = (label, value, unit = '') =>
  `<div class="m"><span class="m-value">${value}${value !== '-' && unit ? `<small>${unit}</small>` : ''}</span><span class="m-label">${label}</span></div>`;
const sub = (label, value) => `<li><span>${label}</span><span>${value}</span></li>`;

function levels(day) {
  const pace = (v) => (v == null ? '-' : formatPace(v));
  switch (day.sport) {
    case 'swim': {
      const ls = day.swim.lapStats;
      return {
        second: [
          metric('거리', int(day.distance_m), 'm'),
          metric('칼로리', int(day.kcal), 'kcal'),
          metric('총 반복횟수', int(day.swim.laps), '회'),
        ],
        third: [
          sub('수영 페이스 (구간 기준)', ls ? `${pace(ls.pacePer100Sec)} /100m` : '-'),
          sub('평균 SWOLF (휴식 제외)', ls ? dec1(ls.avgSwolf) : '-'),
          sub('평균 심박수', day.avg_hr == null ? '-' : `${int(day.avg_hr)} bpm`),
        ],
      };
    }
    case 'bike':
      return {
        second: [
          metric('거리', km(day.distance_m), 'km'),
          metric('칼로리', int(day.kcal), 'kcal'),
          metric('평균 속도', dec1(day.speed_kmh), 'km/h'),
        ],
        third: [sub('평균 심박수', day.avg_hr == null ? '-' : `${int(day.avg_hr)} bpm`)],
      };
    default: // run, walk
      return {
        second: [
          metric('거리', km(day.distance_m), 'km'),
          metric('칼로리', int(day.kcal), 'kcal'),
          metric('평균 페이스', pace(day.pace_sec_per_km), '/km'),
        ],
        third: [
          sub('평균 심박수', day.avg_hr == null ? '-' : `${int(day.avg_hr)} bpm`),
          ...(day.sport === 'run' ? [sub('평균 케이던스', day.avg_cadence == null ? '-' : `${int(day.avg_cadence)} spm`)] : []),
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
  return `<section class="card"><h2>영법별 기록</h2><p class="muted">반복 횟수 기준 비중</p>${rows}</section>`;
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
    return `<div class="detail">${back}<section class="card"><p class="muted">기록을 찾을 수 없어요.</p></section></div>`;
  }
  const { second, third } = levels(day);
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
      <section class="card">
        <div class="primary">
          <span class="m-label">운동 시간</span>
          <span class="primary-value">${formatDuration(day.duration_sec)}</span>
        </div>
        <div class="secondary">${second.join('')}</div>
        <ul class="sub">${third.join('')}</ul>
        ${lapNote(day)}
      </section>
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
  })).filter((g) => g.laps.length);
  if (!groups.length) return '';
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

const SOURCE = { manual: '직접 입력', capture: '캡처', demo: '예시' };

// 잘못 넣은 기록을 지울 수 있게 세션 단위로 보여준다
function sessionList(state, day) {
  const rows = state.db.sessions
    .filter((s) => day.sessionIds.includes(s.id))
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))
    .map((s) => `
      <li>
        <span>${s.start_time ? esc(s.start_time) + ' · ' : ''}${formatDuration(s.duration_sec)} · ${SOURCE[s.source] ?? esc(s.source)}</span>
        <button data-delete="${esc(s.id)}">삭제</button>
      </li>`).join('');
  return `<section class="sessions"><p class="muted">기록 ${day.sessionCount}건</p><ul>${rows}</ul></section>`;
}
