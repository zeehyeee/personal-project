// 기록 추가: 선택 화면(#add)과 직접 입력(#add/manual)
import { SPORTS, SPORT_META } from '../sports.js';
import { ICONS, SPORT_ICON, esc } from '../ui.js';

const back = `<button class="icon-btn" data-action="back" aria-label="뒤로">${ICONS.left}</button>`;

export function renderAddChoice() {
  return `
    <div class="page-head">${back}<h2>기록 추가</h2></div>
    <button class="choice" data-action="capture">
      <span class="choice-icon">📷</span>
      <span><b>캡처로 추가</b><small>삼성헬스 캡처를 여러 장 올리면 필요한 수치만 읽어요</small></span>
    </button>
    <button class="choice" data-nav="add/manual">
      <span class="choice-icon">✏️</span>
      <span><b>직접 입력</b><small>종목과 시간, 거리를 직접 적어요</small></span>
    </button>`;
}

const field = (name, label, unit, { sports, mode = 'decimal', hint = '' } = {}) => `
  <label class="field" data-sports="${sports.join(' ')}">
    <span class="field-label">${label}</span>
    <span class="field-input"><input name="${name}" inputmode="${mode}" autocomplete="off" placeholder="${hint}"><em>${unit}</em></span>
    <span class="field-error" data-error="${name}"></span>
  </label>`;

// form: 다시 그릴 때 입력값을 유지하기 위한 초안
export function renderManual(state) {
  const f = state.form;
  const chips = SPORTS.map((s) => `
    <label class="sport-chip" style="--c: var(--${s})">
      <input type="radio" name="sport" value="${s}" ${f.sport === s ? 'checked' : ''}>
      <span>${SPORT_ICON[s]} ${SPORT_META[s].name}</span>
    </label>`).join('');
  const all = SPORTS;
  return `
    <div class="page-head">${back}<h2>직접 입력</h2></div>
    <form class="card form" id="manual-form" novalidate>
      <div class="sport-chips">${chips}</div>
      <span class="field-error" data-error="sport"></span>

      <div class="row2">
        <label class="field"><span class="field-label">날짜</span>
          <span class="field-input"><input type="date" name="date" value="${esc(f.date)}" max="${esc(state.today)}"></span>
          <span class="field-error" data-error="date"></span></label>
        <label class="field"><span class="field-label">시작 시각 <small>선택</small></span>
          <span class="field-input"><input type="time" name="start_time" value="${esc(f.start_time)}"></span>
          <span class="field-error" data-error="start_time"></span></label>
      </div>

      <div class="field">
        <span class="field-label">운동 시간</span>
        <div class="duration">
          <span class="field-input"><input name="h" inputmode="numeric" placeholder="0"><em>시간</em></span>
          <span class="field-input"><input name="m" inputmode="numeric" placeholder="0"><em>분</em></span>
          <span class="field-input"><input name="s" inputmode="numeric" placeholder="0"><em>초</em></span>
        </div>
        <span class="field-error" data-error="duration"></span>
      </div>

      ${field('distance', '거리', 'km', { sports: ['walk', 'run', 'bike'] })}
      ${field('distance', '거리', 'm', { sports: ['swim'], mode: 'numeric' })}
      ${field('kcal', '칼로리', 'kcal', { sports: all, mode: 'numeric' })}
      ${field('pool_length_m', '수영장 길이', 'm', { sports: ['swim'], hint: `비우면 ${state.db.settings.pool_length_m}m` })}
      ${field('swim_laps', '총 반복횟수', '회', { sports: ['swim'], mode: 'numeric', hint: '비우면 거리로 계산' })}
      ${field('swim_total_strokes', '총 스트로크', '', { sports: ['swim'], mode: 'numeric' })}
      ${field('avg_hr', '평균 심박수', 'bpm', { sports: all, mode: 'numeric' })}
      ${field('avg_cadence', '평균 케이던스', 'spm', { sports: ['run'], mode: 'numeric' })}

      <details class="field-more">
        <summary>운동 강도 입력 <small>선택</small></summary>
        <div class="duration zones-input">
          <span class="field-input"><input name="zone_max_min" inputmode="numeric" placeholder="0"><em>최대</em></span>
          <span class="field-input"><input name="zone_high_min" inputmode="numeric" placeholder="0"><em>고강도</em></span>
          <span class="field-input"><input name="zone_mid_min" inputmode="numeric" placeholder="0"><em>중강도</em></span>
        </div>
        <p class="muted">삼성헬스 '정보'의 강도별 시간(분)</p>
      </details>

      <div class="dup" hidden></div>
      <button class="submit" type="submit">저장</button>
    </form>`;
}

// 고른 종목에 맞는 칸만 보이게 (같은 이름의 칸이 종목별로 둘일 수 있어 숨긴 칸은 비활성화)
export function syncManualFields(form) {
  const sport = form.querySelector('input[name=sport]:checked')?.value;
  for (const el of form.querySelectorAll('[data-sports]')) {
    const on = Boolean(sport) && el.dataset.sports.split(' ').includes(sport);
    el.hidden = !on;
    el.querySelector('input').disabled = !on;
  }
}
