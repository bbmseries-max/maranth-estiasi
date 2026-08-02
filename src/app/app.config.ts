import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // Configures standard event-coalesced change detection to work smoothly with zone.js
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes, 
      withComponentInputBinding(),
      withViewTransitions()
    )
  ]
};