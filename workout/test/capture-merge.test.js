import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mergeCaptures } from '../src/capture/merge.js';
import { aggregateSessions, groupLapsBySession } from '../src/aggregate.js';
import { flagRestLaps, swimLapStats } from '../src/swim.js';
import { formatPace } from '../src/format.js';

// 실제 캡처 18장(지도·그래프·중복 화면 포함)을 브라우저와 같은 방식으로 읽은 결과
const items = JSON.parse(readFileSync(new URL('./fixtures/capture-items.json', import.meta.url)));
let n = 0;
const run = (list) => mergeCaptures(list, { today: '2026-10-08', newId: () => `s${++n}` });

test('실제 캡처 18장 → 6세션 (지도·그래프는 건너뜀)', () => {
  const { sessions } = run(items);
  const summary = sessions.map(({ session: s }) => [s.date, s.start_time, s.sport, s.duration_sec, s.distance_m, s.kcal]);
  assert.deepEqual(summary, [
    ['2026-10-02', '19:18', 'run', 479, 1050, null],
    ['2026-10-02', '19:28', 'run', 1131, 2030, 130],
    ['2026-10-06', '19:20', 'bike', 706, 2360, 52],
    ['2026-10-06', '20:04', 'swim', 3983, 450, 517],
    ['2026-10-06', '21:23', 'walk', 1526, 1930, 92],
  ]);
});

test('전체보기에 다 안 보인 세션은 안내', () => {
  const { notes } = run(items);
  assert.ok(notes.some((t) => t.includes('세션 3개 중 2개')));
});

test('달리기 상세의 심박·케이던스, 걷기는 케이던스 저장 안 함', () => {
  const { sessions } = run(items);
  const runS = sessions.find((s) => s.session.duration_sec === 1131).session;
  assert.equal(runS.avg_hr, 152);
  assert.equal(runS.avg_cadence, 140);
  assert.equal(sessions.find((s) => s.session.sport === 'walk').session.avg_cadence, null);
});

test('수영: 구간 4장(겹침·중복 포함) → 18구간, 검증 경고 없음, 명세 계산값 재현', () => {
  const { sessions } = run(items);
  const swim = sessions.find((s) => s.session.sport === 'swim');
  assert.equal(swim.laps.length, 18);
  assert.deepEqual(swim.warnings, []);
  assert.equal(swim.session.swim_total_strokes, 111);
  const st = swimLapStats(flagRestLaps(swim.laps), 25);
  assert.equal(formatPace(st.pacePer100Sec), `3'20"`);
  assert.equal(Math.round(st.avgSwolf * 10) / 10, 55.7);
  const day = aggregateSessions([swim.session], groupLapsBySession(swim.laps));
  assert.equal(day.swim.lapStats.byStroke.find((b) => b.stroke === 'backstroke').lapCount, 6);
});

test('운동 강도: 그래프 화면에서 읽어 맞는 세션에 붙인다', () => {
  const { sessions } = run(items);
  const swim = sessions.find((s) => s.session.sport === 'swim').session;
  assert.deepEqual([swim.zone_max_min, swim.zone_high_min, swim.zone_mid_min], [null, 26, 30]);
  // 달리기 강도 합 19분 → 18분 51초 세션에 (7분 59초 세션에는 들어가지 않음)
  const runs = sessions.filter((s) => s.session.sport === 'run').map((s) => s.session);
  assert.deepEqual(runs.find((r) => r.duration_sec === 1131).zone_high_min, 12);
  assert.equal(runs.find((r) => r.duration_sec === 479).zone_high_min, null);
});

test('구간 화면 일부만 올리면 빠진 구간 안내', () => {
  const partial = items.filter((i) => !(i.kind === 'laps' && ['01.png', '17.png', '18.png'].includes(i.image)));
  const swim = run(partial).sessions.find((s) => s.session.sport === 'swim');
  assert.ok(swim.warnings.some((w) => w.includes('구간 15~18이 없어요')));
});

test('구간 화면이 없으면 안내', () => {
  const swim = run(items.filter((i) => i.kind !== 'laps')).sessions.find((s) => s.session.sport === 'swim');
  assert.ok(swim.warnings.some((w) => w.includes('구간 화면이 없어')));
});

test('상세 화면만 있고 날짜를 모르면 오늘로 두고 확인 요청', () => {
  const { sessions } = run(items.filter((i) => i.image === '13.png'));
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].session.date, '2026-10-08');
  assert.equal(sessions[0].needsDate, true);
});

test('헤더 화면이 상세 화면에 날짜를 붙여준다', () => {
  const { sessions } = run(items.filter((i) => ['15.png', '16.png'].includes(i.image)));
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].session.date, '2026-10-06');
  assert.equal(sessions[0].session.start_time, '21:23');
  assert.equal(sessions[0].needsDate, false);
});
