import { Injectable, computed, signal } from '@angular/core';
import { JsonFileIO } from '../shared/json-file-io';
import {
  Loka, LokaFile, LokaInput, addBeside, addInside, addMiddle, childrenOf, collectSubtreeIds, createFreshFile, parseFile,
  removeLoka, serialize, updateLoka,
} from './loka-ops';

const DRAFT_KEY = 'vedic:lokas:draft';
const SEED_URL = 'data/lokas.json';

@Injectable({ providedIn: 'root' })
export class CosmosStore {
  private readonly _file = signal<LokaFile>(createFreshFile());
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;
  readonly io = new JsonFileIO();

  readonly file = this._file.asReadonly();
  readonly selectedId = signal<number | null>(null);
  readonly collapsed = signal<ReadonlySet<number>>(new Set());
  readonly notice = signal('');
  readonly loading = signal(true);

  readonly json = computed(() => serialize(this._file()));
  readonly count = computed(() => this._file().lokas.length);
  readonly byId = computed(() => new Map(this._file().lokas.map((l) => [l.id, l])));
  /** The one root loka: it can be edited but never deleted and has no siblings. */
  readonly rootId = computed(() => this._file().lokas.find((l) => l.parentId === null)!.id);
  readonly selectedIsRoot = computed(() => this.selectedId() !== null && this.selectedId() === this.rootId());
  /** "+ Middle" only makes sense when the selected loka already has lokas directly inside it. */
  readonly selectedHasChildren = computed(() => {
    const id = this.selectedId();
    return id !== null && this.children(id).length > 0;
  });
  readonly selected = computed<Loka | null>(() => {
    const id = this.selectedId();
    return id === null ? null : (this.byId().get(id) ?? null);
  });

  /** parentId (null = top level) -> lokas inside it, in sibling order */
  private readonly childMap = computed(() => {
    const map = new Map<number | null, Loka[]>();
    for (const l of this._file().lokas) {
      const list = map.get(l.parentId);
      if (list) list.push(l);
      else map.set(l.parentId, [l]);
    }
    return map;
  });

  constructor() {
    const draft = this.readDraft();
    if (draft) {
      this._file.set(draft);
      this.loading.set(false);
    } else {
      void this.loadSeed();
    }
  }

  children(parentId: number | null): Loka[] {
    return this.childMap().get(parentId) ?? [];
  }

  /** How many lokas disappear if `id` is deleted (itself included). */
  subtreeSize(id: number): number {
    return collectSubtreeIds(this._file(), id).length;
  }

  select(id: number | null): void {
    this.selectedId.set(id);
  }

  // ---- CRUD (all by id) ----------------------------------------------------
  /** Add as the last loka inside `parentId`. */
  addInside(parentId: number, input: LokaInput): void {
    const r = addInside(this._file(), parentId, input);
    this.expand(parentId); // make sure the new loka is visible
    this.commit(r.file);
    this.selectedId.set(r.id);
  }
  /** Add inside `parentId`, and move everything that was directly inside it into the new loka. */
  addMiddle(parentId: number, input: LokaInput): void {
    const r = addMiddle(this._file(), parentId, input);
    this.expand(parentId);
    this.commit(r.file);
    this.selectedId.set(r.id);
  }
  addBeside(siblingId: number, input: LokaInput): void {
    const r = addBeside(this._file(), siblingId, input);
    this.commit(r.file);
    this.selectedId.set(r.id);
  }
  update(id: number, input: LokaInput): void {
    this.commit(updateLoka(this._file(), id, input).file);
  }
  remove(id: number): void {
    const target = this.byId().get(id);
    const r = removeLoka(this._file(), id);
    this.commit(r.file);
    this.selectedId.set(target?.parentId ?? null);
    this.say(r.removedIds.length === 1 ? 'Deleted 1 loka.' : `Deleted ${r.removedIds.length} lokas.`);
  }

  // ---- collapse / expand (view only, not saved) -----------------------------
  toggle(id: number): void {
    const next = new Set(this.collapsed());
    if (!next.delete(id)) next.add(id);
    this.collapsed.set(next);
  }
  private expand(id: number): void {
    // open the loka and every ancestor so a newly added child is on screen
    const next = new Set(this.collapsed());
    for (let cur: Loka | undefined = this.byId().get(id); cur; cur = cur.parentId === null ? undefined : this.byId().get(cur.parentId)) {
      next.delete(cur.id);
    }
    this.collapsed.set(next);
  }
  collapseAll(): void {
    // fold every loka that has lokas inside, except the root, so the first level stays visible
    this.collapsed.set(
      new Set(this._file().lokas.filter((l) => l.parentId !== null && childrenOf(this._file(), l.id).length > 0).map((l) => l.id)),
    );
  }
  expandAll(): void {
    this.collapsed.set(new Set());
  }

  // ---- JSON file handling --------------------------------------------------
  async openFile(): Promise<void> {
    try {
      const text = await this.io.open();
      if (text === null) return;
      const file = parseFile(text);
      this.commit(file);
      this.selectedId.set(null);
      this.collapsed.set(new Set());
      this.say(`Loaded ${file.lokas.length} loka${file.lokas.length === 1 ? '' : 's'}.`);
    } catch (e) {
      this.say(e instanceof Error ? e.message : 'Could not open the file.');
    }
  }

  async saveFile(): Promise<void> {
    try {
      const name = await this.io.save(this.json(), 'lokas.json');
      if (name) this.say(this.io.linked ? `Saved to ${name}.` : `Downloaded ${name}.`);
    } catch (e) {
      this.say(e instanceof Error ? e.message : 'Could not save the file.');
    }
  }

  setAutosave(on: boolean): void {
    this.io.autosave.set(on);
    if (on) void this.autosaveNow();
  }

  /** Throw away the browser draft and reload the original lokas (public/data/lokas.json). */
  async reset(): Promise<void> {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch { /* storage unavailable */ }
    this.io.unlink();
    this.selectedId.set(null);
    this.collapsed.set(new Set());
    await this.loadSeed();
    this.say('Reset to the original lokas.');
  }

  // ---- internals -------------------------------------------------------------
  private commit(file: LokaFile): void {
    this._file.set(file);
    try {
      localStorage.setItem(DRAFT_KEY, serialize(file));
    } catch { /* storage unavailable */ }
    if (this.io.autosave() && this.io.linked) void this.autosaveNow();
  }

  private async autosaveNow(): Promise<void> {
    try {
      await this.io.write(this.json());
    } catch (e) {
      this.io.autosave.set(false);
      this.say(e instanceof Error ? e.message : 'Auto-save failed.');
    }
  }

  private async loadSeed(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await fetch(SEED_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this._file.set(parseFile(await res.text()));
    } catch {
      this._file.set(createFreshFile());
      this.say('Could not load data/lokas.json — starting empty.');
    }
    this.loading.set(false);
  }

  private readDraft(): LokaFile | null {
    try {
      const text = localStorage.getItem(DRAFT_KEY);
      return text ? parseFile(text) : null;
    } catch {
      return null;
    }
  }

  private say(message: string): void {
    this.notice.set(message);
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.notice.set(''), 4000);
  }
}
