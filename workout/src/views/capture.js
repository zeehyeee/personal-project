// 캡처로 추가: 고르기 → 읽는 중 → 확인
import { SPORT_META } from '../sports.js';
import { lapRows, lapEditRows, isBadLap } from './lap-editor.js';
import { formatDuration } from '../format.js';
import { ICONS, SPORT_ICON, esc, dateLabelFull } from '../ui.js';

const back = `<button class="icon-btn" data-action="back" aria-label="뒤로">${ICONS.left}</button>`;

export function renderCapture(state) {
  const c = state.capture;
  const head = `<div class="page-head">${back}<h2>캡처로 추가</h2></div>`;
  if (c.phase === 'reading') {
    const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
    return `${head}
      <section class="card reading">
        <p class="reading-title">${c.done}/${c.total}장 읽는 중</p>
        <div class="bar"><i style="width:${pct}%; --c: var(--primary)"></i></div>
        <p class="muted">${esc(c.status ?? '')}</p>
        <p class="muted">휴대폰 안에서 읽어요. 캡처는 저장하거나 보내지 않아요.</p>
      </section>`;
  }
  if (c.phase === 'confirm') return head + renderConfirm(state);
  if (c.phase === 'laps') return head + renderLapAttach(state);
  return `${head}
    ${c.error ? `<div class="dup">${esc(c.error)}</div>` : ''}
    <section class="card pick">
      <label class="submit pick-btn">캡처 고르기<input type="file" id="capture-input" accept="image/*" multiple hidden></label>
      <ul class="tips">
        <li>아무 화면이나 섞여도 괜찮아요. 필요한 것만 골라 읽고 나머지는 건너뛰어요.</li>
        <li><b>전체보기</b> 화면이 있으면 날짜·시작 시각이 정확해져요.</li>
        <li>수영은 <b>구간</b> 화면(시간·스트로크)도 함께 올리면 페이스·SWOLF·영법별 기록이 나와요.</li>
      </ul>
    </section>`;
}

function renderConfirm(state) {
  const { result } = state.capture;
  const notes = result.notes.map((n) => `<li>${esc(n)}</li>`).join('');
  const skipped = result.ignored ? `<p class="muted">${result.total}장 중 ${result.ignored}장은 필요 없는 화면이라 건너뛰었어요.</p>` : '';
  if (!result.sessions.length) {
    return `${notes ? `<ul class="notes">${notes}</ul>` : ''}
      <section class="card"><h2>읽은 기록이 없어요</h2>${skipped}
      <p class="muted">삼성헬스 전체보기 또는 운동 상세정보 화면을 올려주세요.</p>
      <button class="submit" data-action="capture-again" style="margin-top:16px">다시 고르기</button></section>`;
  }
  const cards = result.sessions.map((s, i) => card(s, i)).join('');
  return `
    ${notes ? `<ul class="notes">${notes}</ul>` : ''}
    ${skipped}
    <form id="capture-form" novalidate>
      ${cards}
      <button class="submit" type="submit">선택한 기록 저장</button>
      <button class="text-btn" type="button" data-action="capture-again">다시 고르기</button>
    </form>`;
}

function card(s, i) {
  const x = s.session;
  const km = x.sport !== 'swim';
  const dist = x.distance_m == null ? '' : km ? (x.distance_m / 1000).toFixed(2) : String(x.distance_m);
  const h = Math.floor(x.duration_sec / 3600), m = Math.floor((x.duration_sec % 3600) / 60), sec = x.duration_sec % 60;
  const facts = [
    x.distance_m != null ? (km ? `${(x.distance_m / 1000).toFixed(2)}km` : `${x.distance_m}m`) : null,
    x.kcal != null ? `${x.kcal}kcal` : null,
    x.avg_hr != null ? `${x.avg_hr}bpm` : null,
    s.laps.length ? `구간 ${s.laps.length}개` : null,
  ].filter(Boolean).join(' · ');
  const warn = [
    ...(s.duplicate ? [`이미 같은 기록이 있어요${s.duplicate.start_time ? ` (${esc(s.duplicate.start_time)})` : ''}. 저장하지 않으려면 선택을 해제하세요.`] : []),
    ...s.warnings,
  ].map((w) => `<li>${esc(w)}</li>`).join('');
  const input = (name, value, attrs = '') => `<input name="${i}.${name}" value="${esc(value)}" ${attrs}>`;
  return `
    <section class="card cap-card" style="--c: var(--${x.sport})">
      <label class="cap-head">
        <input type="checkbox" name="${i}.on" ${s.duplicate ? '' : 'checked'}>
        <span class="tile-icon">${SPORT_ICON[x.sport]}</span>
        <span><b>${SPORT_META[x.sport].name}</b> · ${dateLabelFull(x.date)}${x.start_time ? ` ${esc(x.start_time)}` : ''}</span>
      </label>
      <p class="cap-main">${formatDuration(x.duration_sec)}</p>
      <p class="muted">${facts}</p>
      ${warn ? `<ul class="notes small">${warn}</ul>` : ''}
      ${lapEditor(s, i)}
      <details ${s.needsDate || s.needsEdit ? 'open' : ''}>
        <summary>날짜·시간·거리 수정</summary>
        <div class="form cap-edit">
          <div class="row2">
            <label class="field"><span class="field-label">날짜</span><span class="field-input">${input('date', x.date, 'type="date"')}</span></label>
            <label class="field"><span class="field-label">시작 시각</span><span class="field-input">${input('start_time', x.start_time, 'type="time"')}</span></label>
          </div>
          <div class="field"><span class="field-label">운동 시간</span><div class="duration">
            <span class="field-input">${input('h', h, 'inputmode="numeric"')}<em>시간</em></span>
            <span class="field-input">${input('m', m, 'inputmode="numeric"')}<em>분</em></span>
            <span class="field-input">${input('s', sec, 'inputmode="numeric"')}<em>초</em></span>
          </div></div>
          <div class="row2">
            <label class="field"><span class="field-label">거리</span><span class="field-input">${input('distance', dist, 'inputmode="decimal"')}<em>${km ? 'km' : 'm'}</em></span></label>
            <label class="field"><span class="field-label">칼로리</span><span class="field-input">${input('kcal', x.kcal ?? '', 'inputmode="numeric"')}<em>kcal</em></span></label>
          </div>
          <label class="field"><span class="field-label">평균 심박수</span><span class="field-input">${input('avg_hr', x.avg_hr ?? '', 'inputmode="numeric"')}<em>bpm</em></span></label>
          <span class="field-error" data-error="${i}"></span>
        </div>
      </details>
    </section>`;
}

// 구간 고치기: 빈 값·빠진 구간이 있으면 펼쳐서 그 줄만 먼저 보여준다 (전체는 '모든 구간 보기')
function lapEditor(s, i) {
  if (s.session.sport !== 'swim' || !s.laps.length) return '';
  const rows = lapRows(s.laps, s.session.swim_laps);
  const nBad = rows.filter(isBadLap).length;
  return `
    <details class="lap-details" ${nBad ? 'open' : ''}>
      <summary>구간 고치기${nBad ? ` <em class="le-count">${nBad}개 확인 필요</em>` : ''}</summary>
      <ul class="lap-edits ${nBad ? 'only-bad' : ''}">${lapEditRows(rows, i)}</ul>
      ${nBad ? '<button type="button" class="text-link le-all" data-action="lap-show-all">모든 구간 보기 ›</button>' : ''}
      <span class="field-error" data-error="${i}.laps"></span>
    </details>`;
}

// 이미 저장한 수영에 구간 캡처만 채우기: 읽은 구간을 확인하고 저장
function renderLapAttach(state) {
  const { session: x, laps } = state.capture;
  const rows = lapRows(laps, x.swim_laps);
  const nBad = rows.filter(isBadLap).length;
  return `
    <form class="card lap-form" data-lap-session="${esc(x.id)}" novalidate>
      <div class="cap-head"><span class="tile-icon">${SPORT_ICON.swim}</span><span><b>수영</b> · ${dateLabelFull(x.date)}${x.start_time ? ` ${esc(x.start_time)}` : ''}</span></div>
      <p class="muted" style="margin-top:8px">구간 ${laps.length}개를 읽었어요${x.swim_laps ? ` (총 ${x.swim_laps}구간)` : ''}.${nBad ? ` 빈 칸 ${nBad}줄을 채우거나 그대로 저장하세요.` : ''}</p>
      <ul class="lap-edits">${lapEditRows(rows, 'L')}</ul>
      <span class="field-error" data-error="L.laps"></span>
      <button class="submit" type="submit" style="margin-top:14px">구간 저장</button>
    </form>
    <button class="text-btn" type="button" data-action="back">취소</button>`;
}
