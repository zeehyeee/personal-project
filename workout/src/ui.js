// 화면 공용 헬퍼: 이스케이프, 아이콘, 수치 표기
import { parseDate } from './dates.js';

export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// 종목 아이콘은 비주얼 마감 단계에서 교체한다
export const SPORT_ICON = { walk: '🚶', run: '🏃', bike: '🚴', swim: '🏊' };

export const ICONS = {
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
