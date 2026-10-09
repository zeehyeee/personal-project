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
  assert.equal(swim.session.pool_length_m, 25);
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

test('수영 거리: 반복 횟수 × 수영장 길이와 크게 다르면 고치고 알린다 (675m → 6m 오독)', async () => {
  const { checkSwimDistance } = await import('../src/capture/merge.js');
  const fix = checkSwimDistance({ distance_m: 6, swim_laps: 27, pool_length_m: 25 });
  assert.equal(fix.distance, 675);
  assert.match(fix.warning, /6m로 읽었는데 27구간 × 25m\(675m\)/);
  assert.equal(checkSwimDistance({ distance_m: 450, swim_laps: 18, pool_length_m: 25 }), null);
  assert.equal(checkSwimDistance({ distance_m: null, swim_laps: null }, []), null);
  assert.equal(checkSwimDistance({ distance_m: null, swim_laps: null, pool_length_m: null }, [{ lap_no: 4 }]).distance, 100);
});

test('구간 고치기 입력 → 구간 행: 0:46·46 모두 초로, 빈 줄은 건너뜀, 잘못 쓰면 오류', async () => {
  const { lapsFromForm } = await import('../src/manual.js');
  const v = {
    '0.lap.0.no': '16', '0.lap.0.stroke': 'freestyle', '0.lap.0.time': '0:46', '0.lap.0.strokes': '5',
    '0.lap.1.no': '17', '0.lap.1.stroke': 'backstroke', '0.lap.1.time': '52', '0.lap.1.strokes': '',
    '0.lap.2.no': '18', '0.lap.2.stroke': 'freestyle', '0.lap.2.time': '', '0.lap.2.strokes': '',
  };
  const r = lapsFromForm(v, '0', 's');
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.laps, [
    { session_id: 's', lap_no: 16, stroke: 'freestyle', time_sec: 46, strokes: 5 },
    { session_id: 's', lap_no: 17, stroke: 'backstroke', time_sec: 52, strokes: null },
  ]);
  assert.match(lapsFromForm({ '0.lap.0.no': '3', '0.lap.0.time': '1:75' }, '0', 's').errors[0], /구간 3 시간/);
});
