// 주간 탭 (명세 3-5): 기간·헤드라인 → 미니 캘린더 띠 → 통계 4개(평소 대비) → 종목별 운동량 → 나의 변화 → 습관 지수
import { SPORT_META } from '../sports.js';
import { weeklyReport } from '../report.js';
import { formatMinutes } from '../format.js';
import { ICONS, SPORT_ICON, esc } from '../ui.js';

const WD = '일월화수목금토';

function habitChart(habit) {
  // 6주 꺾은선: 점 6개에 점수를 바로 표기 (범례 불필요한 단일 시리즈)
  const W = 320, H = 120, padX = 24, top = 22, bottom = 26;
  const x = (i) => padX + (i * (W - padX * 2)) / (habit.length - 1);
  const y = (v) => top + (1 - v / 100) * (H - top - bottom);
  const pts = habit.map((h, i) => `${x(i)},${y(h.score)}`).join(' ');
  const dots = habit.map((h, i) => `
    <circle cx="${x(i)}" cy="${y(h.score)}" r="${i === habit.length - 1 ? 5 : 4}" class="${i === habit.length - 1 ? 'now' : ''}"/>
    <text x="${x(i)}" y="${y(h.score) - 10}" class="v">${h.score}</text>
    <text x="${x(i)}" y="${H - 6}" class="l">${h.label}</text>`).join('');
  return `<svg class="habit-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 6주 습관 지수">
    <line x1="${padX}" x2="${W - padX}" y1="${y(0)}" y2="${y(0)}" class="base"/>
    <polyline points="${pts}"/>${dots}</svg>`;
}

export function renderWeekly(state) {
  const r = weeklyReport(state.days, state.weekStart, state.today, state.db.settings);
  const strip = r.strip.map((d) => `
    <div class="ws-day ${d.level}${d.today ? ' today' : ''}${d.future ? ' future' : ''}">
      <span>${WD[new Date(d.date + 'T00:00').getDay()]}</span><i>${Number(d.date.slice(8))}</i>
    </div>`).join('');
  const stats = r.stats.map((s) => `
    <div class="stat">
      <span class="stat-label">${s.label}</span>
      <span class="stat-value">${s.value}</span>
      <span class="chg ${s.tone}">${s.diffLabel}</span>
    </div>`).join('');
  const sports = r.sports.length
    ? r.sports.map((s) => `
      <div class="ws-sport" style="--c: var(--${s.sport})">
        <div class="ws-sport-head"><span>${SPORT_ICON[s.sport]} ${SPORT_META[s.sport].name}</span><b>${formatMinutes(s.minutes * 60)}</b></div>
        <div class="bar"><i style="width:${(s.share * 100).toFixed(1)}%"></i></div>
        <span class="muted">${s.distance_m ? (s.sport === 'swim' ? `${Math.round(s.distance_m)}m` : `${(s.distance_m / 1000).toFixed(2)}km`) : '거리 없음'} · ${Math.round(s.kcal)}kcal · ${s.days}일</span>
      </div>`).join('')
    : '<p class="muted">이번 주 기록이 없어요.</p>';
  const insights = r.insights.map((i) => `<li class="${i.tone}"><span>${i.icon}</span><span>${esc(i.text)}</span></li>`).join('');
  const vs = r.vs4 === 0 ? '4주 전과 같아요' : `4주 전보다 <span class="chg ${r.vs4 > 0 ? 'up' : 'down'}">${r.vs4 > 0 ? '+' : ''}${r.vs4}점</span>`;

  return `
    <section class="card">
      <div class="cal-head">
        <button class="icon-btn" data-week="-1" aria-label="지난주">${ICONS.left}</button>
        <span class="week-badge">${r.label.month}월 ${r.label.week}주차 · ${r.label.range}</span>
        <button class="icon-btn" data-week="1" aria-label="다음 주">${ICONS.right}</button>
      </div>
      <h2 class="headline">${esc(r.headline)}</h2>
      <div class="week-strip">${strip}</div>
    </section>
    <section class="stats">${stats}</section>
    <section class="card"><h2>종목별 운동량</h2><p class="muted">운동 시간 기준</p><div class="ws-sports">${sports}</div></section>
    <section class="card insight"><h2>이번 주 나의 변화</h2><ul>${insights}</ul></section>
    <section class="card">
      <h2>운동 습관 지수 <span class="habit-score">${r.score}</span><span class="muted"> / 100</span></h2>
      <p class="muted">${vs} · 활동일·종목 수·운동 시간으로 계산</p>
      ${habitChart(r.habit)}
    </section>`;
}
