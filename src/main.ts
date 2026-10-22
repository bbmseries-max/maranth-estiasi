import { bootstrapApplication } from '@angular/platform-browser';
import * as Sentry from '@sentry/angular';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { isDevMode } from '@angular/core';

Sentry.init({
  dsn: 'https://90525ef4f74f4d613b00111e173d56bb@o4512295315898368.ingest.de.sentry.io/4512295401160784',
  environment: isDevMode() ? 'development' : 'production',
  tracesSampleRate: 1.0,
});

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));