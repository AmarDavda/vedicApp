import { Component, inject, signal } from '@angular/core';
import { ConfirmBox } from './confirm-box';
import { CosmosStore } from './cosmos-store';
import { LokaView } from './loka';
import { LokaForm } from './loka-form';
import { DEFAULT_COLOR, LokaInput } from './loka-ops';

type FormMode = 'inside' | 'beside' | 'middle' | 'edit';

interface FormState {
  mode: FormMode;
  title: string;
  hint: string;
  okText: string;
  initial: LokaInput;
}

@Component({
  selector: 'app-cosmology-page',
  imports: [LokaView, LokaForm, ConfirmBox],
  templateUrl: './cosmology-page.html',
  styleUrl: './cosmology-page.css',
})
export class CosmologyPage {
  protected readonly store = inject(CosmosStore);
  protected readonly showJson = signal(false);
  protected readonly form = signal<FormState | null>(null);
  protected readonly confirmReset = signal(false);
  protected readonly confirmDelete = signal<{ title: string; message: string } | null>(null);

  // ---- open the add / edit form ---------------------------------------------
  protected addInside(): void {
    const s = this.store.selected();
    if (!s) return;
    this.form.set({
      mode: 'inside', title: 'Add loka inside', okText: 'Add',
      hint: `It will be placed inside #${s.id} ${s.name}.`,
      initial: { name: '', description: '', color: DEFAULT_COLOR },
    });
  }

  protected addBeside(): void {
    const s = this.store.selected();
    if (!s) return;
    this.form.set({
      mode: 'beside', title: 'Add loka beside', okText: 'Add',
      hint: `It will sit right after #${s.id} ${s.name}, at the same level.`,
      initial: { name: '', description: '', color: s.color },
    });
  }

  protected addMiddle(): void {
    const s = this.store.selected();
    if (!s) return;
    this.form.set({
      mode: 'middle', title: 'Add loka in the middle', okText: 'Insert',
      hint: `It goes inside #${s.id} ${s.name}, and everything now directly inside ${s.name} moves inside the new loka.`,
      initial: { name: '', description: '', color: DEFAULT_COLOR },
    });
  }

  protected edit(): void {
    const s = this.store.selected();
    if (!s) return;
    this.form.set({
      mode: 'edit', title: `Edit #${s.id}`, okText: 'Save', hint: '',
      initial: { name: s.name, description: s.description, color: s.color },
    });
  }

  protected onSaved(input: LokaInput): void {
    const f = this.form();
    const s = this.store.selected();
    this.form.set(null);
    if (!f) return;
    if (f.mode === 'edit' && s) this.store.update(s.id, input);
    else if (f.mode === 'inside' && s) this.store.addInside(s.id, input);
    else if (f.mode === 'beside' && s) this.store.addBeside(s.id, input);
    else if (f.mode === 'middle' && s) this.store.addMiddle(s.id, input);
    if (f.mode !== 'edit') this.reveal();
  }

  // ---- delete / reset ---------------------------------------------------------
  protected askDelete(): void {
    const s = this.store.selected();
    if (!s) return;
    const n = this.store.subtreeSize(s.id);
    const extra = n > 1 ? ` This also deletes the ${n - 1} loka${n === 2 ? '' : 's'} inside it.` : '';
    this.confirmDelete.set({ title: 'Delete loka', message: `Delete #${s.id} ${s.name}?${extra}` });
  }

  protected doDelete(): void {
    const s = this.store.selected();
    this.confirmDelete.set(null);
    if (s) this.store.remove(s.id);
  }

  protected async doReset(): Promise<void> {
    this.confirmReset.set(false);
    await this.store.reset();
  }

  /** Scroll the newly added loka into view after it has rendered. */
  private reveal(): void {
    setTimeout(() => document.querySelector('.loka.selected')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80);
  }
}
