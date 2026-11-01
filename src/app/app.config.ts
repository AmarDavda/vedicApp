import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    // real URLs (/cosmology) so search engines can index every page. GitHub Pages gets one HTML file per page, made
    // by scripts/postbuild-seo.mjs (plus 404.html).
    provideRouter(routes),
  ],
};
