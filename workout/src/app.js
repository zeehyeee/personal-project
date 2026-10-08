// 앱 뼈대: 헤더, 하단 탭(캘린더 / 추이), 화면 전환, 저장소 연결.
// 화면 주소: #calendar, #weekly, #trend, #detail/YYYY-MM-DD/sport, #add, #add/manual
import { createLocalStore, hasDemo, demoIds } from './store.js';
import { groupByDay, groupLapsBySession } from './aggregate.js';
import { toDateStr, monthKey, addMonths, addDays, weekStart } from './dates.js';
import { ICONS } from './ui.js';
import { renderCalendar } from './views/calendar.js';
import { renderDetail } from './views/detail.js';
import { renderWeekly } from './views/weekly.js';
import { renderAddChoice, renderManual, syncManualFields } from './views/add.js';
import { buildManualSession } from './manual.js';
import { findDuplicate } from './duplicate.js';

const store = createLocalStore();
const root = document.getElementById('app');

const today = toDateStr(new Date());
const state = {
  today,
  selected: today,
  viewMonth: monthKey(today),
  weekStart: weekStart(today),
  db: null,
  days: {},
  form: null,
};

const emptyForm = () => ({ sport: '', date: state.selected <= today ? state.selected : today, start_time: '' });

// 헤더 대신 뒤로 가기가 있는 화면
const SUB_PAGES = ['detail', 'add'];

function route() {
  const [name, ...args] = location.hash.slice(1).split('/');
  if (name === 'detail' && args.length === 2) return { name, args };
  if (name === 'add') return { name, args };
  return { name: ['weekly', 'trend'].includes(name) ? name : 'calendar', args: [] };
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
  const sub = SUB_PAGES.includes(r.name);
  const tab = sub ? 'calendar' : r.name;
  const demo = state.db && hasDemo(state.db.sessions);
  let body;
  if (r.name === 'detail') body = renderDetail(state, ...r.args);
  else if (r.name === 'add' && r.args[0] === 'manual') body = renderManual(state);
  else if (r.name === 'add') body = renderAddChoice();
  else if (r.name === 'trend') body = renderTrend();
  else if (r.name === 'weekly') body = renderWeekly(state);
  else body = renderCalendar(state);

  root.innerHTML = `
    <div class="app">
      ${sub ? '' : `
      <header class="header">
        <h1>운동 기록</h1>
        <button class="add-btn" data-action="add">+ 기록 추가</button>
      </header>`}
      <main>
        ${demo && !sub ? '<div class="banner"><span>예시 데이터로 보는 중이에요.</span><button data-action="clear-demo">예시 지우기</button></div>' : ''}
        ${body}
      </main>
      <nav class="tabbar"><div class="tabbar-inner" role="tablist">
        <button class="tab" role="tab" data-tab="calendar" aria-selected="${tab === 'calendar'}">${ICONS.calendar}캘린더</button>
        <button class="tab" role="tab" data-tab="weekly" aria-selected="${tab === 'weekly'}">${ICONS.week}주간</button>
        <button class="tab" role="tab" data-tab="trend" aria-selected="${tab === 'trend'}">${ICONS.trend}추이</button>
      </div></nav>
      <div class="toast" role="status"></div>
    </div>`;
  const form = root.querySelector('#manual-form');
  if (form) syncManualFields(form);
}

async function reload() {
  state.db = await store.load();
  state.days = groupByDay(state.db.sessions, groupLapsBySession(state.db.laps), state.db.settings);
  render();
}

// 앱 안에서 들어온 화면이면 뒤로 가기, 주소로 바로 열었으면 캘린더로
let navDepth = 0;
function go(hash) {
  navDepth++;
  location.hash = hash;
}
function goBack() {
  if (navDepth > 0) {
    navDepth--;
    history.back();
  } else location.replace('#calendar');
}

root.addEventListener('click', async (e) => {
  const el = (sel) => e.target.closest(sel);

  if (el('[data-tab]')) {
    const next = el('[data-tab]').dataset.tab;
    // 주간 탭은 캘린더에서 고른 날짜가 있는 주를 연다
    if (next === 'weekly') state.weekStart = weekStart(state.selected);
    location.replace(`#${next}`);
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
    go(`detail/${el('[data-detail]').dataset.detail}`);
    return;
  }
  if (el('[data-nav]')) {
    if (el('[data-nav]').dataset.nav === 'add/manual') state.form = emptyForm();
    go(el('[data-nav]').dataset.nav);
    return;
  }
  if (el('[data-delete]')) {
    if (!confirm('이 기록을 삭제할까요?')) return;
    await store.deleteSessions([el('[data-delete]').dataset.delete]);
    await reload();
    toast('삭제했어요');
    // 그 날 그 종목 기록을 모두 지웠으면 상세 화면에서 나간다
    const r = route();
    if (r.name === 'detail' && !state.days[r.args[0]]?.[r.args[1]]) goBack();
    return;
  }
  if (el('[data-week]')) {
    state.weekStart = addDays(state.weekStart, 7 * Number(el('[data-week]').dataset.week));
    render();
    return;
  }

  const action = el('[data-action]')?.dataset.action;
  if (action === 'back') goBack();
  if (action === 'add') go('add');
  if (action === 'capture') toast('캡처로 추가는 3단계에서 만들어요');
  if (action === 'clear-demo') {
    if (!confirm('예시 데이터를 모두 지울까요?')) return;
    await store.deleteSessions(demoIds(state.db.sessions));
    await reload();
  }
});

// 직접 입력: 종목을 바꾸면 그 종목 칸만 보이게
root.addEventListener('change', (e) => {
  const form = e.target.closest('#manual-form');
  if (!form) return;
  if (e.target.name === 'sport') {
    syncManualFields(form);
    resetDuplicate(form);
  }
});

function resetDuplicate(form) {
  form.querySelector('.dup').hidden = true;
  delete form.dataset.dupOk;
  form.querySelector('.submit').textContent = '저장';
}

root.addEventListener('submit', async (e) => {
  const form = e.target.closest('#manual-form');
  if (!form) return;
  e.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  for (const el of form.querySelectorAll('[data-error]')) el.textContent = '';

  const { session, errors } = buildManualSession(values, state.db.settings);
  if (errors) {
    for (const [key, msg] of Object.entries(errors)) {
      const el = form.querySelector(`[data-error="${key}"]:not([hidden] *)`) ?? form.querySelector(`[data-error="${key}"]`);
      if (el) el.textContent = msg;
    }
    return;
  }
  // 같은 날짜·종목 기록이 있으면 한 번 경고하고, 다시 누르면 저장
  const dup = findDuplicate(session, state.db.sessions);
  if (dup && !form.dataset.dupOk) {
    const box = form.querySelector('.dup');
    box.hidden = false;
    box.textContent = `같은 날 비슷한 ${dup.start_time ? dup.start_time + ' ' : ''}기록이 이미 있어요. 그래도 저장할까요?`;
    form.dataset.dupOk = '1';
    form.querySelector('.submit').textContent = '그래도 저장';
    return;
  }

  await store.addSessions([session]);
  state.selected = session.date;
  state.viewMonth = monthKey(session.date);
  state.form = null;
  navDepth = 0;
  location.replace('#calendar');
  await reload();
  toast('저장했어요');
});

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});

reload();
