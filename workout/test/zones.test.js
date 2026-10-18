import test from 'node:test';
import assert from 'node:assert/strict';
import { zoneRows, zoneOf, bpmRange } from '../src/zones.js';

const day = { zone_max_min: 8, zone_high_min: 16, zone_mid_min: 2, zone_low_min: null, zone_duration_sec: 1559 };

test('심박 존: 삼성헬스 구간을 존 5~1로, 최대 178 기준 bpm', () => {
  const rows = zoneRows(day, { max_hr: 178 });
  assert.deepEqual(rows.map((r) => [r.zone, bpmRange(r), r.min]), [
    [5, '160+', 8], [4, '142–159', 16], [3, '125–141', 2], [2, '107–124', 0], [1, '~106', 0],
  ]);
  assert.equal(rows[1].pct, 62);
});

test('심박 존: 최대 심박수 없으면 범위 없이, 남는 시간은 존 1', () => {
  const rows = zoneRows({ ...day, zone_duration_sec: 30 * 60 }, { max_hr: '' });
  assert.equal(bpmRange(rows[0]), '');
  assert.equal(rows[4].min, 4);
});

test('평균 심박이 몇 존인지', () => {
  assert.equal(zoneOf(153, { max_hr: 178 }), 4);
  assert.equal(zoneOf(120, { max_hr: 178 }), 2);
  assert.equal(zoneOf(90, { max_hr: 178 }), 1);
  assert.equal(zoneOf(153, {}), null);
});
