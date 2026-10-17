import { Injectable, signal } from '@angular/core';
import { Gender, NodeInput } from './tree-ops';

export interface DialogState {
  kind: 'form' | 'confirm';
  title: string;
  message: string;
  okText: string;
  danger: boolean;
  /** form fields */
  name: string;
  gender: Gender;
  description: string;
  /** hint shown above the form, e.g. who the new node attaches to */
  hint: string;
}

@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly state = signal<DialogState | null>(null);
  private resolver: ((result: NodeInput | boolean | null) => void) | null = null;

  /** Name + gender + optional note. Resolves with the data, or null if cancelled. */
  form(
    title: string,
    opts: { hint?: string; name?: string; gender?: Gender; description?: string; okText?: string } = {},
  ): Promise<NodeInput | null> {
    return this.open({
      kind: 'form', title, message: '', danger: false,
      okText: opts.okText ?? 'Save', hint: opts.hint ?? '',
      name: opts.name ?? '', gender: opts.gender ?? 'male', description: opts.description ?? '',
    }) as Promise<NodeInput | null>;
  }

  confirm(title: string, message: string, okText = 'OK', danger = false): Promise<boolean> {
    return this.open({
      kind: 'confirm', title, message, okText, danger, hint: '', name: '', gender: 'male', description: '',
    }).then((r) => r === true);
  }

  patch(changes: Partial<Pick<DialogState, 'name' | 'gender' | 'description'>>): void {
    const s = this.state();
    if (s) this.state.set({ ...s, ...changes });
  }

  accept(): void {
    const s = this.state();
    if (!s) return;
    if (s.kind === 'form') {
      const name = s.name.trim();
      if (!name) return; // keep the dialog open until a name is typed
      this.finish({ name, gender: s.gender, description: s.description.trim() });
    } else {
      this.finish(true);
    }
  }

  cancel(): void {
    this.finish(null);
  }

  private open(state: DialogState): Promise<NodeInput | boolean | null> {
    this.resolver?.(null);
    this.state.set(state);
    return new Promise((resolve) => (this.resolver = resolve));
  }

  private finish(result: NodeInput | boolean | null): void {
    const resolve = this.resolver;
    this.resolver = null;
    this.state.set(null);
    resolve?.(result);
  }
}
