// 앱 뼈대: 헤더, 하단 탭(캘린더 / 추이), 화면 전환, 저장소 연결.
// 화면 주소: #calendar, #weekly, #trend, #detail/YYYY-MM-DD/sport, #add, #add/manual, #add/capture
import { createLocalStore, hasDemo, demoIds } from './store.js';
import { createSyncedStore, createSheetClient, readSheetConfig, writeSheetConfig, autoSheetConfig } from './store-sheets.js';
import { groupByDay, groupLapsBySession } from './aggregate.js';
import { toDateStr, monthKey, addMonths, addDays, weekStart } from './dates.js';
import { ICONS } from './ui.js';
import { renderCalendar } from './views/calendar.js';
import { renderDetail } from './views/detail.js';
import { renderWeekly } from './views/weekly.js';
import { renderAddChoice, renderManual, syncManualFields } from './views/add.js';
import { buildManualSession, formFromSession, applyEdit, lapsFromForm } from './manual.js';
import { findDuplicate } from './duplicate.js';
import { renderCapture } from './views/capture.js';
import { renderTrend } from './views/trend.js';
import { renderSettings, parseSetting } from './views/settings.js';
import { extractImage } from './capture/extract.js';
import { mergeCaptures } from './capture/merge.js';
import { createBrowserEngine, fileToGray } from './capture/engine-browser.js';

// 구글 시트를 연결했으면 시트 동기화, 아니면 휴대폰 저장소만
const makeStore = () => {
  const config = readSheetConfig();
  return config ? createSyncedStore(createLocalStore(), createSheetClient(config)) : createLocalStore();
};
let store = makeStore();
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
const SUB_PAGES = ['detail', 'add', 'settings'];

function route() {
  const [name, ...args] = location.hash.slice(1).split('/');
  if (name === 'detail' && args.length === 2) return { name, args };
  if (name === 'add') return { name, args };
  if (name === 'settings') return { name, args: [] };
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
  // 수정 후 뒤로 가는 사이 다시 그릴 때도 빈 폼으로
  else if (r.name === 'add' && r.args[0] === 'manual') body = renderManual((state.form ??= emptyForm(), state));
  else if (r.name === 'add' && r.args[0] === 'capture') body = renderCapture(state);
  else if (r.name === 'add') body = renderAddChoice();
  else if (r.name === 'settings') body = renderSettings(state);
  else if (r.name === 'trend') body = renderTrend(state);
  else if (r.name === 'weekly') body = renderWeekly(state);
  else body = renderCalendar(state);

  root.innerHTML = `
    <div class="app">
      ${sub ? '' : `
      <header class="header">
        <h1>바다네 체육관</h1>
        <button class="add-btn" data-action="add">+ 운동</button>
        <button class="icon-btn" data-action="settings" aria-label="설정">${ICONS.gear}</button>
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

  // 주간 띠: 고른 주로 맞추고, 밀어서 멈추면 그 주로 바꾼다
  const pager = root.querySelector('#week-pager');
  if (pager) {
    const weeks = pager.dataset.weeks.split(',');
    pager.scrollLeft = weeks.indexOf(state.weekStart) * pager.clientWidth;
    let timer;
    pager.addEventListener('scroll', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const w = weeks[Math.round(pager.scrollLeft / pager.clientWidth)];
        if (w && w !== state.weekStart) {
          state.weekStart = w;
          render();
        }
      }, 120);
    }, { passive: true });
  }
  // 칩 줄: 고른 칩이 보이게
  root.querySelector('.chips-row [aria-pressed="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

let warnedOffline = false;
async function reload() {
  state.db = await store.load();
  state.sync = store.status ? { ...store.status, connected: true } : { connected: false };
  if (store.status?.online === false && !warnedOffline) {
    warnedOffline = true;
    setTimeout(() => toast('시트에 연결하지 못해 휴대폰에 저장된 기록을 보여드려요'), 0);
  }
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
  if (el('[data-lap-metric]')) {
    state.lapMetric = el('[data-lap-metric]').dataset.lapMetric;
    render();
    return;
  }
  if (el('[data-trend-target]')) {
    state.trend = { ...state.trend, target: el('[data-trend-target]').dataset.trendTarget };
    render();
    return;
  }
  if (el('[data-growth]')) {
    state.trend.growth = { ...state.trend.growth, [state.trend.target]: el('[data-growth]').dataset.growth };
    render();
    return;
  }
  if (el('[data-condition]')) {
    const b = el('[data-condition]');
    const s = state.db.sessions.find((x) => x.id === b.dataset.session);
    if (!s) return;
    // 같은 걸 다시 누르면 지운다
    await store.updateSession({ ...s, condition: s.condition === b.dataset.condition ? null : b.dataset.condition });
    await reload();
    return;
  }
  if (el('[data-edit]')) {
    const s = state.db.sessions.find((x) => x.id === el('[data-edit]').dataset.edit);
    if (!s) return;
    state.form = formFromSession(s);
    go('add/manual');
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
    if (route().name === 'weekly') render();
    else location.replace('#weekly');
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

  const action = el('[data-action]')?.dataset.action;
  if (action === 'back') goBack();
  if (action === 'add') go('add');
  if (action === 'settings') go('settings');
  if (action === 'sheet-disconnect') {
    if (!confirm('구글 시트 연결을 끊을까요? 기록은 시트와 이 휴대폰에 그대로 남아요.')) return;
    writeSheetConfig(null);
    store = makeStore();
    await reload();
    toast('연결을 끊었어요');
  }
  if (action === 'backup') {
    const data = await store.exportAll();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    a.download = `운동기록-백업-${today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('백업 파일을 저장했어요');
  }
  if (action === 'capture') {
    state.capture = { phase: 'pick' };
    go('add/capture');
  }
  if (action === 'lap-show-all') {
    el('[data-action]').closest('details').querySelector('.lap-edits').classList.remove('only-bad');
    el('[data-action]').remove();
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

// 구간 시간: 휴대폰 숫자 키패드엔 ':' 이 없어서 숫자만 쳐도 1:17 처럼 맞춰 준다
root.addEventListener('input', (e) => {
  if (!/\.lap\.\d+\.time$/.test(e.target.name ?? '')) return;
  const d = e.target.value.replace(/\D/g, '').slice(0, 4);
  e.target.value = d.length > 2 ? `${d.slice(0, -2)}:${d.slice(-2)}` : d;
});

// 직접 입력: 종목을 바꾸면 그 종목 칸만 보이게
root.addEventListener('change', (e) => {
  // 설정: 바꾸면 바로 저장
  if (e.target.closest('#settings-form')) {
    const v = parseSetting(e.target.name, e.target.value);
    if (v == null) {
      toast(`${e.target.dataset.min}~${e.target.dataset.max} 사이로 입력해주세요`);
      e.target.value = state.db.settings[e.target.name];
      return;
    }
    store.saveSettings({ [e.target.name]: v }).then(reload).then(() => toast('저장했어요'));
    return;
  }
  if (e.target.id === 'restore-input' && e.target.files.length) {
    e.target.files[0].text().then(async (text) => {
      try {
        const data = JSON.parse(text);
        if (!confirm(`백업의 기록 ${data.sessions?.length ?? 0}개로 바꿀까요? 지금 기록은 지워져요.`)) return;
        await store.importAll(data);
        await reload();
        toast('백업을 불러왔어요');
      } catch (err) {
        toast(err.message.includes('JSON') ? '백업 파일을 읽지 못했어요' : err.message);
      }
    });
    return;
  }
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

  const editId = state.form?.editId;
  const original = editId && state.db.sessions.find((s) => s.id === editId);
  const { session, errors } = buildManualSession(values, state.db.settings, original ? editId : undefined);
  if (errors) {
    for (const [key, msg] of Object.entries(errors)) {
      const el = form.querySelector(`[data-error="${key}"]:not([hidden] *)`) ?? form.querySelector(`[data-error="${key}"]`);
      if (el) el.textContent = msg;
    }
    return;
  }
  // 같은 날짜·종목 기록이 있으면 한 번 경고하고, 다시 누르면 저장
  const dup = findDuplicate(session, state.db.sessions.filter((s) => s.id !== editId));
  if (dup && !form.dataset.dupOk) {
    const box = form.querySelector('.dup');
    box.hidden = false;
    box.textContent = `같은 날 비슷한 ${dup.start_time ? dup.start_time + ' ' : ''}기록이 이미 있어요. 그래도 저장할까요?`;
    form.dataset.dupOk = '1';
    form.querySelector('.submit').textContent = '그래도 저장';
    return;
  }

  if (original) {
    const updated = applyEdit(original, session);
    await store.updateSession(updated);
    state.form = null;
    // 날짜·종목이 그대로면 상세로 돌아가고, 바뀌었으면 캘린더에서 그 날을 보여준다
    if (updated.date === original.date && updated.sport === original.sport) goBack();
    else {
      state.selected = updated.date;
      state.viewMonth = monthKey(updated.date);
      navDepth = 0;
      location.replace('#calendar');
    }
    await reload();
    toast('수정했어요');
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

// 한 줄 메모 저장
root.addEventListener('submit', async (e) => {
  const form = e.target.closest('#memo-form');
  if (!form) return;
  e.preventDefault();
  const s = state.db.sessions.find((x) => x.id === form.dataset.session);
  if (!s) return;
  const memo = form.memo.value.trim();
  if ((s.memo ?? '') === memo) return;
  await store.updateSession({ ...s, memo: memo || null });
  await reload();
  toast(memo ? '메모를 저장했어요' : '메모를 지웠어요');
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

// 구글 시트 연결: 주소·비밀번호로 한 번 읽어 보고, 되면 휴대폰 기록을 시트로 올린 뒤 시트 기준으로 바꾼다
root.addEventListener('submit', async (e) => {
  const form = e.target.closest('#sheet-form');
  if (!form) return;
  e.preventDefault();
  const url = form.url.value.trim();
  const token = form.token.value.trim();
  const msg = form.querySelector('.field-error');
  msg.textContent = '';
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)) {
    msg.textContent = '웹 앱 주소는 https://script.google.com/macros/s/…/exec 형태예요.';
    return;
  }
  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  button.textContent = '연결하는 중…';
  try {
    const client = createSheetClient({ url, token });
    await client.read();
    const synced = createSyncedStore(createLocalStore(), client);
    await synced.uploadLocal();
    writeSheetConfig({ url, token });
    store = synced;
    await reload();
    toast('구글 시트에 연결했어요');
  } catch (err) {
    msg.textContent = err instanceof TypeError ? '주소에 연결하지 못했어요. 웹 앱 배포의 액세스가 "모든 사용자"인지 확인해주세요.' : err.message;
    button.disabled = false;
    button.textContent = '연결하기';
  }
});

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
    // 구간 고치기에서 고친 값 (구간 편집이 없는 기록은 읽은 그대로)
    let sessionLaps = s.laps;
    if (form.querySelector(`[name="${i}.lap.0.no"]`)) {
      const r = lapsFromForm(values, String(i), s.session.id);
      const lapErr = form.querySelector(`[data-error="${i}.laps"]`);
      if (r.errors.length) {
        bad = true;
        lapErr.textContent = r.errors[0];
        lapErr.closest('details').open = true;
        return;
      }
      lapErr.textContent = '';
      sessionLaps = r.laps;
    }
    const { date, start_time, duration_sec, distance_m, kcal, avg_hr } = edited;
    toSave.push({ ...s.session, date, start_time, duration_sec, distance_m, kcal, avg_hr });
    laps.push(...sessionLaps);
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

// 처음 여는 기기(홈 화면 앱 포함)는 기본 시트로 바로 연결한다. 시트에 닿지 않으면 이번엔 휴대폰 저장소로
async function autoConnect() {
  const config = autoSheetConfig();
  if (!config) return;
  try {
    const client = createSheetClient(config);
    await client.read();
    const synced = createSyncedStore(createLocalStore(), client);
    await synced.uploadLocal();
    writeSheetConfig(config);
    store = synced;
  } catch {
    // 다음에 앱을 열 때 다시 시도
  }
}

autoConnect().finally(reload);
