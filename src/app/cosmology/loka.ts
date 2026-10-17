import { Component, computed, inject, input } from '@angular/core';
import { CosmosStore } from './cosmos-store';
import { readableText } from './loka-ops';

/** One loka box. Renders its own sub-lokas recursively, like nested <div>s in the original page. */
@Component({
  selector: 'app-loka',
  templateUrl: './loka.html',
  styleUrl: './loka.css',
})
export class LokaView {
  protected readonly store = inject(CosmosStore);
  readonly lokaId = input.required<number>();
  readonly depth = input(0);

  protected readonly loka = computed(() => this.store.byId().get(this.lokaId()));
  protected readonly kids = computed(() => this.store.children(this.lokaId()));
  protected readonly textColor = computed(() => readableText(this.loka()?.color ?? '#e8e8e8'));
  protected readonly isCollapsed = computed(() => this.store.collapsed().has(this.lokaId()));
  protected readonly hidden = computed(() => (this.isCollapsed() ? this.store.subtreeSize(this.lokaId()) - 1 : 0));
  protected readonly level = computed(() => Math.min(this.depth(), 3));

  protected select(event: Event): void {
    event.stopPropagation(); // don't also select the loka this one is inside
    this.store.select(this.lokaId());
  }

  protected fold(event: Event): void {
    event.stopPropagation();
    this.store.toggle(this.lokaId());
  }
}
