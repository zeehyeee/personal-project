# 운동 기록 웹앱

삼성헬스 캡처를 읽어 Google Sheets에 쌓고, 원하는 양식(캘린더·추이·주간 리포트)으로 보여주는 개인 앱.
이 폴더는 저장소 루트의 Next.js 앱과 독립적이다. (빌드 단계 없음, 의존성 없음)

## 구조

```
workout/
  index.html        단일 HTML 프런트, src/*.js 를 ES 모듈로 불러온다
  styles.css        뼈대 스타일 (위계·구조만, 비주얼 마감은 Claude Design 단계)
  dev.js            로컬 확인용 정적 서버
  api/extract.js    (예정) Vercel 함수: Claude 비전으로 캡처 추출. API 키는 환경변수에만
  src/              브라우저·Node 공용 모듈
    app.js          앱 뼈대: 헤더, 하단 탭, 화면 렌더링
    store.js        저장소 (지금은 localStorage, 나중에 Sheets로 교체)
    demo.js         예시 데이터 (source: 'demo', 화면에서 한 번에 지울 수 있음)
    aggregate.js    세션 → 일 합산
    swim.js         수영 구간 기반 페이스·SWOLF, 휴식 구간 제외, 빠진 구간 검사
    streak.js       스트릭, 이번 달 운동일
    compare.js      평소 대비(직전 4주 / 3개월), 증감률
    habit.js        습관 지수
    duplicate.js    중복 판정
    dates.js        날짜·주차·연도 추정
  test/             node --test 단위 테스트
```

실행: `cd workout && npm run dev` → http://localhost:5173
테스트: `npm test` (Node 22, 설치할 것 없음)

## 확정한 결정 (명세 보완)

- **주 시작 요일**: 일요일. 월 캘린더와 주간 리포트(미니 캘린더 띠, 평소 대비, 습관 지수) 모두 일~토 기준.
  1일이 포함된 행이 그 달 1주차.
- **하루 수영 여러 번**: 휴식 구간은 세션별 중앙값으로 판정하고, 페이스·SWOLF·영법별 값은
  그날 모든 세션의 구간을 모아 다시 계산한다. (세션 값끼리 평균 내지 않음)
- **중복 판정**: 같은 날짜·종목에서 둘 다 시작 시각이 있으면 시작 시각 일치,
  한쪽이라도 없으면(직접 입력) 운동 시간 차이 1분 이내. 저장을 막지 않고 건너뛸지 고르게 한다.
- **월 활동일 목표 20**: 스트릭 카드 보조 문구에 분수로 쓴다. `이번 달 12/20일 운동했어요`
  (settings `monthly_active_days_goal`)
- **연도 추정**: 오늘 기준 가장 최근의 과거 날짜로 보고 요일로 검증한다. 요일이 다르면 확인 화면에서 수정 요청.
- **페이스·속도 합산**: 거리가 있는 세션만으로 총 시간 ÷ 총 거리. 심박·케이던스는 값이 있는 세션만 시간 가중 평균.

## settings 시트 추가 키

명세 5장에 더해 `monthly_active_days_goal`(20), `swim_rest_multiplier`(2)를 둔다.
목표치 기본값은 `src/sports.js`의 `DEFAULT_SETTINGS` (임시값).

## 남은 확인

- 바다네 곳간의 Sheets 연동 방식 (7단계로 미룸. `src/store.js`만 바꾸면 된다) (읽기 전용 공개 CSV인지, Apps Script 웹앱으로 쓰기까지 하는지)
- 10/6 수영 실제 구간 값: `test/fixtures.js`는 명세의 집계값을 모두 만족하게 **재구성한 값**이라 실제 값으로 교체 필요
- 습관 지수 공식·목표치
