// Thin Svelte 5 runes wrapper around the plain-TS hash parser in `./router.ts`.
// Kept deliberately small: all parsing/formatting logic lives in `router.ts`
// (unit-tested in tests/router.spec.ts under plain vitest); this file only
// adds reactivity plus the `hashchange` wiring so components can read the
// current route like normal `$state` and navigate without a full reload.

import { DEFAULT_ROUTE, parseHash, type Route, routeToHash } from './router';

export type { Route } from './router';
export { parseHash, routeToHash } from './router';

function readCurrentHash(): string {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

let current = $state<Route>(typeof window === 'undefined' ? DEFAULT_ROUTE : parseHash(readCurrentHash()));

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    current = parseHash(window.location.hash);
  });
}

/** The current route. Reading `.current` inside a component tracks it. */
export const route = {
  get current(): Route {
    return current;
  },
};

/** Navigates to a route (or a raw `#...` hash string), updating `location.hash`. */
export function navigate(target: Route | string): void {
  const hash = typeof target === 'string' ? target : routeToHash(target);
  if (typeof window === 'undefined') return;
  if (window.location.hash === hash) {
    // Setting an unchanged hash never fires `hashchange`; sync state by hand.
    current = parseHash(hash);
    return;
  }
  window.location.hash = hash;
}
