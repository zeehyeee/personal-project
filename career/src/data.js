// 이력서·경력기술서·포트폴리오가 모두 이 한 파일에서 나온다. 내용은 여기만 고치면 된다.
// 지금 값은 자리 표시용 예시다. 기간은 'YYYY-MM', 재직 중이면 end: null.

export const profile = {
  name: '이름',
  headline: '한 줄 소개 — 어떤 일을 하는 사람인지',
  email: 'zeehyeyoon@gmail.com',
  phone: '',
  links: [
    { label: 'GitHub', url: 'https://github.com/zeehyeee' },
  ],
  summary: [
    '핵심 역량 요약 1 — 무엇을 잘하고, 어떤 결과를 냈는지',
    '핵심 역량 요약 2',
    '핵심 역량 요약 3',
  ],
};

// 최근 회사부터
export const companies = [
  {
    id: 'company-a',
    name: '회사 A',
    team: '팀 / 부서',
    title: '직무 · 직급',
    start: '2023-03',
    end: null,
    summary: '이 회사에서 맡은 일 한 줄',
    projects: [
      {
        id: 'project-a1',
        name: '프로젝트 이름',
        start: '2024-01',
        end: '2024-06',
        role: '내 역할 (예: 기획·개발 리드, 기여도 70%)',
        stack: ['기술1', '기술2'],
        problem: '배경과 문제 — 왜 이 일을 했는지',
        actions: ['내가 한 일 1', '내가 한 일 2'],
        results: ['성과 1 (가능하면 숫자로)', '성과 2'],
        portfolio: true,
      },
    ],
  },
  {
    id: 'company-b',
    name: '회사 B',
    team: '팀 / 부서',
    title: '직무 · 직급',
    start: '2020-07',
    end: '2023-02',
    summary: '이 회사에서 맡은 일 한 줄',
    projects: [],
  },
];

// 회사 밖 프로젝트 (사이드 프로젝트 등). 포트폴리오에 함께 나온다.
export const personalProjects = [
  {
    id: 'badagym',
    name: '바다네 체육관',
    start: '2026-09',
    end: null,
    role: '1인 기획·디자인·개발',
    stack: ['JavaScript', 'PWA', 'Google Apps Script', 'Vercel'],
    problem: '삼성헬스 운동 기록을 원하는 양식으로 모아 보고 싶었다',
    actions: ['캡처 이미지에서 기록 추출', 'Google Sheets 저장소', '캘린더·추이·주간 리포트 화면'],
    results: ['매일 쓰는 개인 운동 기록 앱'],
    links: [{ label: '앱', url: 'https://workout-log-olive.vercel.app' }],
    portfolio: true,
  },
];

export const education = [
  { school: '학교 이름', major: '전공 · 학위', start: '2014-03', end: '2020-02' },
];

export const skills = [
  { group: '분야 1', items: ['스킬', '스킬'] },
  { group: '분야 2', items: ['스킬', '스킬'] },
];

export const certificates = [
  // { name: '자격증 / 수상', date: '2022-05', by: '발급 기관' },
];
