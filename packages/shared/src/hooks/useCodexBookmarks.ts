import { useState, useEffect, useCallback } from 'react';
import type { CodexBookmark } from '../types/codex.types';

const STORAGE_KEY = 'codex-bookmarks';

function loadBookmarks(): CodexBookmark[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CodexBookmark[]) : [];
  } catch {
    return [];
  }
}

function saveBookmarks(bookmarks: CodexBookmark[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {
    // localStorage may be unavailable in some Electron contexts — fail silently
  }
}

export function useCodexBookmarks() {
  const [bookmarks, setBookmarks] = useState<CodexBookmark[]>(loadBookmarks);

  // Persist whenever bookmarks change
  useEffect(() => {
    saveBookmarks(bookmarks);
  }, [bookmarks]);

  const addBookmark = useCallback((entryId: string) => {
    setBookmarks((prev) => {
      if (prev.some((b) => b.entryId === entryId)) return prev;
      return [...prev, { entryId, addedAt: Date.now() }];
    });
  }, []);

  const removeBookmark = useCallback((entryId: string) => {
    setBookmarks((prev) => prev.filter((b) => b.entryId !== entryId));
  }, []);

  const isBookmarked = useCallback(
    (entryId: string) => bookmarks.some((b) => b.entryId === entryId),
    [bookmarks],
  );

  const toggleBookmark = useCallback(
    (entryId: string) => {
      if (isBookmarked(entryId)) removeBookmark(entryId);
      else addBookmark(entryId);
    },
    [isBookmarked, addBookmark, removeBookmark],
  );

  return { bookmarks, addBookmark, removeBookmark, isBookmarked, toggleBookmark };
}
