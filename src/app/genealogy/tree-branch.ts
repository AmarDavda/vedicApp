import { Component, computed, inject, input } from '@angular/core';
import { TreeStore } from './tree-store';

/**
 * One <li> of the tree: a node card and, recursively, a <ul> of everything hanging below it
 * (its consorts first, then its own children). Styling lives in src/styles.css (.tree).
 */
@Component({
  selector: 'li[appBranch]',
  templateUrl: './tree-branch.html',
  host: { '[class.is-consort]': 'node()?.type === "consort"' },
})
export class TreeBranch {
  protected readonly store = inject(TreeStore);
  readonly nodeId = input.required<number>();

  protected readonly node = computed(() => this.store.byId().get(this.nodeId()));
  protected readonly kids = computed(() => this.store.children(this.nodeId()));
}
