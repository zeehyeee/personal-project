// 앱 뼈대: 헤더, 하단 탭(캘린더 / 추이), 화면 전환, 저장소 연결.
// 화면 주소: #calendar, #trend, #detail/YYYY-MM-DD/sport
import { createLocalStore, hasDemo, demoIds } from './store.js';
import { groupByDay, groupLapsBySession } from './aggregate.js';
import { toDateStr, monthKey, addMonths } from './dates.js';
import { ICONS } from './ui.js';
import { renderCalendar } from './views/calendar.js';
import { renderDetail } from './views/detail.js';

const store = createLocalStore();
const root = document.getElementById('app');

const today = toDateStr(new Date());
const state = {
  today,
  selected: today,
  viewMonth: monthKey(today),
  db: null,
  days: {},
};

function route() {
  const [name, ...args] = location.hash.slice(1).split('/');
  if (name === 'detail' && args.length === 2) return { name, args };
  return { name: name === 'trend' ? 'trend' : 'calendar', args: [] };
}

let toastTimer;
function toast(msg) {
  const el = root.querySelector('.toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

function renderTrend() {
  return `<section class="card"><h2>추이</h2><p class="muted">종목 캐러셀과 막대 그래프는 4단계에서 만들어요.</p></section>`;
}

function render() {
  const r = route();
  const tab = r.name === 'trend' ? 'trend' : 'calendar';
  const demo = state.db && hasDemo(state.db.sessions);
  let body;
  if (r.name === 'detail') body = renderDetail(state, ...r.args);
  else if (r.name === 'trend') body = renderTrend();
  else body = renderCalendar(state);

  root.innerHTML = `
    <div class="app">
      ${r.name === 'detail' ? '' : `
      <header class="header">
        <h1>운동 기록</h1>
        <button class="icon-btn" data-action="report" aria-label="최신 주간 리포트">${ICONS.report}</button>
        <button class="add-btn" data-action="add">+ 기록 추가</button>
      </header>`}
      <main>
        ${demo && r.name !== 'detail' ? '<div class="banner"><span>예시 데이터로 보는 중이에요.</span><button data-action="clear-demo">예시 지우기</button></div>' : ''}
        ${body}
      </main>
      <nav class="tabbar"><div class="tabbar-inner" role="tablist">
        <button class="tab" role="tab" data-tab="calendar" aria-selected="${tab === 'calendar'}">${ICONS.calendar}캘린더</button>
        <button class="tab" role="tab" data-tab="trend" aria-selected="${tab === 'trend'}">${ICONS.trend}추이</button>
      </div></nav>
      <div class="toast" role="status"></div>
    </div>`;
}

async function reload() {
  state.db = await store.load();
  state.days = groupByDay(state.db.sessions, groupLapsBySession(state.db.laps), state.db.settings);
  render();
}

// 앱 안에서 상세로 들어왔으면 뒤로 가기, 주소로 바로 열었으면 캘린더로
let navigatedInApp = false;

root.addEventListener('click', async (e) => {
  const el = (sel) => e.target.closest(sel);

  if (el('[data-tab]')) {
    location.replace(`#${el('[data-tab]').dataset.tab}`);
    return;
  }
  if (el('[data-month]')) {
    state.viewMonth = addMonths(state.viewMonth, Number(el('[data-month]').dataset.month));
    render();
    return;
  }
  if (el('[data-date]')) {
    state.selected = el('[data-date]').dataset.date;
    if (monthKey(state.selected) !== state.viewMonth) state.viewMonth = monthKey(state.selected);
    render();
    return;
  }
  if (el('[data-detail]')) {
    navigatedInApp = true;
    location.hash = `detail/${el('[data-detail]').dataset.detail}`;
    return;
  }
  if (el('[data-week]')) {
    toast('주간 리포트는 5단계에서 만들어요');
    return;
  }

  const action = el('[data-action]')?.dataset.action;
  if (action === 'back') {
    if (navigatedInApp) history.back();
    else location.replace('#calendar');
  }
  if (action === 'add') toast('기록 추가는 2-3 단계에서 만들어요');
  if (action === 'report') toast('주간 리포트는 5단계에서 만들어요');
  if (action === 'clear-demo') {
    if (!confirm('예시 데이터를 모두 지울까요?')) return;
    await store.deleteSessions(demoIds(state.db.sessions));
    await reload();
  }
});

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});

reload();
