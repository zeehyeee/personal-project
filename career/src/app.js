// 화면 셋: #resume(이력서) · #career(경력기술서) · #portfolio(포트폴리오), 상세 #project/<id>
import { profile, companies, personalProjects, education, skills, certificates } from './data.js';
import { months, formatMonths, formatPeriod, totalMonths } from './period.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const list = (items) => (items?.length ? `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '');
const tags = (items) => (items?.length ? `<div class="tags">${items.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : '');
const links = (items) => (items?.length ? `<div class="links">${items.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}</div>` : '');
const period = (it, ongoing) => `${formatPeriod(it.start, it.end, ongoing)} · ${formatMonths(months(it.start, it.end))}`;

const allProjects = () => [
  ...companies.flatMap((c) => c.projects.map((p) => ({ ...p, company: c.name }))),
  ...personalProjects.map((p) => ({ ...p, company: '개인 프로젝트' })),
];

function header() {
  const contact = [profile.email, profile.phone].filter(Boolean).map(esc).join(' · ');
  return `<header class="card profile">
    <h1>${esc(profile.name)}</h1>
    <p class="headline">${esc(profile.headline)}</p>
    <p class="muted">${contact}</p>
    ${links(profile.links)}
  </header>`;
}

function resume() {
  const total = formatMonths(totalMonths(companies));
  return `${header()}
  <section class="card"><h2>요약</h2>${list(profile.summary)}</section>
  <section class="card"><h2>경력 <span class="muted">총 ${total}</span></h2>
    ${companies.map((c) => `<div class="row">
      <div class="row-head"><strong>${esc(c.name)}</strong><span class="muted">${period(c)}</span></div>
      <p class="sub">${esc([c.team, c.title].filter(Boolean).join(' · '))}</p>
      <p>${esc(c.summary)}</p>
    </div>`).join('')}
  </section>
  <section class="card"><h2>학력</h2>
    ${education.map((e) => `<div class="row">
      <div class="row-head"><strong>${esc(e.school)}</strong><span class="muted">${formatPeriod(e.start, e.end)}</span></div>
      <p class="sub">${esc(e.major)}</p>
    </div>`).join('')}
  </section>
  <section class="card"><h2>기술</h2>
    ${skills.map((s) => `<div class="row"><p class="sub">${esc(s.group)}</p>${tags(s.items)}</div>`).join('')}
  </section>
  ${certificates.length ? `<section class="card"><h2>자격 · 수상</h2>
    ${certificates.map((c) => `<div class="row-head"><span>${esc(c.name)} <span class="muted">${esc(c.by)}</span></span><span class="muted">${esc(c.date.replace('-', '.'))}</span></div>`).join('')}
  </section>` : ''}`;
}

function projectBody(p) {
  return `<p class="sub">${esc(p.role)}</p>
    ${tags(p.stack)}
    ${p.problem ? `<h4>배경 · 문제</h4><p>${esc(p.problem)}</p>` : ''}
    ${p.actions?.length ? `<h4>한 일</h4>${list(p.actions)}` : ''}
    ${p.results?.length ? `<h4>성과</h4>${list(p.results)}` : ''}
    ${links(p.links)}`;
}

function career() {
  return `${header()}
  ${companies.map((c) => `<section class="card">
    <h2>${esc(c.name)}</h2>
    <p class="muted">${esc([c.team, c.title].filter(Boolean).join(' · '))} · ${period(c)}</p>
    <p>${esc(c.summary)}</p>
    ${c.projects.length ? c.projects.map((p) => `<article class="project">
      <div class="row-head"><h3>${esc(p.name)}</h3><span class="muted">${formatPeriod(p.start, p.end, '진행 중')}</span></div>
      ${projectBody(p)}
    </article>`).join('') : '<p class="muted empty">프로젝트를 data.js 에 적어 주세요</p>'}
  </section>`).join('')}`;
}

function portfolio() {
  const items = allProjects().filter((p) => p.portfolio);
  return `<h1 class="page-title">포트폴리오</h1>
  <div class="grid">${items.map((p) => `<a class="card tile" href="#project/${esc(p.id)}">
    <p class="muted">${esc(p.company)} · ${formatPeriod(p.start, p.end, '진행 중')}</p>
    <h3>${esc(p.name)}</h3>
    <p>${esc(p.problem)}</p>
    ${tags(p.stack)}
  </a>`).join('')}</div>`;
}

function project(id) {
  const p = allProjects().find((x) => x.id === id);
  if (!p) return '<p class="muted">찾는 프로젝트가 없어요</p>';
  return `<a class="back" href="#portfolio">← 포트폴리오</a>
  <section class="card">
    <p class="muted">${esc(p.company)} · ${period(p, '진행 중')}</p>
    <h2>${esc(p.name)}</h2>
    ${projectBody(p)}
  </section>`;
}

const TABS = [
  ['resume', '이력서'],
  ['career', '경력기술서'],
  ['portfolio', '포트폴리오'],
];

function render() {
  const [route, arg] = location.hash.slice(1).split('/');
  const tab = route === 'project' ? 'portfolio' : TABS.some(([k]) => k === route) ? route : 'resume';
  const body = route === 'project' ? project(decodeURIComponent(arg ?? '')) : { resume, career, portfolio }[tab]();
  document.getElementById('app').innerHTML = `
    <main>${body}
      <button class="print" type="button" onclick="print()">PDF로 저장 · 인쇄</button>
    </main>
    <nav class="tabbar">${TABS.map(([k, label]) => `<a href="#${k}" class="${k === tab ? 'on' : ''}">${label}</a>`).join('')}</nav>`;
  document.title = `${profile.name} · ${TABS.find(([k]) => k === tab)[1]}`;
  scrollTo(0, 0);
}

addEventListener('hashchange', render);
render();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
