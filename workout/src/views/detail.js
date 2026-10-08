// 종목별 상세 화면 (명세 3-4)
// 위계: 1순위 운동 시간(단독 한 줄, 가장 크게) → 2순위 2~3개 → 3순위 작고 회색
import { SPORT_META, STROKE_NAMES } from '../sports.js';
import { formatDuration, formatPace } from '../format.js';
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
          sub('평균 케이던스', day.avg_cadence == null ? '-' : `${int(day.avg_cadence)} spm`),
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
      ${strokeSection(day)}
    </div>`;
}
