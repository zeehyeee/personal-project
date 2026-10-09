// index.html 의 modulepreload 목록이 app.js 에서 불러오는 모듈과 같은지 (빠지면 첫 로딩이 느려진다)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export function moduleGraph(entry = 'src/app.js') {
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(join(root, file), 'utf8');
    for (const m of src.matchAll(/^\s*import\s[^'"]*['"](\.[^'"]+)['"]/gm)) walk(relative(root, join(root, dirname(file), m[1])));
  };
  walk(entry);
  return [...seen].sort();
}

test('modulepreload 목록 = app.js 가 불러오는 모듈 전부', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const listed = [...html.matchAll(/rel="modulepreload" href="([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(listed, moduleGraph().filter((f) => f !== 'src/app.js'));
});
