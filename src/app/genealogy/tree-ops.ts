/**
 * Pure, framework-free family-tree logic. Every operation takes a TreeFile and
 * returns a NEW TreeFile (no mutation), and everything is addressed by node id.
 *
 * Data model (this is exactly what is stored in the JSON file):
 *   { lastId: number, nodes: [{ id, name, gender, description?, parentId, type }] }
 *
 *  - id          unique number, starts at 1, always lastId + 1 (never reused, even after deletes)
 *  - gender      'male' | 'female'  (drives the colour: light blue / light pink)
 *  - description optional short note
 *  - parentId    null for the first (root) node. Otherwise the id of the node it hangs from:
 *                  type 'consort' -> the node it is the wife/husband of
 *                  type 'child'   -> its parent: ANY node (a consort, or the node itself)
 *  - type        'root' | 'consort' | 'child'
 */

export type NodeType = 'root' | 'child' | 'consort';
export type Gender = 'male' | 'female';

export interface TreeNode {
  id: number;
  name: string;
  gender: Gender;
  description?: string;
  parentId: number | null;
  type: NodeType;
}

export interface TreeFile {
  lastId: number;
  nodes: TreeNode[];
}

/** What the user types in the add / edit form. */
export interface NodeInput {
  name: string;
  gender: Gender;
  description?: string;
}

export interface OpResult {
  file: TreeFile;
  /** id of the node that was created (add/insert) or affected (update/remove) */
  id: number;
}

export const MAX_NAME = 80;
export const MAX_DESCRIPTION = 160;

/** A brand-new tree with a single node, id 1. */
export function createFreshTree(rootName = 'Root', gender: Gender = 'male'): TreeFile {
  return { lastId: 1, nodes: [{ id: 1, name: rootName, gender, parentId: null, type: 'root' }] };
}

export function oppositeGender(g: Gender): Gender {
  return g === 'male' ? 'female' : 'male';
}

function cleanInput(input: NodeInput): { name: string; gender: Gender; description?: string } {
  const name = (input?.name ?? '').trim();
  if (!name) throw new Error('Name cannot be empty.');
  if (name.length > MAX_NAME) throw new Error(`Name is longer than ${MAX_NAME} characters.`);
  if (input.gender !== 'male' && input.gender !== 'female') throw new Error('Gender must be male or female.');
  const description = (input.description ?? '').trim();
  if (description.length > MAX_DESCRIPTION) throw new Error(`Description is longer than ${MAX_DESCRIPTION} characters.`);
  return description ? { name, gender: input.gender, description } : { name, gender: input.gender };
}

export function findNode(file: TreeFile, id: number): TreeNode {
  const node = file.nodes.find((n) => n.id === id);
  if (!node) throw new Error(`Node #${id} does not exist.`);
  return node;
}

/** Everything hanging directly from `id`: consorts first, then children, each by id. */
export function attachedTo(file: TreeFile, id: number): TreeNode[] {
  const rank = (n: TreeNode) => (n.type === 'consort' ? 0 : 1);
  return file.nodes.filter((n) => n.parentId === id).sort((a, b) => rank(a) - rank(b) || a.id - b.id);
}

export function childrenOf(file: TreeFile, id: number): TreeNode[] {
  return file.nodes.filter((n) => n.parentId === id && n.type === 'child');
}

export function consortsOf(file: TreeFile, id: number): TreeNode[] {
  return file.nodes.filter((n) => n.parentId === id && n.type === 'consort');
}

function append(file: TreeFile, node: Omit<TreeNode, 'id'>): OpResult {
  const id = file.lastId + 1;
  return { id, file: { lastId: id, nodes: [...file.nodes, { ...node, id }] } };
}

/** Add a wife/husband to a node. A node can have several. A consort cannot have a consort. */
export function addConsort(file: TreeFile, nodeId: number, input: NodeInput): OpResult {
  const node = findNode(file, nodeId);
  if (node.type === 'consort') throw new Error('A consort cannot have a consort. Select the main node instead.');
  return append(file, { ...cleanInput(input), parentId: node.id, type: 'consort' });
}

/** Add a child to ANY node: a consort (child of that consort) or a node itself (child directly from it). */
export function addChild(file: TreeFile, nodeId: number, input: NodeInput): OpResult {
  const parent = findNode(file, nodeId);
  return append(file, { ...cleanInput(input), parentId: parent.id, type: 'child' });
}

/**
 * Add a node in the MIDDLE of the tree: the new node becomes a child of `nodeId`, and the
 * existing children of `nodeId` (with their whole subtrees) become children of the new node.
 * Consorts stay with the node they belong to.
 */
export function insertBetween(file: TreeFile, nodeId: number, input: NodeInput): OpResult {
  const parent = findNode(file, nodeId);
  const added = append(file, { ...cleanInput(input), parentId: parent.id, type: 'child' });
  const nodes = added.file.nodes.map((n) =>
    n.id !== added.id && n.parentId === parent.id && n.type === 'child' ? { ...n, parentId: added.id } : n,
  );
  return { id: added.id, file: { lastId: added.file.lastId, nodes } };
}

/** Change name / gender / description of a node. */
export function updateNode(file: TreeFile, id: number, input: NodeInput): OpResult {
  findNode(file, id);
  const clean = cleanInput(input);
  const nodes = file.nodes.map((n) => {
    if (n.id !== id) return n;
    const { description: _old, ...rest } = n;
    return { ...rest, ...clean };
  });
  return { id, file: { ...file, nodes } };
}

/** The node itself plus every descendant (consorts, children, their consorts and children, ...). */
export function collectSubtreeIds(file: TreeFile, id: number): number[] {
  findNode(file, id);
  const result = new Set<number>([id]);
  let frontier = [id];
  while (frontier.length) {
    const next: number[] = [];
    for (const n of file.nodes) {
      if (n.parentId !== null && frontier.includes(n.parentId) && !result.has(n.id)) {
        result.add(n.id);
        next.push(n.id);
      }
    }
    frontier = next;
  }
  return [...result];
}

/** Delete a node and everything below it. Returns the removed ids via `removedIds`. */
export function removeNode(file: TreeFile, id: number): OpResult & { removedIds: number[] } {
  const node = findNode(file, id);
  if (node.type === 'root') throw new Error('The first (root) node cannot be deleted.');
  const removedIds = collectSubtreeIds(file, id);
  const gone = new Set(removedIds);
  return {
    id,
    removedIds,
    file: { lastId: file.lastId, nodes: file.nodes.filter((n) => !gone.has(n.id)) },
  };
}

/** Validate untrusted data (e.g. a JSON file the user opened) and return a clean TreeFile. */
export function validateFile(data: unknown): TreeFile {
  const bad = (msg: string): never => {
    throw new Error(`Invalid tree file: ${msg}`);
  };
  if (typeof data !== 'object' || data === null) return bad('expected an object.');
  const raw = data as { lastId?: unknown; nodes?: unknown };
  if (!Array.isArray(raw.nodes) || raw.nodes.length === 0) return bad('"nodes" must be a non-empty array.');

  const nodes: TreeNode[] = [];
  const ids = new Set<number>();
  for (const item of raw.nodes as Record<string, unknown>[]) {
    const { id, name, gender, description, parentId, type } = item ?? {};
    if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) return bad(`bad id ${JSON.stringify(id)}.`);
    if (ids.has(id)) return bad(`duplicate id ${id}.`);
    if (typeof name !== 'string' || !name.trim()) return bad(`node #${id} needs a name.`);
    if (type !== 'root' && type !== 'child' && type !== 'consort') return bad(`node #${id} has bad type.`);
    if (gender !== undefined && gender !== 'male' && gender !== 'female') return bad(`node #${id} has bad gender.`);
    if (description !== undefined && typeof description !== 'string') return bad(`node #${id} has bad description.`);
    if (parentId !== null && (typeof parentId !== 'number' || !Number.isInteger(parentId))) {
      return bad(`node #${id} has bad parentId.`);
    }
    ids.add(id);
    const node: TreeNode = { id, name: name.trim(), gender: gender ?? 'male', parentId: parentId as number | null, type };
    const note = description?.trim();
    if (note) node.description = note.slice(0, MAX_DESCRIPTION);
    nodes.push(node);
  }

  const roots = nodes.filter((n) => n.type === 'root');
  if (roots.length !== 1 || roots[0].parentId !== null) return bad('exactly one root node with parentId null is required.');
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    if (n.type === 'root') continue;
    if (n.parentId === null || !byId.has(n.parentId)) return bad(`node #${n.id} points to a missing parent.`);
    if (n.type === 'consort' && byId.get(n.parentId)!.type === 'consort') {
      return bad(`consort #${n.id} must be attached to a non-consort node.`);
    }
    // walk up to make sure every node reaches the root (no cycles)
    let cursor: TreeNode | undefined = n;
    for (let hops = 0; cursor && cursor.type !== 'root'; hops++) {
      if (hops > nodes.length) return bad(`node #${n.id} is part of a cycle.`);
      cursor = byId.get(cursor.parentId as number);
    }
  }

  const maxId = Math.max(...nodes.map((n) => n.id));
  const lastId = typeof raw.lastId === 'number' && Number.isInteger(raw.lastId) ? Math.max(raw.lastId, maxId) : maxId;
  return { lastId, nodes };
}

/** Parse JSON text into a validated TreeFile. */
export function parseFile(text: string): TreeFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid tree file: not valid JSON.');
  }
  return validateFile(data);
}

/** Pretty JSON with one node per line. */
export function serialize(file: TreeFile): string {
  const lines = file.nodes.map((n) => {
    const note = n.description ? `, "description": ${JSON.stringify(n.description)}` : '';
    const parent = n.parentId === null ? 'null' : n.parentId;
    return `    { "id": ${n.id}, "name": ${JSON.stringify(n.name)}, "gender": "${n.gender}"${note}, "parentId": ${parent}, "type": "${n.type}" }`;
  });
  return `{\n  "lastId": ${file.lastId},\n  "nodes": [\n${lines.join(',\n')}\n  ]\n}\n`;
}
