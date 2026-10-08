// 설정: 습관 목표, 종목별 월 목표, 수영(기본 수영장 길이, 휴식 판정 배수), 데이터 백업
import { SPORTS, SPORT_META } from '../sports.js';
import { ICONS, esc } from '../ui.js';
import { hasDemo } from '../store.js';

// 설정 항목: [키, 이름, 단위, 최소, 최대, 소수 허용]
export const SETTING_FIELDS = {
  weekly_active_days_goal: ['주 운동일 목표', '일', 1, 7],
  weekly_minutes_goal: ['주 운동 시간 목표', '분', 10, 2000],
  pool_length_m: ['기본 수영장 길이', 'm', 5, 100, true],
  swim_rest_multiplier: ['휴식 판정 배수', '배', 1.2, 5, true],
  ...Object.fromEntries(SPORTS.map((s) => [`monthly_count_goal_${s}`, [`${SPORT_META[s].name} 월 목표`, '회', 0, 31]])),
};

// 입력값 → 저장할 값 (범위를 벗어나면 null)
export function parseSetting(key, raw) {
  const f = SETTING_FIELDS[key];
  if (!f) return null;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < f[2] || n > f[3]) return null;
  return f[4] ? Math.round(n * 10) / 10 : Math.round(n);
}

const row = (state, key, hint = '') => {
  const [name, unit, min, max, dec] = SETTING_FIELDS[key];
  return `
    <label class="set-row">
      <span><b>${name}</b>${hint ? `<small>${hint}</small>` : ''}</span>
      <span class="field-input set-input"><input name="${key}" value="${esc(state.db.settings[key])}" inputmode="${dec ? 'decimal' : 'numeric'}" data-min="${min}" data-max="${max}"><em>${unit}</em></span>
    </label>`;
};

export function renderSettings(state) {
  const back = `<button class="icon-btn" data-action="back" aria-label="뒤로">${ICONS.left}</button>`;
  return `
    <div class="page-head">${back}<h2>설정</h2></div>
    <form id="settings-form" novalidate>
      <section class="card set-card">
        <h2>습관 목표</h2>
        <p class="muted">습관 지수와 주간 리포트에 쓰여요.</p>
        ${row(state, 'weekly_active_days_goal')}
        ${row(state, 'weekly_minutes_goal')}
      </section>
      <section class="card set-card">
        <h2>종목별 월 목표 횟수</h2>
        <p class="muted">추이 탭에서 이번 달 몇 번 했는지 보여줘요. 0이면 표시하지 않아요.</p>
        ${SPORTS.map((s) => row(state, `monthly_count_goal_${s}`)).join('')}
      </section>
      <section class="card set-card">
        <h2>수영</h2>
        ${row(state, 'pool_length_m', '캡처·입력에 수영장 길이가 없을 때')}
        ${row(state, 'swim_rest_multiplier', '구간 시간이 그날 중앙값의 몇 배를 넘으면 휴식이 섞인 구간으로 볼지. 바꾸면 지난 기록도 다시 계산해요')}
      </section>
    </form>
    <section class="card set-card">
      <h2>데이터</h2>
      <p class="muted">기록은 지금 이 휴대폰 브라우저에만 저장돼요. 가끔 백업 파일을 저장해 두세요.</p>
      <button class="set-btn" data-action="backup">백업 파일 저장</button>
      <label class="set-btn">백업 불러오기<input type="file" id="restore-input" accept="application/json,.json" hidden></label>
      ${hasDemo(state.db.sessions) ? '<button class="set-btn danger" data-action="clear-demo">예시 데이터 지우기</button>' : ''}
    </section>`;
}
