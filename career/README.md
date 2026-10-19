# 커리어 (이력서 · 경력기술서 · 포트폴리오)

내 이력서·경력기술서·포트폴리오를 한 곳에 정리하는 개인 웹앱.
이 폴더는 저장소 루트의 Next.js 앱과 독립적이다. (빌드 단계 없음, 의존성 없음 — `workout/`과 같은 방식)

## 구조

```
career/
  vercel.json       정적 사이트로 배포 (Vercel 프로젝트 Root Directory = career)
  index.html        단일 HTML, src/app.js 를 ES 모듈로 불러온다
  styles.css        화면 + 인쇄(A4 PDF) 스타일
  sw.js             홈 화면에 추가했을 때 바로 뜨도록 앱 파일 저장
  src/
    data.js         ★ 내용은 전부 여기. 프로필·회사·프로젝트·학력·기술·자격
    period.js       기간 표기, 재직 개월, 총 경력(겹치는 기간 한 번만)
    app.js          화면: #resume · #career · #portfolio · #project/<id>
  test/             node --test 단위 테스트 (기간 계산, data.js 형식 검사)
```

실행: `cd career && npm run dev` → http://localhost:5173
테스트: `npm test` (Node 22, 설치할 것 없음)

## 한 데이터, 세 문서

- **이력서**: 프로필 + 요약 + 회사별 한 줄 + 학력·기술·자격. 총 경력은 자동 계산
- **경력기술서**: 회사별 프로젝트마다 역할 · 배경/문제 · 한 일 · 성과
- **포트폴리오**: `portfolio: true` 인 프로젝트(회사 + 개인)를 카드로, 누르면 상세
- 어느 화면이든 아래 `PDF로 저장 · 인쇄` → 브라우저 인쇄에서 PDF로 저장 (A4, 탭바·버튼 숨김)
