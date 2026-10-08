// 종목 메타 정보. 캘린더·추이 공통 표기 단위를 여기서 정한다.
// 화면에 보이는 순서: 주력 종목(수영)부터
export const SPORTS = ['swim', 'run', 'walk', 'bike'];

export const SPORT_META = {
  walk: { name: '걷기', unit: 'min' },
  run: { name: '달리기', unit: 'km' },
  bike: { name: '자전거', unit: 'min' },
  swim: { name: '수영', unit: 'm' },
};

export const STROKE_NAMES = {
  freestyle: '자유형',
  backstroke: '배영',
  breaststroke: '평영',
  medley: '혼영·기타',
  butterfly: '접영',
};

// 운동 강도(삼성헬스 심박 구간) 분. 높은 강도부터
export const ZONE_KEYS = ['zone_max_min', 'zone_high_min', 'zone_mid_min', 'zone_low_min'];
export const ZONE_META = {
  zone_max_min: { name: '최대', color: '#c4302b' },
  zone_high_min: { name: '고강도', color: '#f0563f' },
  zone_mid_min: { name: '중강도', color: '#f6a23a' },
  zone_low_min: { name: '저강도', color: '#f7cf6b' },
};

// settings 시트 기본값. 목표치는 임시값이며 설정 화면에서 바꾼다.
export const DEFAULT_SETTINGS = {
  pool_length_m: 25,
  swim_rest_multiplier: 2,
  weekly_active_days_goal: 5,
  weekly_minutes_goal: 150,
  monthly_active_days_goal: 20,
  monthly_count_goal_walk: 12,
  monthly_count_goal_run: 8,
  monthly_count_goal_bike: 4,
  monthly_count_goal_swim: 8,
};

// 캘린더·추이 공통 운동량 표기: 걷기=분, 달리기=km, 자전거=분, 수영=m
export function sportAmount(day) {
  const unit = SPORT_META[day.sport].unit;
  if (unit === 'min') return `${Math.round(day.duration_sec / 60)}분`;
  if (unit === 'km') return `${(day.distance_m / 1000).toFixed(2)}km`;
  return `${Math.round(day.distance_m)}m`;
}
