import { Injectable } from '@angular/core';
import { DailyZReportSnapshot, WaiterVaultSession } from '../models/restaurant-pos.models';

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
}