import { Component, inject, signal } from '@angular/core';
import { Dialog } from './dialog';
import { DialogService } from './dialog.service';
import { TreeBranch } from './tree-branch';
import { TreeStore } from './tree-store';
import { oppositeGender } from './tree-ops';

@Component({
  selector: 'app-genealogy-page',
  imports: [TreeBranch, Dialog],
  templateUrl: './genealogy-page.html',
  styleUrl: './genealogy-page.css',
})
export class GenealogyPage {
  protected readonly store = inject(TreeStore);
  private readonly dialog = inject(DialogService);

  /** JSON panel: open on wide screens, closed on phones. */
  protected readonly showJson = signal(typeof window === 'undefined' || window.innerWidth > 800);
  protected readonly zoom = signal(1);
  private pan: { x: number; y: number; left: number; top: number } | null = null;

  constructor() {
    this.reveal(); // start with the selected node centred, handy on phones
  }

  protected async addConsort(): Promise<void> {
    const s = this.store.selected();
    const input = await this.dialog.form('Add consort', {
      hint: `Wife / husband of #${s.id} ${s.name}`,
      gender: oppositeGender(s.gender),
      okText: 'Add',
    });
    if (input) {
      this.store.addConsort(input);
      this.reveal();
    }
  }

  protected async addChild(): Promise<void> {
    const s = this.store.selected();
    const input = await this.dialog.form('Add child', {
      hint: s.type === 'consort' ? `Child of consort #${s.id} ${s.name}` : `Child of #${s.id} ${s.name}`,
      okText: 'Add',
    });
    if (input) {
      this.store.addChild(input);
      this.reveal();
    }
  }

  protected async addMiddle(): Promise<void> {
    const s = this.store.selected();
    const input = await this.dialog.form('Add in the middle', {
      hint: `New node goes below #${s.id} ${s.name}; its current children move under the new node.`,
      okText: 'Insert',
    });
    if (input) {
      this.store.insertBetween(input);
      this.reveal();
    }
  }

  protected async edit(): Promise<void> {
    const s = this.store.selected();
    const input = await this.dialog.form(`Edit #${s.id}`, {
      name: s.name, gender: s.gender, description: s.description ?? '', okText: 'Save',
    });
    if (input) this.store.update(input);
  }

  protected async remove(): Promise<void> {
    const s = this.store.selected();
    const n = this.store.subtreeSize(s.id);
    const extra = n > 1 ? ` This also deletes ${n - 1} connected node${n === 2 ? '' : 's'} below it (consorts, children and their descendants).` : '';
    const ok = await this.dialog.confirm('Delete node', `Delete #${s.id} ${s.name}?${extra}`, 'Delete', true);
    if (ok) this.store.remove();
  }

  protected async reset(): Promise<void> {
    const ok = await this.dialog.confirm(
      'Reset tree',
      'This discards the current tree in the browser and reloads data/family-tree.json (a single node). Save first if you want to keep it.',
      'Reset',
      true,
    );
    if (ok) await this.store.reset();
  }

  // ---- zoom + drag-to-pan (touch devices scroll natively) -----------------
  protected zoomBy(delta: number): void {
    this.zoom.update((z) => Math.min(1.6, Math.max(0.4, Math.round((z + delta) * 10) / 10)));
  }

  protected panStart(e: PointerEvent, canvas: HTMLElement): void {
    if (e.pointerType !== 'mouse' || e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    this.pan = { x: e.clientX, y: e.clientY, left: canvas.scrollLeft, top: canvas.scrollTop };
  }

  protected panMove(e: PointerEvent, canvas: HTMLElement): void {
    if (!this.pan) return;
    canvas.scrollLeft = this.pan.left - (e.clientX - this.pan.x);
    canvas.scrollTop = this.pan.top - (e.clientY - this.pan.y);
  }

  protected panEnd(): void {
    this.pan = null;
  }

  /** Scroll the newly selected card into view after it has rendered. */
  private reveal(): void {
    setTimeout(() => {
      document.querySelector('.card.selected')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }, 60);
  }
}
