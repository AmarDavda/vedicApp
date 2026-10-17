import { Injectable, computed, signal } from '@angular/core';
import {
  NodeInput, TreeFile, TreeNode, addChild, addConsort, collectSubtreeIds, createFreshTree,
  insertBetween, parseFile, removeNode, serialize, updateNode,
} from './tree-ops';

const DRAFT_KEY = 'family-tree:draft:v2';
const SEED_URL = 'data/family-tree.json';

/** Minimal typings for the File System Access API (Chrome / Edge). */
interface FileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}
const JSON_TYPES = [{ description: 'Family tree JSON', accept: { 'application/json': ['.json'] } }];

@Injectable({ providedIn: 'root' })
export class TreeStore {
  private readonly _file = signal<TreeFile>(createFreshTree());
  private handle: FileHandle | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;

  readonly file = this._file.asReadonly();
  readonly selectedId = signal<number>(1);
  readonly notice = signal<string>('');
  readonly linkedName = signal<string | null>(null);
  readonly autosave = signal(false);

  readonly json = computed(() => serialize(this._file()));
  readonly byId = computed(() => new Map(this._file().nodes.map((n) => [n.id, n])));
  readonly rootId = computed(() => this._file().nodes.find((n) => n.type === 'root')!.id);
  readonly selected = computed<TreeNode>(() => this.byId().get(this.selectedId()) ?? this.byId().get(this.rootId())!);
  readonly count = computed(() => this._file().nodes.length);

  /** parentId -> nodes hanging from it (consorts first, then children). */
  private readonly attachedMap = computed(() => {
    const map = new Map<number, TreeNode[]>();
    const rank = (n: TreeNode) => (n.type === 'consort' ? 0 : 1);
    for (const n of [...this._file().nodes].sort((a, b) => rank(a) - rank(b) || a.id - b.id)) {
      if (n.parentId === null) continue;
      const list = map.get(n.parentId);
      if (list) list.push(n);
      else map.set(n.parentId, [n]);
    }
    return map;
  });

  /** Insert-in-the-middle only makes sense when the selected node already has direct children. */
  readonly selectedHasChildren = computed(() => this.children(this.selectedId()).some((n) => n.type === 'child'));
  readonly canAddConsort = computed(() => this.selected().type !== 'consort');

  constructor() {
    const draft = this.readDraft();
    if (draft) {
      this._file.set(draft);
      this.selectedId.set(this.rootId());
    } else {
      void this.loadSeed();
    }
  }

  /** Everything hanging directly below a node: its consorts first, then its own children. */
  children(id: number): TreeNode[] {
    return this.attachedMap().get(id) ?? [];
  }
  /** How many nodes would disappear if `id` were deleted (itself included). */
  subtreeSize(id: number): number {
    return collectSubtreeIds(this._file(), id).length;
  }

  select(id: number): void {
    this.selectedId.set(id);
  }

  // ---- CRUD (all by id) -------------------------------------------------
  addConsort(input: NodeInput): void {
    const r = addConsort(this._file(), this.selectedId(), input);
    this.commit(r.file);
    this.selectedId.set(r.id);
  }
  addChild(input: NodeInput): void {
    const r = addChild(this._file(), this.selectedId(), input);
    this.commit(r.file);
    this.selectedId.set(r.id);
  }
  insertBetween(input: NodeInput): void {
    const r = insertBetween(this._file(), this.selectedId(), input);
    this.commit(r.file);
    this.selectedId.set(r.id);
  }
  update(input: NodeInput): void {
    this.commit(updateNode(this._file(), this.selectedId(), input).file);
  }
  remove(): void {
    const target = this.selected();
    const r = removeNode(this._file(), target.id);
    this.commit(r.file);
    this.selectedId.set(target.parentId ?? this.rootId());
    this.say(r.removedIds.length === 1 ? 'Deleted 1 node.' : `Deleted ${r.removedIds.length} nodes.`);
  }

  // ---- JSON file handling ----------------------------------------------
  async openFile(): Promise<void> {
    try {
      const w = window as any;
      if (w.showOpenFilePicker) {
        const [h]: FileHandle[] = await w.showOpenFilePicker({ types: JSON_TYPES });
        this.loadText(await (await h.getFile()).text());
        this.handle = h;
        this.linkedName.set(h.name);
      } else {
        const text = await this.pickWithInput();
        if (text !== null) this.loadText(text);
      }
    } catch (e) {
      this.reportError(e);
    }
  }

  async saveFile(): Promise<void> {
    try {
      const w = window as any;
      if (!this.handle && w.showSaveFilePicker) {
        this.handle = await w.showSaveFilePicker({ suggestedName: 'family-tree.json', types: JSON_TYPES });
        this.linkedName.set(this.handle!.name);
      }
      if (this.handle) {
        await this.write(this.handle);
        this.say(`Saved to ${this.handle.name}.`);
      } else {
        this.download();
        this.say('Downloaded family-tree.json.');
      }
    } catch (e) {
      this.reportError(e);
    }
  }

  setAutosave(on: boolean): void {
    this.autosave.set(on);
    if (on && this.handle) void this.autosaveNow();
  }

  /** Throw away the browser draft and reload the starting file (public/data/family-tree.json). */
  async reset(): Promise<void> {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch { /* storage unavailable */ }
    this.handle = null;
    this.linkedName.set(null);
    this.autosave.set(false);
    await this.loadSeed();
    this.say('Tree reset.');
  }

  // ---- internals --------------------------------------------------------
  private commit(file: TreeFile): void {
    this._file.set(file);
    try {
      localStorage.setItem(DRAFT_KEY, serialize(file));
    } catch { /* storage unavailable */ }
    if (this.autosave() && this.handle) void this.autosaveNow();
  }

  private loadText(text: string): void {
    const file = parseFile(text);
    this.commit(file);
    this.selectedId.set(this.rootId());
    this.say(`Loaded ${file.nodes.length} node${file.nodes.length === 1 ? '' : 's'}.`);
  }

  private async loadSeed(): Promise<void> {
    try {
      const res = await fetch(SEED_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this._file.set(parseFile(await res.text()));
    } catch {
      this._file.set(createFreshTree());
    }
    this.selectedId.set(this.rootId());
  }

  private readDraft(): TreeFile | null {
    try {
      const text = localStorage.getItem(DRAFT_KEY);
      return text ? parseFile(text) : null;
    } catch {
      return null;
    }
  }

  private async write(h: FileHandle): Promise<void> {
    const w = await h.createWritable();
    await w.write(this.json());
    await w.close();
  }

  private async autosaveNow(): Promise<void> {
    try {
      if (this.handle) await this.write(this.handle);
    } catch (e) {
      this.autosave.set(false);
      this.reportError(e);
    }
  }

  private download(): void {
    const url = URL.createObjectURL(new Blob([this.json()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'family-tree.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  private pickWithInput(): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async () => resolve(input.files?.[0] ? await input.files[0].text() : null);
      input.click();
    });
  }

  private say(message: string): void {
    this.notice.set(message);
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.notice.set(''), 4000);
  }

  private reportError(e: unknown): void {
    if (e instanceof DOMException && e.name === 'AbortError') return; // user closed the picker
    this.say(e instanceof Error ? e.message : 'Something went wrong.');
  }
}
