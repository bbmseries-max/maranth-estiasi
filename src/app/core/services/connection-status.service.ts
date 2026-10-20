// src/app/core/services/connection-status.service.ts

import { Injectable, signal, inject, NgZone } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ConnectionStatusService {
  private ngZone = inject(NgZone);

  // Reactive state: true = online, false = offline
  public isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.ngZone.run(() => this.isOnline.set(true));
      });

      window.addEventListener('offline', () => {
        this.ngZone.run(() => this.isOnline.set(false));
      });
    }
  }
}