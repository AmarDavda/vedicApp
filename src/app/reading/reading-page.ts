import { Component, computed, signal } from '@angular/core';
import {
  PAGE_SIZE, ReadingItem, formatSize, pageWindow, paginate, parseManifest, search, toItems,
} from './reading-ops';

const MANIFEST_URL = 'data/reading-material/index.json';

/** Read-only list of the PDFs in public/data/reading-material/: search + 10 per page. */
@Component({
  selector: 'app-reading-page',
  templateUrl: './reading-page.html',
  styleUrl: './reading-page.css',
})
export class ReadingPage {
  protected readonly pageSize = PAGE_SIZE;
  protected readonly items = signal<ReadingItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly query = signal('');
  private readonly requestedPage = signal(1);

  protected readonly matches = computed(() => search(this.items(), this.query()));
  protected readonly view = computed(() => paginate(this.matches(), this.requestedPage()));
  protected readonly buttons = computed(() => pageWindow(this.view().page, this.view().pageCount));

  constructor() {
    void this.load();
  }

  protected onSearch(text: string): void {
    this.query.set(text);
    this.requestedPage.set(1); // a new search starts on page 1
  }

  protected clear(input: HTMLInputElement): void {
    this.onSearch('');
    input.value = '';
    input.focus();
  }

  protected go(page: number): void {
    this.requestedPage.set(page);
    // bring the top of the list back into view (matters on phones)
    setTimeout(() => document.getElementById('reading-top')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }

  protected size(bytes: number): string {
    return formatSize(bytes);
  }

  protected date(iso: string): string {
    const d = new Date(iso);
    return iso && !isNaN(d.getTime()) ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
  }

  private async load(): Promise<void> {
    try {
      const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.items.set(toItems(parseManifest(await res.text())));
    } catch (e) {
      this.error.set(
        e instanceof Error && e.message.startsWith('The reading list')
          ? e.message
          : 'Could not load the reading list (data/reading-material/index.json). Start the app with "npm start", or run "npm run pdfs".',
      );
    }
    this.loading.set(false);
  }
}
