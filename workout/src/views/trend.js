// 추이 탭 (명세 3-3): 종목 캐러셀 → 기간 알약 + 막대 그래프 → 선택한 기간 요약 → 이번 달 요약
import { SPORT_META } from '../sports.js';
import { buildSeries, changeFromPrevious, monthSummary, formatAmount, periodLabel } from '../trend.js';
import { ICONS, SPORT_ICON } from '../ui.js';

export const TARGETS = ['all', 'walk', 'run', 'bike', 'swim'];
const NAME = (t) => (t === 'all' ? '전체' : SPORT_META[t].name);
const ICON = (t) => (t === 'all' ? '🔥' : SPORT_ICON[t]);
// 전체는 수영(파랑)과 헷갈리지 않게 중립 색
const COLOR = (t) => (t === 'all' ? 'var(--grey-700)' : `var(--${t})`);
const MODES = [['day', '일별'], ['week', '주별'], ['month', '월별']];
const PREV = { day: '전날', week: '지난주', month: '지난달' };

const pct = (r) => `${r > 0 ? '+' : ''}${Math.round(r * 100)}%`;
const tone = (r) => (r == null || Math.round(r * 100) === 0 ? 'same' : r > 0 ? 'up' : 'down');

function carousel(state) {
  const t = state.trend.target;
  const m = monthSummary(state.days, t, state.today);
  const dots = TARGETS.map((x) => `<i class="${x === t ? 'on' : ''}"></i>`).join('');
  return `
    <section class="carousel" data-swipe="trend">
      <button class="icon-btn" data-trend-step="-1" aria-label="이전 종목">${ICONS.left}</button>
      <div class="carousel-card" style="--c: ${COLOR(t)}">
        <span class="carousel-icon">${ICON(t)}</span>
        <span class="carousel-name">${NAME(t)}</span>
        <span class="carousel-value">이번 달 <b>${formatAmount(m.value, m.unit)}</b></span>
      </div>
      <button class="icon-btn" data-trend-step="1" aria-label="다음 종목">${ICONS.right}</button>
    </section>
    <div class="dots-nav">${dots}</div>`;
}

function axisLabel(bar, mode, i) {
  const d = Number(bar.start.slice(8)), mo = Number(bar.start.slice(5, 7));
  if (mode === 'day') return d === 1 || i === 0 ? `${mo}/${d}` : String(d);
  if (mode === 'week') return `${mo}/${d}`;
  return `${mo}월`;
}

function chart(state, series) {
  const { mode, target } = state.trend;
  const sel = state.trend.index;
  const h = 160;
  const scale = series.max > 0 ? (h - 8) / series.max : 0;
  const bars = series.bars.map((b, i) => {
    const height = b.value > 0 ? Math.max(6, b.value * scale) : 3; // 기록 없는 기간은 얇은 회색 막대
    return `
      <button class="tbar ${b.value > 0 ? '' : 'empty'} ${i === sel ? 'sel' : ''}" data-trend-bar="${i}"
        aria-label="${periodLabel(b, mode)} ${formatAmount(b.value, series.unit)}">
        <span class="tbar-fill" style="height:${height}px"></span>
        <span class="tbar-label">${axisLabel(b, mode, i)}</span>
      </button>`;
  }).join('');
  const avgY = series.average > 0 ? series.average * scale : null;
  return `
    <section class="card trend-card" style="--c: ${COLOR(target)}">
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
  // 일별: 그날 상세로 (전체면 캘린더의 그날)
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

function monthCard(state) {
  const t = state.trend.target;
  const m = monthSummary(state.days, t, state.today);
  const change = m.change == null ? '지난달 기록 없음' : `<span class="chg ${tone(m.change)}">지난달보다 ${pct(m.change)}</span>`;
  return `
    <section class="card">
      <h2>이번 달 요약</h2>
      <p class="month-value">${formatAmount(m.value, m.unit)}</p>
      <p class="muted">운동 ${m.activeDays}일 · ${change}</p>
    </section>`;
}

export function renderTrend(state) {
  const series = buildSeries(state.days, state.trend.target, state.trend.mode, state.today);
  if (state.trend.index == null || state.trend.index >= series.bars.length) state.trend.index = series.bars.length - 1;
  return carousel(state) + chart(state, series) + monthCard(state);
}
