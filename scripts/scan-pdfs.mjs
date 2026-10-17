// Lists the PDFs in public/data/reading-material/ into public/data/reading-material/index.json.
// A browser cannot list a folder by itself, so the Reading page reads this small list instead.
// Runs automatically with `npm start` (and keeps watching) and `npm run build`; or run `npm run pdfs`.
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DIR = path.join(here, '..', 'public', 'data', 'reading-material');
export const MANIFEST = 'index.json';

/** Returns [{ file, size, modified }] for every .pdf directly inside `dir` (sub-folders are ignored). */
export async function listPdfs(dir = DIR) {
  await mkdir(dir, { recursive: true });
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    if (!e.isFile() || !/\.pdf$/i.test(e.name)) continue;
    const s = await stat(path.join(dir, e.name));
    files.push({ file: e.name, size: s.size, modified: s.mtime.toISOString() });
  }
  return files.sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true, sensitivity: 'base' }));
}

/** Writes index.json (only when its content changed). Returns the list. */
export async function scan(dir = DIR) {
  const files = await listPdfs(dir);
  const text = JSON.stringify({ files }, null, 2) + '\n';
  const target = path.join(dir, MANIFEST);
  let old = '';
  try {
    old = await readFile(target, 'utf8');
  } catch { /* first run */ }
  if (old !== text) await writeFile(target, text, 'utf8');
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = await scan();
  console.log(`reading-material: ${files.length} PDF${files.length === 1 ? '' : 's'} listed in ${path.relative(process.cwd(), path.join(DIR, MANIFEST))}`);
}
