import { test } from 'node:test';
import assert from 'node:assert/strict';
import { months, formatMonths, formatPeriod, totalMonths } from '../src/period.js';
import * as data from '../src/data.js';

const now = new Date(2026, 9, 19); // 2026-10

test('기간은 시작·끝 달을 모두 센다', () => {
  assert.equal(months('2023-03', '2023-03'), 1);
  assert.equal(months('2020-07', '2023-02'), 32);
  assert.equal(months('2026-01', null, now), 10);
});

test('개월 표기', () => {
  assert.equal(formatMonths(32), '2년 8개월');
  assert.equal(formatMonths(24), '2년');
  assert.equal(formatMonths(5), '5개월');
});

test('기간 표기', () => {
  assert.equal(formatPeriod('2023-03', null), '2023.03 ~ 재직 중');
  assert.equal(formatPeriod('2020-07', '2023-02'), '2020.07 ~ 2023.02');
  assert.equal(formatPeriod('2026-09', null, '진행 중'), '2026.09 ~ 진행 중');
});

test('총 경력은 겹치는 기간을 한 번만', () => {
  assert.equal(totalMonths([{ start: '2020-01', end: '2020-12' }, { start: '2020-07', end: '2021-06' }]), 18);
  assert.equal(totalMonths([{ start: '2020-01', end: '2020-06' }, { start: '2020-07', end: '2020-12' }]), 12);
  assert.equal(totalMonths([{ start: '2020-01', end: '2020-03' }, { start: '2021-01', end: '2021-03' }]), 6);
});

test('데이터: 기간 형식과 id 중복', () => {
  const ym = /^\d{4}-(0[1-9]|1[0-2])$/;
  const items = [...data.companies, ...data.companies.flatMap((c) => c.projects), ...data.personalProjects];
  const ids = new Set();
  for (const it of items) {
    assert.match(it.start, ym, it.id);
    if (it.end !== null) assert.match(it.end, ym, it.id);
    if (it.end) assert.ok(it.start <= it.end, `${it.id}: 시작이 끝보다 늦다`);
    assert.ok(!ids.has(it.id), `id 중복: ${it.id}`);
    ids.add(it.id);
  }
});
