// 브라우저용 OCR 엔진: Tesseract.js(무료, 휴대폰 안에서 실행). 이미지는 어디에도 보내지 않는다.
// 처음 한 번 인식 데이터(한글+영문 약 3MB)를 받고, 이후에는 브라우저 캐시를 쓴다.
import { toGray } from './image.js';

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

let workerPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (globalThis.Tesseract) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('글자 인식 도구를 불러오지 못했어요. 인터넷 연결을 확인해주세요.'));
    document.head.appendChild(s);
  });
}

async function getWorker(onStatus) {
  if (!workerPromise) {
    workerPromise = (async () => {
      onStatus?.('글자 인식 준비 중… (처음 한 번은 조금 걸려요)');
      // OCR_ASSETS: CDN에 접근할 수 없는 환경(로컬 테스트)에서 파일 위치를 바꿀 때만 쓴다
      const cfg = globalThis.OCR_ASSETS ?? {};
      await loadScript(cfg.script ?? TESSERACT_URL);
      return globalThis.Tesseract.createWorker(['kor', 'eng'], 1, cfg.workerOptions ?? {});
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

function grayToCanvas(g) {
  const c = document.createElement('canvas');
  c.width = g.width;
  c.height = g.height;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(g.width, g.height);
  for (let i = 0, j = 0; i < g.data.length; i++, j += 4) {
    img.data[j] = img.data[j + 1] = img.data[j + 2] = g.data[i];
    img.data[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export async function createBrowserEngine(onStatus) {
  const worker = await getWorker(onStatus);
  return {
    async ocr(g, { psm = 6, whitelist = '' } = {}) {
      await worker.setParameters({ tessedit_pageseg_mode: String(psm), tessedit_char_whitelist: whitelist });
      const { data } = await worker.recognize(grayToCanvas(g), {}, { text: true, blocks: true });
      const lines = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines)).map((l) => ({ text: l.text.trim(), bbox: l.bbox }));
      return { text: data.text, lines };
    },
  };
}

// 파일 → 회색조 픽셀
export async function fileToGray(file) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  bmp.close?.();
  return toGray(ctx.getImageData(0, 0, c.width, c.height));
}
