// 기간 표기와 경력 합산. 'YYYY-MM' 문자열만 다룬다.

const toIndex = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return y * 12 + (m - 1);
};

const thisMonth = (now) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

// 시작 달과 끝 달을 모두 센다 (2023-03 ~ 2023-03 은 1개월)
export function months(start, end, now = new Date()) {
  return toIndex(end ?? thisMonth(now)) - toIndex(start) + 1;
}

export function formatMonths(n) {
  const y = Math.floor(n / 12);
  const m = n % 12;
  if (y && m) return `${y}년 ${m}개월`;
  return y ? `${y}년` : `${m}개월`;
}

export function formatPeriod(start, end, ongoing = '재직 중') {
  const f = (ym) => ym.replace('-', '.');
  return `${f(start)} ~ ${end ? f(end) : ongoing}`;
}

// 총 경력: 겹치는 기간은 한 번만 센다
export function totalMonths(periods, now = new Date()) {
  const ranges = periods
    .map(({ start, end }) => [toIndex(start), toIndex(end ?? thisMonth(now))])
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur = null;
  for (const [s, e] of ranges) {
    if (cur && s <= cur[1] + 1) cur[1] = Math.max(cur[1], e);
    else {
      if (cur) total += cur[1] - cur[0] + 1;
      cur = [s, e];
    }
  }
  if (cur) total += cur[1] - cur[0] + 1;
  return total;
}
