import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

const isHomeUrl = (url: string) => {
  const path = url.split(/[?#]/)[0];
  return path === '' || path === '/';
};

/** Site shell: a slim navigation bar on top (not on the Home page, which has its own cards) and the current page below. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);

  protected readonly isHome = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => isHomeUrl(e.urlAfterRedirects)),
    ),
    // before the first navigation finishes, trust the address bar (#/cosmology etc.) so the nav doesn't flash
    { initialValue: isHomeUrl(typeof location === 'undefined' ? '' : location.hash.slice(1)) },
  );
}
