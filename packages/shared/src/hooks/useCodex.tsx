import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { CodexEntry, CodexSearchResult, CodexCategory } from '../types/codex.types';
import { buildCodexIndex, type CodexDataSources } from '../utils/codexIndex';
import { initCodexSearchWithCache, searchCodex, getAllEntries } from '../utils/codexSearch';
import { useCodexBookmarks } from '../hooks/useCodexBookmarks';

// ── Context shape ────────────────────────────────────────────────────────────

interface CodexContextValue {
  /** All codex entries */
  entries: CodexEntry[];
  /** Fuzzy-search the codex */
  search: (query: string, limit?: number) => CodexSearchResult[];
  /** Get a single entry by its ID */
  getEntry: (id: string) => CodexEntry | undefined;
  /** Entries grouped by category */
  byCategory: Record<string, CodexEntry[]>;

  // ── Navigation state ───────────────────────────────────────────────────
  /** Currently viewed entry (for the full Codex Viewer) */
  activeEntry: CodexEntry | null;
  setActiveEntry: (entry: CodexEntry | null) => void;
  /** Navigate to an entry by ID */
  openEntry: (id: string) => void;

  // ── Command palette ────────────────────────────────────────────────────
  isPaletteOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;

  // ── Codex viewer ───────────────────────────────────────────────────────
  isViewerOpen: boolean;
  openViewer: (entryId?: string) => void;
  closeViewer: () => void;

  // ── Popup ──────────────────────────────────────────────────────────────
  popupEntry: CodexEntry | null;
  openPopup: (id: string) => void;
  closePopup: () => void;

  // ── Bookmarks ──────────────────────────────────────────────────────────
  bookmarkedIds: string[];
  isBookmarked: (id: string) => boolean;
  toggleBookmark: (id: string) => void;
}

const CodexContext = createContext<CodexContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

interface CodexProviderProps {
  dataSources: CodexDataSources;
  children: React.ReactNode;
}

export function CodexProvider({ dataSources, children }: CodexProviderProps) {
  // Build and index entries whenever data sources change
  const entries = useMemo(() => {
    const idx = buildCodexIndex(dataSources);
    initCodexSearchWithCache(idx);
    return idx;
  }, [dataSources]);

  const byCategory = useMemo(() => {
    const map: Record<string, CodexEntry[]> = {};
    for (const e of entries) {
      (map[e.category] ??= []).push(e);
    }
    return map;
  }, [entries]);

  const getEntry = useCallback(
    (id: string) => entries.find((e) => e.id === id),
    [entries],
  );

  // ── Navigation state ───────────────────────────────────────────────────
  const [activeEntry, setActiveEntry] = useState<CodexEntry | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [popupEntry, setPopupEntry] = useState<CodexEntry | null>(null);

  const openEntry = useCallback(
    (id: string) => {
      const entry = entries.find((e) => e.id === id);
      if (entry) setActiveEntry(entry);
    },
    [entries],
  );

  const openPalette = useCallback(() => setIsPaletteOpen(true), []);
  const closePalette = useCallback(() => setIsPaletteOpen(false), []);
  const togglePalette = useCallback(() => setIsPaletteOpen((v) => !v), []);

  const openViewer = useCallback(
    (entryId?: string) => {
      if (entryId) openEntry(entryId);
      setIsViewerOpen(true);
    },
    [openEntry],
  );
  const closeViewer = useCallback(() => {
    setIsViewerOpen(false);
    setActiveEntry(null);
  }, []);

  const openPopup = useCallback(
    (id: string) => {
      const entry = entries.find((e) => e.id === id);
      if (entry) setPopupEntry(entry);
    },
    [entries],
  );
  const closePopup = useCallback(() => setPopupEntry(null), []);

  // ── Bookmarks ──────────────────────────────────────────────────────────
  const { bookmarks, isBookmarked, toggleBookmark } = useCodexBookmarks();
  const bookmarkedIds = useMemo(() => bookmarks.map((b) => b.entryId), [bookmarks]);

  // ── Keyboard shortcut (Ctrl/Cmd + K) ──────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        togglePalette();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePalette]);

  const value: CodexContextValue = useMemo(
    () => ({
      entries,
      search: searchCodex,
      getEntry,
      byCategory,
      activeEntry,
      setActiveEntry,
      openEntry,
      isPaletteOpen,
      openPalette,
      closePalette,
      togglePalette,
      isViewerOpen,
      openViewer,
      closeViewer,
      popupEntry,
      openPopup,
      closePopup,
      bookmarkedIds,
      isBookmarked,
      toggleBookmark,
    }),
    [
      entries, getEntry, byCategory,
      activeEntry, openEntry,
      isPaletteOpen, openPalette, closePalette, togglePalette,
      isViewerOpen, openViewer, closeViewer,
      popupEntry, openPopup, closePopup,
      bookmarkedIds, isBookmarked, toggleBookmark,
    ],
  );

  return <CodexContext.Provider value={value}>{children}</CodexContext.Provider>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCodex(): CodexContextValue {
  const ctx = useContext(CodexContext);
  if (!ctx) throw new Error('useCodex must be used within a <CodexProvider>');
  return ctx;
}
