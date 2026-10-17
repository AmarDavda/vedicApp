/**
 * Pure helpers for the "Vedic Reading Materials" page: read the generated list, search it, paginate it.
 * The list comes from public/data/reading-material/index.json (written by scripts/scan-pdfs.mjs).
 */

export const PAGE_SIZE = 10;
export const FOLDER = 'data/reading-material/';

/** One entry of index.json */
export interface PdfEntry {
  file: string;
  size: number;
  modified: string;
}

export interface ReadingItem extends PdfEntry {
  title: string;
  url: string;
  /** lower-case, accent-free text that the search runs on */
  key: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
  /** 1-based position of the first / last item shown (0 when empty) */
  from: number;
  to: number;
}

/** "Bhagavad_Gita__Chapter-1.PDF" -> "Bhagavad Gita Chapter-1" */
export function titleFromFileName(file: string): string {
  const title = file.replace(/\.pdf$/i, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  return title || file;
}

/** Lower-case, strip accents (Bhāgavata = bhagavata), treat - _ . as spaces, collapse spaces. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Validate the generated list; throws a readable error when it is not usable. */
export function parseManifest(text: string): PdfEntry[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('The reading list (index.json) is not valid JSON. Run "npm run pdfs" to rebuild it.');
  }
  const files = (data as { files?: unknown })?.files;
  if (!Array.isArray(files)) throw new Error('The reading list (index.json) has no "files" list. Run "npm run pdfs" to rebuild it.');
  return files
    .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null && typeof (f as { file?: unknown }).file === 'string')
    .map((f) => ({
      file: f['file'] as string,
      size: typeof f['size'] === 'number' ? f['size'] : 0,
      modified: typeof f['modified'] === 'string' ? f['modified'] : '',
    }))
    .filter((f) => /\.pdf$/i.test(f.file));
}

/** Entries -> display items, sorted by title (natural order: "Part 2" before "Part 10"). */
export function toItems(entries: PdfEntry[]): ReadingItem[] {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  return entries
    .map((e) => {
      const title = titleFromFileName(e.file);
      return { ...e, title, url: FOLDER + encodeURIComponent(e.file), key: normalize(`${title} ${e.file}`) };
    })
    .sort((a, b) => collator.compare(a.title, b.title));
}

/** Every word you type must appear somewhere in the title / file name. Empty query = everything. */
export function search(items: ReadingItem[], query: string): ReadingItem[] {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (!terms.length) return items;
  return items.filter((i) => terms.every((t) => i.key.includes(t)));
}

/** 1-based page; out-of-range pages are clamped. */
export function paginate<T>(items: T[], page: number, size = PAGE_SIZE): Page<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (p - 1) * size;
  const slice = items.slice(start, start + size);
  return { items: slice, page: p, pageCount, total, from: slice.length ? start + 1 : 0, to: start + slice.length };
}

/** Page buttons to show, e.g. [1, '…', 4, 5, 6, '…', 12]. */
export function pageWindow(page: number, pageCount: number): (number | '…')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const keep = new Set([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((n) => keep.add(n));
  if (page >= pageCount - 2) [pageCount - 1, pageCount - 2, pageCount - 3].forEach((n) => keep.add(n));
  const sorted = [...keep].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((n, i) => {
    if (i > 0) {
      const gap = n - sorted[i - 1];
      if (gap === 2) out.push(n - 1); // a "…" that hides just one page would be silly: show it
      else if (gap > 2) out.push('…');
    }
    out.push(n);
  });
  return out;
}

export function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1000 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
