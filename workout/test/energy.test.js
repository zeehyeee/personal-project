import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swimActiveSec, metOf, estimateKcal } from '../src/energy.js';
import { flagRestLaps } from '../src/swim.js';
import { groupByDay, groupLapsBySession } from '../src/aggregate.js';
import { demoData } from '../src/demo.js';
import { DEFAULT_SETTINGS } from '../src/sports.js';

test('수영 물속 시간: 휴식이 섞인 구간은 평소 구간 시간으로, 빠진 구간도 채워 센다', () => {
  const laps = flagRestLaps([50, 52, 48, 400, 50].map((t, i) => ({ lap_no: i + 1, time_sec: t })), 2);
  // 50+52+48+50(400→중앙값 50)+50 = 250, 총 6구간이라 1구간(50) 더
  assert.equal(swimActiveSec({ swim_laps: 6, duration_sec: 3000 }, laps), 300);
  assert.equal(swimActiveSec({ duration_sec: 3000 }, []), null);
  // 기록된 시간보다 길어지지 않게
  assert.equal(swimActiveSec({ swim_laps: 100, duration_sec: 200 }, laps), 200);
});

test('하루 합산: 수영은 물속 시간, 전체 시간은 따로 (실제 10/6: 66분 중)', () => {
  const { sessions, laps } = demoData();
  const d = groupByDay(sessions, groupLapsBySession(laps))['2026-10-06'].swim;
  assert.equal(d.total_sec, 3983);
  assert.ok(d.duration_sec > 600 && d.duration_sec < 1500, d.duration_sec);
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
