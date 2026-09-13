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

// The in-app route we came from, or `undefined` on a fresh load (a deep
// link, a reload). Lets a detail page offer "Back to feed"/"Back to library"
// and lets `goBack` tell "there's in-app history behind us" apart from
// "we'd leave the app if we called `history.back()`".
let previous = $state<Route | undefined>(undefined);

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/** Applies a resolved route, wrapped in a View Transition when the browser supports one and motion isn't reduced. */
function applyRoute(next: Route): void {
  previous = current;
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

/** The current route. Reading `.current` (or `.previous`) inside a component tracks it. */
export const route = {
  get current(): Route {
    return current;
  },
  get previous(): Route | undefined {
    return previous;
  },
};

/**
 * Goes back one step in the browser's history when that step is an in-app
 * route we saw (so scroll position and card focus restore for free), or
 * navigates to `fallback` when there's no in-app history behind us — e.g.
 * the reader arrived by deep link straight onto `#/work/...`.
 */
export function goBack(fallback: Route): void {
  if (typeof window === 'undefined') return;
  if (previous !== undefined && window.history.length > 1) {
    window.history.back();
    return;
  }
  navigate(fallback);
}

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
