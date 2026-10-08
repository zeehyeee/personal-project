// 회색조 이미지 연산 (브라우저·Node 공용, 의존성 없음)
// gray: { data: Uint8Array(width*height), width, height }

export function toGray({ data, width, height }) {
  const out = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) {
    out[i] = (data[j] * 299 + data[j + 1] * 587 + data[j + 2] * 114) / 1000;
  }
  return { data: out, width, height };
}

// 비율(0~1) 또는 픽셀로 자른다
export function crop(g, x, y, w, h) {
  const px = (v, size) => Math.round(v <= 1 ? v * size : v);
  const x0 = Math.max(0, px(x, g.width)), y0 = Math.max(0, px(y, g.height));
  const cw = Math.min(g.width - x0, px(w, g.width)), ch = Math.min(g.height - y0, px(h, g.height));
  const out = new Uint8Array(cw * ch);
  for (let r = 0; r < ch; r++) out.set(g.data.subarray((y0 + r) * g.width + x0, (y0 + r) * g.width + x0 + cw), r * cw);
  return { data: out, width: cw, height: ch };
}

// 임계값보다 밝으면 흰색, 아니면 검정. 연한 하늘색·회색 글자를 진하게 만든다
export function threshold(g, t) {
  const out = new Uint8Array(g.data.length);
  for (let i = 0; i < out.length; i++) out[i] = g.data[i] > t ? 255 : 0;
  return { data: out, width: g.width, height: g.height };
}

// 양선형 확대 (작은 글자 인식률을 올린다)
export function scale(g, f) {
  const w = Math.round(g.width * f), h = Math.round(g.height * f);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(g.height - 1, y / f), y0 = Math.floor(sy), y1 = Math.min(g.height - 1, y0 + 1), fy = sy - y0;
    for (let x = 0; x < w; x++) {
      const sx = Math.min(g.width - 1, x / f), x0 = Math.floor(sx), x1 = Math.min(g.width - 1, x0 + 1), fx = sx - x0;
      const a = g.data[y0 * g.width + x0], b = g.data[y0 * g.width + x1];
      const c = g.data[y1 * g.width + x0], d = g.data[y1 * g.width + x1];
      out[y * w + x] = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
    }
  }
  return { data: out, width: w, height: h };
}

export function pad(g, p, value = 255) {
  const w = g.width + p * 2, h = g.height + p * 2;
  const out = new Uint8Array(w * h).fill(value);
  for (let r = 0; r < g.height; r++) out.set(g.data.subarray(r * g.width, (r + 1) * g.width), (r + p) * w + p);
  return { data: out, width: w, height: h };
}

// 이진 이미지에서 x0~x1 사이에 검은 픽셀이 있는 가로 띠(= 글자 줄)를 찾는다
export function rowBands(bin, x0, x1, { minHeight = 0.008, minDark = 3 } = {}) {
  const a = Math.round(x0 * bin.width), b = Math.round(x1 * bin.width);
  const bands = [];
  let start = -1;
  for (let y = 0; y <= bin.height; y++) {
    let n = 0;
    if (y < bin.height) for (let x = a; x < b; x++) if (bin.data[y * bin.width + x] === 0) n++;
    if (n >= minDark && start < 0) start = y;
    if (n < minDark && start >= 0) {
      if (y - start >= minHeight * bin.height) bands.push([start, y]);
      start = -1;
    }
  }
  return bands;
}

// 이진 이미지에서 글자 하나하나의 상자를 찾는다 (세로로 빈 열을 경계로 자른다)
export function glyphBoxes(bin) {
  const { width: w, height: h, data } = bin;
  const ink = (x) => { for (let y = 0; y < h; y++) if (data[y * w + x] === 0) return true; return false; };
  const boxes = [];
  let start = -1;
  for (let x = 0; x <= w; x++) {
    const on = x < w && ink(x);
    if (on && start < 0) start = x;
    if (!on && start >= 0) {
      let y0 = h, y1 = -1;
      for (let y = 0; y < h; y++) for (let xx = start; xx < x; xx++) if (data[y * w + xx] === 0) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      boxes.push({ x0: start, x1: x, y0, y1: y1 + 1 });
      start = -1;
    }
  }
  return boxes;
}

// 글자 상자를 고정 크기(GW×GH) 비트열로 줄인다 (크기가 달라도 같은 모양이면 같은 비트열)
export const GW = 12, GH = 18;
export function glyphBits(bin, box) {
  const bw = box.x1 - box.x0, bh = box.y1 - box.y0;
  let bits = '';
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      const sx = box.x0 + Math.min(bw - 1, Math.floor(((x + 0.5) * bw) / GW));
      const sy = box.y0 + Math.min(bh - 1, Math.floor(((y + 0.5) * bh) / GH));
      bits += bin.data[sy * bin.width + sx] === 0 ? '1' : '0';
    }
  }
  return bits;
}
