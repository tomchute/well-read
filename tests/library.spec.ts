import { describe, expect, it } from 'vitest';
import type { ManifestEntry } from '$lib/data/manifest';
import type { Reactions, Read, Saved } from '$lib/stores/schema';
import {
  filterByTabAndType,
  getFilteredAndSortedEntries,
  getTabCounts,
  sortEntries,
  type TabType,
} from '../src/views/library';

describe('library helpers', () => {
  const createEntry = (overrides: Partial<ManifestEntry>): ManifestEntry => ({
    id: 'test-1',
    title: 'Test Work',
    author: 'Test Author',
    year: 2020,
    era: 'modern',
    type: 'poem',
    form: 'lyric',
    themes: ['nature'],
    tags: [],
    difficulty: 3,
    length: 'short',
    textPolicy: 'full',
    shard: 1,
    ...overrides,
  });

  describe('filterByTabAndType', () => {
    const entry1 = createEntry({ id: 'poem-1', title: 'Poem One', type: 'poem' });
    const entry2 = createEntry({ id: 'story-1', title: 'Story One', type: 'short_story' });
    const entry3 = createEntry({ id: 'book-1', title: 'Book One', type: 'book' });
    const allEntries = [entry1, entry2, entry3];

    it('filters saved tab', () => {
      const saved: Saved = ['poem-1', 'story-1'];
      const read: Read = [];
      const reactions: Reactions = {};

      const result = filterByTabAndType(allEntries, 'saved', saved, read, reactions, 'all');

      expect(result).toHaveLength(2);
      expect(result.map((e) => e.id)).toEqual(['poem-1', 'story-1']);
    });

    it('filters read tab', () => {
      const saved: Saved = [];
      const read: Read = ['book-1'];
      const reactions: Reactions = {};

      const result = filterByTabAndType(allEntries, 'read', saved, read, reactions, 'all');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('book-1');
    });

    it('filters liked tab (reactions = 1)', () => {
      const saved: Saved = [];
      const read: Read = [];
      const reactions: Reactions = { 'poem-1': 1, 'story-1': -1 };

      const result = filterByTabAndType(allEntries, 'liked', saved, read, reactions, 'all');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('poem-1');
    });

    it('filters by work type (poem)', () => {
      const saved: Saved = ['poem-1', 'story-1', 'book-1'];
      const read: Read = [];
      const reactions: Reactions = {};

      const result = filterByTabAndType(allEntries, 'saved', saved, read, reactions, 'poem');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('poem-1');
    });

    it('filters by work type (story = short_story)', () => {
      const saved: Saved = ['poem-1', 'story-1', 'book-1'];
      const read: Read = [];
      const reactions: Reactions = {};

      const result = filterByTabAndType(allEntries, 'saved', saved, read, reactions, 'story');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('story-1');
    });

    it('returns empty array when no matches', () => {
      const saved: Saved = [];
      const read: Read = [];
      const reactions: Reactions = {};

      const result = filterByTabAndType(allEntries, 'saved', saved, read, reactions, 'all');

      expect(result).toHaveLength(0);
    });
  });

  describe('sortEntries', () => {
    it('sorts by title alphabetically', () => {
      const entries = [
        createEntry({ id: '1', title: 'Zebra' }),
        createEntry({ id: '2', title: 'Apple' }),
        createEntry({ id: '3', title: 'Mango' }),
      ];

      const result = sortEntries(entries);

      expect(result.map((e) => e.title)).toEqual(['Apple', 'Mango', 'Zebra']);
    });

    it('does not mutate original array', () => {
      const entries = [
        createEntry({ id: '1', title: 'Zebra' }),
        createEntry({ id: '2', title: 'Apple' }),
      ];
      const originalFirst = entries[0].id;

      sortEntries(entries);

      expect(entries[0].id).toBe(originalFirst);
    });
  });

  describe('getFilteredAndSortedEntries', () => {
    const entries = [
      createEntry({ id: 'poem-1', title: 'Zebra Poem', type: 'poem' }),
      createEntry({ id: 'poem-2', title: 'Apple Poem', type: 'poem' }),
      createEntry({ id: 'story-1', title: 'Mountain Story', type: 'short_story' }),
    ];

    it('filters saved and sorts by title', () => {
      const saved: Saved = ['poem-2', 'story-1'];
      const read: Read = [];
      const reactions: Reactions = {};

      const result = getFilteredAndSortedEntries(entries, 'saved', saved, read, reactions, 'all');

      expect(result.map((e) => e.title)).toEqual(['Apple Poem', 'Mountain Story']);
    });

    it('filters saved by type and sorts', () => {
      const saved: Saved = ['poem-1', 'poem-2', 'story-1'];
      const read: Read = [];
      const reactions: Reactions = {};

      const result = getFilteredAndSortedEntries(entries, 'saved', saved, read, reactions, 'poem');

      expect(result).toHaveLength(2);
      expect(result.map((e) => e.title)).toEqual(['Apple Poem', 'Zebra Poem']);
    });
  });

  describe('getTabCounts', () => {
    const entries = [
      createEntry({ id: 'p1' }),
      createEntry({ id: 'p2' }),
      createEntry({ id: 's1' }),
    ];

    it('counts entries in each tab', () => {
      const saved: Saved = ['p1', 'p2'];
      const read: Read = ['s1'];
      const reactions: Reactions = { p1: 1, s1: -1 };

      const result = getTabCounts(saved, read, reactions);

      expect(result.saved).toBe(2);
      expect(result.read).toBe(1);
      expect(result.liked).toBe(1);
    });

    it('counts zero when empty', () => {
      const saved: Saved = [];
      const read: Read = [];
      const reactions: Reactions = {};

      const result = getTabCounts(saved, read, reactions);

      expect(result.saved).toBe(0);
      expect(result.read).toBe(0);
      expect(result.liked).toBe(0);
    });

    it('counts only likes (reaction = 1), not dislikes', () => {
      const saved: Saved = [];
      const read: Read = [];
      const reactions: Reactions = { p1: 1, p2: 1, s1: -1 };

      const result = getTabCounts(saved, read, reactions);

      expect(result.liked).toBe(2);
    });
  });
});
