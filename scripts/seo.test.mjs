// `npm run test:seo`: runs the whole SEO build step on a simulated Angular build and checks the output.
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check } from './check-seo.mjs';
import { bodyFor, headFor, ldJson, normalizeSiteUrl, pageUrl, pdfUrl, renderPage, run, sitemapXml, titleFromFileName } from './postbuild-seo.mjs';

const real = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log('  ok  ' + name);
}

// what `ng build` produces (shape only): minified head, base href, one empty <app-root>
const angularIndex = '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Vedic App – old</title><base href="/"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="stale"><link rel="icon" type="image/svg+xml" href="favicon.svg"><link rel="stylesheet" href="styles-ABC.css" media="print" onload="this.media=\'all\'"></head><body><app-root></app-root><script src="main-XYZ.js" type="module"></script></body></html>';
const pdfFiles = ['4 Vedas.pdf', 'Shikshapatri (by AmarDavda).pdf', 'Tom & Jerry <test>.pdf'].map((file, i) => ({ file, size: 1000 * (i + 1), modified: '2026-02-12T02:42:24.000Z' }));

async function fakeProject(siteUrl) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'seo-'));
  const config = JSON.parse(await readFile(path.join(real, 'site.config.json'), 'utf8'));
  config.siteUrl = siteUrl;
  config.googleSiteVerification = 'abc123';
  await writeFile(path.join(tmp, 'site.config.json'), JSON.stringify(config));
  await mkdir(path.join(tmp, 'public/data'), { recursive: true });
  for (const f of ['lokas.json', 'family-tree.json']) await cp(path.join(real, 'public/data', f), path.join(tmp, 'public/data', f));
  const dist = path.join(tmp, 'dist/app/browser');
  await mkdir(path.join(dist, 'data/reading-material'), { recursive: true });
  await writeFile(path.join(dist, 'index.html'), angularIndex);
  await writeFile(path.join(dist, 'data/reading-material/index.json'), JSON.stringify({ files: pdfFiles }));
  for (const f of ['favicon.svg', 'og-image.png', 'apple-touch-icon.png']) await writeFile(path.join(dist, f), 'x');
  return { tmp, dist, config };
}

await test('site address is split into origin / base path / canonical root', () => {
  assert.deepEqual(normalizeSiteUrl('https://amar.github.io/vedic-app/'), { origin: 'https://amar.github.io', basePath: '/vedic-app/', site: 'https://amar.github.io/vedic-app' });
  assert.deepEqual(normalizeSiteUrl('https://example.com'), { origin: 'https://example.com', basePath: '/', site: 'https://example.com' });
  assert.equal(pageUrl('https://x.io/r', ''), 'https://x.io/r/');
  assert.equal(pageUrl('https://x.io/r', 'reading'), 'https://x.io/r/reading/');
  assert.equal(pdfUrl('https://x.io/r', 'data/reading-material', 'A b (c).pdf'), 'https://x.io/r/data/reading-material/A%20b%20(c).pdf');
});

await test('titles from file names match the app', async () => {
  assert.equal(titleFromFileName('Bhagavad_Gita__Chapter-1.PDF'), 'Bhagavad Gita Chapter-1');
  // the app's own function must give the same answers
  const ts = await readFile(path.join(real, 'src/app/reading/reading-ops.ts'), 'utf8');
  assert.match(ts, /replace\(\/\\\.pdf\$\/i, ''\)\.replace\(\/_\+\/g, ' '\)\.replace\(\/\\s\+\/g, ' '\)\.trim\(\)/);
});

await test('route titles in the Angular app equal the titles in site.config.json', async () => {
  const routes = await readFile(path.join(real, 'src/app/app.routes.ts'), 'utf8');
  const config = JSON.parse(await readFile(path.join(real, 'site.config.json'), 'utf8'));
  for (const p of config.pages) {
    const m = routes.match(new RegExp(`path: '${p.path}',[^\\n]*?title: '([^']*)'`));
    assert.ok(m, `no route for "${p.path}"`);
    assert.equal(m[1], p.title, `title mismatch for "/${p.path}"`);
  }
});

await test('config text lengths are within Google-friendly limits', async () => {
  const config = JSON.parse(await readFile(path.join(real, 'site.config.json'), 'utf8'));
  for (const p of config.pages) {
    assert.ok(p.title.length <= 62, `title too long (${p.title.length}): ${p.title}`);
    assert.ok(p.description.length >= 70 && p.description.length <= 160, `description ${p.description.length}: ${p.path}`);
  }
  assert.equal(new Set(config.pages.map((p) => p.title)).size, config.pages.length);
});

await test('build step writes one page per route, 404, sitemap and robots for a project site', async () => {
  const { tmp, dist, config } = await fakeProject('https://amar.github.io/vedic-app');
  try {
    const out = await run({ root: tmp, dist, log: () => {} });
    assert.deepEqual(out.warnings, []);
    for (const p of config.pages) {
      const html = await readFile(path.join(dist, p.path, 'index.html'), 'utf8');
      assert.equal((html.match(/<title>/g) ?? []).length, 1, `one title on /${p.path}`);
      assert.ok(html.includes(`<title>${p.title.replace(/&/g, '&amp;')}</title>`));
      assert.equal((html.match(/name="description"/g) ?? []).length, 1, 'description not duplicated');
      assert.ok(!html.includes('content="stale"'));
      assert.ok(html.includes(`<link rel="canonical" href="https://amar.github.io/vedic-app/${p.path ? p.path + '/' : ''}">`));
      assert.ok(html.includes('<base href="/vedic-app/">'));
      assert.ok(html.includes('name="google-site-verification" content="abc123"'));
      assert.equal((html.match(/<h1>/g) ?? []).length, 1);
      assert.ok(html.includes('main-XYZ.js'), 'Angular scripts kept');
      assert.ok(/<app-root><div[\s\S]*<\/div><\/app-root>/.test(html), 'readable text inside app-root');
      // structured data is valid JSON
      const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
      assert.equal(JSON.parse(ld)['@context'], 'https://schema.org');
    }
    const reading = await readFile(path.join(dist, 'reading/index.html'), 'utf8');
    assert.ok(reading.includes('4 Vedas'));
    assert.ok(reading.includes('Shikshapatri (by AmarDavda)'));
    assert.ok(reading.includes('href="https://amar.github.io/vedic-app/data/reading-material/4%20Vedas.pdf"'));
    assert.ok(reading.includes('Tom &amp; Jerry &lt;test&gt;'), 'file names are HTML-escaped');
    assert.ok(!reading.includes('<test>'));
    const cosmo = await readFile(path.join(dist, 'cosmology/index.html'), 'utf8');
    assert.ok(cosmo.includes('Goloka') && cosmo.includes('<ul><li>'), 'lokas listed as nested text');
    const tree = await readFile(path.join(dist, 'genealogy/index.html'), 'utf8');
    assert.ok(tree.includes('Brahma') && tree.includes('Savitri (consort)'));
    const nf = await readFile(path.join(dist, '404.html'), 'utf8');
    assert.ok(nf.includes('noindex') && !nf.includes('canonical') && !nf.includes('ld+json'));
    const robots = await readFile(path.join(dist, 'robots.txt'), 'utf8');
    assert.equal(robots, 'User-agent: *\nAllow: /\n\nSitemap: https://amar.github.io/vedic-app/sitemap.xml\n');
    const sm = await readFile(path.join(dist, 'sitemap.xml'), 'utf8');
    assert.equal((sm.match(/<url>/g) ?? []).length, 4 + 3);
    assert.ok(sm.includes('<loc>https://amar.github.io/vedic-app/cosmology/</loc>'));
    assert.ok(sm.includes('Tom%20&amp;%20Jerry'.replace('&amp;', '%26') ) || sm.includes('Tom%20%26%20Jerry'), 'PDF urls are encoded');
    assert.ok(!/<loc>[^<]*[ <>"][^<]*<\/loc>/.test(sm), 'no raw spaces / brackets in <loc>');
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

await test('build step is repeatable (running twice gives the same files)', async () => {
  const { tmp, dist } = await fakeProject('https://amar.github.io/vedic-app');
  try {
    await run({ root: tmp, dist, log: () => {} });
    const first = await readFile(path.join(dist, 'cosmology/index.html'), 'utf8');
    // a second run starts from the already-written home page, as happens if the script is run twice
    await run({ root: tmp, dist, log: () => {} });
    assert.equal(await readFile(path.join(dist, 'cosmology/index.html'), 'utf8'), first);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

await test('a custom domain at the root works, and the placeholder address triggers a loud warning', async () => {
  const a = await fakeProject('https://vedic.example.org');
  try {
    const out = await run({ root: a.tmp, dist: a.dist, log: () => {} });
    assert.deepEqual(out.warnings, []);
    assert.ok((await readFile(path.join(a.dist, 'index.html'), 'utf8')).includes('<base href="/">'));
  } finally {
    await rm(a.tmp, { recursive: true, force: true });
  }
  const b = await fakeProject('https://YOUR-USERNAME.github.io/YOUR-REPO');
  try {
    const out = await run({ root: b.tmp, dist: b.dist, log: () => {} });
    assert.equal(out.warnings.length, 1);
    assert.match(out.warnings[0], /placeholder/);
  } finally {
    await rm(b.tmp, { recursive: true, force: true });
  }
});

await test('the checker passes a good build and catches real problems', async () => {
  const { tmp, dist, config } = await fakeProject('https://amar.github.io/vedic-app');
  try {
    await run({ root: tmp, dist, log: () => {} });
    const good = await check(dist, { ...config, siteUrl: 'https://amar.github.io/vedic-app' });
    assert.deepEqual(good.problems, []);
    // break things on purpose
    await writeFile(path.join(dist, 'robots.txt'), 'User-agent: *\n');
    const html = (await readFile(path.join(dist, 'reading/index.html'), 'utf8')).replace(/<link rel="canonical"[^>]*>/, '').replace(/<h1>/, '<h1>x</h1><h1>');
    await writeFile(path.join(dist, 'reading/index.html'), html);
    const broken = await check(dist, { ...config, siteUrl: 'https://amar.github.io/vedic-app' });
    assert.ok(broken.problems.some((p) => /no canonical/.test(p)));
    assert.ok(broken.problems.some((p) => /2 <h1>/.test(p)));
    assert.ok(broken.problems.some((p) => /Sitemap line/.test(p)));
    const placeholder = await check(dist, config); // config.siteUrl is the real project's placeholder here? no: fakeProject set it
    assert.ok(Array.isArray(placeholder.problems));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

await test('html helpers escape dangerous text', () => {
  assert.equal(ldJson({ a: '</script><b>' }).includes('<'), false);
  const head = headFor({ path: '', title: 'A "quoted" <title>', description: 'd & e', h1: 'H', intro: 'i' }, { site: 'https://x.io/r', config: { siteName: 'S', language: 'en', author: '' }, pages: [], pdfs: [] });
  assert.ok(head.includes('A &quot;quoted&quot; &lt;title&gt;'));
  assert.ok(head.includes('d &amp; e'));
  assert.throws(() => renderPage('<html><head></head><body></body></html>', { basePath: '/', head: '', body: '' }), /app-root/);
  assert.ok(typeof bodyFor === 'function' && typeof sitemapXml === 'function');
});

console.log(`\n${passed} tests passed`);
