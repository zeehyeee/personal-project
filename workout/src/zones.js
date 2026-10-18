// 심박 존 1~5: 삼성헬스 구간(최대 심박수의 %)을 존 번호로 옮기고, 최대 심박수로 bpm 범위를 계산한다.
// 저장된 건 구간별 분뿐이라 경계를 바꿔 다시 나눌 수는 없고, 표기만 바꾼다 (지난 기록에도 그대로 적용)
export const HR_ZONES = [
  { zone: 5, key: 'zone_max_min', name: '최대', pct: 0.9, color: '#c4302b' },
  { zone: 4, key: 'zone_high_min', name: '고강도', pct: 0.8, color: '#f0563f' },
  { zone: 3, key: 'zone_mid_min', name: '중강도', pct: 0.7, color: '#f6a23a' },
  { zone: 2, key: 'zone_low_min', name: '저강도', pct: 0.6, color: '#f7cf6b' },
  { zone: 1, key: null, name: '워밍업·그 외', pct: 0, color: 'var(--grey-200)' },
];

const maxOf = (settings) => {
  const n = Number(settings?.max_hr);
  return Number.isFinite(n) && n >= 100 ? n : null;
};

// 존마다 { zone, name, color, from, to (bpm, 최대 심박수 없으면 null), min, pct(%) }
// totalMin: 강도 기록이 있는 세션의 운동 시간. 구간 합보다 길면 나머지는 존 1
export function zoneRows(day, settings) {
  const max = maxOf(settings);
  const listed = HR_ZONES.filter((z) => z.key).reduce((a, z) => a + (day[z.key] || 0), 0);
  const total = Math.max(listed, (day.zone_duration_sec || 0) / 60);
  return HR_ZONES.map((z, i) => {
    const min = z.key ? day[z.key] || 0 : Math.max(0, Math.round(total - listed));
    const from = max && z.pct ? Math.round(max * z.pct) : null;
    const upper = i > 0 && max ? Math.round(max * HR_ZONES[i - 1].pct) - 1 : null;
    return { zone: z.zone, name: z.name, color: z.color, from, to: upper, min, pct: total ? Math.round((min / total) * 100) : 0 };
  });
}

// 심박수가 몇 존인지 (최대 심박수 없으면 null)
export function zoneOf(bpm, settings) {
  const max = maxOf(settings);
  if (!max || !bpm) return null;
  return (HR_ZONES.find((z) => z.pct && bpm >= Math.round(max * z.pct)) || HR_ZONES[4]).zone;
}

// 화면 표기: "160+", "142–159", "~106"
export function bpmRange(r) {
  if (r.from == null && r.to == null) return '';
  if (r.to == null) return `${r.from}+`;
  if (r.from == null) return `~${r.to}`;
  return `${r.from}–${r.to}`;
}
