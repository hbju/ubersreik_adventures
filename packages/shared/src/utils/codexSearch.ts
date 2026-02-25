// ─── Codex Search Engine (Fuse.js wrapper) ──────────────────────────────────

import Fuse, { type IFuseOptions } from 'fuse.js';
import type { CodexEntry, CodexSearchResult } from '../types/codex.types';

let fuseInstance: Fuse<CodexEntry> | null = null;
let _allEntries: CodexEntry[] = [];

const FUSE_OPTIONS: IFuseOptions<CodexEntry> = {
  keys: [
    { name: 'title', weight: 0.5 },
    { name: 'tags', weight: 0.35 },
    { name: 'category', weight: 0.1 },
    { name: 'subcategory', weight: 0.05 },
    { name: 'content', weight: 0.01 },
  ],
  threshold: 0.35,          // fuzzy tolerance (0 = exact, 1 = match everything)
  distance: 200,
  includeScore: true,
  minMatchCharLength: 2,
  useExtendedSearch: false,
};

/**
 * Initialise (or re-initialise) the Fuse search index.
 * Call whenever the codex entries change (e.g. language switch).
 */
export function initCodexSearch(entries: CodexEntry[]): void {
  _allEntries = entries;
  fuseInstance = new Fuse(entries, FUSE_OPTIONS);
}

/**
 * Initialise with cache — alias kept for backward compat.
 */
export const initCodexSearchWithCache = initCodexSearch;

/**
 * Search the codex.  Returns up to `limit` results sorted by relevance.
 */
export function searchCodex(
  query: string,
  limit = 20,
): CodexSearchResult[] {
  if (!fuseInstance || !query.trim()) return [];
  return fuseInstance
    .search(query, { limit })
    .map((r) => ({ entry: r.item, score: r.score ?? 1 }));
}

/**
 * Return all entries currently indexed.
 * Useful for the Codex Viewer sidebar.
 */
export function getAllEntries(): CodexEntry[] {
  return _allEntries;
}
