// 날짜는 모두 로컬 기준 'YYYY-MM-DD' 문자열로 다룬다.
// 주는 일요일 시작(월 캘린더와 동일)이다.

export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function weekStart(str) {
  return addDays(str, -parseDate(str).getDay());
}

export function weekDates(startStr) {
  return Array.from({ length: 7 }, (_, i) => addDays(startStr, i));
}

// 그 달 캘린더에서 몇 번째 주 행인지 (1일이 포함된 행 = 1주차)
export function weekOfMonth(str, year, month) {
  const first = toDateStr(new Date(year, month - 1, 1));
  const diff = (parseDate(weekStart(str)) - parseDate(weekStart(first))) / 86400000;
  return Math.round(diff / 7) + 1;
}

export function monthKey(str) {
  return str.slice(0, 7);
}

export function addMonths(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 삼성헬스 화면에는 연도가 없고 요일만 있다 (`10월 6일 (화)`).
// 오늘 기준 가장 최근의 과거 날짜로 보고(연초의 12월 캡처는 작년), 요일로 검증한다.
// 요일이 맞지 않으면 다른 연도를 찾지 않고 needsConfirm으로 확인 화면에서 수정을 요청한다.
// (1년 전 같은 날이 우연히 그 요일일 수 있어 잘못 읽은 날짜를 그대로 통과시키게 된다)
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function inferDate(month, day, weekdayKo, todayStr) {
  const today = parseDate(todayStr);
  let d = new Date(today.getFullYear(), month - 1, day);
  if (d > today) d = new Date(today.getFullYear() - 1, month - 1, day);
  const needsConfirm = Boolean(weekdayKo) && d.getDay() !== WEEKDAYS.indexOf(weekdayKo);
  return { date: toDateStr(d), needsConfirm };
}

// 월 캘린더 격자: 일~토 주 단위 배열. 앞뒤 달 날짜도 채워 넣는다.
export function monthGrid(year, month) {
  const first = toDateStr(new Date(year, month - 1, 1));
  const last = toDateStr(new Date(year, month, 0));
  const weeks = [];
  for (let start = weekStart(first); start <= last; start = addDays(start, 7)) {
    weeks.push(weekDates(start));
  }
  return weeks;
}
