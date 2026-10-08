// 주간 탭. 리포트 본문(통계 카드, 종목별 운동량, 습관 지수)은 5단계에서 채운다.
import { SPORTS } from '../sports.js';
import { weekDates, weekLabel, parseDate } from '../dates.js';
import { ICONS } from '../ui.js';

export function renderWeekly(state) {
  const { month, week, range } = weekLabel(state.weekStart);
  const strip = weekDates(state.weekStart).map((date) => {
    const day = state.days[date] ?? {};
    const n = SPORTS.filter((s) => day[s]).length;
    const level = n === 0 ? 'none' : n === 4 ? 'full' : 'some';
    const wd = '일월화수목금토'[parseDate(date).getDay()];
    return `<div class="ws-day ${level}${date === state.today ? ' today' : ''}"><span>${wd}</span><i>${Number(date.slice(8))}</i></div>`;
  }).join('');
  return `
    <section class="card">
      <div class="cal-head">
        <button class="icon-btn" data-week="-1" aria-label="지난주">${ICONS.left}</button>
        <div class="week-title"><h2>${month}월 ${week}주차</h2><span class="muted">${range}</span></div>
        <button class="icon-btn" data-week="1" aria-label="다음 주">${ICONS.right}</button>
      </div>
      <div class="week-strip">${strip}</div>
    </section>
    <section class="card"><p class="muted">통계 카드, 종목별 운동량, 습관 지수는 5단계에서 만들어요.</p></section>`;
}
