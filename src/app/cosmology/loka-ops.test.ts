// Run with:  npm run test:logic
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LokaInput, addBeside, addInside, addMiddle, childrenOf, collectSubtreeIds, createFreshFile, ensureSingleRoot,
  normalizeColor, parseFile, readableText, removeLoka, rootOf, serialize, updateLoka, validateFile,
} from './loka-ops';

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log('  ok  ' + name);
}
const inp = (name: string, description = '', color = '#aabbcc'): LokaInput => ({ name, description, color });
const ids = (f: { lokas: { id: number }[] }) => f.lokas.map((l) => l.id).sort((a, b) => a - b);
const names = (l: { name: string }[]) => l.map((x) => x.name);

test('the shipped lokas.json has ONE root and keeps the original page structure', () => {
  const file = parseFile(readFileSync('public/data/lokas.json', 'utf8'));
  assert.equal(file.lokas.length, 94);
  assert.equal(file.lastId, 94);
  assert.deepEqual(names(childrenOf(file, null)), ['Vedic Cosmos']);
  const root = rootOf(file);
  assert.equal(root.id, 1);
  assert.deepEqual(names(childrenOf(file, root.id)), ['Brahmajyoti', 'Maya-loka']);
  const goloka = file.lokas.find((l) => l.name === 'Goloka')!;
  assert.deepEqual(names(childrenOf(file, goloka.id)), ['Vraj-Bhumi', 'Golden-City Dwarka', 'Nava-Dwipa', 'Aksharadham']);
  assert.deepEqual(parseFile(serialize(file)), file);
  assert.equal(serialize(file), readFileSync('public/data/lokas.json', 'utf8'));
});

test('a fresh file is just the root loka', () => {
  const f = createFreshFile();
  assert.equal(f.lokas.length, 1);
  assert.equal(f.lokas[0].parentId, null);
});

test('add inside: new id is lastId + 1, appended as the last child', () => {
  let t = createFreshFile();                                   // 1 = root
  const a = addInside(t, 1, inp('A')); t = a.file;             // 2
  const b = addInside(t, 1, inp('B')); t = b.file;             // 3
  assert.equal(a.id, 2); assert.equal(b.id, 3); assert.equal(t.lastId, 3);
  assert.deepEqual(names(childrenOf(t, 1)), ['A', 'B']);
  assert.deepEqual(names(childrenOf(t, null)), ['Vedic Cosmos']); // still one root
});

test('add beside: same parent, placed right after the sibling; the root has no siblings', () => {
  let t = createFreshFile();
  t = addInside(t, 1, inp('A')).file;                          // 2
  t = addInside(t, 1, inp('B')).file;                          // 3
  t = addInside(t, 2, inp('A-inner')).file;                    // 4
  const r = addBeside(t, 2, inp('A2'));                        // 5
  assert.equal(r.file.lokas.find((l) => l.id === 5)!.parentId, 1);
  assert.deepEqual(names(childrenOf(r.file, 1)), ['A', 'A2', 'B']);
  assert.throws(() => addBeside(t, 1, inp('X')), /root loka has no siblings/);
});

test('add in the middle: e in b -> add a in b -> e is inside a', () => {
  let t = createFreshFile();
  t = addInside(t, 1, inp('b')).file;                          // 2
  t = addInside(t, 2, inp('e')).file;                          // 3
  t = addInside(t, 3, inp('e-child')).file;                    // 4
  const r = addMiddle(t, 2, inp('a'));                         // 5
  t = r.file;
  assert.equal(r.id, 5);
  assert.deepEqual(names(childrenOf(t, 2)), ['a']);            // b now holds only a
  assert.deepEqual(names(childrenOf(t, 5)), ['e']);            // e moved inside a
  assert.equal(t.lokas.find((l) => l.id === 4)!.parentId, 3);  // e's own child stays inside e
  assert.equal(t.lokas.find((l) => l.id === 2)!.parentId, 1);  // b itself did not move
});

test('add in the middle moves ALL direct children in order, also when used on the root', () => {
  let t = createFreshFile();
  t = addInside(t, 1, inp('x')).file;                          // 2
  t = addInside(t, 1, inp('y')).file;                          // 3
  t = addMiddle(t, 1, inp('mid')).file;                        // 4
  assert.deepEqual(names(childrenOf(t, 1)), ['mid']);
  assert.deepEqual(names(childrenOf(t, 4)), ['x', 'y']);
  assert.equal(rootOf(t).id, 1);
});

test('add in the middle of a loka with nothing inside behaves like add inside', () => {
  const t = addInside(createFreshFile(), 1, inp('leaf')).file;
  const r = addMiddle(t, 2, inp('new'));
  assert.deepEqual(names(childrenOf(r.file, 2)), ['new']);
});

test('update by id changes name, description and colour; the root can be edited too', () => {
  const t = createFreshFile();
  const u = updateLoka(t, 1, { name: '  Brahmanda ', description: ' all of it\r\nhere ', color: '#ABC' }).file;
  assert.deepEqual(u.lokas[0], { id: 1, name: 'Brahmanda', description: 'all of it\nhere', color: '#aabbcc', parentId: null });
  assert.equal(t.lokas[0].name, 'Vedic Cosmos');
});

test('delete removes the loka and everything inside it, at every depth', () => {
  let t = createFreshFile();
  t = addInside(t, 1, inp('A')).file;                          // 2
  t = addInside(t, 1, inp('B')).file;                          // 3
  t = addInside(t, 2, inp('A1')).file;                         // 4
  t = addInside(t, 4, inp('A1a')).file;                        // 5
  const r = removeLoka(t, 2);
  assert.deepEqual(r.removedIds.sort((a, b) => a - b), [2, 4, 5]);
  assert.deepEqual(ids(r.file), [1, 3]);
});

test('the root loka cannot be deleted', () => {
  assert.throws(() => removeLoka(createFreshFile(), 1), /root loka cannot be deleted/);
  const t = addInside(createFreshFile(), 1, inp('A')).file;
  assert.throws(() => removeLoka(t, 1), /root loka cannot be deleted/);
});

test('ids are never reused after a delete', () => {
  let t = addInside(createFreshFile(), 1, inp('A')).file;      // 2
  t = removeLoka(t, 2).file;
  assert.equal(addInside(t, 1, inp('B')).id, 3);
});

test('validation of input and ids', () => {
  const t = createFreshFile();
  assert.throws(() => addInside(t, 1, inp('  ')), /empty/);
  assert.throws(() => addInside(t, 1, inp('x', '', 'red')), /Color/);
  assert.throws(() => addInside(t, 99, inp('x')), /does not exist/);
  assert.throws(() => addMiddle(t, 99, inp('x')), /does not exist/);
  assert.throws(() => updateLoka(t, 99, inp('x')), /does not exist/);
  assert.throws(() => removeLoka(t, 99), /does not exist/);
  assert.throws(() => addInside(t, 1, inp('x', 'a'.repeat(501))), /Description/);
  assert.equal(normalizeColor('#FA0'), '#ffaa00');
});

test('old files with several top-level lokas (or none) are wrapped in / given a root', () => {
  const a = { id: 1, name: 'A', description: '', color: '#fff', parentId: null };
  const b = { id: 2, name: 'B', description: 'x', color: '#000', parentId: null };
  const kid = { id: 3, name: 'kid', description: '', color: '#123', parentId: 1 };
  const f = validateFile({ lastId: 3, lokas: [a, b, kid] });
  assert.equal(f.lokas.length, 4);
  assert.equal(f.lastId, 4);
  assert.deepEqual(names(childrenOf(f, null)), ['Vedic Cosmos']);
  assert.deepEqual(names(childrenOf(f, 4)), ['A', 'B']);
  assert.equal(f.lokas.find((l) => l.id === 3)!.parentId, 1); // nested loka untouched
  assert.deepEqual(validateFile({ lokas: [] }), createFreshFile());
  assert.equal(ensureSingleRoot(f), f); // already fine -> unchanged
});

test('validateFile rejects broken files and repairs lastId', () => {
  assert.throws(() => parseFile('nope'), /not valid JSON/);
  assert.throws(() => validateFile({}), /array/);
  const a = { id: 1, name: 'A', description: '', color: '#fff', parentId: null };
  assert.throws(() => validateFile({ lokas: [a, { ...a }] }), /duplicate/);
  assert.throws(() => validateFile({ lokas: [{ ...a, parentId: 9 }] }), /missing parent/);
  assert.throws(() => validateFile({ lokas: [{ ...a, color: 'blue' }] }), /color/);
  assert.throws(() => validateFile({ lokas: [{ ...a, id: 1, parentId: 2 }, { ...a, id: 2, parentId: 1 }] }), /cycle/);
  assert.equal(validateFile({ lastId: 1, lokas: [a, { ...a, id: 7, parentId: 1 }] }).lastId, 7);
  assert.equal(validateFile({ lokas: [{ id: 1, name: 'A' }] }).lokas[0].color, '#e8e8e8');
});

test('collectSubtreeIds counts the node itself', () => {
  const t = addInside(createFreshFile(), 1, inp('A')).file;
  assert.deepEqual(collectSubtreeIds(t, 1).sort(), [1, 2]);
  assert.deepEqual(collectSubtreeIds(t, 2), [2]);
});

test('readableText always gives good contrast, for every colour in the real data', () => {
  const file = parseFile(readFileSync('public/data/lokas.json', 'utf8'));
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const f = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  };
  let worst = 99;
  for (const l of file.lokas) {
    const a = lum(l.color), b = lum(readableText(l.color));
    worst = Math.min(worst, (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
  }
  assert.ok(worst >= 3, `worst contrast ${worst.toFixed(2)}`);
});

console.log(`\n${passed} tests passed`);
