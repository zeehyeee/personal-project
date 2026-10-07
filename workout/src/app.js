// 앱 뼈대: 헤더, 하단 탭(캘린더 / 추이), 저장소 연결.
import { createLocalStore, hasDemo, demoIds } from './store.js';
import { groupByDay, groupLapsBySession } from './aggregate.js';
import { SPORTS, SPORT_META, sportAmount } from './sports.js';
import { parseDate } from './dates.js';

const store = createLocalStore();
const root = document.getElementById('app');

const state = {
  tab: location.hash === '#trend' ? 'trend' : 'calendar',
  db: null,
  days: {},
};

const ICONS = {
  report: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 15v2M12 11v6M16 8v9"/></svg>',
  calendar: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  trend: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 20V12M10 20V6M15 20v-9M20 20V9"/></svg>',
};

function formatDateKo(str) {
  const d = parseDate(str);
  const wd = '일월화수목금토'[d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()} (${wd})`;
}

let toastTimer;
function toast(msg) {
  const el = root.querySelector('.toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

// 2-2에서 월 캘린더로 바뀐다. 지금은 저장된 데이터가 일 단위로 합산되는지 확인하는 목록.
function renderCalendarTab() {
  const dates = Object.keys(state.days).sort().reverse();
  if (!dates.length) {
    return `<section class="card"><h2>아직 기록이 없어요</h2><p class="muted">+ 기록 추가로 첫 운동을 남겨보세요.</p></section>`;
  }
  const rows = dates.map((date) => {
    const chips = SPORTS.filter((s) => state.days[date][s]).map((s) => {
      const day = state.days[date][s];
      const multi = day.sessionCount > 1 ? ` <small>${day.sessionCount}세션</small>` : '';
      return `<span class="chip" style="--c: var(--${s})"><span class="dot"></span>${SPORT_META[s].name} ${sportAmount(day)}${multi}</span>`;
    });
    return `<div class="day-row"><div class="date">${formatDateKo(date)}</div><div class="chips">${chips.join('')}</div></div>`;
  });
  return `
    <section class="card">
      <h2>기록 목록</h2>
      <p class="muted">다음 단계(2-2)에서 월 캘린더로 바뀌어요.</p>
      ${rows.join('')}
    </section>`;
}

function renderTrendTab() {
  return `<section class="card"><h2>추이</h2><p class="muted">종목 캐러셀과 막대 그래프는 4단계에서 만들어요.</p></section>`;
}

function render() {
  const demo = state.db && hasDemo(state.db.sessions);
  root.innerHTML = `
    <div class="app">
      <header class="header">
        <h1>운동 기록</h1>
        <button class="icon-btn" data-action="report" aria-label="최신 주간 리포트">${ICONS.report}</button>
        <button class="add-btn" data-action="add">+ 기록 추가</button>
      </header>
      <main>
        ${demo ? '<div class="banner"><span>예시 데이터로 보는 중이에요.</span><button data-action="clear-demo">예시 지우기</button></div>' : ''}
        ${state.tab === 'calendar' ? renderCalendarTab() : renderTrendTab()}
      </main>
      <nav class="tabbar"><div class="tabbar-inner" role="tablist">
        <button class="tab" role="tab" data-tab="calendar" aria-selected="${state.tab === 'calendar'}">${ICONS.calendar}캘린더</button>
        <button class="tab" role="tab" data-tab="trend" aria-selected="${state.tab === 'trend'}">${ICONS.trend}추이</button>
      </div></nav>
      <div class="toast" role="status"></div>
    </div>`;
}

async function reload() {
  state.db = await store.load();
  state.days = groupByDay(state.db.sessions, groupLapsBySession(state.db.laps), state.db.settings);
  render();
}

root.addEventListener('click', async (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    state.tab = tab.dataset.tab;
    history.replaceState(null, '', `#${state.tab}`);
    render();
    return;
  }
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'add') toast('기록 추가는 2-3 단계에서 만들어요');
  if (action === 'report') toast('주간 리포트는 5단계에서 만들어요');
  if (action === 'clear-demo') {
    if (!confirm('예시 데이터를 모두 지울까요?')) return;
    await store.deleteSessions(demoIds(state.db.sessions));
    await reload();
  }
});

reload();
