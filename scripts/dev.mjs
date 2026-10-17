// `npm start`: list the PDFs, keep the list up to date while you add / remove PDFs, and run `ng serve`.
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { DIR, MANIFEST, scan } from './scan-pdfs.mjs';

const first = await scan();
console.log(`reading-material: ${first.length} PDF${first.length === 1 ? '' : 's'} found (drop more PDFs into public/data/reading-material/ any time)`);

let timer;
try {
  watch(DIR, (_event, name) => {
    if (name === MANIFEST) return; // our own write
    clearTimeout(timer);
    timer = setTimeout(() => scan().then((f) => console.log(`reading-material: now ${f.length} PDF${f.length === 1 ? '' : 's'}`)).catch(console.error), 400);
  });
} catch (e) {
  console.warn('reading-material: could not watch the folder; run "npm run pdfs" after adding PDFs.', e.message);
}

const ng = spawn('ng', ['serve', ...process.argv.slice(2)], { stdio: 'inherit', shell: true });
ng.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => ng.kill(sig));
