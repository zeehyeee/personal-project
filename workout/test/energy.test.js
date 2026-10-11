import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swimActiveSec, metOf, estimateKcal } from '../src/energy.js';
import { flagRestLaps } from '../src/swim.js';
import { groupByDay, groupLapsBySession } from '../src/aggregate.js';
import { demoData } from '../src/demo.js';
import { DEFAULT_SETTINGS } from '../src/sports.js';

test('수영 운동 시간: 출발 전·끝난 뒤 대기만 빼고 중간 휴식은 둔다', () => {
  // 첫 구간 400초(평소 50초 → 출발 전 대기 350초), 중간 휴식 구간 300초는 그대로, 구간 합 850초, 기록 1500초 → 끝난 뒤 650초
  const laps = flagRestLaps([400, 50, 52, 300, 48].map((t, i) => ({ lap_no: i + 1, time_sec: t })), 2);
  assert.equal(swimActiveSec({ swim_laps: 5, duration_sec: 1500 }, laps), 1500 - 650 - 350);
  assert.equal(swimActiveSec({ duration_sec: 3000 }, []), null);
  // 빠진 구간은 평소 구간 시간으로 채워 '끝난 뒤'를 덜 뺀다
  assert.equal(swimActiveSec({ swim_laps: 7, duration_sec: 1500 }, laps), 1500 - (1500 - 950) - 350);
});

test('하루 합산: 실제 10/6 — 66분 중 출발 전 약 9분·끝난 뒤 약 21분을 빼고 약 37분', () => {
  const { sessions, laps } = demoData();
  const d = groupByDay(sessions, groupLapsBySession(laps))['2026-10-06'].swim;
  assert.equal(d.total_sec, 3983);
  // 구간 합 2750초 → 끝난 뒤 1233초, 첫 구간 564초 − 평소 약 49초 → 출발 전 약 515초
  assert.ok(Math.abs(d.duration_sec - (3983 - 1233 - 515)) <= 1, d.duration_sec);
});

test('칼로리: 몸무게가 있으면 MET × kg × 시간, 없으면 삼성헬스 값', () => {
  // 달리기 3.2km 26분25초(약 7.3km/h) → ACSM ≈ 7.9 MET
  assert.equal(Math.round(metOf('run', 3200, 1585) * 10) / 10, 7.9);
  assert.equal(estimateKcal('run', 3200, 1585, 55), Math.round(metOf('run', 3200, 1585) * 55 * (1585 / 3600)));
  assert.equal(estimateKcal('run', 3200, 1585, 0), null);
  const s = [{ id: 'r', date: '2026-09-28', sport: 'run', duration_sec: 1585, distance_m: 3200, kcal: 181 }];
  assert.equal(groupByDay(s)['2026-09-28'].run.kcal, 181);
  const est = groupByDay(s, {}, { ...DEFAULT_SETTINGS, weight_kg: 55 })['2026-09-28'].run;
  assert.equal(est.kcal_estimated, true);
  assert.equal(est.kcal_device, 181);
  assert.ok(est.kcal > 150 && est.kcal < 200, est.kcal);
  // 수영 느린 자유형(분당 20m 미만)은 5.8 MET
  assert.equal(metOf('swim', 625, 2400), 5.8);
});
