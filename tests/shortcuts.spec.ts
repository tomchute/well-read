// Vitest cases for the pure key-mapping logic in src/lib/shortcuts.ts
// (WP-2.6, docs/design-system.md §7 "Keyboard shortcuts"). Deliberately no
// DOM: `target` is a plain duck-typed object, matching how the module itself
// avoids `instanceof HTMLElement` so it runs under plain vitest (no jsdom in
// this project — see vitest.config.ts).

import { describe, expect, it } from 'vitest';
import { isEditableTarget, resolveShortcut } from '../src/lib/shortcuts';

describe('isEditableTarget', () => {
  it('is false for a null/undefined target', () => {
    expect(isEditableTarget(null)).toBe(false);
    expect(isEditableTarget(undefined)).toBe(false);
  });

  it('is false for a non-object target', () => {
    expect(isEditableTarget('input')).toBe(false);
    expect(isEditableTarget(42)).toBe(false);
  });

  it('is false for a plain element like a button or article', () => {
    expect(isEditableTarget({ tagName: 'BUTTON' })).toBe(false);
    expect(isEditableTarget({ tagName: 'ARTICLE' })).toBe(false);
    expect(isEditableTarget({ tagName: 'A' })).toBe(false);
  });

  it('is true for input, textarea, and select, case-insensitively', () => {
    expect(isEditableTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isEditableTarget({ tagName: 'input' })).toBe(true);
    expect(isEditableTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isEditableTarget({ tagName: 'SELECT' })).toBe(true);
  });

  it('is true for a contenteditable element regardless of tag name', () => {
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('is false when isContentEditable is present but falsy', () => {
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: false })).toBe(false);
  });
});

describe('resolveShortcut', () => {
  it('maps j/k to next/prev', () => {
    expect(resolveShortcut({ key: 'j' })).toBe('next');
    expect(resolveShortcut({ key: 'k' })).toBe('prev');
  });

  it('maps Enter to open', () => {
    expect(resolveShortcut({ key: 'Enter' })).toBe('open');
  });

  it('maps s to save and m to more-like-this', () => {
    expect(resolveShortcut({ key: 's' })).toBe('save');
    expect(resolveShortcut({ key: 'm' })).toBe('more-like-this');
  });

  it('maps Escape to close and ? to help', () => {
    expect(resolveShortcut({ key: 'Escape' })).toBe('close');
    expect(resolveShortcut({ key: '?' })).toBe('help');
  });

  it('returns null for a key that is not one of ours', () => {
    expect(resolveShortcut({ key: 'a' })).toBeNull();
    expect(resolveShortcut({ key: 'Tab' })).toBeNull();
    expect(resolveShortcut({ key: 'J' })).toBeNull(); // case-sensitive: no shift-j shortcut
  });

  it('ignores the key while a modifier is held, so browser/OS chords are never stolen', () => {
    expect(resolveShortcut({ key: 'j', metaKey: true })).toBeNull();
    expect(resolveShortcut({ key: 's', ctrlKey: true })).toBeNull();
    expect(resolveShortcut({ key: 'm', altKey: true })).toBeNull();
  });

  it('ignores the key while focus is inside a text input, textarea, select, or contenteditable', () => {
    expect(resolveShortcut({ key: 'j', target: { tagName: 'INPUT' } })).toBeNull();
    expect(resolveShortcut({ key: 's', target: { tagName: 'TEXTAREA' } })).toBeNull();
    expect(resolveShortcut({ key: 'm', target: { tagName: 'SELECT' } })).toBeNull();
    expect(
      resolveShortcut({ key: 'k', target: { tagName: 'DIV', isContentEditable: true } })
    ).toBeNull();
  });

  it('still resolves normally when the target is a plain non-editable element', () => {
    expect(resolveShortcut({ key: 'j', target: { tagName: 'A' } })).toBe('next');
    expect(resolveShortcut({ key: 'Escape', target: { tagName: 'BUTTON' } })).toBe('close');
  });

  it('resolves with no target and no modifiers supplied at all', () => {
    expect(resolveShortcut({ key: '?' })).toBe('help');
  });
});
