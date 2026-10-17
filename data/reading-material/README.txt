Put your PDF files in this folder (just copy them in).

They show up on the "Vedic Reading Materials" page. The list (index.json) is rebuilt
automatically by `npm start` (it keeps watching this folder) and by `npm run build`.
If you only copy files and use another server, run `npm run pdfs` once.

- Only .pdf files directly in this folder are listed (not sub-folders).
- The page title comes from the file name: "Bhagavad_Gita_Chapter-1.pdf" -> "Bhagavad Gita Chapter-1".
- Don't edit index.json by hand; it is generated.
