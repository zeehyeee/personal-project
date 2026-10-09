import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDaily, parseHeader, parseDetail, parseKoDate, parseStroke, repairLapNumbers, detectSport, parseZones } from '../src/capture/parse.js';

// 아래 글자는 실제 캡처를 2배 확대해 OCR한 결과
test('전체보기: 날짜와 세션 줄', () => {
  const text = `10월 2일 (금)\n금7 분\n3세션 3.49 km\n달리기                     오후 7:28\n00:18:51 2.03 km           Galaxy Fit2\n달리기 @                   오후 7:18\n00:07:59 1.05 km           Galaxy Fit2\n달리기                     오후 7:12`;
  const r = parseDaily(text);
  assert.deepEqual(r.date, { month: 10, day: 2, weekday: '금' });
  assert.equal(r.sessionCount, 3);
  assert.deepEqual(r.rows, [
    { sport: 'run', start_time: '19:28', duration_sec: 1131, distance_m: 2030 },
    { sport: 'run', start_time: '19:18', duration_sec: 479, distance_m: 1050 },
  ]);
});

test('전체보기: 수영은 두 번째 값이 칼로리', () => {
  const r = parseDaily(`10월 6일 (화)\n1세션 0.45 km\n수영(실내)          오후 8:04\n01:06:23 517 kcal      Galaxy Fit2 ^`);
  assert.deepEqual(r.rows, [{ sport: 'swim', start_time: '20:04', duration_sec: 3983, kcal: 517 }]);
});

test('결과 헤더: 날짜·시작·끝·운동 시간', () => {
  const r = parseHeader('10월 2일 (금) 오후 7:28 - 오후 7:50\n18분 51초');
  assert.deepEqual(r, { date: { month: 10, day: 2, weekday: '금' }, start_time: '19:28', end_time: '19:50', duration_sec: 1131, duration_has_sec: true });
});

test('결과 헤더: 콜론 빠짐, 초 글자 깨짐', () => {
  const r = parseHeader('10월 2일 (금) 오후 728 - 오후 7:50\n18 분 51x');
  assert.equal(r.start_time, '19:28');
  assert.equal(r.duration_sec, 1131);
});

test('OCR이 월을 2로 읽어도 날짜 인식', () => {
  assert.deepEqual(parseKoDate('102 6일 (화)'), { month: 10, day: 6, weekday: '화' });
  assert.deepEqual(parseKoDate('122 25일 (금)'), { month: 12, day: 25, weekday: '금' });
});

test('상세정보: 필요한 값만 가져온다', () => {
  const r = parseDetail([
    { label: '운동 시간', value: '00:18:51' },
    { label: '총 시간', value: '00:22:07' },
    { label: '거리', value: '2.03 km' },
    { label: '운동 칼로리', value: '130 kcal' },
    { label: '평균 속도', value: '6.4 km/h' },
    { label: '최고 고도', value: '4m' },
    { label: '평균 심박수', value: '152 bpm' },
    { label: '평균 케이던스', value: '140 spm' },
  ]);
  assert.deepEqual(r, { duration_sec: 1131, distance_m: 2030, kcal: 130, avg_hr: 152, avg_cadence: 140 });
});

test('운동 강도 화면 (실제 OCR)', () => {
  assert.deepEqual(parseZones('시간 (분)   정보\n최대                  6분\n고강도                 12 분\n중강도                 1 분'),
    { zone_max_min: 6, zone_high_min: 12, zone_mid_min: 1 });
  assert.deepEqual(parseZones('고강도                  26 분\n중강도                  30 분'), { zone_high_min: 26, zone_mid_min: 30 });
  assert.equal(parseZones('최대 심박수\n168 bpm'), null);
});

test('영법, 종목 인식', () => {
  assert.equal(parseStroke('자유형(크롤)'), 'freestyle');
  assert.equal(parseStroke('자 (크롤)'), 'freestyle');
  assert.equal(parseStroke('배영'), 'backstroke');
  assert.equal(detectSport('자전거타기'), 'bike');
});

test('구간 번호 보정: 빠지거나 붙어 읽힌 번호', () => {
  assert.deepEqual(repairLapNumbers([5, 6, 7, 8, 9, 10, null, 12, 13, 14, 15, 16, 17, 18]), [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  assert.deepEqual(repairLapNumbers([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 12]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.equal(repairLapNumbers([null, null]), null);
  // 2번째 줄을 못 읽어 빠졌을 때: 위치(0,2,3,…)로 번호를 매긴다
  assert.deepEqual(repairLapNumbers([null, 3, 4, 5], [0, 2, 3, 4]), [1, 3, 4, 5]);
});

test('헤더(아이폰): `1 시간 25 분` 다음 줄 `775 m` 를 초로 읽지 않고, 깨진 `]` 도 1시간으로', () => {
  const a = parseHeader('10월 4일 (일) 오전 10:57 - 오후 12:23\n] 시간 25 분\n775 m   1M1');
  assert.equal(a.duration_sec, 5100);
  assert.equal(a.duration_has_sec, false);
  const b = parseHeader('10월 4일 (일) 오전 10:57 - 오후 12:23\n1 시간 25 분');
  assert.equal(b.duration_sec, 5100);
  assert.equal(parseHeader('10월 2일 (금) 오후 7:28 - 오후 7:50\n18분 51초').duration_has_sec, true);
});

test('시각: 콜론이 빠지거나(728) 7로 읽혀도(7728) 7:28, 10:57·12:23 은 그대로', async () => {
  const { looseClock } = await import('../src/capture/parse.js');
  assert.deepEqual(looseClock('7:28'), ['7', '28']);
  assert.deepEqual(looseClock('728'), ['7', '28']);
  assert.deepEqual(looseClock('7728'), ['7', '28']);
  assert.deepEqual(looseClock('1057'), ['10', '57']);
  assert.deepEqual(looseClock('12:23'), ['12', '23']);
  assert.equal(looseClock('7799'), null);
  const d = parseDaily('10월 2일 (금)\n3세션 3.49 km\n달리기    오후 7728\n00:18:51 2.03 km   Galaxy Fit2\n달리기 @   오후 7:18\n00:07:59 1.05 km');
  assert.deepEqual(d.rows.map((r) => r.start_time), ['19:28', '19:18']);
});
