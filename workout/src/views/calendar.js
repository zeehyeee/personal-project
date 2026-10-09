// 캘린더 탭: 이번 달·연속 한 줄 → 월 캘린더 → 선택한 날 목록 (오늘 기록이 없으면 할 일 한 줄 + 고양이)
import { SPORTS, SPORT_META } from '../sports.js';
import { monthGrid, monthKey, weekStart, addDays, weekLabel } from '../dates.js';
import { weeklyReport } from '../report.js';
import { recordsOn } from '../records.js';
import { todayCoach } from '../coach.js';
import { formatMinutes, formatDistance } from '../format.js';
import { ICONS, SPORT_ICON, CONDITION_EMOJI, dateLabel, emptyState } from '../ui.js';

// 예시 데이터 안내와 같은 흰 띠 한 줄: 왼쪽 이번 달 운동일, 오른쪽 연속 일차 (오늘 아직이면 응원)
function streakBar(c) {
  const left = c.month.days ? `이번 달 <b>${c.month.days}일째</b> 운동했어요` : '이번 달 첫 운동을 기다려요';
  const right = c.doneToday ? `연속 <b>${c.streak}일차</b>` : '오늘도 달려요!';
  return `
    <section class="streak-bar ${c.month.days ? '' : 'zero'}">
      <span><span class="flame">🔥</span>${left}</span>
      <span class="sb-right ${c.doneToday ? '' : 'cheer'}">${right}</span>
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

function selectedDayCard(state, coach) {
  const date = state.selected;
  const day = state.days[date] ?? {};
  const sports = SPORTS.filter((s) => day[s]);
  const title = dateLabel(date, state.today);
  if (!sports.length) {
    const empty = date === state.today
      ? emptyState(coach.text, { action: 'data-action="add"', label: '+ 운동 추가', mood: 'hello' })
      : date > state.today ? emptyState('아직 오지 않은 날이에요.') : emptyState('이 날은 쉬었어요.');
    return `<section class="card"><div class="day-head"><h2>${title}</h2></div>${empty}</section>`;
  }
  // 토스 목록 줄: 종목 아이콘 · 이름(+거리·컨디션·신기록) · 운동 시간 ›
  const tiles = sports.map((s) => {
    const meta = [formatDistance(s, day[s].distance_m), cond(day[s], state), recordsOn(state.days, s, date).length ? '<span class="row-pr">🏅 신기록</span>' : ''].filter(Boolean).join(' · ');
    return `
    <button class="row" data-detail="${date}/${s}" style="--c: var(--${s})">
      <span class="row-icon">${SPORT_ICON[s]}</span>
      <span class="row-main"><b>${SPORT_META[s].name}</b>${meta ? `<small>${meta}</small>` : ''}</span>
      <span class="row-value">${formatMinutes(day[s].duration_sec)}</span>
      <span class="row-chev">›</span>
    </button>`;
  }).join('');
  return `
    <section class="card">
      <div class="day-head"><h2>${title}</h2><span class="muted">${sports.length}종목</span></div>
      <div class="rows">${tiles}</div>
    </section>`;
}

// 지난주에 운동했으면 '리포트 도착' 카드 → 주간 탭
function reportCard(state) {
  const start = addDays(weekStart(state.today), -7);
  const r = weeklyReport(state.days, start, state.today, state.db.settings);
  if (!r.sports.length) return '';
  const { month, week } = weekLabel(start);
  return `
    <button class="report-card" data-open-week="${start}">
      <span class="report-icon">${ICONS.week}</span>
      <span><b>${month}월 ${week}주차 리포트가 도착했어요</b><small>${r.headline} · 습관 지수 ${r.score}점</small></span>
      <span>${ICONS.right}</span>
    </button>`;
}

// 그날 그 종목에 남긴 컨디션 (첫 세션 기준)
function cond(day, state) {
  const first = state.db.sessions.filter((x) => day.sessionIds.includes(x.id)).find((x) => x.condition);
  return first ? CONDITION_EMOJI[first.condition] ?? '' : '';
}

export function renderCalendar(state) {
  const coach = todayCoach(state.days, state.today);
  return streakBar(coach) + calendarCard(state) + selectedDayCard(state, coach) + reportCard(state);
}
