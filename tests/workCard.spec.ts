// Vitest cases for the pure teaser helper in WorkCard.svelte (WP-2.3). Kept
// in the component's `<script module>` block per that WP's file scope
// (WorkCard.svelte, Feed.svelte only) rather than a sibling `workCard.ts` —
// importing named exports from a compiled `.svelte` file works the same as
// any other ES module as long as nothing here mounts the component.

import { describe, expect, it } from 'vitest';
import { computeTeaser } from '../src/lib/components/WorkCard.svelte';

describe('computeTeaser', () => {
  it("shows a poem's first 3-4 non-blank lines verbatim, preserving indentation", () => {
    const text = [
      '   Because I could not stop for Death –',
      'He kindly stopped for me –',
      '',
      'The Carriage held but just Ourselves –',
      'And Immortality.',
      'We slowly drove – He knew no haste',
    ].join('\n');

    const teaser = computeTeaser({ type: 'poem', text });

    expect(teaser).toEqual({
      kind: 'text',
      value: [
        '   Because I could not stop for Death –',
        'He kindly stopped for me –',
        'The Carriage held but just Ourselves –',
        'And Immortality.',
      ].join('\n'),
    });
  });

  it('falls back to excerpt when a poem has no full text', () => {
    const teaser = computeTeaser({ type: 'poem', excerpt: 'One line only.' });
    expect(teaser).toEqual({ kind: 'text', value: 'One line only.' });
  });

  it('shows roughly the first 40 words of prose, with an ellipsis when truncated', () => {
    const words = Array.from({ length: 60 }, (_, i) => `word${i + 1}`);
    const text = words.join(' ');

    const teaser = computeTeaser({ type: 'short_story', text });

    expect(teaser.kind).toBe('text');
    const value = teaser.kind === 'text' ? teaser.value : '';
    expect(value.endsWith('…')).toBe(true);
    expect(value.split(/\s+/).length).toBe(40);
    expect(value.startsWith('word1 word2')).toBe(true);
  });

  it('does not add an ellipsis when prose text is already short', () => {
    const teaser = computeTeaser({
      type: 'essay',
      excerpt: 'A short excerpt of ten words here yes it is.',
    });
    expect(teaser).toEqual({
      kind: 'text',
      value: 'A short excerpt of ten words here yes it is.',
    });
  });

  it('teasers as pending when neither text nor excerpt is present', () => {
    expect(computeTeaser({ type: 'book' })).toEqual({ kind: 'pending' });
    expect(computeTeaser({ type: 'poem', text: undefined, excerpt: undefined })).toEqual({
      kind: 'pending',
    });
  });

  it('prefers full text over excerpt when both are present', () => {
    const teaser = computeTeaser({
      type: 'essay',
      text: 'Full text wins here.',
      excerpt: 'Excerpt loses.',
    });
    expect(teaser).toEqual({ kind: 'text', value: 'Full text wins here.' });
  });
});
