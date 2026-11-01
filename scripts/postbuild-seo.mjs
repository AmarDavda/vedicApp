// Runs automatically after `npm run build` (npm "postbuild" hook). Turns the Angular build output into a
// search-engine-friendly static site for GitHub Pages:
//   - one HTML file per page (/cosmology/index.html ...) with its own <title>, description, canonical URL,
//     social-share tags, structured data (JSON-LD) and readable text inside <app-root>
//   - sitemap.xml (pages + every PDF), robots.txt, 404.html (fallback for unknown URLs)
// Settings live in site.config.json. Nothing here changes how the app itself behaves.
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PLACEHOLDER = /YOUR-(USERNAME|REPO)/i;

// ---------- helpers (exported for tests) ----------
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
/** JSON for a <script type="application/ld+json"> block (a "<" could close the tag early). */
export const ldJson = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

/** Same rule as the app's reading page: "Bhagavad_Gita__Chapter-1.pdf" -> "Bhagavad Gita Chapter-1" */
export function titleFromFileName(file) {
  const t = file.replace(/\.pdf$/i, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  return t || file;
}

export function normalizeSiteUrl(url) {
  const u = new URL(String(url).trim());
  const pathname = u.pathname.replace(/\/+$/, '');
  return { origin: u.origin, basePath: pathname + '/', site: u.origin + pathname };
}

/** Public URL of a page: "" -> https://x/repo/ ; "cosmology" -> https://x/repo/cosmology/ */
export const pageUrl = (site, p) => (p ? `${site}/${p}/` : `${site}/`);
export const pdfUrl = (site, folder, file) => `${site}/${folder}/${encodeURIComponent(file)}`;

// ---------- page bodies (readable text that is also in the running app) ----------
function nestedList(items, rootParent, label) {
  const kids = new Map();
  for (const n of items) {
    const list = kids.get(n.parentId) ?? [];
    list.push(n);
    kids.set(n.parentId, list);
  }
  const walk = (parent) => {
    const list = kids.get(parent);
    if (!list) return '';
    return `<ul>${list.map((n) => `<li>${esc(label(n))}${walk(n.id)}</li>`).join('')}</ul>`;
  };
  return walk(rootParent);
}

export function bodyFor(page, { site, lokas, nodes, pdfs, pages }) {
  const wrapStart = '<div style="font-family:Georgia,serif;max-width:860px;margin:0 auto;padding:24px 18px;color:#3b1d1d;line-height:1.6">';
  const nav = `<nav aria-label="Main"><ul>${pages
    .map((p) => `<li><a href="${esc(pageUrl(site, p.path))}">${esc(p.path ? p.h1 : 'Home')}</a></li>`)
    .join('')}</ul></nav>`;
  let main = `<h1>${esc(page.h1)}</h1><p>${esc(page.intro)}</p>`;
  if (page.path === '') {
    main += `<ul>${pages
      .filter((p) => p.path)
      .map((p) => `<li><a href="${esc(pageUrl(site, p.path))}"><strong>${esc(p.h1)}</strong></a>: ${esc(p.description)}</li>`)
      .join('')}</ul>`;
  } else if (page.path === 'cosmology') {
    const root = lokas.find((l) => l.parentId === null);
    main += `<h2>Lokas</h2>${root ? nestedList(lokas, null, (l) => (l.description ? `${l.name}: ${l.description.replace(/\s*\n\s*/g, ', ')}` : l.name)) : ''}`;
  } else if (page.path === 'genealogy') {
    main += `<h2>Family tree</h2>${nestedList(nodes, null, (n) => (n.type === 'consort' ? `${n.name} (consort)` : n.name))}`;
  } else if (page.path === 'reading') {
    main += `<h2>Available PDFs</h2><ul>${pdfs
      .map((f) => `<li><a href="${esc(pdfUrl(site, 'data/reading-material', f.file))}">${esc(titleFromFileName(f.file))}</a> (PDF)</li>`)
      .join('')}</ul>`;
  }
  return `${wrapStart}${nav}<main>${main}</main></div>`;
}

// ---------- <head> additions ----------
export function headFor(page, ctx) {
  const { site, config, pages } = ctx;
  const url = pageUrl(site, page.path);
  const image = `${site}/og-image.png`;
  const tags = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta name="robots" content="index, follow, max-image-preview:large">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${esc(config.siteName)}">`,
    `<meta property="og:title" content="${esc(page.title)}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(image)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(config.siteName)}: Vedic cosmology, family tree and reading materials">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(page.title)}">`,
    `<meta name="twitter:description" content="${esc(page.description)}">`,
    `<meta name="twitter:image" content="${esc(image)}">`,
  ];
  if (config.googleSiteVerification) tags.push(`<meta name="google-site-verification" content="${esc(config.googleSiteVerification)}">`);
  if (config.bingSiteVerification) tags.push(`<meta name="msvalidate.01" content="${esc(config.bingSiteVerification)}">`);

  const author = config.author ? { author: { '@type': 'Person', name: config.author } } : {};
  const graph = [];
  if (page.path === '') {
    graph.push({ '@type': 'WebSite', '@id': `${site}/#website`, name: config.siteName, url: `${site}/`, description: page.description, inLanguage: config.language, ...author });
  } else {
    const type = page.path === 'reading' ? 'CollectionPage' : 'WebPage';
    const node = { '@type': type, '@id': `${url}#page`, name: page.title, url, description: page.description, inLanguage: config.language, isPartOf: { '@id': `${site}/#website` } };
    if (page.path === 'reading') {
      node.mainEntity = {
        '@type': 'ItemList',
        itemListElement: ctx.pdfs.map((f, i) => ({ '@type': 'ListItem', position: i + 1, name: titleFromFileName(f.file), url: pdfUrl(site, 'data/reading-material', f.file) })),
      };
    }
    graph.push({ '@type': 'WebSite', '@id': `${site}/#website`, name: config.siteName, url: `${site}/`, inLanguage: config.language, ...author });
    graph.push(node);
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/` },
        { '@type': 'ListItem', position: 2, name: page.h1, item: url },
      ],
    });
  }
  tags.push(`<script type="application/ld+json">${ldJson({ '@context': 'https://schema.org', '@graph': graph })}</script>`);
  void pages;
  return tags.join('\n    ');
}

/** Put the head additions + body text into Angular's built index.html. */
export function renderPage(template, { basePath, head, body, robots }) {
  let html = template;
  html = html.replace(/<base\s+href="[^"]*"\s*\/?>/i, `<base href="${basePath}">`);
  // drop anything we are about to replace, so nothing ends up twice
  // each removal also eats the indentation before it and the newline after it, so re-running leaves no blank lines
  const strip = (re) => { html = html.replace(re, ''); };
  strip(/[ \t]*<title>[\s\S]*?<\/title>[ \t]*\n?/i);
  strip(/[ \t]*<meta\s+name="(description|robots|google-site-verification|msvalidate\.01)"[^>]*>[ \t]*\n?/gi);
  strip(/[ \t]*<link\s+rel="canonical"[^>]*>[ \t]*\n?/gi);
  strip(/[ \t]*<meta\s+(property="og:|name="twitter:)[^>]*>[ \t]*\n?/gi);
  strip(/[ \t]*<script type="application\/ld\+json">[\s\S]*?<\/script>[ \t]*\n?/gi);
  strip(/\s+(?=<\/head>)/i);
  const headBlock = robots ? head.replace(/<meta name="robots"[^>]*>/, `<meta name="robots" content="${robots}">`) : head;
  if (!/<\/head>/i.test(html)) throw new Error('index.html has no </head>');
  html = html.replace(/<\/head>/i, `    ${headBlock}\n  </head>`);
  if (!/<app-root[^>]*>[\s\S]*?<\/app-root>/i.test(html)) throw new Error('index.html has no <app-root></app-root>');
  html = html.replace(/<app-root([^>]*)>[\s\S]*?<\/app-root>/i, `<app-root$1>${body}</app-root>`);
  return html;
}

// ---------- sitemap + robots ----------
export function sitemapXml({ site, pages, pdfs }) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    ...pages.map((p) => `  <url>\n    <loc>${xmlEsc(pageUrl(site, p.path))}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`),
    ...pdfs.map((f) => {
      const d = f.modified && !isNaN(new Date(f.modified)) ? new Date(f.modified).toISOString().slice(0, 10) : today;
      return `  <url>\n    <loc>${xmlEsc(pdfUrl(site, 'data/reading-material', f.file))}</loc>\n    <lastmod>${d}</lastmod>\n  </url>`;
    }),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

export const robotsTxt = (site) => `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`;

// ---------- main ----------
async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function findDist(root) {
  const dist = path.join(root, 'dist');
  let names = [];
  try {
    names = await readdir(dist);
  } catch {
    throw new Error('No dist/ folder. Run "npm run build" first.');
  }
  for (const n of names) {
    for (const sub of ['browser', '']) {
      const dir = path.join(dist, n, sub);
      try {
        await stat(path.join(dir, 'index.html'));
        return dir;
      } catch { /* keep looking */ }
    }
  }
  throw new Error('Could not find the built index.html inside dist/.');
}

export async function run({ root = path.join(here, '..'), dist, log = console.log } = {}) {
  const config = await readJson(path.join(root, 'site.config.json'));
  if (!config) throw new Error('site.config.json is missing or not valid JSON.');
  const warnings = [];
  if (PLACEHOLDER.test(config.siteUrl)) {
    warnings.push('site.config.json still has the placeholder siteUrl. Put your real GitHub Pages address there (see SEO-GUIDE.md), then build again. Canonical links and the sitemap are wrong until you do.');
  }
  const { site, basePath } = normalizeSiteUrl(config.siteUrl);
  const distDir = dist ?? (await findDist(root));

  const lokas = (await readJson(path.join(root, 'public/data/lokas.json'), { lokas: [] })).lokas ?? [];
  const nodes = (await readJson(path.join(root, 'public/data/family-tree.json'), { nodes: [] })).nodes ?? [];
  const pdfs = ((await readJson(path.join(distDir, 'data/reading-material/index.json'), { files: [] })).files ?? []).filter((f) => /\.pdf$/i.test(f.file));
  const pages = config.pages;
  const ctx = { site, config, pages, lokas, nodes, pdfs };

  const template = await readFile(path.join(distDir, 'index.html'), 'utf8');
  for (const page of pages) {
    const html = renderPage(template, { basePath, head: headFor(page, ctx), body: bodyFor(page, ctx) });
    const target = page.path ? path.join(distDir, page.path, 'index.html') : path.join(distDir, 'index.html');
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, html, 'utf8');
  }

  // 404.html: GitHub Pages serves it for any address that has no file. Not indexed; the app sends visitors home.
  const notFound = { path: '404', title: `Page not found | ${config.siteName}`, description: 'This page does not exist. Go back to the home page.', h1: 'Page not found', intro: 'This page does not exist.' };
  const nf = renderPage(template, { basePath, head: headFor(notFound, ctx), body: '', robots: 'noindex' })
    .replace(/<link rel="canonical"[^>]*>\s*/g, '')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g, '');
  await writeFile(path.join(distDir, '404.html'), nf, 'utf8');

  await writeFile(path.join(distDir, 'sitemap.xml'), sitemapXml({ site, pages, pdfs }), 'utf8');
  await writeFile(path.join(distDir, 'robots.txt'), robotsTxt(site), 'utf8');

  log(`seo: ${pages.length} pages, ${pdfs.length} PDFs in sitemap, 404.html, robots.txt written to ${path.relative(root, distDir) || '.'}`);
  log(`seo: site address used: ${site}/`);
  for (const w of warnings) log(`\n  !! ${w}\n`);
  return { distDir, site, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((e) => {
    console.error(`seo: ${e.message}`);
    process.exit(1);
  });
}
