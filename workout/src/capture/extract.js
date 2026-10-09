// 캡처 1장 → 화면 종류와 값.
// engine.ocr(gray, { lang: 'kor'|'eng'|'kor+eng', psm, whitelist }) → { text, lines: [{ text, bbox:{x0,y0,x1,y1} }] }
// 1) 원래 크기로 한 번 읽어 화면 종류와 줄 위치를 찾고 2) 필요한 부분만 2배로 다시 읽는다.
import { crop, threshold, scale, pad, rowBands } from './image.js';
import { detectSport, parseDaily, parseHeader, parseDetail, parseStroke, repairLapNumbers, parseZones } from './parse.js';
import { readDigits } from './digits.js';
import { parseClock } from '../format.js';

const TH = 200; // 회색 글자를 살리는 임계값
const LAP_TH = 225; // 수영 구간의 연한 하늘색 글자용

const region = (gray, x0, y0, x1, y1, f = 2, th = TH) =>
  pad(threshold(scale(crop(gray, x0, y0, x1 - x0, y1 - y0), f), th), 16);

const DAILY_ROW = /\d{1,2}:\d{2}:\d{2}\s+[\d.,]+\s*(km|kcal)/;

const DETAIL_LABEL = /운동\s*시간|총\s*시간|거리|칼로리|스트로크|반복|수영장|SWOLF|속도|페이스|고도|오르막|내리막|심박|케이던스|종류/;

// 기기마다 캡처 해상도가 달라 기준 너비로 맞춘다 (숫자 템플릿과 잘라내는 위치가 이 크기 기준)
const BASE_WIDTH = 1206;

export async function extractImage(input, engine) {
  const gray = input.width === BASE_WIDTH ? input : scale(input, BASE_WIDTH / input.width);
  const H = gray.height;
  // psm 6(한 덩어리): 자동 배치(psm 3)는 구간 화면의 막대를 표로 보고 글자를 놓친다
  const page = await engine.ocr(pad(threshold(gray, TH), 16), { lang: 'kor+eng', psm: 6 });
  const lines = page.lines.map((l) => ({ ...l, y0: (l.bbox.y0 - 16) / H, y1: (l.bbox.y1 - 16) / H }));
  const title = lines.filter((l) => l.y1 < 0.13).map((l) => l.text).join(' ');
  const text = page.text;
  const sport = detectSport(title);
  const items = [];

  // 결과 헤더(`오후 7:28 - 오후 7:50`)는 지도 화면 위쪽에 있다. 다른 화면과 함께 있을 수 있어 따로 본다
  const head = lines.find((l) => l.y0 < 0.3 && /\d:\d{2}\s*[-~]\s*\S*\s*\d{1,2}:\d{2}/.test(l.text));
  if (head) {
    const r = await engine.ocr(region(gray, 0, head.y0 - 0.006, 1, head.y1 + 0.1), { lang: 'kor+eng', psm: 6 });
    // 2배로 읽은 글자가 깨졌으면 원래 크기 줄로 보충한다
    const h = parseHeader(`${r.text}\n${head.text}`);
    if (h && h.duration_sec == null) {
      // 헤더 아래 큰 글씨(`18분 51초`)만 따로 다시 읽는다
      const big = lines.find((l) => l.y0 > head.y1 && l.y0 < head.y1 + 0.08);
      if (big) {
        const b = await engine.ocr(region(gray, 0, big.y0 - 0.005, 1, big.y1 + 0.005), { lang: 'kor+eng', psm: 7 });
        h.duration_sec = parseHeader(`${head.text}\n${b.text}`)?.duration_sec ?? null;
      }
    }
    if (h) items.push({ kind: 'header', sport, ...h });
  }

  // 구간 화면: 제목 `구간`, 또는 영법 이름이 여러 줄 (제목이 안 읽혀도 알아보게)
  const strokeLines = (text.match(/크롤|배영|평영|혼영|접영/g) ?? []).length;
  if ((/구간/.test(title) || strokeLines >= 3) && !/운동\s*시간|세션/.test(text)) {
    items.push({ kind: 'laps', sport: 'swim', ...(await extractLaps(gray, engine, lines)) });
  } else if (!/운동\s*시간/.test(text) && (/세션/.test(text) || DAILY_ROW.test(text))) {
    // 전체보기: `N세션` 줄이 깨져도 `00:11:46 2.36 km` 같은 세션 줄로 알아본다. 날짜 줄부터 아래를 다시 읽는다
    // 날짜 줄: `10월 6일 (화)` 이 `10 6일 (화)` 로 깨져도 `(요일)` 로 찾는다
    const anchor = lines.find((l) => l.y0 > 0.3 && /\d\s*일\s*\(\s*[일월화수목금토]/.test(l.text)) ?? lines.find((l) => /세션/.test(l.text));
    const y0 = anchor ? Math.max(0, anchor.y0 - 0.01) : 0.45;
    const r = await engine.ocr(region(gray, 0, y0, 1, 0.92), { lang: 'kor+eng', psm: 6 });
    const d = parseDaily(r.text);
    items.push({ kind: 'daily', sport: sport ?? d.rows[0]?.sport ?? null, ...d });
  } else if (/운동\s*시간|운동\s*칼로리|평균\s*심박|총\s*스트로크/.test(text)) {
    items.push({ kind: 'detail', sport, ...(await extractDetail(gray, engine, sport)) });
  }

  // 운동 강도(최대·고강도·중강도) 줄은 그래프 화면에 있다. 다른 내용과 함께 있어도 따로 가져온다
  const zones = parseZones(text);
  if (zones && sport) items.push({ kind: 'zones', sport, ...zones });

  if (!items.length) items.push({ kind: 'ignored', sport });
  return items;
}

// 상세정보: 왼쪽 칸(평균·운동 시간 등)만 2배로 읽고, 라벨 바로 위 줄을 값으로 짝짓는다.
// 오른쪽 칸은 수영의 총 반복 횟수만 필요하다
async function extractDetail(gray, engine, sport) {
  const pairsFrom = (text) => {
    const ls = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const pairs = [];
    for (let i = 1; i < ls.length; i++) {
      if (DETAIL_LABEL.test(ls[i]) && !DETAIL_LABEL.test(ls[i - 1])) pairs.push({ label: ls[i], value: ls[i - 1] });
    }
    return pairs;
  };
  const left = await engine.ocr(region(gray, 0.19, 0.12, 0.57, 0.92), { lang: 'kor+eng', psm: 6 });
  const pairs = pairsFrom(left.text);
  if (sport === 'swim') {
    const right = await engine.ocr(region(gray, 0.61, 0.12, 1, 0.92), { lang: 'kor+eng', psm: 6 });
    pairs.push(...pairsFrom(right.text).filter((p) => /반복/.test(p.label)));
  }
  return parseDetail(pairs);
}

// 수영 구간: 시간 칸에서 글자 띠로 줄을 나누고, 줄마다 번호·값·영법을 따로 읽는다
async function extractLaps(gray, engine, pageLines = []) {
  const bin = threshold(gray, LAP_TH);
  const top = Math.round(0.12 * gray.height), bottom = Math.round(0.9 * gray.height);
  const body = crop(bin, 0, top, 1, bottom - top);
  const bands = rowBands(body, 0.17, 0.36).map(([a, b]) => [(a + top) / gray.height, (b + top) / gray.height]);
  const raw = [];
  for (const [y0, y1] of bands) {
    const m = 0.004;
    // 번호·값은 숫자 모양 템플릿으로, 영법은 OCR로 읽는다
    const no = readDigits(crop(bin, 0.03, y0 - m, 0.13, y1 - y0 + 2 * m)) ?? '';
    const v = readDigits(crop(bin, 0.17, y0 - m, 0.19, y1 - y0 + 2 * m)) ?? '';
    const st = await engine.ocr(region(gray, 0.40, y0 - m, 0.62, y1 + m, 1, TH), { lang: 'kor', psm: 7 });
    let stroke = parseStroke(st.text);
    if (!stroke && /^\d/.test(v)) {
      const again = await engine.ocr(region(gray, 0.40, y0 - m, 0.56, y1 + m, 2, 170), { lang: 'kor', psm: 7 });
      stroke = parseStroke(again.text)
        ?? parseStroke(pageLines.filter((l) => l.y0 < y1 + m && l.y1 > y0 - m).map((l) => l.text).join(' '));
    }
    let value = null, type = null;
    if (/^\d{2}:\d{2}$/.test(v)) { value = parseClock(v); type = 'time'; }
    else if (/^\d{1,2}$/.test(v)) { value = Number(v); type = 'strokes'; }
    else if (/^\d{3,}$/.test(v)) type = 'swolf'; // `44.0` 의 점은 잡티로 빠져 `440` 이 된다
    if (!stroke || !type) continue; // 상태바, `평균` 상자 등
    raw.push({ no: /^\d{1,2}$/.test(no) ? Number(no) : null, stroke, type, value, y: (y0 + y1) / 2 });
  }
  const types = raw.map((r) => r.type);
  const metric = ['time', 'strokes', 'swolf'].sort((a, b) => types.filter((t) => t === b).length - types.filter((t) => t === a).length)[0];
  const rows = raw.filter((r) => r.type === metric);
  // 줄 간격이 일정하므로 위치로 몇 번째 줄인지 정한다. 중간 줄을 못 읽어도 번호가 밀리지 않는다
  const idx = rowIndexes(rows.map((r) => r.y));
  const nums = repairLapNumbers(rows.map((r) => r.no), idx);
  return { metric, rows: rows.map((r, i) => ({ lap_no: nums ? nums[i] : idx[i] + 1, stroke: r.stroke, value: r.value })) };
}

function rowIndexes(ys) {
  if (ys.length < 2) return ys.map(() => 0);
  const gaps = ys.slice(1).map((y, i) => y - ys[i]).sort((a, b) => a - b);
  const pitch = gaps[0]; // 가장 좁은 간격 = 한 줄
  return ys.map((y) => Math.round((y - ys[0]) / pitch));
}
