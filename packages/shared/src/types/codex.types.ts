
export type CodexCategory =
  | 'core-rules'
  | 'combat'
  | 'magic'
  | 'skills'
  | 'talents'
  | 'careers'
  | 'conditions'
  | 'equipment'
  | 'qualities';

export type CodexEntryType = 'json' | 'markdown';

export interface CodexEntry {
  /** Unique identifier, e.g. "talent:ambidextrous" or "md:combat/grappling" */
  id: string;
  /** Display title */
  title: string;
  /** Top-level category for sidebar grouping */
  category: CodexCategory;
  /** Sub-category for further grouping within the sidebar */
  subcategory?: string;
  /** Whether the source data is structured JSON or raw Markdown */
  type: CodexEntryType;
  /** The raw data — a Talent/Skill/Career/Condition object for JSON, or a string for MD */
  content: unknown;
  /** Searchable tags (skill names, career names, effect types, etc.) */
  tags: string[];
}

export interface CodexBookmark {
  entryId: string;
  addedAt: number;
}

export interface CodexSearchResult {
  entry: CodexEntry;
  /** Fuse.js score — lower is better (0 = perfect match) */
  score: number;
}
