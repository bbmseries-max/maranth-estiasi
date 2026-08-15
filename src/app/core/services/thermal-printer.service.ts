import { Injectable } from '@angular/core';
import { DailyZReportSnapshot, WaiterVaultSession } from '../modals/restaurant-pos.modals';


@Injectable({
  providedIn: 'root'
})
export class ThermalPrinterService {

  /**
   * Prints 80mm Waiter Vault Handover Receipt
   */
  public printVaultReceipt(vault: WaiterVaultSession, handedCash?: number): void {
    const dateStr = new Date().toLocaleString('el-GR');
    const expectedCash = (vault.startingFloat || 0) + (vault.cashCollected || 0);
    const actual = handedCash !== undefined ? handedCash : expectedCash;
    const variance = actual - expectedCash;

    const printWin = window.open('', '_blank', 'width=400,height=650');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html lang="el">
        <head>
          <meta charset="UTF-8">
          <title>Δελτίο Ταμείου - ${vault.waiterName}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 72mm;
              margin: 0 auto;
              padding: 12px 4px;
              color: #000;
              font-size: 12px;
              line-height: 1.3;
            }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .item-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .header-title { font-size: 15px; font-weight: bold; }
            .sig-box { margin-top: 24px; display: flex; justify-content: space-between; font-size: 10px; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="header-title">🍊 MARANTH ESTIASI</div>
            <div>ΔΕΛΤΙΟ ΠΑΡΑΔΟΣΗΣ ΤΑΜΕΙΟΥ</div>
            <div>Καφέ - Εστιατόριο - Bar</div>
          </div>
          <div class="divider"></div>
          <div><strong>Σερβιτόρος:</strong> ${vault.waiterName}</div>
          <div><strong>Έναρξη:</strong> ${new Date(vault.openedAt).toLocaleString('el-GR')}</div>
          <div><strong>Έκδοση:</strong> ${dateStr}</div>
          <div class="divider"></div>
          <div class="item-row">
            <span>Αρχικό Ταμείο (Ρέστα):</span>
            <span>€${(vault.startingFloat || 0).toFixed(2)}</span>
          </div>
          <div class="item-row">
            <span>Εισπράξεις Μετρητών:</span>
            <span>€${(vault.cashCollected || 0).toFixed(2)}</span>
          </div>
          <div class="item-row">
            <span>Εισπράξεις Καρτών (POS):</span>
            <span>€${(vault.cardCollected || 0).toFixed(2)}</span>
          </div>
          <div class="divider"></div>
          <div class="item-row font-bold">
            <span>Αναμενόμενα Μετρητά:</span>
            <span>€${expectedCash.toFixed(2)}</span>
          </div>
          <div class="item-row font-bold">
            <span>Παραδοθέντα Μετρητά:</span>
            <span>€${actual.toFixed(2)}</span>
          </div>
          <div class="item-row font-bold">
            <span>Απόκλιση / Διαφορά:</span>
            <span>${variance >= 0 ? '+' : ''}€${variance.toFixed(2)}</span>
          </div>
          <div class="divider"></div>
          <div class="sig-box">
            <div>___________________<br>Υπογραφή Σερβιτόρου</div>
            <div>___________________<br>Υπογραφή Manager</div>
          </div>
          <div class="text-center" style="margin-top: 20px; font-size: 10px;">
            *** ΕΣΩΤΕΡΙΚΗ ΧΡΗΣΗ ΤΑΜΕΙΟΥ ***
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
        </html>
      `);
      printWin.document.close();
    }
  }

  /**
   * Prints 80mm Official Daily Z-Report Snapshot
   */
  public printZReport(z: DailyZReportSnapshot): void {
    const printWin = window.open('', '_blank', 'width=400,height=650');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html lang="el">
        <head>
          <meta charset="UTF-8">
          <title>Z-REPORT - ${z.dateStr}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 72mm;
              margin: 0 auto;
              padding: 12px 4px;
              color: #000;
              font-size: 12px;
              line-height: 1.3;
            }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .item-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .header-title { font-size: 16px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="header-title">🍊 MARANTH ESTIASI</div>
            <div>ΗΜΕΡΗΣΙΑ ΑΝΑΦΟΡΑ Z-REPORT</div>
            <div>Καφέ - Εστιατόριο - Bar</div>
          </div>
          <div class="divider"></div>
          <div><strong>Ημερομηνία:</strong> ${z.dateStr}</div>
          <div><strong>Έκδοση:</strong> ${new Date(z.timestamp).toLocaleString('el-GR')}</div>
          <div><strong>Υπεύθυνος:</strong> ${z.closedByEmployeeName}</div>
          <div class="divider"></div>
          <div class="text-center font-bold">--- ΑΝΑΛΥΣΗ ΕΙΣΠΡΑΞΕΩΝ ---</div>
          <div class="item-row">
            <span>Εισπράξεις Μετρητών:</span>
            <span>€${z.totalCash.toFixed(2)}</span>
          </div>
          <div class="item-row">
            <span>Εισπράξεις Καρτών (POS):</span>
            <span>€${z.totalCard.toFixed(2)}</span>
          </div>
          <div class="item-row font-bold">
            <span>ΣΥΝΟΛΟ ΤΖΙΡΟΥ:</span>
            <span>€${z.totalGrossRevenue.toFixed(2)}</span>
          </div>
          <div class="divider"></div>
          <div class="text-center font-bold">--- ΑΝΑΛΥΣΗ ΦΠΑ ---</div>
          <div class="item-row">
            <span>Καθαρά 13%:</span>
            <span>€${z.net13.toFixed(2)}</span>
          </div>
          <div class="item-row">
            <span>ΦΠΑ 13%:</span>
            <span>€${z.vat13.toFixed(2)}</span>
          </div>
          <div class="item-row">
            <span>Καθαρά 24%:</span>
            <span>€${z.net24.toFixed(2)}</span>
          </div>
          <div class="item-row">
            <span>ΦΠΑ 24%:</span>
            <span>€${z.vat24.toFixed(2)}</span>
          </div>
          <div class="divider"></div>
          <div class="item-row font-bold">
            <span>ΣΥΝΟΛΟ ΚΑΘΑΡΗΣ ΑΞΙΑΣ:</span>
            <span>€${z.totalNetRevenue.toFixed(2)}</span>
          </div>
          <div class="item-row font-bold">
            <span>ΣΥΝΟΛΟ ΦΠΑ:</span>
            <span>€${z.totalVatLiability.toFixed(2)}</span>
          </div>
          <div class="divider"></div>
          <div class="text-center" style="margin-top: 15px; font-size: 10px;">
            *** ΤΕΛΟΣ ΗΜΕΡΗΣΙΑΣ ΑΝΑΦΟΡΑΣ Z ***
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
        </html>
      `);
      printWin.document.close();
    }
  }

  // Add to src/app/core/services/thermal-printer.service.ts

  /**
   * Prints 80mm Table Bill / Proforma Receipt (Προτιμολόγιο / Λογαριασμός)
   */
  public printTableBillReceipt(
    tableNumber: number | string,
    tableName: string,
    items: Array<{ productName?: string; name?: string; quantity: number; finalItemPrice?: number; unitPrice?: number; price?: number; status?: string; modifiers?: any[] }>,
    grandTotal: number,
    waiterName: string = 'Σερβιτόρος'
  ): void {
    const activeItems = items.filter(i => i.status !== 'VOIDED');
    const subtotalNet = Number((grandTotal / 1.13).toFixed(2));
    const vatAmount = Number((grandTotal - subtotalNet).toFixed(2));
    const dateStr = new Date().toLocaleString('el-GR');

    const printWin = window.open('', '_blank', 'width=400,height=650');
    if (printWin) {
      const itemsRowsHtml = activeItems.map(item => {
        const name = item.productName || item.name || 'Προϊόν';
        const qty = item.quantity || 1;
        const rawPrice = item.finalItemPrice ?? item.unitPrice ?? item.price ?? 0;
        const total = Number((rawPrice * qty).toFixed(2));
        
        let modHtml = '';
        if (item.modifiers && Array.isArray(item.modifiers) && item.modifiers.length > 0) {
          const modText = item.modifiers.map(m => m.optionName || m.name || '').filter(Boolean).join(', ');
          if (modText) {
            modHtml = `<div style="font-size: 10px; color: #444; padding-left: 10px;">↳ ${modText}</div>`;
          }
        }

        return `
          <div style="margin-bottom: 4px;">
            <div style="display: flex; justify-content: space-between;">
              <span>${qty}x ${name}</span>
              <span>€${total.toFixed(2)}</span>
            </div>
            ${modHtml}
          </div>
        `;
      }).join('');

      printWin.document.write(`
        <!DOCTYPE html>
        <html lang="el">
        <head>
          <meta charset="UTF-8">
          <title>Λογαριασμός - Τραπέζι #${tableNumber}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 72mm;
              margin: 0 auto;
              padding: 12px 4px;
              color: #000;
              font-size: 12px;
              line-height: 1.3;
            }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .item-row { display: flex; justify-content: space-between; margin-bottom: 4px; }
            .header-title { font-size: 16px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="header-title">🍊 MARANTH ESTIASI</div>
            <div>ΠΡΟΛΟΓΑΡΙΑΣΜΟΣ / ΕΝΗΜΕΡΩΤΙΚΟ</div>
            <div>Καφέ - Εστιατόριο - Bar</div>
          </div>
          <div class="divider"></div>
          <div><strong>ΤΡΑΠΕΖΙ:</strong> #${tableNumber} (${tableName})</div>
          <div><strong>Σερβιτόρος:</strong> ${waiterName}</div>
          <div><strong>Ημερομηνία:</strong> ${dateStr}</div>
          <div class="divider"></div>
          
          <div class="text-center font-bold" style="margin-bottom: 6px;">--- ΠΑΡΑΓΓΕΛΙΑ ---</div>
          ${itemsRowsHtml}
          
          <div class="divider"></div>
          <div class="item-row">
            <span>Καθαρή Αξία:</span>
            <span>€${subtotalNet.toFixed(2)}</span>
          </div>
          <div class="item-row">
            <span>Φ.Π.Α.:</span>
            <span>€${vatAmount.toFixed(2)}</span>
          </div>
          <div class="divider"></div>
          <div class="item-row font-bold" style="font-size: 15px;">
            <span>ΠΛΗΡΩΤΕΟ ΠΟΣΟ:</span>
            <span>€${grandTotal.toFixed(2)}</span>
          </div>
          <div class="divider"></div>
          <div class="text-center" style="margin-top: 15px; font-size: 10px;">
            ΔΕΝ ΑΠΟΤΕΛΕΙ ΝΟΜΙΜΗ ΑΠΟΔΕΙΞΗ<br>
            ΕΥΧΑΡΙΣΤΟΥΜΕ ΓΙΑ ΤΗΝ ΠΡΟΤΙΜΗΣΗ ΣΑΣ!
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
        </html>
      `);
      printWin.document.close();
    }
  }
}