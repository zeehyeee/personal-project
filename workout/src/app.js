// 앱 뼈대: 헤더, 하단 탭(캘린더 / 추이), 화면 전환, 저장소 연결.
// 화면 주소: #calendar, #weekly, #trend, #detail/YYYY-MM-DD/sport, #add, #add/manual, #add/capture
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
import { renderCapture } from './views/capture.js';
import { renderTrend, TARGETS } from './views/trend.js';
import { extractImage } from './capture/extract.js';
import { mergeCaptures } from './capture/merge.js';
import { createBrowserEngine, fileToGray } from './capture/engine-browser.js';

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
  capture: { phase: 'pick' },
  trend: { target: 'all', mode: 'day', index: null, scroll: null },
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

function render() {
  const r = route();
  const sub = SUB_PAGES.includes(r.name);
  const tab = sub ? 'calendar' : r.name;
  const demo = state.db && hasDemo(state.db.sessions);
  let body;
  if (r.name === 'detail') body = renderDetail(state, ...r.args);
  else if (r.name === 'add' && r.args[0] === 'manual') body = renderManual(state);
  else if (r.name === 'add' && r.args[0] === 'capture') body = renderCapture(state);
  else if (r.name === 'add') body = renderAddChoice();
  else if (r.name === 'trend') body = renderTrend(state);
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
  // 추이 그래프: 처음엔 오늘(오른쪽 끝)이 보이게, 다시 그릴 때는 보던 위치 유지
  const chart = root.querySelector('#tchart');
  if (chart) {
    chart.scrollLeft = state.trend.scroll ?? chart.scrollWidth;
    chart.addEventListener('scroll', () => { state.trend.scroll = chart.scrollLeft; }, { passive: true });
  }
}

function setTrendTarget(step) {
  const i = TARGETS.indexOf(state.trend.target);
  state.trend = { ...state.trend, target: TARGETS[(i + step + TARGETS.length) % TARGETS.length] };
  render();
}

// 종목 캐러셀 스와이프
let touchX = null;
root.addEventListener('touchstart', (e) => {
  touchX = e.target.closest('[data-swipe]') ? e.touches[0].clientX : null;
}, { passive: true });
root.addEventListener('touchend', (e) => {
  if (touchX == null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 40) setTrendTarget(dx < 0 ? 1 : -1);
}, { passive: true });

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
  if (el('[data-trend-step]')) {
    setTrendTarget(Number(el('[data-trend-step]').dataset.trendStep));
    return;
  }
  if (el('[data-trend-mode]')) {
    state.trend = { ...state.trend, mode: el('[data-trend-mode]').dataset.trendMode, index: null, scroll: null };
    render();
    return;
  }
  if (el('[data-trend-bar]')) {
    state.trend.index = Number(el('[data-trend-bar]').dataset.trendBar);
    render();
    return;
  }
  if (el('[data-open-week]')) {
    state.weekStart = el('[data-open-week]').dataset.openWeek;
    location.replace('#weekly');
    return;
  }
  if (el('[data-goto-date]')) {
    state.selected = el('[data-goto-date]').dataset.gotoDate;
    state.viewMonth = monthKey(state.selected);
    location.replace('#calendar');
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
  if (action === 'capture') {
    state.capture = { phase: 'pick' };
    go('add/capture');
  }
  if (action === 'capture-again') {
    state.capture = { phase: 'pick' };
    render();
  }
  if (action === 'clear-demo') {
    if (!confirm('예시 데이터를 모두 지울까요?')) return;
    await store.deleteSessions(demoIds(state.db.sessions));
    await reload();
  }
});

// 직접 입력: 종목을 바꾸면 그 종목 칸만 보이게
root.addEventListener('change', (e) => {
  if (e.target.id === 'capture-input' && e.target.files.length) {
    readCaptures([...e.target.files]);
    return;
  }
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

// 캡처 읽기: 한 장씩 휴대폰 안에서 OCR → 세션으로 합치기 → 확인 화면
async function readCaptures(files) {
  const c = (state.capture = { phase: 'reading', total: files.length, done: 0, status: '' });
  render();
  try {
    const engine = await createBrowserEngine((msg) => { c.status = msg; render(); });
    const items = [];
    let ignored = 0;
    for (const file of files) {
      c.status = '';
      render();
      const found = await extractImage(await fileToGray(file), engine);
      if (found.every((it) => it.kind === 'ignored')) ignored++;
      items.push(...found);
      c.done++;
      render();
    }
    const result = mergeCaptures(items, { today });
    for (const s of result.sessions) s.duplicate = findDuplicate(s.session, state.db.sessions);
    state.capture = { phase: 'confirm', result: { ...result, ignored, total: files.length } };
  } catch (err) {
    state.capture = { phase: 'pick', error: err.message || '캡처를 읽지 못했어요.' };
  }
  render();
}

root.addEventListener('submit', async (e) => {
  const form = e.target.closest('#capture-form');
  if (!form) return;
  e.preventDefault();
  const values = Object.fromEntries(new FormData(form));
  const { sessions } = state.capture.result;
  const toSave = [];
  const laps = [];
  let bad = false;
  sessions.forEach((s, i) => {
    if (!values[`${i}.on`]) return;
    const v = (k) => values[`${i}.${k}`] ?? '';
    // 수정한 값을 직접 입력과 같은 규칙으로 검증한다
    const { session: edited, errors } = buildManualSession(
      { sport: s.session.sport, date: v('date'), start_time: v('start_time'), h: v('h'), m: v('m'), s: v('s'), distance: v('distance'), kcal: v('kcal'), avg_hr: v('avg_hr') },
      state.db.settings, s.session.id,
    );
    const errEl = form.querySelector(`[data-error="${i}"]`);
    if (errors) {
      bad = true;
      errEl.textContent = Object.values(errors)[0];
      errEl.closest('details').open = true;
      return;
    }
    errEl.textContent = '';
    const { date, start_time, duration_sec, distance_m, kcal, avg_hr } = edited;
    toSave.push({ ...s.session, date, start_time, duration_sec, distance_m, kcal, avg_hr });
    laps.push(...s.laps);
  });
  if (bad) return;
  if (!toSave.length) {
    toast('저장할 기록을 골라주세요');
    return;
  }
  await store.addSessions(toSave, laps);
  const last = toSave.map((s) => s.date).sort().pop();
  state.selected = last;
  state.viewMonth = monthKey(last);
  state.capture = { phase: 'pick' };
  navDepth = 0;
  location.replace('#calendar');
  await reload();
  toast(`${toSave.length}개 저장했어요`);
});

window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});

reload();
