// `npm run check:seo` (after `npm run build`): reads the built site in dist/ and tells you what is missing or too long.
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function check(distDir, config) {
  const problems = [];
  const notes = [];
  const bad = (m) => problems.push(m);
  if (/YOUR-(USERNAME|REPO)/i.test(config.siteUrl)) bad('site.config.json: siteUrl is still the placeholder.');
  const site = config.siteUrl.replace(/\/+$/, '');
  const titles = new Map();
  const descriptions = new Map();

  for (const p of config.pages) {
    const file = path.join(distDir, p.path, 'index.html');
    let html = '';
    try {
      html = await readFile(file, 'utf8');
    } catch {
      bad(`/${p.path}: ${path.relative(distDir, file)} was not generated.`);
      continue;
    }
    const label = `/${p.path}`;
    const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
    const desc = html.match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? '';
    const canonical = html.match(/<link rel="canonical" href="([^"]*)"/i)?.[1] ?? '';
    const h1s = (html.match(/<h1[\s>]/gi) ?? []).length;
    if (!title) bad(`${label}: no <title>.`);
    else if (title.length > 65) bad(`${label}: title is ${title.length} characters (keep it under about 60).`);
    if (!desc) bad(`${label}: no meta description.`);
    else if (desc.length < 70 || desc.length > 160) bad(`${label}: description is ${desc.length} characters (aim for 70-155).`);
    if (!canonical) bad(`${label}: no canonical link.`);
    else if (!canonical.startsWith(site)) bad(`${label}: canonical ${canonical} does not start with ${site}.`);
    if (h1s !== 1) bad(`${label}: ${h1s} <h1> headings in the static page (should be exactly 1).`);
    if (!/og:image/.test(html)) bad(`${label}: no og:image.`);
    if (!/application\/ld\+json/.test(html)) bad(`${label}: no structured data.`);
    if (titles.has(title)) bad(`${label}: same title as ${titles.get(title)}.`);
    titles.set(title, label);
    if (descriptions.has(desc)) bad(`${label}: same description as ${descriptions.get(desc)}.`);
    descriptions.set(desc, label);
  }

  for (const f of ['sitemap.xml', 'robots.txt', '404.html', 'favicon.svg', 'og-image.png', 'apple-touch-icon.png']) {
    try {
      await stat(path.join(distDir, f));
    } catch {
      bad(`${f} is missing from the build.`);
    }
  }
  try {
    const sitemap = await readFile(path.join(distDir, 'sitemap.xml'), 'utf8');
    const locs = [...sitemap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
    notes.push(`sitemap lists ${locs.length} URLs`);
    for (const p of config.pages) if (!locs.includes(p.path ? `${site}/${p.path}/` : `${site}/`)) bad(`sitemap.xml does not list /${p.path}.`);
  } catch { /* already reported */ }
  try {
    const robots = await readFile(path.join(distDir, 'robots.txt'), 'utf8');
    if (!robots.includes(`Sitemap: ${site}/sitemap.xml`)) bad('robots.txt has no correct Sitemap line.');
  } catch { /* already reported */ }
  const pdfDir = path.join(distDir, 'data/reading-material');
  try {
    const pdfs = (await readdir(pdfDir)).filter((n) => /\.pdf$/i.test(n));
    notes.push(`${pdfs.length} PDFs found`);
    for (const n of pdfs) {
      const mb = (await stat(path.join(pdfDir, n))).size / 1024 / 1024;
      if (mb > 50) notes.push(`"${n}" is ${mb.toFixed(0)} MB. Google only reads the first 64 MB of a PDF, and big files load slowly.`);
    }
  } catch { /* no PDFs */ }
  return { problems, notes };
}

async function main() {
  const config = JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8'));
  let distDir = '';
  for (const n of await readdir(path.join(root, 'dist')).catch(() => [])) {
    for (const sub of ['browser', '']) {
      const d = path.join(root, 'dist', n, sub);
      if (await stat(path.join(d, 'index.html')).then(() => true, () => false)) { distDir = d; break; }
    }
    if (distDir) break;
  }
  if (!distDir) {
    console.error('No build found. Run "npm run build" first.');
    process.exit(1);
  }
  const { problems, notes } = await check(distDir, config);
  for (const n of notes) console.log(`  info  ${n}`);
  if (!problems.length) console.log('\nSEO check passed.');
  else {
    console.log('');
    for (const p of problems) console.log(`  FIX   ${p}`);
    console.log(`\n${problems.length} thing${problems.length === 1 ? '' : 's'} to fix.`);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
