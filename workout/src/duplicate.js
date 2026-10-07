// 중복 판정. 같은 날짜·종목에서
// - 둘 다 시작 시각이 있으면 시작 시각이 같을 때
// - 한쪽이라도 없으면(직접 입력) 운동 시간 차이가 1분 이내일 때
// 중복으로 본다. 저장을 막지는 않고 확인 화면에서 건너뛸지 고르게 한다.
const DURATION_TOLERANCE_SEC = 60;

export function findDuplicate(candidate, existing) {
  return (
    existing.find((s) => {
      if (s.date !== candidate.date || s.sport !== candidate.sport) return false;
      if (s.start_time && candidate.start_time) return s.start_time === candidate.start_time;
      return Math.abs((s.duration_sec ?? 0) - (candidate.duration_sec ?? 0)) <= DURATION_TOLERANCE_SEC;
    }) ?? null
  );
}
