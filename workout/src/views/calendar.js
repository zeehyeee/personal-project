// 캘린더 탭: 오늘 카드(고양이 + 할 일 한 줄 + 이번 주 진행) → 월 캘린더 → 선택한 날 블록
import { SPORTS, SPORT_META } from '../sports.js';
import { monthGrid, monthKey, weekStart, addDays, weekLabel } from '../dates.js';
import { weeklyReport } from '../report.js';
import { recordsOn } from '../records.js';
import { todayCoach } from '../coach.js';
import { cat } from '../mascot.js';
import { formatMinutes, formatDistance } from '../format.js';
import { ICONS, SPORT_ICON, CONDITION_EMOJI, dateLabel, emptyState } from '../ui.js';

// 곳간의 캐릭터 말풍선 + 토스식 숫자 위계: 말풍선(할 일) → 진행 막대 2개 → 연속·이번 달
function coachCard(state) {
  const c = todayCoach(state.days, state.today, state.db.settings);
  const bar = (label, v, goal, unit) => `
    <div class="cp">
      <span class="cp-label">${label}</span>
      <span class="cp-value"><b>${v}</b>/${goal}${unit}</span>
      <span class="cp-bar"><i style="width:${Math.min(100, (v / goal) * 100).toFixed(1)}%"></i></span>
    </div>`;
  return `
    <section class="coach mood-${c.mood}">
      <div class="coach-top">
        <span class="coach-cat">${cat({ size: 68, mood: c.mood })}</span>
        <p class="bubble">${c.text}</p>
      </div>
      <div class="coach-progress">
        ${bar('이번 주 운동일', c.week.days, c.week.daysGoal, '일')}
        ${bar('이번 주 운동 시간', c.week.minutes, c.week.minutesGoal, '분')}
      </div>
      <div class="coach-foot">
        <span>🔥 ${c.streak ? `<b>${c.streak}일</b> 연속` : '연속 기록 시작 전'}</span>
        <span>이번 달 <b>${c.month.days}</b>/${c.month.elapsed}일</span>
      </div>
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
    const empty = date === state.today
      ? emptyState('아직 기록이 없어요.', { action: 'data-action="add"', label: '+ 기록 추가', mood: 'hello' })
      : date > state.today ? emptyState('아직 오지 않은 날이에요.') : emptyState('이 날은 쉬었어요.');
    return `<section class="card"><div class="day-head"><h2>${title}</h2></div>${empty}</section>`;
  }
  // 1줄: 아이콘 + 종목명 / 2줄: 운동 시간(크게) + 거리(작게)
  const tiles = sports.map((s) => `
    <button class="tile" data-detail="${date}/${s}" style="--c: var(--${s})">
      <span class="tile-name"><span class="tile-icon">${SPORT_ICON[s]}</span>${SPORT_META[s].name}${cond(day[s], state)}${recordsOn(state.days, s, date).length ? '<span class="tile-pr">🏅 신기록</span>' : ''}</span>
      <span class="tile-amount">${formatMinutes(day[s].duration_sec)}<small>${formatDistance(s, day[s].distance_m)}</small></span>
    </button>`).join('');
  return `
    <section class="card">
      <div class="day-head"><h2>${title}</h2><span class="muted">${sports.length}종목</span></div>
      <div class="tiles">${tiles}</div>
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
  return first ? ` <span class="tile-cond">${CONDITION_EMOJI[first.condition] ?? ''}</span>` : '';
}

export function renderCalendar(state) {
  return coachCard(state) + calendarCard(state) + selectedDayCard(state) + reportCard(state);
}
