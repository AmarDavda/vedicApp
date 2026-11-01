# SEO guide for the Vedic App (step by step)

Everything the code can do is already done. This file lists **what only you can do**, in order. Do steps 1 to 6 first; they matter most.

## What is already done in the project

- Real page addresses instead of `#/…` (Google ignores everything after `#`). Old `#/cosmology` links redirect automatically.
- Each page (`/`, `/cosmology/`, `/genealogy/`, `/reading/`) gets its own title, description, canonical link, social-share tags and structured data, plus plain readable text (lokas, family tree, PDF links) inside the page for Google.
- `sitemap.xml` (pages + every PDF), `robots.txt`, `404.html`, favicon, share image (`og-image.png`) are generated at build time.
- Home page has an "About" text section. PDF links have descriptive labels.
- `npm run check:seo` tells you what is wrong after a build.

## 1. Fill in your website address

Open `site.config.json` and change `siteUrl` to your live address, no trailing slash:

- Project site: `https://YOUR-NAME.github.io/YOUR-REPO`
- Custom domain: `https://yourdomain.com`

## 2. Hook the SEO step into your build

In **your** `package.json`, in `"scripts"`, add:

```json
"postbuild": "node scripts/postbuild-seo.mjs",
"check:seo": "node scripts/check-seo.mjs",
"test:seo": "node scripts/seo.test.mjs"
```

Then build with **`npm run build`** (this runs `postbuild` automatically). For a project site use
`npx ng build --base-href /YOUR-REPO/` (the script then fixes the `<base>` for you), then `npm run postbuild` if you run `ng build` directly.
`ng deploy` / `angular-cli-ghpages` do **not** run `postbuild`; build first with `npm run build`, then deploy the folder `dist/<project>/browser` (e.g. `npx angular-cli-ghpages --dir=dist/<project>/browser`).

Run `npm run check:seo`. Fix every line that says `FIX`.

## 3. Check it works once deployed

1. Open `https://YOUR-SITE/cosmology/` directly in a new tab. It must load the page (not 404).
2. Open `https://YOUR-SITE/sitemap.xml` and `https://YOUR-SITE/robots.txt`. Both must show text.
3. Right-click a page, "View page source". You should see your `<title>`, description, and readable text inside `<app-root>`.

## 4. Google Search Console (free, essential)

1. Go to search.google.com/search-console, **Add property**, choose **URL prefix**, enter your full address (with `https://` and trailing `/`).
2. Choose **HTML tag** verification. Copy only the code inside `content="…"`.
3. Paste it into `googleSiteVerification` in `site.config.json`, rebuild and deploy, then click **Verify**.
4. **Sitemaps** menu, enter `sitemap.xml`, **Submit**.
5. **URL Inspection**, paste each of your 4 page addresses, click **Request indexing**.

Indexing usually takes a few days to a few weeks. Check **Pages** report for problems.

## 5. Bing (optional, 5 minutes)

bing.com/webmasters, sign in, **Import from Google Search Console**. That also covers DuckDuckGo and others.

## 6. robots.txt on a GitHub project site

Crawlers read `robots.txt` only at the root of a domain (`youruser.github.io/robots.txt`), not inside `/repo/`. On a project site yours is therefore ignored. That is fine: everything is allowed by default, and the sitemap is submitted in Search Console. If you want a working robots.txt, use a custom domain or name the repo `YOUR-USER.github.io`.

## 7. PDFs (your Reading Materials)

- Google indexes PDFs and shows their **Title** in results. In Acrobat: File, Properties, Description, **Title**. Or: `exiftool -Title="Shikshapatri" file.pdf`.
- Use descriptive file names: `Shikshapatri (by Amar Davda).pdf`, not `scan001.pdf`. The page title shown in the app comes from the file name.
- Keep files under about 50 MB. Run `npm run scan-pdfs` (your existing script) after adding PDFs, then rebuild.

## 8. Titles and descriptions (what you can edit)

All in `site.config.json`, one block per page. Rules:

- Title about 50 to 60 characters, unique per page, main keyword first.
- Description 120 to 155 characters, written like a sentence that makes someone click.
- If you change a title there, also change the same title in `src/app/app.routes.ts` (a test, `npm run test:seo`, warns if they differ).
- Headings: one `<h1>` per page (already so).

## 9. Alt text

The app currently has no `<img>` pictures, and decorative icons are hidden from screen readers on purpose. If you add a picture later, always write `alt="what the picture shows"` (e.g. `alt="Family tree chart of the Yadu dynasty"`), and `alt=""` for pure decoration. The share image has its description in `og:image:alt`.

## 10. Get found (this is what ranks you)

- Add real text: a short paragraph about each loka, a "Sources" page, blog-style notes. Google ranks content.
- Get links to your site: your GitHub README, social profiles, relevant forums and communities, friends' websites.
- Share the link on WhatsApp / Facebook to test the preview image.

## 11. Test tools (all free)

- Google search `site:YOUR-SITE` shows what is indexed.
- search.google.com/test/rich-results (structured data)
- pagespeed.web.dev (speed on mobile)
- Search Console, **Performance** shows the searches that bring visitors.

## Honest expectations

Nobody can guarantee a ranking. A new site is normally indexed within days to weeks, and ranks for specific phrases (like your exact app name) first. Broad terms ("Vedic cosmology") need content and links over months.

## Optional: custom domain

Buy a domain, in the repo **Settings, Pages, Custom domain** enter it, add the DNS records GitHub shows, tick **Enforce HTTPS**, then update `siteUrl`. A root domain also makes `robots.txt` work.
