// Thin Svelte 5 runes wrapper around the plain-TS hash parser in `./router.ts`.
// Kept deliberately small: all parsing/formatting logic lives in `router.ts`
// (unit-tested in tests/router.spec.ts under plain vitest); this file only
// adds reactivity plus the `hashchange` wiring so components can read the
// current route like normal `$state` and navigate without a full reload.
//
// View transitions (WP-2.6, docs/design-system.md §5 "Card → detail"): every
// route change — whether started by `navigate()` or by the browser itself
// (a card's plain `<a href>`, back/forward) — funnels through `applyRoute`
// below, so feed<->detail always gets the morph animation regardless of how
// the change was triggered. `document.startViewTransition` snapshots the
// DOM before and after its callback; `flushSync` forces Svelte to apply the
// route's reactive updates synchronously inside that callback instead of on
// its usual microtask, so the "after" snapshot is taken once the new view
// has actually rendered. Falls back to a plain, instant swap with no visual
// transition when the API is unsupported or `prefers-reduced-motion:
// reduce` is set (docs/design-system.md §5 "Reduced motion").

import { flushSync } from 'svelte';
import { DEFAULT_ROUTE, parseHash, type Route, routeToHash } from './router';

export type { Route } from './router';
export { parseHash, routeToHash } from './router';

function readCurrentHash(): string {
  return typeof window === 'undefined' ? '' : window.location.hash;
}

let current = $state<Route>(
  typeof window === 'undefined' ? DEFAULT_ROUTE : parseHash(readCurrentHash())
);

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/** Applies a resolved route, wrapped in a View Transition when the browser supports one and motion isn't reduced. */
function applyRoute(next: Route): void {
  if (
    typeof document !== 'undefined' &&
    typeof document.startViewTransition === 'function' &&
    !prefersReducedMotion()
  ) {
    document.startViewTransition(() => {
      current = next;
      flushSync();
    });
    return;
  }
  current = next;
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    applyRoute(parseHash(window.location.hash));
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
    // Setting an unchanged hash never fires `hashchange`; apply it by hand.
    applyRoute(parseHash(hash));
    return;
  }
  window.location.hash = hash;
}
