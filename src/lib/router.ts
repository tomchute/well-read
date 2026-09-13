// Pure, plain-TypeScript hash-route parsing/formatting. No Svelte runes here
// on purpose — this module is what tests/router.spec.ts imports directly and
// must run under plain vitest with no compiler magic, matching the split used
// by src/lib/stores/persisted.ts + index.svelte.ts. The reactive rune-backed
// store that components use lives in `./router.svelte.ts`.
//
// Hash routing (not a router library) per docs/open-source-reuse.md: "hash
// routing is preferred by default for Pages simplicity ... the ~40-line hash
// router".
//
// Routes: `#/` (feed), `#/work/:id` (work detail), `#/library`, `#/settings`.
// Anything else parses to `not-found` so the shell can render a plain-text
// fallback instead of throwing.

export type Route =
  | { name: 'feed' }
  | { name: 'work'; id: string }
  | { name: 'library' }
  | { name: 'settings' }
  | { name: 'styleguide' }
  | { name: 'not-found'; hash: string };

export const DEFAULT_ROUTE: Route = { name: 'feed' };

const WORK_PATH = /^\/work\/([^/]+)\/?$/;

/** Strips a leading `#` and any trailing slash (except the bare root path). */
function normalizePath(raw: string): string {
  const withoutHash = raw.startsWith('#') ? raw.slice(1) : raw;
  const path = withoutHash === '' ? '/' : withoutHash;
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/** Parses a `location.hash`-shaped string (with or without the `#`) into a `Route`. */
export function parseHash(hash: string): Route {
  const path = normalizePath(hash);

  if (path === '/') return { name: 'feed' };
  if (path === '/library') return { name: 'library' };
  if (path === '/settings') return { name: 'settings' };
  if (path === '/styleguide') return { name: 'styleguide' };

  const workMatch = WORK_PATH.exec(path);
  if (workMatch) {
    const id = decodeURIComponent(workMatch[1] as string);
    return id ? { name: 'work', id } : { name: 'not-found', hash: path };
  }

  return { name: 'not-found', hash: path };
}

/** Builds the `#...` hash string to navigate to a given route. */
export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'feed':
      return '#/';
    case 'library':
      return '#/library';
    case 'settings':
      return '#/settings';
    case 'styleguide':
      return '#/styleguide';
    case 'work':
      return `#/work/${encodeURIComponent(route.id)}`;
    case 'not-found':
      return `#${route.hash}`;
  }
}
