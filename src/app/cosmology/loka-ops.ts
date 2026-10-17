/**
 * Pure, framework-free logic for the Vedic cosmology page. Every operation takes a LokaFile and
 * returns a NEW LokaFile; everything is addressed by id.
 *
 * JSON format:
 *   { lastId: number, lokas: [{ id, name, description, color, parentId }] }
 *
 *  - id          unique number, always lastId + 1 (never reused, even after deletes)
 *  - name        title shown on the loka
 *  - description text under the title (may have several lines)
 *  - color       background colour as #rrggbb (text colour is derived automatically)
 *  - parentId    null for a top-level loka, else the id of the loka it sits inside
 *
 * Sibling order = order of appearance in the `lokas` array.
 *
 * There is always exactly ONE root loka (parentId null). It can be edited but never deleted,
 * and it has no siblings. Everything else lives inside it.
 */

export interface Loka {
  id: number;
  name: string;
  description: string;
  color: string;
  parentId: number | null;
}

export interface LokaFile {
  lastId: number;
  lokas: Loka[];
}

export interface LokaInput {
  name: string;
  description: string;
  color: string;
}

export interface LokaResult {
  file: LokaFile;
  /** id of the loka that was created or changed */
  id: number;
}

export const MAX_NAME = 80;
export const MAX_DESCRIPTION = 500;
export const DEFAULT_COLOR = '#e8e8e8';

export const ROOT_NAME = 'Vedic Cosmos';
export const ROOT_COLOR = '#f4f4a9';

/** A brand-new file: just the root loka. */
export function createFreshFile(): LokaFile {
  return { lastId: 1, lokas: [{ id: 1, name: ROOT_NAME, description: '', color: ROOT_COLOR, parentId: null }] };
}

export function rootOf(file: LokaFile): Loka {
  const root = file.lokas.find((l) => l.parentId === null);
  if (!root) throw new Error('This file has no root loka.');
  return root;
}

/** Accepts #rgb or #rrggbb (any case) and returns lower-case #rrggbb, or throws. */
export function normalizeColor(color: string): string {
  const c = (color ?? '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(c)) return c;
  if (/^#[0-9a-f]{3}$/.test(c)) return '#' + [...c.slice(1)].map((h) => h + h).join('');
  throw new Error('Color must look like #a1b2c3.');
}

function cleanInput(input: LokaInput): LokaInput {
  const name = (input?.name ?? '').trim();
  if (!name) throw new Error('Name cannot be empty.');
  if (name.length > MAX_NAME) throw new Error(`Name is longer than ${MAX_NAME} characters.`);
  const description = (input.description ?? '').replace(/\r\n?/g, '\n').trim();
  if (description.length > MAX_DESCRIPTION) throw new Error(`Description is longer than ${MAX_DESCRIPTION} characters.`);
  return { name, description, color: normalizeColor(input.color) };
}

export function findLoka(file: LokaFile, id: number): Loka {
  const loka = file.lokas.find((l) => l.id === id);
  if (!loka) throw new Error(`Loka #${id} does not exist.`);
  return loka;
}

/** Lokas directly inside `parentId` (null = top level), in sibling order. */
export function childrenOf(file: LokaFile, parentId: number | null): Loka[] {
  return file.lokas.filter((l) => l.parentId === parentId);
}

/** The loka itself plus every loka inside it, at any depth. */
export function collectSubtreeIds(file: LokaFile, id: number): number[] {
  findLoka(file, id);
  const result = new Set<number>([id]);
  let frontier = [id];
  while (frontier.length) {
    const next: number[] = [];
    for (const l of file.lokas) {
      if (l.parentId !== null && frontier.includes(l.parentId) && !result.has(l.id)) {
        result.add(l.id);
        next.push(l.id);
      }
    }
    frontier = next;
  }
  return [...result];
}

/** Add a loka as the LAST loka inside `parentId`. */
export function addInside(file: LokaFile, parentId: number, input: LokaInput): LokaResult {
  findLoka(file, parentId);
  const id = file.lastId + 1;
  const loka: Loka = { id, ...cleanInput(input), parentId };
  return { id, file: { lastId: id, lokas: [...file.lokas, loka] } };
}

/** Add a loka right after `siblingId`, inside the same parent. The root has no siblings. */
export function addBeside(file: LokaFile, siblingId: number, input: LokaInput): LokaResult {
  const sibling = findLoka(file, siblingId);
  if (sibling.parentId === null) throw new Error('The root loka has no siblings. Add inside it instead.');
  const id = file.lastId + 1;
  const loka: Loka = { id, ...cleanInput(input), parentId: sibling.parentId };
  // sibling order is the array order among lokas with the same parent, so insert just before the
  // next sibling (or at the end when the sibling is the last one)
  const siblings = file.lokas.filter((l) => l.parentId === sibling.parentId);
  const next = siblings[siblings.findIndex((l) => l.id === siblingId) + 1];
  const at = next ? file.lokas.findIndex((l) => l.id === next.id) : file.lokas.length;
  const lokas = [...file.lokas.slice(0, at), loka, ...file.lokas.slice(at)];
  return { id, file: { lastId: id, lokas } };
}

/**
 * Add a loka in the MIDDLE: the new loka goes inside `parentId`, and every loka that was directly inside
 * `parentId` (with everything inside those) moves inside the new loka.
 * Example: e is inside b. Add-in-the-middle on b with "a" -> a is inside b, e is inside a.
 */
export function addMiddle(file: LokaFile, parentId: number, input: LokaInput): LokaResult {
  findLoka(file, parentId);
  const id = file.lastId + 1;
  const loka: Loka = { id, ...cleanInput(input), parentId };
  const moved = file.lokas.map((l) => (l.parentId === parentId ? { ...l, parentId: id } : l));
  return { id, file: { lastId: id, lokas: [...moved, loka] } };
}

/** Change name, description and colour of a loka. */
export function updateLoka(file: LokaFile, id: number, input: LokaInput): LokaResult {
  findLoka(file, id);
  const clean = cleanInput(input);
  return { id, file: { ...file, lokas: file.lokas.map((l) => (l.id === id ? { ...l, ...clean } : l)) } };
}

/** Delete a loka and every loka inside it. The root loka cannot be deleted. */
export function removeLoka(file: LokaFile, id: number): LokaResult & { removedIds: number[] } {
  if (findLoka(file, id).parentId === null) throw new Error('The root loka cannot be deleted.');
  const removedIds = collectSubtreeIds(file, id);
  const gone = new Set(removedIds);
  return { id, removedIds, file: { lastId: file.lastId, lokas: file.lokas.filter((l) => !gone.has(l.id)) } };
}

/** Validate untrusted data (e.g. an opened JSON file) and return a clean LokaFile. */
export function validateFile(data: unknown): LokaFile {
  const bad = (msg: string): never => {
    throw new Error(`Invalid loka file: ${msg}`);
  };
  if (typeof data !== 'object' || data === null) return bad('expected an object.');
  const raw = data as { lastId?: unknown; lokas?: unknown };
  if (!Array.isArray(raw.lokas)) return bad('"lokas" must be an array.');

  const lokas: Loka[] = [];
  const ids = new Set<number>();
  for (const item of raw.lokas as Record<string, unknown>[]) {
    const { id, name, description, color, parentId } = item ?? {};
    if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) return bad(`bad id ${JSON.stringify(id)}.`);
    if (ids.has(id)) return bad(`duplicate id ${id}.`);
    if (typeof name !== 'string' || !name.trim()) return bad(`loka #${id} needs a name.`);
    if (description !== undefined && typeof description !== 'string') return bad(`loka #${id} has a bad description.`);
    if (parentId !== null && parentId !== undefined && (typeof parentId !== 'number' || !Number.isInteger(parentId))) {
      return bad(`loka #${id} has a bad parentId.`);
    }
    let hex = DEFAULT_COLOR;
    if (color !== undefined) {
      try {
        hex = normalizeColor(String(color));
      } catch {
        return bad(`loka #${id} has a bad color.`);
      }
    }
    ids.add(id);
    lokas.push({ id, name: name.trim(), description: (description ?? '').trim(), color: hex, parentId: (parentId ?? null) as number | null });
  }

  const byId = new Map(lokas.map((l) => [l.id, l]));
  for (const l of lokas) {
    if (l.parentId !== null && !byId.has(l.parentId)) return bad(`loka #${l.id} points to a missing parent.`);
    let cursor: Loka | undefined = l;
    for (let hops = 0; cursor && cursor.parentId !== null; hops++) {
      if (hops > lokas.length) return bad(`loka #${l.id} is part of a cycle.`);
      cursor = byId.get(cursor.parentId);
    }
  }

  const maxId = lokas.length ? Math.max(...lokas.map((l) => l.id)) : 0;
  const lastId = typeof raw.lastId === 'number' && Number.isInteger(raw.lastId) ? Math.max(raw.lastId, maxId) : maxId;
  return ensureSingleRoot({ lastId, lokas });
}

/**
 * Older files may be empty or have several top-level lokas. Make them fit the "one root" rule by adding a
 * root loka that holds them (nothing is lost or moved otherwise).
 */
export function ensureSingleRoot(file: LokaFile): LokaFile {
  const tops = file.lokas.filter((l) => l.parentId === null);
  if (tops.length === 1) return file;
  if (tops.length === 0) return createFreshFile();
  const id = file.lastId + 1;
  const root: Loka = { id, name: ROOT_NAME, description: '', color: ROOT_COLOR, parentId: null };
  const lokas = file.lokas.map((l) => (l.parentId === null ? { ...l, parentId: id } : l));
  return { lastId: id, lokas: [root, ...lokas] };
}

export function parseFile(text: string): LokaFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid loka file: not valid JSON.');
  }
  return validateFile(data);
}

/** Pretty JSON with one loka per line. */
export function serialize(file: LokaFile): string {
  const lines = file.lokas.map(
    (l) =>
      `    { "id": ${l.id}, "name": ${JSON.stringify(l.name)}, "description": ${JSON.stringify(l.description)}, "color": "${l.color}", "parentId": ${l.parentId === null ? 'null' : l.parentId} }`,
  );
  return `{\n  "lastId": ${file.lastId},\n  "lokas": [\n${lines.join(',\n')}\n  ]\n}\n`;
}

// ---- text colour -------------------------------------------------------------

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mix(rgb: [number, number, number], target: number, amount: number): [number, number, number] {
  return rgb.map((v) => Math.round(v + (target - v) * amount)) as [number, number, number];
}

const toHex = (rgb: [number, number, number]) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');

/**
 * A readable text colour for a background: a deep shade of the background itself, or a pale tint of it,
 * whichever has the better contrast (keeps the look of the original page, where text matched its box).
 */
export function readableText(background: string): string {
  const bg = channels(normalizeColor(background));
  const dark = mix(bg, 0, 0.72);
  const light = mix(bg, 255, 0.8);
  const contrast = (fg: [number, number, number]) => {
    const [a, b] = [luminance(bg), luminance(fg)];
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  return toHex(contrast(dark) >= contrast(light) ? dark : light);
}
