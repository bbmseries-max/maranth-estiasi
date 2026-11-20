// src/app/core/services/invoice-bridge.service.ts (in maranth-estiasi)

import { Injectable, inject } from '@angular/core';
import { TenantContextService } from './tenant-context.service';
import { environment } from '../../../environments/environments';

export interface EstiasiExternalDocumentHandover {
  documentType: '1.1';
  items: Array<{
    description: string;
    quantity: number;
    measurementUnit: number;
    price: number;
    vatRate: number;
    barcode?: string;
  }>;
  version: string;
  tenantId: string;
  messageId: string;
  paymentMethod?: 'CASH' | 'CARD' | 'SPLIT';
  referenceNumber?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InvoiceBridgeService {
  private readonly tenantContext = inject(TenantContextService);

  private get timologioBaseUrl(): string {
    return (environment as any).timologioUrl || 'https://maranth-timologio.vercel.app';
  }

  private encodeUrlSafeBase64(obj: unknown): string {
    const json = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

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
  }): Promise<string> {
    const store = this.tenantContext.activeStore();
    const messageId = `estiasi_${store.tenantId}_${Date.now()}`;

    const items = params.rawItems.map((item, idx) => {
      const qty = Number(item.quantity || 1);
      const grossUnit = Number(item.price || 0);
      const vatRate = Number(item.vatRate ?? 13);
      // Net unit price for myDATA 1.1 B2B Invoice lines
      const netUnit = Number((grossUnit / (1 + vatRate / 100)).toFixed(4));

      return {
        description: item.name,
        quantity: qty,
        measurementUnit: 1,
        price: netUnit,
        vatRate,
        barcode: `EST-${idx + 1}`
      };
    });

    const handoverPayload: EstiasiExternalDocumentHandover = {
      documentType: '1.1',
      items,
      version: '1.0',
      tenantId: store.tenantId,
      messageId,
      paymentMethod: params.paymentMethod,
      referenceNumber: params.tableLabel
    };

    const encodedHandover = this.encodeUrlSafeBase64(handoverPayload);
    const targetOrigin = this.timologioBaseUrl.replace(/\/+$/, '');
    const targetUrl = `${targetOrigin}/?handover=${encodedHandover}`;

    const popup = window.open(targetUrl, '_blank');

    // Also dispatch postMessage handshake once the Timologio tab initializes
    if (popup) {
      let attempts = 0;
      const timer = window.setInterval(() => {
        attempts++;
        if (popup.closed || attempts > 15) {
          window.clearInterval(timer);
          return;
        }
        try {
          popup.postMessage(
            {
              type: 'MARANTH_HANDOVER_REQUEST',
              correlationId: messageId,
              payload: handoverPayload
            },
            targetOrigin
          );
        } catch {
          // Target window still loading
        }
      }, 400);

      const ackHandler = (event: MessageEvent) => {
        if (
          event.origin === targetOrigin &&
          event.data?.type === 'MARANTH_HANDOVER_ACK' &&
          event.data?.correlationId === messageId
        ) {
          window.clearInterval(timer);
          window.removeEventListener('message', ackHandler);
        }
      };
      window.addEventListener('message', ackHandler);
    }

    return messageId;
  }
}