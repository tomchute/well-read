// Global keyboard shortcuts (WP-2.6, docs/design-system.md §7 "Keyboard
// shortcuts"). Deliberately Svelte-free — the same pattern as `./actions.ts`
// — so the key-mapping logic runs under plain vitest with plain objects,
// with no DOM/jsdom required (tests/shortcuts.spec.ts). `attachShortcuts` is
// a thin, untested-by-design DOM convenience that Feed.svelte, Work.svelte
// and App.svelte each call with the small subset of actions they own.

/** Every shortcut the app recognises. `j`/`k` move focus in the feed;
 * `Enter` opens the focused card; `s`/`m` act on the focused card or the
 * open work; `Escape` closes the notes sheet, the shortcuts overlay, or
 * returns from detail to feed; `?` opens the shortcuts overlay. */
export type ShortcutAction =
  | 'next'
  | 'prev'
  | 'open'
  | 'save'
  | 'more-like-this'
  | 'close'
  | 'help';

const KEY_TO_ACTION: Readonly<Record<string, ShortcutAction>> = {
  j: 'next',
  k: 'prev',
  Enter: 'open',
  s: 'save',
  m: 'more-like-this',
  Escape: 'close',
  '?': 'help',
};

/** Tag names that count as "typing" — shortcuts never fire while focus is inside one of these. */
const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Whether `target` (an event's `target`, duck-typed rather than
 * `instanceof HTMLElement` so this runs without a DOM) is a place the user
 * is typing: a form control or a `contenteditable` element.
 */
export function isEditableTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: unknown; isContentEditable?: unknown };
  if (el.isContentEditable === true) return true;
  return typeof el.tagName === 'string' && EDITABLE_TAGS.has(el.tagName.toUpperCase());
}

/** The subset of a `KeyboardEvent` the key-mapping logic needs — duck-typed so tests need no DOM. */
export interface ShortcutEventLike {
  key: string;
  target?: unknown;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}

/**
 * Maps a keydown to a `ShortcutAction`, or `null` when the key isn't one of
 * ours, a modifier is held (never steal a browser/OS chord), or focus is
 * inside a text input, textarea, select, or `contenteditable` element.
 */
export function resolveShortcut(event: ShortcutEventLike): ShortcutAction | null {
  if (event.metaKey || event.ctrlKey || event.altKey) return null;
  if (isEditableTarget(event.target)) return null;
  return KEY_TO_ACTION[event.key] ?? null;
}

/** Handlers a caller supplies for the shortcuts it wants to act on; actions with no handler are ignored. */
export type ShortcutHandlers = Partial<Record<ShortcutAction, () => void>>;

/**
 * Attaches a `keydown` listener that resolves each event via
 * `resolveShortcut` and calls the matching handler, if the caller supplied
 * one. Returns a cleanup function. A no-op (with a no-op cleanup) outside a
 * DOM environment (`target` unset and no global `window`), and safe to call
 * from several components at once — the only priority Escape needs (closing
 * the shortcuts overlay before anything else reacts to it) is handled by
 * App.svelte with its own capture-phase listener, not here.
 */
export function attachShortcuts(
  handlers: ShortcutHandlers,
  target: EventTarget | undefined = typeof window === 'undefined' ? undefined : window
): () => void {
  if (!target) return () => {};

  const onKeydown = (event: Event) => {
    const keyboardEvent = event as KeyboardEvent;
    const action = resolveShortcut({
      key: keyboardEvent.key,
      target: keyboardEvent.target,
      metaKey: keyboardEvent.metaKey,
      ctrlKey: keyboardEvent.ctrlKey,
      altKey: keyboardEvent.altKey,
    });
    if (!action) return;
    const handler = handlers[action];
    if (!handler) return;
    keyboardEvent.preventDefault();
    handler();
  };

  target.addEventListener('keydown', onKeydown);
  return () => target.removeEventListener('keydown', onKeydown);
}
