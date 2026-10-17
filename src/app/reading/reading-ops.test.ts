// Run with:  npm run test:logic
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  PdfEntry, formatSize, normalize, pageWindow, paginate, parseManifest, search, titleFromFileName, toItems,
} from './reading-ops';

let passed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed++;
  console.log('  ok  ' + name);
}
const entry = (file: string): PdfEntry => ({ file, size: 1000, modified: '2026-10-01T00:00:00.000Z' });
const many = (n: number) => toItems(Array.from({ length: n }, (_, i) => entry(`Book_${String(i + 1).padStart(2, '0')}.pdf`)));

async function main() {
// the scanner is a plain ES module script; load it dynamically
const { scan } = (await import('../../../scripts/scan-pdfs.mjs')) as { scan: (dir: string) => Promise<PdfEntry[]> };

await test('titles come from the file name', () => {
  assert.equal(titleFromFileName('Bhagavad_Gita__Chapter-1.PDF'), 'Bhagavad Gita Chapter-1');
  assert.equal(titleFromFileName('  Srimad Bhagavatam.pdf'), 'Srimad Bhagavatam');
  assert.equal(titleFromFileName('.pdf'), '.pdf');
});

await test('search ignores case, accents and - _ separators; every word must match', () => {
  const items = toItems(['Śrīmad-Bhāgavatam_Canto_1.pdf', 'Bhagavad_Gita.pdf', 'Upanishads.pdf', 'Canto_10.pdf'].map(entry));
  assert.deepEqual(search(items, 'bhagavatam').map((i) => i.file), ['Śrīmad-Bhāgavatam_Canto_1.pdf']);
  assert.deepEqual(search(items, 'SRIMAD bhagavatam canto').map((i) => i.file), ['Śrīmad-Bhāgavatam_Canto_1.pdf']);
  assert.deepEqual(search(items, 'gita').map((i) => i.file), ['Bhagavad_Gita.pdf']);
  assert.deepEqual(search(items, 'canto 1').length, 2); // "canto" + "1" matches Canto_1 and Canto_10
  assert.deepEqual(search(items, 'zzz'), []);
  assert.equal(search(items, '   ').length, 4);
  assert.equal(normalize('A-b_C.d'), 'a b c d');
});

await test('items are sorted naturally by title and get a safe url', () => {
  const items = toItems(['Part 10.pdf', 'Part 2.pdf', 'Part 1.pdf', 'Gita & Vedas (new).pdf'].map(entry));
  assert.deepEqual(items.map((i) => i.title), ['Gita & Vedas (new)', 'Part 1', 'Part 2', 'Part 10']);
  assert.equal(items[0].url, 'data/reading-material/Gita%20%26%20Vedas%20(new).pdf');
});

await test('pagination: 27 items -> 3 pages of 10, 10, 7', () => {
  const items = many(27);
  const p1 = paginate(items, 1), p2 = paginate(items, 2), p3 = paginate(items, 3);
  assert.deepEqual([p1.items.length, p2.items.length, p3.items.length], [10, 10, 7]);
  assert.equal(p1.pageCount, 3);
  assert.deepEqual([p3.from, p3.to, p3.total], [21, 27, 27]);
  assert.equal(p2.items[0].title, 'Book 11');
});

await test('pagination edge cases: empty, exactly 10, out-of-range pages', () => {
  const empty = paginate([], 1);
  assert.deepEqual([empty.items.length, empty.page, empty.pageCount, empty.from, empty.to], [0, 1, 1, 0, 0]);
  assert.equal(paginate(many(10), 1).pageCount, 1);
  assert.equal(paginate(many(11), 1).pageCount, 2);
  assert.equal(paginate(many(27), 99).page, 3);
  assert.equal(paginate(many(27), -4).page, 1);
  assert.equal(paginate(many(27), NaN).page, 1);
});

await test('page buttons collapse long ranges with …', () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(2, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(pageWindow(1, 12), [1, 2, 3, 4, '…', 12]);
  assert.deepEqual(pageWindow(6, 12), [1, '…', 5, 6, 7, '…', 12]);
  assert.deepEqual(pageWindow(12, 12), [1, '…', 9, 10, 11, 12]);
  assert.deepEqual(pageWindow(4, 12), [1, 2, 3, 4, 5, '…', 12]);
});

await test('sizes are readable', () => {
  assert.equal(formatSize(0), '');
  assert.equal(formatSize(512), '512 B');
  assert.equal(formatSize(2048), '2 KB');
  assert.equal(formatSize(1033 * 1024), '1.0 MB'); // not "1033 KB"
  assert.equal(formatSize(1.5 * 1024 * 1024), '1.5 MB');
  assert.equal(formatSize(25 * 1024 * 1024), '25 MB');
});

await test('manifest parsing: valid, tolerant of junk, clear errors', () => {
  const ok = parseManifest(JSON.stringify({ files: [entry('a.pdf'), { file: 'b.txt' }, { nope: 1 }, { file: 'c.PDF' }] }));
  assert.deepEqual(ok.map((f) => f.file), ['a.pdf', 'c.PDF']);
  assert.deepEqual(parseManifest('{"files": []}'), []);
  assert.throws(() => parseManifest('nope'), /not valid JSON/);
  assert.throws(() => parseManifest('{}'), /no "files" list/);
});

await test('the folder scanner lists only .pdf files, writes index.json, and is stable', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'reading-'));
  try {
    await writeFile(path.join(dir, 'b second.pdf'), 'x'.repeat(2000));
    await writeFile(path.join(dir, 'A_first.PDF'), 'x');
    await writeFile(path.join(dir, 'notes.txt'), 'x');
    await mkdir(path.join(dir, 'sub.pdf')); // a folder named like a pdf must be ignored
    const files = await scan(dir);
    assert.deepEqual(files.map((f) => f.file), ['A_first.PDF', 'b second.pdf']);
    const written = parseManifest(await readFile(path.join(dir, 'index.json'), 'utf8'));
    assert.deepEqual(written.map((f) => f.file), ['A_first.PDF', 'b second.pdf']);
    assert.equal(written[1].size, 2000);
    const before = await readFile(path.join(dir, 'index.json'), 'utf8');
    await scan(dir); // second run: nothing changed
    assert.equal(await readFile(path.join(dir, 'index.json'), 'utf8'), before);
    await writeFile(path.join(dir, 'c.pdf'), 'x'); // new file shows up
    assert.equal((await scan(dir)).length, 3);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

console.log(`\n${passed} tests passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
