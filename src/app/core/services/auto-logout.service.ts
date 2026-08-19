// src/app/core/services/auto-logout.service.ts

import { Injectable, inject, NgZone, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { RestaurantPosService } from './restaurant-pos.service';
import { AuthShiftService } from './auth-shift.service';

@Injectable({
  providedIn: 'root'
})
export class AutoLogoutService implements OnDestroy {
  private posService = inject(RestaurantPosService);
  private authShiftService = inject(AuthShiftService);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  // Inactivity timeout: 15 minutes (900,000 ms)
  private readonly IDLE_TIMEOUT_MS = 15 * 60 * 1000;
  
  private heartbeatIntervalId: any = null;
  private lastActivityTimestamp = Date.now();
  private lastThrottledReset = 0;
  private isListening = false;

  private readonly activityEvents = [
    'mousemove',
    'mousedown',
    'keydown',
    'touchstart',
    'touchend',
    'pointerdown',
    'scroll'
  ];

  private readonly boundActivityHandler = () => this.handleUserActivity();
  private readonly boundVisibilityHandler = () => this.handleVisibilityChange();

  /**
   * Starts or restarts monitoring. Safe to call repeatedly on every login.
   */
  public startMonitoring(customTimeoutMs?: number): void {
    // 1. Teardown any stale listeners first
    this.stopMonitoring();

    const timeout = customTimeoutMs || this.IDLE_TIMEOUT_MS;
    this.lastActivityTimestamp = Date.now();
    this.isListening = true;

    // 2. Attach DOM listeners outside Angular zone to avoid triggering change detection
    this.ngZone.runOutsideAngular(() => {
      this.activityEvents.forEach(event => {
        window.addEventListener(event, this.boundActivityHandler, { passive: true });
      });

      document.addEventListener('visibilitychange', this.boundVisibilityHandler);
      window.addEventListener('focus', this.boundVisibilityHandler);

      // 3. Reliable heartbeat check every 10 seconds (immune to setTimeout timer drift)
      this.heartbeatIntervalId = setInterval(() => {
        this.checkIdleState(timeout);
      }, 10000);
    });
  }

  /**
   * Stops listeners and clears heartbeat. Call this on manual logout.
   */
  public stopMonitoring(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }

    if (this.isListening) {
      this.activityEvents.forEach(event => {
        window.removeEventListener(event, this.boundActivityHandler);
      });

      document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
      window.removeEventListener('focus', this.boundVisibilityHandler);
      this.isListening = false;
    }
  }

  /**
   * Throttles timestamp updates so mouse moves don't overwhelm performance
   */
  private handleUserActivity(): void {
    const now = Date.now();
    // Only update once every 2 seconds
    if (now - this.lastThrottledReset > 2000) {
      this.lastActivityTimestamp = now;
      this.lastThrottledReset = now;
    }
  }

  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this.checkIdleState(this.IDLE_TIMEOUT_MS);
    }
  }

  private checkIdleState(timeoutMs: number): void {
    const currentEmp = this.getCurrentUser();
    if (!currentEmp) {
      this.stopMonitoring();
      return;
    }

    const elapsed = Date.now() - this.lastActivityTimestamp;
    if (elapsed >= timeoutMs) {
      this.ngZone.run(() => {
        this.performAutoLogout('Αυτόματη αποσύνδεση λόγω παρατεταμένης αδράνειας');
      });
    }
  }

 public performAutoLogout(customReason?: string): void {
  const emp = this.getCurrentUser();
  if (!emp) return;

  const reason = customReason || `Αυτόματη αποσύνδεση λόγω αδράνειας (15 λ.) - ${emp.name}`;
  console.warn(`🔒 ${reason}`);

  this.stopMonitoring();
  this.posService.logoutEmployee(); // Calls posService.logoutEmployee() which handles cleanup + redirect to /login
}

  private getCurrentUser() {
    return this.authShiftService?.currentEmployee?.() || this.posService?.currentEmployee?.();
  }

  ngOnDestroy(): void {
    this.stopMonitoring();
  }
}