import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-box',
  host: { '(document:keydown.escape)': 'cancelled.emit()' },
  template: `
    <div class="backdrop" (click)="cancelled.emit()">
      <div class="dialog" role="alertdialog" aria-modal="true" [attr.aria-label]="title()" (click)="$event.stopPropagation()">
        <h2>{{ title() }}</h2>
        <p>{{ message() }}</p>
        <div class="row">
          <button type="button" class="btn" (click)="cancelled.emit()">Cancel</button>
          <button type="button" class="btn danger" (click)="confirmed.emit()">{{ okText() }}</button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; background: rgba(59, 29, 29, 0.45); display: grid; place-items: center; z-index: 50; padding: 16px; }
    .dialog { background: #fffaf5; border: 1px solid #e2c7a0; border-radius: 14px; padding: 22px; width: min(440px, 100%); box-shadow: 0 20px 50px rgba(59, 29, 29, 0.35); display: grid; gap: 12px; }
    h2 { margin: 0; font: 700 20px/1.2 Georgia, serif; color: #3b1d1d; }
    p { margin: 0; line-height: 1.5; color: #5a3a3a; overflow-wrap: anywhere; }
    .row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px; }
    @media (max-width: 480px) {
      .backdrop { place-items: end center; padding: 0; }
      .dialog { width: 100%; border-radius: 16px 16px 0 0; padding: 18px 16px calc(18px + env(safe-area-inset-bottom)); }
      .row .btn { flex: 1; padding: 12px; }
    }
  `,
})
export class ConfirmBox {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly okText = input('Delete');
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
}
