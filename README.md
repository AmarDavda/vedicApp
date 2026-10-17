# Vedic App (Angular, JSON only)

One Angular project, three pages, no server and no database — everything is stored as plain JSON.

| Page | Route | What it is |
| --- | --- | --- |
| **Home** | `#/` | navigation page with a card for each page (no top navbar here; the other pages have one) |
| **Vedic Cosmology** | `#/cosmology` | all lokas as nested boxes, editable, stored in `public/data/lokas.json` |
| **Vedic Genealogy** | `#/genealogy` | the family-tree app, stored in `public/data/family-tree.json` |
| **Other Vedic Reading Materials** | `#/reading` | read-only list of the PDFs you put in `public/data/reading-material/`, with search and 10 per page |

## Run

```bash
npm install
npm start            # http://localhost:4200  (also lists your PDFs and keeps watching the PDF folder)
npm run build        # production build (lists the PDFs first)
npm run pdfs         # only rebuild the PDF list
npm run test:logic   # tests for the tree, loka and reading rules (39 tests)
```

## Vedic Cosmology

Converted from the old `vedic.html` / `vedic.css`: 93 lokas, same nesting, same colours, plus one **root loka** ("Vedic Cosmos") that holds Brahmajyoti and Maya-loka — 94 in `public/data/lokas.json`.

```json
{
  "lastId": 3,
  "lokas": [
    { "id": 1, "name": "Brahmajyoti", "description": "", "color": "#fcfca0", "parentId": null },
    { "id": 2, "name": "Goloka", "description": "Krishna", "color": "#f95999", "parentId": 1 },
    { "id": 3, "name": "Vraj-Bhumi", "description": "Radha-Krishna", "color": "#e57622", "parentId": 2 }
  ]
}
```

- `id` – unique number, every new loka gets `lastId + 1` (never reused). `parentId` – the loka it sits inside; only the root has `null`.
- **There is always exactly one root loka.** You can edit it (name, description, colour) but never delete it, and it has no siblings. An older file with several top-level lokas is wrapped in a new root when opened.
- `color` – background `#rrggbb`. The text colour is worked out automatically (a deep or pale shade of the same colour, whichever reads better).
- Sibling order = order in the `lokas` array.

Click a loka to select it (click the empty page to deselect), then use the bar at the bottom:

| Button | Result |
| --- | --- |
| **+ Inside** | new loka inside the selected one (added last) |
| **+ Beside** | new loka right after the selected one, same level (not for the root) |
| **+ Middle** | new loka inside the selected one, and every loka that was directly inside it moves **into the new loka**. Example: *e* is in *b* → add *a* in the middle of *b* → *a* is in *b*, *e* is in *a*. Only enabled when the selected loka has lokas inside. |
| **Edit** | change name, description, colour (works on the root too) |
| **Delete** | removes the loka **and every loka inside it** (asks first). Disabled for the root. |

The ▾ / ▸ button on a loka folds it; **Collapse all / Expand all** fold everything (view only, not saved).

## Other Vedic Reading Materials

A **read-only** page: no upload, edit or delete — only the available PDFs, a search box and pagination (10 per page).

1. Copy your PDF files into `public/data/reading-material/` yourself.
2. They appear on the page. While `npm start` is running the folder is watched, so a new PDF shows up after a refresh; with `npm run build` the list is rebuilt first. (Using another server? run `npm run pdfs` once.)

Notes:
- A browser can't list a folder by itself, so `scripts/scan-pdfs.mjs` writes the generated list `public/data/reading-material/index.json` (don't edit it by hand).
- Only `.pdf` files directly inside that folder are listed (not sub-folders). The title is made from the file name: `Bhagavad_Gita_Chapter-1.pdf` → "Bhagavad Gita Chapter-1".
- Search: every word you type must appear in the title or file name; case and accents are ignored (*bhagavatam* finds *Śrīmad-Bhāgavatam*). A new search starts on page 1.
- **Read** opens the PDF in a new browser tab.

## Vedic Genealogy

Behaviour unchanged — see the rules below. (Its files moved into `src/app/genealogy/`.)

- A node's **consorts** hang **below** it (gold line, dashed card). Children hang from a consort, or directly from the node. Light blue = male, light pink = female, optional short description.
- `public/data/family-tree.json` starts with one node. Format: `{ lastId, nodes: [{ id, name, gender, description?, parentId, type }] }` with `type` = `root | consort | child`.
- Buttons: **+ Consort**, **+ Child**, **+ Middle** (new node takes over the selected node's children), **Edit**, **Delete** (removes everything below).

## Where the JSON lives (both pages)

Browsers can't silently write into your project folder, so:

- Every change updates the live JSON panel and a draft in the browser (survives refresh; each page keeps its own draft).
- **Save JSON** – Chrome/Edge: pick a file once, then it overwrites that same file; **Auto-save** writes on every change. Other browsers download the file.
- **Open** loads a saved file. **Reset** drops the draft and reloads the starting file from `public/data/`. To make a saved file the new starting point, copy it over the one in `public/data/`.

## Code map

```
src/app/
  app.*                shell: top navigation + router outlet      app.routes.ts: the routes
  home/                home page
  cosmology/           loka-ops.ts (all rules, pure, tested) · cosmos-store.ts · loka.* (recursive box) · loka-form.* · cosmology-page.*
  reading/             reading-ops.ts (search, pagination, list parsing; tested) · reading-page.*
  genealogy/           tree-ops.ts (rules, tested) · tree-store.ts · tree-branch.* · dialog* · genealogy-page.*
  shared/              json-file-io.ts (open / save / auto-save a JSON file)
public/data/           family-tree.json · lokas.json · reading-material/ (your PDFs + generated index.json)
scripts/               scan-pdfs.mjs (builds the PDF list) · dev.mjs (npm start: list + watch + ng serve)
```
