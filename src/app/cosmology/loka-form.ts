import { AfterViewInit, Component, ElementRef, OnInit, input, output, signal, viewChild } from '@angular/core';
import { LokaInput, MAX_DESCRIPTION, MAX_NAME, normalizeColor } from './loka-ops';

/** Add / edit form for one loka: name, description, colour. */
@Component({
  selector: 'app-loka-form',
  templateUrl: './loka-form.html',
  styleUrl: './loka-form.css',
  host: { '(document:keydown.escape)': 'cancelled.emit()' },
})
export class LokaForm implements OnInit, AfterViewInit {
  readonly title = input.required<string>();
  readonly hint = input('');
  readonly okText = input('Save');
  readonly initial = input.required<LokaInput>();
  readonly selectName = input(false); // pre-select the name once on open (edit mode)

  readonly saved = output<LokaInput>();
  readonly cancelled = output<void>();

  protected readonly maxName = MAX_NAME;
  protected readonly maxDescription = MAX_DESCRIPTION;
  protected readonly swatches = ['#fcfca0', '#f95999', '#e57622', '#ffd700', '#e7ffc3', '#807ec9', '#98fefe', '#71d6d6', '#0f910f', '#048a97', '#435789', '#c89f6f', '#ad2647', '#2f3c5f'];

  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly color = signal('#e8e8e8');
  protected readonly hexText = signal('#e8e8e8');
  protected readonly hexValid = signal(true);

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  ngOnInit(): void {
    const i = this.initial();
    this.name.set(i.name);
    this.description.set(i.description);
    this.color.set(i.color);
    this.hexText.set(i.color);
  }

  // focus once, when the form opens (not on every keystroke)
  ngAfterViewInit(): void {
    setTimeout(() => {
      const el = this.field()?.nativeElement;
      el?.focus();
      if (this.selectName()) el?.select();
    });
  }

  protected pick(hex: string): void {
    this.color.set(hex);
    this.hexText.set(hex);
    this.hexValid.set(true);
  }

  protected typeHex(text: string): void {
    this.hexText.set(text);
    try {
      this.color.set(normalizeColor(text));
      this.hexValid.set(true);
    } catch {
      this.hexValid.set(false);
    }
  }

  protected submit(): void {
    const name = this.name().trim();
    if (!name || !this.hexValid()) return;
    this.saved.emit({ name, description: this.description().trim(), color: this.color() });
  }
}
