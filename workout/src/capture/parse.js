// OCR 글자 → 값 (순수 함수). 삼성헬스 한국어 화면 기준
import { parseClock } from '../format.js';


export function detectSport(text) {
  if (/자전거/.test(text)) return 'bike';
  if (/달리기/.test(text)) return 'run';
  if (/걷기/.test(text)) return 'walk';
  if (/수영/.test(text)) return 'swim';
  return null;
}

// `10월 6일 (화)`. OCR이 `월`을 `2`로 읽는 경우가 있어 함께 받는다
const DATE_RE = /(\d{1,2})\s*[월2]\s*(\d{1,2})\s*일\s*\(\s*([일월화수목금토])\s*\)/;
export function parseKoDate(text) {
  const m = text.match(DATE_RE);
  if (!m) return null;
  const month = Number(m[1]), day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day, weekday: m[3] };
}

export function to24h(ampm, h, mm) {
  let hour = Number(h) % 12;
  if (ampm === '오후') hour += 12;
  return `${String(hour).padStart(2, '0')}:${mm}`;
}

// `7:28` 이 OCR 에서 `728`(콜론 빠짐)이나 `7728`(콜론을 7로) 로 깨져도 시·분을 되살린다
const CLOCK = '([\\d:;.]{3,5})';
export function looseClock(token) {
  const parts = token.split(/[:;.]/).filter(Boolean);
  let h, m;
  if (parts.length === 2) [h, m] = parts;
  else {
    const d = token.replace(/\D/g, '');
    if (d.length === 3) [h, m] = [d.slice(0, 1), d.slice(1)];
    else if (d.length === 4) [h, m] = Number(d.slice(0, 2)) <= 12 ? [d.slice(0, 2), d.slice(2)] : [d.slice(0, 1), d.slice(2)];
    else return null;
  }
  if (!/^\d{1,2}$/.test(h) || !/^\d{2}$/.test(m) || Number(h) > 12 || Number(m) > 59) return null;
  return [h, m];
}
const ampmTime = (ampm, token) => {
  const c = looseClock(token);
  return c ? to24h(ampm, c[0], c[1]) : null;
};

// 전체보기(일별) 화면: `달리기  오후 7:28` 다음 줄 `00:18:51 2.03 km`
export function parseDaily(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].match(new RegExp(`(오전|오후)\\s*${CLOCK}`));
    const start_time = t && ampmTime(t[1], t[2]);
    if (!start_time) continue;
    const v = (lines[i + 1] ?? '').match(/(\d{1,2}:\d{2}:\d{2})\s+([\d.,]+)\s*(km|kcal|m)\b/);
    if (!v) continue;
    const amount = Number(v[2].replace(/,/g, ''));
    rows.push({
      sport: detectSport(lines[i]),
      start_time,
      duration_sec: parseClock(v[1]),
      ...(v[3] === 'kcal' ? { kcal: amount } : { distance_m: v[3] === 'km' ? Math.round(amount * 1000) : amount }),
    });
  }
  // `3세션`: 화면에 다 안 보인 세션이 있는지 확인용
  const n = text.match(/(\d+)\s*세션/);
  return { date: parseKoDate(text), sessionCount: n ? Number(n[1]) : null, rows };
}

// 결과 헤더: `10월 2일 (금) 오후 7:28 - 오후 7:50` 와 큰 글씨 `18분 51초`
export function parseHeader(text) {
  // OCR이 콜론을 빠뜨리는 경우(`오후 728`)도 받는다
  // 앞의 `오후` 가 `2%` `=` 처럼 깨지는 경우가 있어 앞쪽은 아무 글자 3개까지 받고, 뒤쪽 오전/오후로 추정한다
  const m = text.match(new RegExp(`(오전|오후|[^\\s\\d]{1,3}|\\d%)?\\s*${CLOCK}\\s*[-~]\\s*(오전|오후)\\s*${CLOCK}`));
  if (!m) return null;
  const end = ampmTime(m[3], m[4]);
  let start = /^(오전|오후)$/.test(m[1] ?? '') ? ampmTime(m[1], m[2]) : null;
  if (!start && end) {
    // 끝과 같은 오전/오후로 보고, 그러면 시작이 끝보다 늦어지면 반대로 (오전 11:50 - 오후 12:30)
    start = ampmTime(m[3], m[2]);
    if (start && start > end) start = ampmTime(m[3] === '오후' ? '오전' : '오후', m[2]);
  }
  if (!start) return null;
  // `18분 51초`, 아이폰 `1 시간 25 분` (초 없음). 초는 같은 줄의 숫자만 (다음 줄 `775 m` 를 초로 읽지 않게)
  // 큰 글씨 `1` 이 `]` `|` `l` `I` 로 깨지는 경우도 받는다
  const fixed = text.replace(/[\]|lI](?=[ \t]*시간)/g, '1');
  const d = fixed.match(/(?:(\d+)[ \t]*시간[ \t]*)?(\d+)[ \t]*분(?:[ \t]*(\d{1,2})(?!\d))?/);
  const duration_sec = d ? Number(d[1] ?? 0) * 3600 + Number(d[2]) * 60 + Number(d[3] ?? 0) : null;
  return { date: parseKoDate(text), start_time: start, end_time: end, duration_sec, duration_has_sec: Boolean(d?.[3]) };
}

// `2.03 km` → 2030, `450 m` → 450
export function parseDistance(text) {
  const m = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(km|m)\b/);
  if (!m) return null;
  return m[2] === 'km' ? Math.round(Number(m[1]) * 1000) : Number(m[1]);
}

const firstInt = (text) => {
  const m = text.replace(/,/g, '').match(/\d+/);
  return m ? Number(m[0]) : null;
};

// 상세정보: 라벨 → 저장할 필드. 저장하지 않는 지표(최고값, 고도, 속도, 페이스 등)는 일부러 뺐다
const DETAIL_FIELDS = [
  { re: /운동\s*시간/, key: 'duration_sec', parse: (t) => { const m = t.match(/\d{1,2}:\d{2}:\d{2}/); return m ? parseClock(m[0]) : null; } },
  { re: /^거리$|거리/, key: 'distance_m', parse: parseDistance },
  { re: /운동\s*칼로리/, key: 'kcal', parse: firstInt },
  { re: /총\s*스트로크/, key: 'swim_total_strokes', parse: firstInt },
  { re: /총\s*반복/, key: 'swim_laps', parse: firstInt },
  { re: /수영장\s*길이/, key: 'pool_length_m', parse: firstInt },
  { re: /평균\s*심박/, key: 'avg_hr', parse: firstInt },
  { re: /평균\s*케이던스/, key: 'avg_cadence', parse: firstInt },
];

// pairs: [{ label, value }] (같은 칸의 라벨과 바로 위 값)
export function parseDetail(pairs) {
  const out = {};
  for (const { label, value } of pairs) {
    const f = DETAIL_FIELDS.find((d) => d.re.test(label.replace(/\s+/g, ' ')));
    if (!f || out[f.key] != null) continue;
    const v = f.parse(value);
    if (v != null && Number.isFinite(v)) out[f.key] = v;
  }
  return out;
}

// 운동 강도(심박 구간) 화면: `최대 6분`, `고강도 12 분`, `중강도 1 분`
export const ZONES = [['최대', 'zone_max_min'], ['고강도', 'zone_high_min'], ['중강도', 'zone_mid_min'], ['저강도', 'zone_low_min']];
export function parseZones(text) {
  const out = {};
  for (const [label, key] of ZONES) {
    const m = text.match(new RegExp(`(?:^|\\n)\\s*${label}\\s+(\\d+)\\s*분`));
    if (m) out[key] = Number(m[1]);
  }
  return Object.keys(out).length ? out : null;
}

export function parseStroke(text) {
  if (/크|롤|자유|유형/.test(text)) return 'freestyle';
  if (/배/.test(text)) return 'backstroke';
  if (/평/.test(text)) return 'breaststroke';
  if (/혼/.test(text)) return 'medley';
  if (/접/.test(text)) return 'butterfly';
  return null;
}

// 구간 번호 보정: 화면 안 구간은 1씩 이어진다. 가장 많이 맞는 시작 번호를 골라 다시 매긴다
// idx: 각 줄이 화면에서 몇 번째 줄인지 (기본은 0,1,2…)
export function repairLapNumbers(nums, idx = nums.map((_, i) => i)) {
  const count = new Map();
  nums.forEach((n, i) => {
    if (n == null) return;
    count.set(n - idx[i], (count.get(n - idx[i]) ?? 0) + 1);
  });
  if (!count.size) return null;
  const start = [...count].sort((a, b) => b[1] - a[1])[0][0];
  return idx.map((k) => start + k);
}
