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

  // Inactivity timeout setting: 3 minutes (180,000 ms)
  private readonly IDLE_TIMEOUT_MS = 3 * 60 * 1000;
  
  private timeoutId: any = null;
  private isListening = false;
  private lastActivityTimestamp = Date.now();

  // Expanded mobile & desktop interaction events
  private readonly activityEvents = [
    'mousemove',
    'mousedown',
    'keydown',
    'touchstart',
    'touchend',
    'pointerdown',
    'scroll'
  ];

  private readonly boundResetTimer = this.handleUserActivity.bind(this);
  private readonly boundVisibilityCheck = this.handleVisibilityChange.bind(this);

  /**
   * Starts monitoring user activity and mobile lifecycle state.
   */
  public startMonitoring(): void {
    if (this.isListening) return;
    this.isListening = true;
    this.lastActivityTimestamp = Date.now();

    this.ngZone.runOutsideAngular(() => {
      // 1. Interaction listeners
      this.activityEvents.forEach(event => {
        window.addEventListener(event, this.boundResetTimer, { passive: true });
      });

      // 2. Mobile screen wake / app-switch listener
      document.addEventListener('visibilitychange', this.boundVisibilityCheck);
      window.addEventListener('focus', this.boundVisibilityCheck);
    });

    this.resetTimer();
  }

  /**
   * Stops monitoring activity.
   */
  public stopMonitoring(): void {
    if (!this.isListening) return;
    this.isListening = false;

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.activityEvents.forEach(event => {
      window.removeEventListener(event, this.boundResetTimer);
    });

    document.removeEventListener('visibilitychange', this.boundVisibilityCheck);
    window.removeEventListener('focus', this.boundVisibilityCheck);
  }

  /**
   * Handles user interaction.
   */
  private handleUserActivity(): void {
    this.lastActivityTimestamp = Date.now();
    this.resetTimer();
  }

  /**
   * Evaluates elapsed idle time immediately upon mobile screen unlock or tab focus.
   */
  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      const elapsed = Date.now() - this.lastActivityTimestamp;
      const currentEmp = this.getCurrentUser();

      if (currentEmp && elapsed >= this.IDLE_TIMEOUT_MS) {
        this.ngZone.run(() => {
          this.performAutoLogout('Επαναφορά από αδράνεια / κλείδωμα οθόνης');
        });
      } else {
        this.resetTimer();
      }
    }
  }

  /**
   * Resets the inactivity timeout countdown.
   */
  public resetTimer(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    const currentEmp = this.getCurrentUser();
    if (!currentEmp) return;

    this.timeoutId = setTimeout(() => {
      this.ngZone.run(() => {
        this.performAutoLogout();
      });
    }, this.IDLE_TIMEOUT_MS);
  }

  /**
   * Performs absolute logout across all services and navigates to /login.
   */
  public performAutoLogout(customReason?: string): void {
    const emp = this.getCurrentUser();
    if (!emp) return;

    const reason = customReason || `Αυτόματη αποσύνδεση λόγω αδράνειας (3 λ.) - ${emp.name}`;
    console.warn(`🔒 ${reason}`);

    // 1. Audit log
    this.posService.logAudit('AUTO_LOGOUT', reason);

    // 2. Clear both service states and local storage keys
    this.stopMonitoring();
    this.authShiftService.logoutEmployee();
    this.posService.logoutEmployee();

    localStorage.removeItem('current_employee');
    localStorage.removeItem('maranth_pos_employee');

    // 3. Navigate back to PIN login screen
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  private getCurrentUser() {
    return this.authShiftService.currentEmployee() || this.posService.currentEmployee();
  }

  ngOnDestroy(): void {
    this.stopMonitoring();
  }
}