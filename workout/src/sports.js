// 종목 메타 정보. 캘린더·추이 공통 표기 단위를 여기서 정한다.
export const SPORTS = ['walk', 'run', 'bike', 'swim'];

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
  medley: '혼영',
  butterfly: '접영',
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
