// src/app/core/services/invoice-bridge.service.ts

import { Injectable, inject } from '@angular/core';
import { Firestore, doc, setDoc, onSnapshot, Unsubscribe } from '@angular/fire/firestore';
import { TenantContextService } from './tenant-context.service';
import { environment } from '../../../environments/environments';

export interface InvoiceHandoffItem {
  name: string;
  quantity: number;
  unitPriceGross: number;
  vatRate: number; // e.g. 13 or 24
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
}

export interface InvoiceHandoffPayload {
  id: string;
  tenantId: string;
  storeId: string;
  saleId: string;
  tableLabel: string;
  issuerAfm: string;
  issuerName: string;
  paymentMethod: 'CASH' | 'CARD' | 'SPLIT';
  totalGross: number;
  totalNet: number;
  totalVat: number;
  items: InvoiceHandoffItem[];
  status: 'PENDING' | 'ISSUED';
  mark?: string;
  invoiceNumber?: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class InvoiceBridgeService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly tenantContext = inject(TenantContextService);

  // Configure your deployed Maranth Timologio URL in environment.ts (fallback provided)
  private get timologioBaseUrl(): string {
    return (environment as any).timologioUrl || 'https://maranth-timologio.vercel.app';
  }

  /**
   * 1. Writes a structured B2B invoice handoff doc to Firestore `/invoice_handoffs/{handoffId}`
   * 2. Opens Maranth Timologio with `?handoffId=...` so the cashier only enters the buyer's AFM
   */
  public async launchB2BInvoice(params: {
    saleId: string;
    tableLabel: string;
    paymentMethod: 'CASH' | 'CARD' | 'SPLIT';
    rawItems: Array<{
      name: string;
      quantity: number;
      price: number;
      vatRate?: number;
    }>;
  }): Promise<string | null> {
    if (!this.firestore) {
      console.error('[InvoiceBridge] Firestore is not initialized.');
      return null;
    }

    const store = this.tenantContext.activeStore();
    const handoffId = `hoff_${store.tenantId}_${Date.now()}`;

    let totalGross = 0;
    let totalNet = 0;
    let totalVat = 0;

    const items: InvoiceHandoffItem[] = params.rawItems.map((item) => {
      const qty = Number(item.quantity || 1);
      const grossUnit = Number(item.price || 0);
      const vatRate = Number(item.vatRate ?? 13); // Greek hospitality default: 13% (24% for alcohol/soft drinks)
      const grossAmount = Number((qty * grossUnit).toFixed(2));
      const netAmount = Number((grossAmount / (1 + vatRate / 100)).toFixed(2));
      const vatAmount = Number((grossAmount - netAmount).toFixed(2));

      totalGross = Number((totalGross + grossAmount).toFixed(2));
      totalNet = Number((totalNet + netAmount).toFixed(2));
      totalVat = Number((totalVat + vatAmount).toFixed(2));

      return {
        name: item.name,
        quantity: qty,
        unitPriceGross: grossUnit,
        vatRate,
        netAmount,
        vatAmount,
        grossAmount
      };
    });

    const payload: InvoiceHandoffPayload = {
      id: handoffId,
      tenantId: store.tenantId,
      storeId: store.storeId,
      saleId: params.saleId,
      tableLabel: params.tableLabel,
      issuerAfm: store.afm || '',
      issuerName: store.name,
      paymentMethod: params.paymentMethod,
      totalGross,
      totalNet,
      totalVat,
      items,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(this.firestore, 'invoice_handoffs', handoffId), payload);

    const bridgeUrl = `${this.timologioBaseUrl.replace(/\/+$/, '')}/pos-bridge?handoffId=${encodeURIComponent(handoffId)}&tenant=${encodeURIComponent(store.tenantId)}`;
    window.open(bridgeUrl, '_blank', 'noopener');

    return handoffId;
  }

  /**
   * Optional: Listens for myDATA MARK confirmation written back by Maranth Timologio
   */
  public watchHandoffStatus(
    handoffId: string,
    onIssued: (data: { mark: string; invoiceNumber: string }) => void
  ): Unsubscribe | null {
    if (!this.firestore || !handoffId) return null;

    return onSnapshot(doc(this.firestore, 'invoice_handoffs', handoffId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as InvoiceHandoffPayload;
      if (data.status === 'ISSUED' && data.mark) {
        onIssued({
          mark: data.mark,
          invoiceNumber: data.invoiceNumber || ''
        });
      }
    });
  }
}