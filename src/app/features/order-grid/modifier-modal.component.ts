// src/app/features/order-grid/modifier-modal.component.ts
import { Component, computed, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product, ModifierGroup, ModifierOption, SelectedModifier } from '../../core/modals';

@Component({
  selector: 'app-modifier-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div class="bg-slate-800 border border-slate-700 w-full max-w-lg rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
        
        <!-- MODAL HEADER -->
        <div class="flex justify-between items-center border-b border-slate-700 pb-4 mb-4">
          <div>
            <h2 class="text-xl font-extrabold text-white">{{ product.name }}</h2>
            <p class="text-xs text-amber-400 font-bold mt-0.5">Base Price: €{{ product.price.toFixed(2) }}</p>
          </div>
          <button (click)="cancel.emit()" class="text-slate-400 hover:text-white text-2xl font-bold cursor-pointer">✕</button>
        </div>

        <!-- MODIFIER GROUPS LIST -->
        <div class="flex-1 overflow-y-auto space-y-6 pr-1">
          @for (group of modifierGroups; track group.id) {
            <div class="bg-slate-900 border border-slate-700/80 p-4 rounded-2xl">
              <div class="flex justify-between items-center mb-3">
                <span class="text-sm font-bold text-slate-200 uppercase tracking-wider">{{ group.name }}</span>
                <span class="text-xs text-slate-400">
                  {{ (group.minSelect ?? 0) > 0 ? 'Required' : 'Optional' }}
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                @for (opt of group.options; track opt.id) {
                  <button 
                    (click)="toggleOption(group, opt)"
                    [class.bg-amber-500]="isSelected(group.id, opt.id)"
                    [class.text-slate-950]="isSelected(group.id, opt.id)"
                    [class.bg-slate-800]="!isSelected(group.id, opt.id)"
                    [class.text-slate-200]="!isSelected(group.id, opt.id)"
                    class="p-3 rounded-xl border border-slate-700 font-bold text-sm flex justify-between items-center transition cursor-pointer active:scale-95">
                    <span>{{ opt.name }}</span>
                    @if ((opt.priceExtra ?? 0) > 0) {
                      <span class="text-emerald-400 font-bold">+€{{ (opt.priceExtra ?? 0).toFixed(2) }}</span>
                    } @else {
                      <span class="text-slate-500">Free</span>
                    }
                  </button>
                }
              </div>
            </div>
          }
        </div>

        <!-- MODAL FOOTER WITH CALCULATED TOTAL -->
        <div class="border-t border-slate-700 pt-4 mt-4 flex gap-3 items-center">
          <button (click)="cancel.emit()" class="py-3.5 px-5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-sm cursor-pointer">
            Cancel
          </button>
          
          <button 
            (click)="confirmSelection()" 
            class="flex-1 py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base shadow-lg flex justify-between items-center cursor-pointer active:scale-95">
            <span>Add to Order</span>
            <span>€{{ calculatedTotalPrice().toFixed(2) }}</span>
          </button>
        </div>

      </div>
    </div>
  `
})
export class ModifierModalComponent {
  @Input({ required: true }) product!: Product;
  @Input() modifierGroups: ModifierGroup[] = [];
  
  @Output() confirm = new EventEmitter<{
    product: Product;
    selectedModifiers: SelectedModifier[];
    totalPrice: number;
  }>();
  @Output() cancel = new EventEmitter<void>();

  public selectedModifierOptions = signal<Record<string, string[]>>({});

  /**
   * Checks whether a given modifier option is currently selected
   */
  public isSelected(groupId: string, optionId: string): boolean {
    const selections = this.selectedModifierOptions();
    return selections[groupId]?.includes(optionId) ?? false;
  }

  /**
   * Calculates total price: base product price + extra charges from selected modifiers
   */
  public calculatedTotalPrice = computed<number>(() => {
    if (!this.product) return 0;
    
    let total = this.product.price;
    const selections = this.selectedModifierOptions();

    for (const group of this.modifierGroups) {
      const selectedIds = selections[group.id] || [];
      for (const optId of selectedIds) {
        const option = group.options?.find((o: ModifierOption) => o.id === optId);
        if (option?.priceExtra) {
          total += option.priceExtra;
        }
      }
    }

    return total;
  });

  /**
   * Handles option toggles for radio or multi-select groups
   */
  public toggleOption(group: ModifierGroup, option: ModifierOption): void {
    const current = { ...this.selectedModifierOptions() };
    const groupSelections = current[group.id] ? [...current[group.id]] : [];
    const maxAllowed = group.maxSelect ?? group.maxSelections ?? 1;

    if (maxAllowed === 1) {
      current[group.id] = [option.id];
    } else {
      const index = groupSelections.indexOf(option.id);
      if (index > -1) {
        groupSelections.splice(index, 1);
      } else if (groupSelections.length < maxAllowed) {
        groupSelections.push(option.id);
      }
      current[group.id] = groupSelections;
    }

    this.selectedModifierOptions.set(current);
  }

  /**
   * Emits complete custom item payload expected by parent component
   */
  public confirmSelection(): void {
    const formattedModifiers: SelectedModifier[] = [];
    const selections = this.selectedModifierOptions();

    for (const group of this.modifierGroups) {
      const selectedIds = selections[group.id] || [];
      for (const optId of selectedIds) {
        const option = group.options?.find((o: ModifierOption) => o.id === optId);
        if (option) {
          formattedModifiers.push({
            groupId: group.id,
            groupName: group.name,
            optionId: option.id,
            optionName: option.name,
            priceExtra: option.priceExtra ?? 0
          });
        }
      }
    }

    this.confirm.emit({
      product: this.product,
      selectedModifiers: formattedModifiers,
      totalPrice: this.calculatedTotalPrice()
    });
  }

  public closeModal(): void {
    this.cancel.emit();
  }
}