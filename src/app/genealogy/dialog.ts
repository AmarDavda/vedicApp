import { Component, ElementRef, computed, effect, inject, viewChild } from '@angular/core';
import { DialogService } from './dialog.service';
import { MAX_DESCRIPTION, MAX_NAME } from './tree-ops';

@Component({
  selector: 'app-dialog',
  host: { '(document:keydown.escape)': 'dialog.cancel()' },
  templateUrl: './dialog.html',
  styleUrl: './dialog.css',
})
export class Dialog {
  protected readonly dialog = inject(DialogService);
  protected readonly maxName = MAX_NAME;
  protected readonly maxDescription = MAX_DESCRIPTION;
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  /** Only flips when the dialog opens or closes, NOT on every keystroke (state changes while typing). */
  private readonly isOpen = computed(() => this.dialog.state() !== null);

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        setTimeout(() => {
          const el = this.field()?.nativeElement;
          el?.focus();
          el?.select();
        });
      }
    });
  }
}
