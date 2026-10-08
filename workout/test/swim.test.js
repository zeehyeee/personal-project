import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flagRestLaps, swimLapStats, findMissingLaps } from '../src/swim.js';
import { formatPace } from '../src/format.js';
import { swim1006Laps } from './fixtures.js';

const round1 = (n) => Math.round(n * 10) / 10;
const flagged = flagRestLaps(swim1006Laps, 2);
const stats = swimLapStats(flagged, 25);

test('10/6 실제 구간: 휴식 1·10·16·17만 제외 (중앙값 50.5초, 기준 101초)', () => {
  const rest = flagged.filter((l) => l.rest).map((l) => l.lap_no);
  assert.deepEqual(rest, [1, 10, 16, 17]);
  assert.equal(stats.restExcluded, 4);
});

test('10/6 세션 전체: 3\'20"/100m, SWOLF 55.7, 스트로크 합 111', () => {
  assert.equal(stats.lapCount, 18);
  assert.equal(stats.distanceM, 450);
  assert.equal(formatPace(stats.pacePer100Sec), `3'20"`);
  assert.equal(round1(stats.avgSwolf), 55.7);
  assert.equal(stats.totalStrokes, 111);
});

test('10/6 자유형: 12회 67%, 3\'15"/100m, 구간당 5.5스트로크, SWOLF 53.6', () => {
  const f = stats.byStroke.find((s) => s.stroke === 'freestyle');
  assert.equal(f.lapCount, 12);
  assert.equal(Math.round(f.share * 100), 67);
  assert.equal(formatPace(f.pacePer100Sec), `3'15"`);
  assert.equal(f.strokesPerLap, 5.5);
  assert.equal(round1(f.avgSwolf), 53.6);
});

test('10/6 배영: 6회 33%, 3\'29"/100m, 구간당 7.5스트로크, SWOLF 59.6', () => {
  const b = stats.byStroke.find((s) => s.stroke === 'backstroke');
  assert.equal(b.lapCount, 6);
  assert.equal(Math.round(b.share * 100), 33);
  assert.equal(formatPace(b.pacePer100Sec), `3'29"`);
  assert.equal(b.strokesPerLap, 7.5);
  assert.equal(round1(b.avgSwolf), 59.6);
});

test('영법별 섹션은 영법이 2개 이상일 때만', () => {
  assert.equal(stats.showByStroke, true);
  const one = swimLapStats(flagged.filter((l) => l.stroke === 'freestyle'), 25);
  assert.equal(one.showByStroke, false);
});

test('배수를 바꾸면 휴식 판정이 달라진다', () => {
  const loose = flagRestLaps(swim1006Laps, 4).filter((l) => l.rest).map((l) => l.lap_no);
  assert.deepEqual(loose, [1, 16]);
});

test('스트로크 화면만 있으면(시간 없음) 스트로크만 계산', () => {
  const only = swim1006Laps.map((l) => ({ ...l, time_sec: null }));
  const st = swimLapStats(flagRestLaps(only), 25);
  assert.equal(st.restExcluded, 0);
  assert.equal(st.totalStrokes, 111);
  assert.equal(st.pacePer100Sec, null);
  assert.equal(st.avgSwolf, null);
});

test('시간 화면만 있으면 페이스는 계산, SWOLF는 없음', () => {
  const only = swim1006Laps.map((l) => ({ ...l, strokes: null }));
  const st = swimLapStats(flagRestLaps(only), 25);
  assert.equal(formatPace(st.pacePer100Sec), `3'20"`);
  assert.equal(st.avgSwolf, null);
  assert.equal(st.strokesPerLap, null);
});

test('수영장 길이가 다른 구간: 거리와 페이스를 구간마다 계산', () => {
  const laps = flagRestLaps([
    { lap_no: 1, stroke: 'freestyle', time_sec: 50, strokes: 5, pool_m: 25 },
    { lap_no: 2, stroke: 'freestyle', time_sec: 25, strokes: 3, pool_m: 12.5 },
  ]);
  const st = swimLapStats(laps, 25);
  assert.equal(st.distanceM, 37.5);
  assert.equal(formatPace(st.pacePer100Sec), `3'20"`); // 둘 다 200초/100m
});

test('빠진 구간 범위를 찾는다', () => {
  assert.deepEqual(findMissingLaps([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], 18), [[15, 18]]);
  assert.deepEqual(findMissingLaps([1, 3, 4], 6), [[2, 2], [5, 6]]);
  assert.deepEqual(findMissingLaps(swim1006Laps.map((l) => l.lap_no), 18), []);
});
