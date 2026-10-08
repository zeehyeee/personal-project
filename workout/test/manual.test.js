import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildManualSession } from '../src/manual.js';

const base = { date: '2026-10-08', start_time: '', h: '', m: '', s: '' };

test('달리기: 시간·거리로 페이스 계산, km → m', () => {
  const { session, errors } = buildManualSession({ ...base, sport: 'run', m: '18', s: '51', distance: '2.03', kcal: '150' }, undefined, 'x');
  assert.equal(errors, undefined);
  assert.equal(session.duration_sec, 1131);
  assert.equal(session.distance_m, 2030);
  assert.equal(session.avg_pace_sec, 557);
  assert.equal(session.source, 'manual');
  assert.equal(session.id, 'x');
});

test('자전거: 평균 속도, 케이던스는 저장 안 함', () => {
  const { session } = buildManualSession({ ...base, sport: 'bike', m: '30', distance: '6', avg_cadence: '80' });
  assert.equal(session.avg_speed_kmh, 12);
  assert.equal(session.avg_cadence, null);
});

test('수영: 거리는 m, 반복 횟수를 비우면 거리 ÷ 수영장 길이', () => {
  const { session } = buildManualSession({ ...base, sport: 'swim', h: '1', m: '6', s: '23', distance: '450' });
  assert.equal(session.duration_sec, 3983);
  assert.equal(session.distance_m, 450);
  assert.equal(session.swim_laps, 18);
});

test('검증: 종목·시간 누락, 잘못된 숫자', () => {
  const { errors } = buildManualSession({ ...base, sport: '', distance: 'abc', m: '70' });
  assert.ok(errors.sport);
  assert.ok(errors.duration);
  assert.ok(errors.distance);
  assert.ok(buildManualSession({ ...base, sport: 'walk' }).errors.duration);
});

test('거리 없이 시간만 입력해도 저장', () => {
  const { session } = buildManualSession({ ...base, sport: 'walk', m: '25' });
  assert.equal(session.distance_m, null);
  assert.equal(session.avg_pace_sec, null);
});
