// Run with:  npm run test:logic
import assert from 'node:assert/strict';
import {
  NodeInput, addChild, addConsort, attachedTo, childrenOf, consortsOf, createFreshTree, insertBetween,
  parseFile, removeNode, serialize, updateNode, validateFile,
} from './tree-ops';

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log('  ok  ' + name);
}
const ids = (f: { nodes: { id: number }[] }) => f.nodes.map((n) => n.id).sort((a, b) => a - b);
const m = (name: string, description?: string): NodeInput => ({ name, gender: 'male', description });
const f = (name: string, description?: string): NodeInput => ({ name, gender: 'female', description });

test('starts fresh with exactly one node, id 1, parentId null', () => {
  assert.deepEqual(createFreshTree(), {
    lastId: 1,
    nodes: [{ id: 1, name: 'Root', gender: 'male', parentId: null, type: 'root' }],
  });
});

test('new ids are lastId + 1; consort and child point at the node they hang from', () => {
  let t = createFreshTree();
  const c = addChild(t, 1, m('A', ' first son ')); t = c.file;
  const w = addConsort(t, 1, f('Wife')); t = w.file;
  assert.equal(c.id, 2);
  assert.equal(w.id, 3);
  assert.equal(t.lastId, 3);
  assert.deepEqual(t.nodes[1], { id: 2, name: 'A', gender: 'male', description: 'first son', parentId: 1, type: 'child' });
  assert.deepEqual(t.nodes[2], { id: 3, name: 'Wife', gender: 'female', parentId: 1, type: 'consort' }); // no empty description key
});

test('a node can have several consorts, each with their own children', () => {
  let t = createFreshTree();
  t = addConsort(t, 1, f('W1')).file; // 2
  t = addConsort(t, 1, f('W2')).file; // 3
  t = addChild(t, 2, m('Son of W1')).file; // 4 -> parent 2
  t = addChild(t, 3, f('Daughter of W2')).file; // 5 -> parent 3
  assert.deepEqual(consortsOf(t, 1).map((n) => n.id), [2, 3]);
  assert.equal(t.nodes.find((n) => n.id === 4)!.parentId, 2);
  assert.equal(t.nodes.find((n) => n.id === 5)!.parentId, 3);
  assert.deepEqual(childrenOf(t, 1), []);
});

test('a node with consorts can still have a child directly (not from any consort)', () => {
  let t = addConsort(createFreshTree(), 1, f('W')).file; // 2
  t = addChild(t, 1, m('Direct child')).file; // 3
  assert.equal(t.nodes[2].parentId, 1);
  assert.deepEqual(attachedTo(t, 1).map((n) => n.id), [2, 3]); // consorts listed first
});

test('a consort can have children; a consort cannot have a consort', () => {
  let t = addConsort(createFreshTree(), 1, f('W')).file;
  assert.doesNotThrow(() => addChild(t, 2, m('kid')));
  assert.throws(() => addConsort(t, 2, m('x')), /consort cannot have a consort/);
});

test('insert in the middle: new node takes the node\'s children, consorts stay, consort kids untouched', () => {
  let t = createFreshTree();
  t = addChild(t, 1, m('A')).file;       // 2
  t = addChild(t, 1, f('B')).file;       // 3
  t = addConsort(t, 1, f('Wife')).file;  // 4
  t = addChild(t, 4, m('Wife kid')).file; // 5 (child of consort: not moved)
  t = addChild(t, 2, m('A-kid')).file;   // 6 (grandchild: not moved)
  const r = insertBetween(t, 1, m('Middle')); // 7
  t = r.file;
  assert.equal(r.id, 7);
  assert.deepEqual(childrenOf(t, 1).map((n) => n.id), [7]);
  assert.deepEqual(childrenOf(t, 7).map((n) => n.id), [2, 3]);
  assert.deepEqual(consortsOf(t, 1).map((n) => n.id), [4]);
  assert.equal(t.nodes.find((n) => n.id === 5)!.parentId, 4);
  assert.equal(t.nodes.find((n) => n.id === 6)!.parentId, 2);
});

test('insert in the middle below a consort moves that consort\'s children', () => {
  let t = addConsort(createFreshTree(), 1, f('W')).file; // 2
  t = addChild(t, 2, m('k1')).file; // 3
  t = insertBetween(t, 2, m('mid')).file; // 4
  assert.equal(t.nodes.find((n) => n.id === 3)!.parentId, 4);
  assert.equal(t.nodes.find((n) => n.id === 4)!.parentId, 2);
});

test('delete removes the node and all consorts, children and grandchildren below it', () => {
  let t = createFreshTree();
  t = addChild(t, 1, m('A')).file;       // 2
  t = addChild(t, 1, m('B')).file;       // 3
  t = addConsort(t, 2, f('A-wife')).file; // 4
  t = addChild(t, 4, m('A1')).file;      // 5 (child of consort)
  t = addConsort(t, 5, f('A1-wife')).file; // 6
  t = addChild(t, 5, m('A1a')).file;     // 7
  const r = removeNode(t, 2);
  assert.deepEqual(r.removedIds.sort((a, b) => a - b), [2, 4, 5, 6, 7]);
  assert.deepEqual(ids(r.file), [1, 3]);
});

test('deleting a consort deletes that consort and its children, nothing else', () => {
  let t = addConsort(createFreshTree(), 1, f('W')).file; // 2
  t = addChild(t, 2, m('kid')).file;     // 3
  t = addChild(t, 1, m('direct')).file;  // 4
  assert.deepEqual(ids(removeNode(t, 2).file), [1, 4]);
});

test('root cannot be deleted; unknown ids throw', () => {
  assert.throws(() => removeNode(createFreshTree(), 1), /root/);
  assert.throws(() => addChild(createFreshTree(), 99, m('x')), /does not exist/);
});

test('ids are never reused after a delete', () => {
  let t = addChild(createFreshTree(), 1, m('A')).file; // 2
  t = removeNode(t, 2).file;
  assert.equal(addChild(t, 1, m('B')).id, 3);
});

test('update by id: name, gender, description (set and clear); input not mutated', () => {
  const t = createFreshTree();
  const u = updateNode(t, 1, { name: '  Ancestor ', gender: 'female', description: ' founder ' }).file;
  assert.deepEqual(u.nodes[0], { id: 1, name: 'Ancestor', gender: 'female', description: 'founder', parentId: null, type: 'root' });
  assert.equal(t.nodes[0].name, 'Root');
  const cleared = updateNode(u, 1, { name: 'Ancestor', gender: 'female', description: '  ' }).file;
  assert.equal('description' in cleared.nodes[0], false);
  assert.throws(() => updateNode(t, 1, m('   ')), /empty/);
  assert.throws(() => updateNode(t, 1, { name: 'x', gender: 'other' as never }), /Gender/);
  assert.throws(() => updateNode(t, 1, m('x', 'a'.repeat(161))), /Description/);
});

test('serialize -> parse round-trips (including quotes in notes)', () => {
  let t = createFreshTree('Ra"ma');
  t = addConsort(t, 1, f('Sita', 'Says "hi"\nline 2')).file;
  t = addChild(t, 2, m('Luv')).file;
  assert.deepEqual(parseFile(serialize(t)), t);
});

test('validateFile: old files without gender load as male; bad data is rejected', () => {
  const root = { id: 1, name: 'R', parentId: null, type: 'root' };
  assert.equal(validateFile({ nodes: [root] }).nodes[0].gender, 'male');
  assert.throws(() => parseFile('nope'), /not valid JSON/);
  assert.throws(() => validateFile({ nodes: [] }), /non-empty/);
  assert.throws(() => validateFile({ nodes: [{ ...root, gender: 'x' }] }), /gender/);
  assert.throws(() => validateFile({ nodes: [root, { ...root, type: 'child', parentId: 1 }] }), /duplicate/);
  assert.throws(() => validateFile({ nodes: [root, { id: 2, name: 'x', parentId: 9, type: 'child' }] }), /missing parent/);
  assert.throws(() => validateFile({ nodes: [{ ...root, type: 'child', parentId: 1 }] }), /exactly one root/);
  assert.throws(
    () => validateFile({ nodes: [root, { id: 2, name: 'a', parentId: 3, type: 'child' }, { id: 3, name: 'b', parentId: 2, type: 'child' }] }),
    /cycle/,
  );
  assert.throws(
    () => validateFile({ nodes: [root, { id: 2, name: 'a', parentId: 1, type: 'consort' }, { id: 3, name: 'b', parentId: 2, type: 'consort' }] }),
    /non-consort/,
  );
  assert.equal(validateFile({ lastId: 1, nodes: [root, { id: 5, name: 'k', parentId: 1, type: 'child' }] }).lastId, 5);
});

console.log(`\n${passed} tests passed`);
