// 습관 지수 (명세 4-3, 임시 공식)
// 활동일 달성률×50 + 종목 다양성×20 + 운동 시간 달성률×30, 각 항목은 최대 1
import { DEFAULT_SETTINGS } from './sports.js';

export function habitIndex({ activeDays, sportCount, minutes }, settings = DEFAULT_SETTINGS) {
  const cap = (v) => Math.max(0, Math.min(1, v));
  const days = cap(activeDays / settings.weekly_active_days_goal);
  const variety = cap(sportCount / 4);
  const time = cap(minutes / settings.weekly_minutes_goal);
  return Math.round(days * 50 + variety * 20 + time * 30);
}
