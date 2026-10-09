// 화면 공용 헬퍼: 이스케이프, 아이콘, 수치 표기
import { parseDate } from './dates.js';
import { cat } from './mascot.js';

export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// 종목 아이콘은 비주얼 마감 단계에서 교체한다
export const SPORT_ICON = { walk: '🚶', run: '🏃', bike: '🚴', swim: '🏊' };

export const ICONS = {
  gear: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  week: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M7 15h10"/></svg>',
  report: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 15v2M12 11v6M16 8v9"/></svg>',
  calendar: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  trend: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 20V12M10 20V6M15 20v-9M20 20V9"/></svg>',
  left: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
};

const WD = '일월화수목금토';

export function dateLabel(str, todayStr) {
  if (str === todayStr) return '오늘';
  const d = parseDate(str);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export function dateLabelFull(str) {
  const d = parseDate(str);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`;
}

// 값이 없으면 '-'
const fmt = (v, f) => (v == null || !Number.isFinite(v) ? '-' : f(v));
export const km = (m) => fmt(m, (v) => (v / 1000).toFixed(2));
export const int = (v) => fmt(v, (x) => Math.round(x).toLocaleString('ko-KR'));
export const dec1 = (v) => fmt(v, (x) => x.toFixed(1));

// 빈 화면: 쉬는 고양이 + 한 줄 + (선택) 버튼
export function emptyState(text, { action = '', label = '', mood = 'rest' } = {}) {
  return `<div class="empty">${cat({ size: 96, mood })}<p>${text}</p>${action ? `<button class="empty-btn" ${action}>${label}</button>` : ''}</div>`;
}

// 컨디션 (운동마다 하나)
export const CONDITIONS = [
  ['tough', '😮‍💨', '힘들었어'],
  ['ok', '🙂', '보통'],
  ['good', '😄', '좋았어'],
  ['great', '🤩', '최고'],
];
export const CONDITION_EMOJI = Object.fromEntries(CONDITIONS.map(([k, e]) => [k, e]));

// 오리발(수영 핀) 아이콘: 발 넣는 곳 + 넓은 날개
export const FIN_ICON = `<svg class="fin" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 1.8c-2.6 0-4.3 1.9-4.3 4.4v3.3L4.6 18.6c-.5 1.6.7 3.2 2.4 3.2 1 0 1.8-.5 2.4-1.2L12 18l2.6 2.6c.6.7 1.4 1.2 2.4 1.2 1.7 0 2.9-1.6 2.4-3.2l-3.1-9.1V6.2c0-2.5-1.7-4.4-4.3-4.4z" fill="currentColor"/>
  <ellipse cx="12" cy="6.4" rx="2.3" ry="2.6" fill="#fff" opacity=".9"/>
  <path d="M9.6 13.5 8 19M14.4 13.5 16 19M12 12v6" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".55"/>
</svg>`;
