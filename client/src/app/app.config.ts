import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, Route } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';

// import { routes } from './app.routes';
const routes: Route[] = [];

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
  ],
};
