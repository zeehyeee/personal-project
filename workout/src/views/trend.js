// 추이 탭 (명세 3-3, 토스 패턴으로 정리)
// 종목 칩 → 이번 달 헤드라인(큰 숫자 + 지난달 대비) → 기간 알약 + 막대 그래프 + 선택한 기간
import { SPORTS, SPORT_META } from '../sports.js';
import { buildSeries, changeFromPrevious, monthSummary, formatAmount, periodLabel } from '../trend.js';
import { SPORT_ICON, dateLabelFull } from '../ui.js';
import { bestRecords } from '../records.js';
import { monthKey } from '../dates.js';

export const TARGETS = ['all', 'swim', 'run', 'walk', 'bike'];
const NAME = (t) => (t === 'all' ? '전체' : SPORT_META[t].name);
const MODES = [['day', '일별'], ['week', '주별'], ['month', '월별']];
const PREV = { day: '전날', week: '지난주', month: '지난달' };

const pct = (r) => `${r > 0 ? '+' : ''}${Math.round(r * 100)}%`;
const tone = (r) => (r == null || Math.round(r * 100) === 0 ? 'same' : r > 0 ? 'up' : 'down');

// 종목 고르기: 칩 한 줄 (화살표 대신)
function chips(state) {
  const t = state.trend.target;
  return `<nav class="chips-row" aria-label="종목">${TARGETS.map((x) => `
    <button class="chip-btn" aria-pressed="${x === t}" data-trend-target="${x}">${x === 'all' ? '' : `${SPORT_ICON[x]} `}${NAME(x)}</button>`).join('')}</nav>`;
}

// 이번 달 누적이 화면의 주인공: 배경 위 큰 숫자 + 한 줄 변화
function headline(state) {
  const t = state.trend.target;
  const m = monthSummary(state.days, t, state.today);
  const change = m.change == null ? '지난달 기록 없음' : `<span class="chg ${tone(m.change)}">지난달보다 ${pct(m.change)}</span>`;
  // 종목별 월 목표 횟수(설정): '이번 달 3/8회'
  const goal = t === 'all' ? 0 : Number(state.db.settings[`monthly_count_goal_${t}`]) || 0;
  const count = goal ? `<b class="goal ${m.activeDays >= goal ? 'done' : ''}">${m.activeDays}/${goal}회</b>` : `운동 ${m.activeDays}일`;
  return `
    <section class="page-hero">
      <span class="hero-label">이번 달 ${NAME(t)}</span>
      <span class="hero-value">${formatAmount(m.value, m.unit)}</span>
      <span class="hero-sub">${count} · ${change}</span>
    </section>`;
}

function axisLabel(bar, mode, i) {
  const d = Number(bar.start.slice(8)), mo = Number(bar.start.slice(5, 7));
  if (mode === 'day') return d === 1 || i === 0 ? `${mo}/${d}` : String(d);
  if (mode === 'week') return `${mo}/${d}`;
  return `${mo}월`;
}

function barFill(b, target, scale) {
  if (!(b.value > 0)) return '<span class="tbar-fill empty-fill" style="height:3px"></span>';
  if (target !== 'all') return `<span class="tbar-fill" style="height:${Math.max(6, b.value * scale)}px"></span>`;
  // 전체: 종목 색으로 쌓기 (아래부터 수영·달리기·걷기·자전거)
  const segs = SPORTS.filter((s) => b.parts[s] > 0)
    .map((s) => `<span class="seg" style="--c: var(--${s}); height:${Math.max(3, b.parts[s] * scale)}px"></span>`).reverse().join('');
  return `<span class="tbar-stack">${segs}</span>`;
}

function chart(state, series) {
  const { mode, target } = state.trend;
  const sel = state.trend.index;
  const h = 160;
  const scale = series.max > 0 ? (h - 8) / series.max : 0;
  const bars = series.bars.map((b, i) => `
    <button class="tbar ${b.value > 0 ? '' : 'empty'} ${i === sel ? 'sel' : ''}" data-trend-bar="${i}"
      aria-label="${periodLabel(b, mode)} ${formatAmount(b.value, series.unit)}">
      ${barFill(b, target, scale)}
      <span class="tbar-label">${axisLabel(b, mode, i)}</span>
    </button>`).join('');
  const avgY = series.average > 0 ? series.average * scale : null;
  const legend = target === 'all'
    ? `<div class="legend">${SPORTS.map((s) => `<span><i style="--c: var(--${s})"></i>${SPORT_META[s].name}</span>`).join('')}</div>`
    : '';
  return `
    <section class="card trend-card" style="--c: ${target === 'all' ? 'var(--grey-700)' : `var(--${target})`}">
      <div class="trend-head">
        <span class="muted">${series.average > 0 ? `평균 ${formatAmount(series.average, series.unit)}` : '아직 기록이 없어요'}</span>
        <div class="pills" role="tablist">${MODES.map(([k, l]) => `<button role="tab" aria-selected="${k === mode}" data-trend-mode="${k}">${l}</button>`).join('')}</div>
      </div>
      <div class="tchart" id="tchart">
        <div class="tchart-inner mode-${mode}" style="--h:${h}px">
          ${avgY != null ? `<div class="tavg" style="bottom:${avgY + 28}px"></div>` : ''}
          ${bars}
        </div>
      </div>
      ${legend}
      ${selection(state, series)}
    </section>`;
}

function selection(state, series) {
  const { mode, target } = state.trend;
  const b = series.bars[state.trend.index];
  if (!b) return '';
  const change = mode === 'day' ? null : changeFromPrevious(series.bars, state.trend.index);
  const sub = [
    mode === 'day' ? (b.sessions ? `${b.sessions}세션` : b.start === state.today ? '아직 기록이 없어요' : '쉬었어요') : `운동 ${b.activeDays}일`,
    change != null ? `<span class="chg ${tone(change)}">${PREV[mode]}보다 ${pct(change)}</span>` : null,
  ].filter(Boolean).join(' · ');
  const link = mode === 'day' && b.value > 0
    ? (target === 'all'
      ? `<button class="text-link" data-goto-date="${b.start}">그날 기록 보기 ›</button>`
      : `<button class="text-link" data-detail="${b.start}/${target}">자세히 보기 ›</button>`)
    : '';
  return `
    <div class="tsel">
      <span class="muted">${periodLabel(b, mode)}</span>
      <span class="tsel-value">${formatAmount(b.value, series.unit)}</span>
      <span class="tsel-sub">${sub}</span>
      ${link}
    </div>`;
}

// 종목별 역대 최고 기록 (이번 달에 세운 기록은 표시)
function recordsCard(state) {
  const t = state.trend.target;
  if (t === 'all') return '';
  const list = bestRecords(state.days, t);
  if (!list.length) return '';
  const thisMonth = monthKey(state.today);
  return `
    <section class="card">
      <h2>나의 최고 기록</h2>
      <ul class="sub records">${list.map((r) => `
        <li><span>${r.label}${monthKey(r.date) === thisMonth ? ' <em class="pr-new">이번 달</em>' : ''}</span>
        <span><b>${r.text}</b><small>${dateLabelFull(r.date)}</small></span></li>`).join('')}</ul>
    </section>`;
}

export function renderTrend(state) {
  const series = buildSeries(state.days, state.trend.target, state.trend.mode, state.today);
  if (state.trend.index == null || state.trend.index >= series.bars.length) state.trend.index = series.bars.length - 1;
  return chips(state) + headline(state) + chart(state, series) + recordsCard(state);
}
