import { Injectable, inject, signal, NgZone, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { RestaurantPosService } from './restaurant-pos.service';

@Injectable({
  providedIn: 'root'
})
export class AutoLogoutService implements OnDestroy {
  private posService = inject(RestaurantPosService);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  // Inactivity timeout setting (default: 3 minutes = 180,000 ms)
  private readonly IDLE_TIMEOUT_MS = 3 * 60 * 1000;
  
  private timeoutId: any = null;
  private isListening = false;

  // Track activity events
  private readonly activityEvents = [
    'mousemove',
    'mousedown',
    'keydown',
    'touchstart',
    'pointerdown',
    'scroll'
  ];

  private readonly boundResetTimer = this.resetTimer.bind(this);

  /**
   * Starts monitoring user activity. Call this when the app initializes.
   */
  public startMonitoring(): void {
    if (this.isListening) return;
    this.isListening = true;

    // Run event listeners OUTSIDE Angular change detection for high performance
    this.ngZone.runOutsideAngular(() => {
      this.activityEvents.forEach(event => {
        window.addEventListener(event, this.boundResetTimer, { passive: true });
      });
    });

    this.resetTimer();
  }

  /**
   * Stops monitoring activity (e.g. when already logged out).
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
  }

  /**
   * Resets the inactivity timer whenever user interaction is detected.
   */
  public resetTimer(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    // Do not run timeout logic if no employee is currently logged in
    const currentEmp = this.posService.currentEmployee();
    if (!currentEmp) return;

    this.timeoutId = setTimeout(() => {
      this.ngZone.run(() => {
        this.performAutoLogout();
      });
    }, this.IDLE_TIMEOUT_MS);
  }

  /**
   * Performs bulletproof auto-logout and redirects to PIN screen.
   */
  private performAutoLogout(): void {
    const emp = this.posService.currentEmployee();
    if (!emp) return;

    console.warn(`🔒 Auto-logout triggered due to 3 minutes of inactivity for ${emp.name} (${emp.role})`);

    // Audit log entry for security audit trail
    this.posService.logAudit('AUTO_LOGOUT', `Αυτόματη αποσύνδεση λόγω αδράνειας (3 λ.) - ${emp.name}`);

    // Clear active user session (keep active shift/vault intact in DB!)
    this.posService.logoutEmployee();

    // Redirect straight to PIN entry screen
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    this.stopMonitoring();
  }
}