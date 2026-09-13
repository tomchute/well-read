import type { ManifestEntry } from '$lib/data/manifest';
import type { Reactions, Read, Saved } from '$lib/stores/schema';

export type TabType = 'saved' | 'read' | 'liked';
export type WorkType = 'all' | 'poem' | 'story' | 'book' | 'essay' | 'play';

/**
 * Filters manifest entries by tab type and work type.
 * Saved: entries in the saved array.
 * Read: entries in the read array.
 * Liked: entries with reactions value of 1.
 */
export function filterByTabAndType(
  entries: ManifestEntry[],
  tab: TabType,
  saved: Saved,
  read: Read,
  reactions: Reactions,
  typeFilter: WorkType
): ManifestEntry[] {
  let filtered = entries;

  // Filter by tab
  switch (tab) {
    case 'saved':
      filtered = entries.filter((e) => saved.includes(e.id));
      break;
    case 'read':
      filtered = entries.filter((e) => read.includes(e.id));
      break;
    case 'liked':
      filtered = entries.filter((e) => reactions[e.id] === 1);
      break;
  }

  // Filter by work type
  if (typeFilter !== 'all') {
    const typeMap: Record<WorkType, ManifestEntry['type']> = {
      all: 'poem', // fallback (should not be reached)
      poem: 'poem',
      story: 'short_story',
      book: 'book',
      essay: 'essay',
      play: 'play',
    };

    filtered = filtered.filter((e) => e.type === typeMap[typeFilter]);
  }

  return filtered;
}

/**
 * Sorts entries by most recently added (if timestamps exist in the manifest)
 * or by title otherwise. For now, we sort by title since timestamps are not
 * in the manifest index.
 */
export function sortEntries(entries: ManifestEntry[]): ManifestEntry[] {
  return [...entries].sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Filters, sorts, and counts entries for a given tab and type filter.
 */
export function getFilteredAndSortedEntries(
  allEntries: ManifestEntry[],
  tab: TabType,
  saved: Saved,
  read: Read,
  reactions: Reactions,
  typeFilter: WorkType
): ManifestEntry[] {
  const filtered = filterByTabAndType(allEntries, tab, saved, read, reactions, typeFilter);
  return sortEntries(filtered);
}

/**
 * Gets the count of entries for each tab for use in tab labels.
 */
export function getTabCounts(
  saved: Saved,
  read: Read,
  reactions: Reactions
): Record<TabType, number> {
  return {
    saved: saved.length,
    read: read.length,
    liked: Object.values(reactions).filter((v) => v === 1).length,
  };
}
