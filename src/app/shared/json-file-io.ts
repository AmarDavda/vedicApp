import { signal } from '@angular/core';

/** Minimal typings for the File System Access API (Chrome / Edge). */
interface FileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}
const JSON_TYPES = [{ description: 'JSON', accept: { 'application/json': ['.json'] } }];

/**
 * Opens / saves a JSON text file. In Chrome / Edge it keeps a handle so later saves overwrite the same file
 * (and auto-save can write on every change); other browsers fall back to upload / download.
 */
export class JsonFileIO {
  private handle: FileHandle | null = null;
  readonly linkedName = signal<string | null>(null);
  readonly autosave = signal(false);

  /** Let the user pick a JSON file. Resolves with its text, or null if they closed the picker. */
  async open(): Promise<string | null> {
    const w = window as any;
    if (w.showOpenFilePicker) {
      try {
        const [h]: FileHandle[] = await w.showOpenFilePicker({ types: JSON_TYPES });
        const text = await (await h.getFile()).text();
        this.handle = h;
        this.linkedName.set(h.name);
        return text;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return null;
        throw e;
      }
    }
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async () => resolve(input.files?.[0] ? await input.files[0].text() : null);
      input.click();
    });
  }

  /** Save text. Returns the file name used, or null if the user closed the save dialog. */
  async save(text: string, suggestedName: string): Promise<string | null> {
    const w = window as any;
    try {
      if (!this.handle && w.showSaveFilePicker) {
        this.handle = await w.showSaveFilePicker({ suggestedName, types: JSON_TYPES });
        this.linkedName.set(this.handle!.name);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return null;
      throw e;
    }
    if (this.handle) {
      await this.write(text);
      return this.handle.name;
    }
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);
    return suggestedName;
  }

  /** Overwrite the linked file (no-op when nothing is linked). */
  async write(text: string): Promise<void> {
    if (!this.handle) return;
    const w = await this.handle.createWritable();
    await w.write(text);
    await w.close();
  }

  get linked(): boolean {
    return this.handle !== null;
  }

  unlink(): void {
    this.handle = null;
    this.linkedName.set(null);
    this.autosave.set(false);
  }
}
