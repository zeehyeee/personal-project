// 캘린더 탭: 월 캘린더 → 스트릭 카드 → 선택한 날 블록 (명세 3-2)
import { SPORTS, SPORT_META } from '../sports.js';
import { formatMinutes, formatDistance } from '../format.js';
import { monthGrid, weekOfMonth, monthKey } from '../dates.js';
import { streak, monthActiveDays } from '../streak.js';
import { ICONS, SPORT_ICON, dateLabel } from '../ui.js';

function calendarCard(state) {
  const [y, m] = state.viewMonth.split('-').map(Number);
  const weeks = monthGrid(y, m);
  const head = '일월화수목금토'.split('').map((d) => `<span>${d}</span>`).join('');
  const rows = weeks.map((week) => {
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
    const n = weekOfMonth(week[0], y, m);
    return `<div class="cal-week">${cells}<button class="week-label" data-week="${week[0]}" aria-label="${n}주차 리포트"><span class="v">${n}주차</span></button></div>`;
  }).join('');

  return `
    <section class="card cal">
      <div class="cal-head">
        <button class="icon-btn" data-month="-1" aria-label="이전 달">${ICONS.left}</button>
        <h2>${y}년 ${m}월</h2>
        <button class="icon-btn" data-month="1" aria-label="다음 달">${ICONS.right}</button>
      </div>
      <div class="cal-weekdays">${head}<span></span></div>
      ${rows}
    </section>`;
}

function streakCard(state) {
  const active = Object.keys(state.days);
  const s = streak(active, state.today);
  const monthDays = monthActiveDays(active, state.today);
  const goal = state.db.settings.monthly_active_days_goal;
  const big = s.days === 0 ? '오늘 시작해볼까요?' : s.untilYesterday ? `어제까지 ${s.days}일` : `운동 ${s.days}일차`;
  return `
    <section class="streak">
      <p class="streak-big">${big}</p>
      <p class="streak-sub">이번 달 <b>${monthDays}</b>/${goal}일 운동했어요</p>
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
  const tiles = sports.map((s) => `
    <button class="tile" data-detail="${date}/${s}" style="--c: var(--${s})">
      <span class="tile-icon">${SPORT_ICON[s]}</span>
      <span class="tile-name">${SPORT_META[s].name}</span>
      <span class="tile-amount">${formatMinutes(day[s].duration_sec)}<small>${formatDistance(s, day[s].distance_m)}</small></span>
    </button>`).join('');
  return `
    <section class="card">
      <div class="day-head"><h2>${title}</h2><span class="muted">${sports.length}종목</span></div>
      <div class="tiles">${tiles}</div>
    </section>`;
}

export function renderCalendar(state) {
  return calendarCard(state) + streakCard(state) + selectedDayCard(state);
}
