// 캘린더 탭: 스트릭 한 줄 → 월 캘린더 → 선택한 날 블록
import { SPORTS, SPORT_META } from '../sports.js';
import { monthGrid, monthKey } from '../dates.js';
import { streak, monthActiveDays } from '../streak.js';
import { formatMinutes, formatDistance } from '../format.js';
import { ICONS, SPORT_ICON, dateLabel } from '../ui.js';

function streakLine(state) {
  const active = Object.keys(state.days);
  const s = streak(active, state.today);
  const monthDays = monthActiveDays(active, state.today);
  // 분모는 오늘 날짜(이번 달 지난 날 수): 매일 운동이 목표라서
  const elapsed = Number(state.today.slice(8));
  let main;
  if (s.days === 0) main = '오늘 운동하면 <b>1일차</b>';
  else if (s.untilYesterday) main = `어제까지 <b>${s.days}일</b> · 오늘도 이어가요`;
  else main = `운동 <b>${s.days}일차</b>`;
  return `
    <section class="streak">
      <span class="streak-main">🔥 ${main}</span>
      <span class="streak-month">이번 달 <b>${monthDays}</b>/${elapsed}일</span>
    </section>`;
}

function calendarCard(state) {
  const [y, m] = state.viewMonth.split('-').map(Number);
  const head = '일월화수목금토'.split('').map((d) => `<span>${d}</span>`).join('');
  const rows = monthGrid(y, m).map((week) => {
    const cells = week.map((date) => {
      const day = state.days[date] ?? {};
      const dots = SPORTS.filter((s) => day[s]).map((s) => `<i style="--c: var(--${s})"></i>`).join('');
      const cls = [
        'cal-day',
        monthKey(date) !== state.viewMonth && 'other',
        date === state.today && 'today',
        date === state.selected && 'selected',
      ].filter(Boolean).join(' ');
      return `<button class="${cls}" data-date="${date}"><span class="num">${Number(date.slice(8))}</span><span class="dots">${dots}</span></button>`;
    }).join('');
    return `<div class="cal-week">${cells}</div>`;
  }).join('');

  return `
    <section class="card cal">
      <div class="cal-head">
        <button class="icon-btn" data-month="-1" aria-label="이전 달">${ICONS.left}</button>
        <h2>${y}년 ${m}월</h2>
        <button class="icon-btn" data-month="1" aria-label="다음 달">${ICONS.right}</button>
      </div>
      <div class="cal-weekdays">${head}</div>
      ${rows}
    </section>`;
}

function selectedDayCard(state) {
  const date = state.selected;
  const day = state.days[date] ?? {};
  const sports = SPORTS.filter((s) => day[s]);
  const title = dateLabel(date, state.today);
  if (!sports.length) {
    const empty = date === state.today ? '아직 기록이 없어요.' : '이 날은 쉬었어요.';
    return `<section class="card"><div class="day-head"><h2>${title}</h2></div><p class="muted">${empty}</p></section>`;
  }
  // 1줄: 아이콘 + 종목명 / 2줄: 운동 시간(크게) + 거리(작게)
  const tiles = sports.map((s) => `
    <button class="tile" data-detail="${date}/${s}" style="--c: var(--${s})">
      <span class="tile-name"><span class="tile-icon">${SPORT_ICON[s]}</span>${SPORT_META[s].name}</span>
      <span class="tile-amount">${formatMinutes(day[s].duration_sec)}<small>${formatDistance(s, day[s].distance_m)}</small></span>
    </button>`).join('');
  return `
    <section class="card">
      <div class="day-head"><h2>${title}</h2><span class="muted">${sports.length}종목</span></div>
      <div class="tiles">${tiles}</div>
    </section>`;
}

export function renderCalendar(state) {
  return streakLine(state) + calendarCard(state) + selectedDayCard(state);
}
