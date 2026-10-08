// 화면 표기용 포맷터

export function formatDuration(sec) {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  if (m > 0) return r > 0 ? `${m}분 ${r}초` : `${m}분`;
  return `${r}초`;
}

// 9'02" 형식. 페이스(/km, /100m) 공통
export function formatPace(sec) {
  if (sec == null || !Number.isFinite(sec)) return '-';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}'${String(s % 60).padStart(2, '0')}"`;
}

// 'mm:ss' 또는 'h:mm:ss' → 초
export function parseClock(text) {
  const parts = String(text).trim().split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

// 분 단위 짧은 표기 (타일 등 좁은 곳): 32분, 1시간 6분
export function formatMinutes(sec) {
  const total = Math.round(sec / 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}분`;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

// 거리 표기: 수영은 m, 나머지는 km
export function formatDistance(sport, meters) {
  if (meters == null || !(meters > 0)) return '';
  return sport === 'swim' ? `${Math.round(meters).toLocaleString('ko-KR')}m` : `${(meters / 1000).toFixed(2)}km`;
}
