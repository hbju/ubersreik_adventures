import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useCodex } from '../../hooks/useCodex';
import type { CodexSearchResult, CodexCategory } from '../../types/codex.types';
import styles from './CommandPalette.module.css';

const CATEGORY_ICONS: Record<CodexCategory | string, string> = {
  talents: '🎭',
  skills: '🎲',
  careers: '📜',
  conditions: '🩸',
  qualities: '⚔️',
  'core-rules': '📖',
  combat: '⚔️',
  magic: '🔮',
  equipment: '🛡️',
};

const CATEGORY_LABELS: Record<string, string> = {
  talents: 'Talents',
  skills: 'Skills',
  careers: 'Careers',
  conditions: 'Conditions',
  qualities: 'Qualities & Flaws',
  'core-rules': 'Rules',
  combat: 'Combat',
  magic: 'Magic',
  equipment: 'Equipment',
};

export function CommandPalette() {
  const { isPaletteOpen, closePalette, search, openViewer, entries } = useCodex();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (isPaletteOpen) {
      setQuery('');
      setActiveIndex(0);
      // Focus input after a tick so overlay is rendered
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isPaletteOpen]);

  // Search results
  const results: CodexSearchResult[] = useMemo(() => {
    if (!query.trim()) return [];
    return search(query, 30);
  }, [query, search]);

  // Group results by category for display
  const grouped = useMemo(() => {
    const map: Record<string, CodexSearchResult[]> = {};
    for (const r of results) {
      const cat = r.entry.category;
      (map[cat] ??= []).push(r);
    }
    return map;
  }, [results]);

  // Flat indexable list (for keyboard navigation)
  const flatResults = useMemo(() => {
    const arr: CodexSearchResult[] = [];
    for (const group of Object.values(grouped)) arr.push(...group);
    return arr;
  }, [grouped]);

  // Keep activeIndex in bounds
  useEffect(() => {
    if (activeIndex >= flatResults.length) setActiveIndex(Math.max(0, flatResults.length - 1));
  }, [flatResults.length, activeIndex]);

  // Scroll active item into view
  useEffect(() => {
    const container = resultsRef.current;
    if (!container) return;
    const item = container.querySelector(`.${styles.active}`) as HTMLElement | null;
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const selectResult = useCallback(
    (idx: number) => {
      const r = flatResults[idx];
      if (r) {
        closePalette();
        openViewer(r.entry.id);
      }
    },
    [flatResults, closePalette, openViewer],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          selectResult(activeIndex);
          break;
        case 'Escape':
          e.preventDefault();
          closePalette();
          break;
      }
    },
    [activeIndex, flatResults.length, selectResult, closePalette],
  );

  if (!isPaletteOpen) return null;

  let globalIdx = -1;

  return (
    <div className={styles.overlay} onClick={closePalette}>
      <div className={styles.palette} onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        {/* Search bar */}
        <div className={styles.searchRow}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            ref={inputRef}
            className={styles.searchInput}
            type="text"
            placeholder="Search rules, talents, skills, careers…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
          />
          <span className={styles.shortcut}>ESC</span>
        </div>

        {/* Results */}
        <div className={styles.results} ref={resultsRef}>
          {query.trim() === '' && (
            <div className={styles.emptyState}>
              Type to search the Rules Codex — talents, skills, careers, conditions, rules…
            </div>
          )}

          {query.trim() !== '' && flatResults.length === 0 && (
            <div className={styles.emptyState}>No results for "{query}"</div>
          )}

          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className={styles.groupLabel}>
                {CATEGORY_LABELS[cat] ?? cat}
              </div>
              {items.map((r) => {
                globalIdx++;
                const idx = globalIdx;
                return (
                  <div
                    key={r.entry.id}
                    className={`${styles.resultItem} ${idx === activeIndex ? styles.active : ''}`}
                    onClick={() => selectResult(idx)}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <span className={styles.resultIcon}>
                      {CATEGORY_ICONS[r.entry.category] ?? '📄'}
                    </span>
                    <span className={styles.resultTitle}>{r.entry.title}</span>
                    <span className={styles.resultCategory}>
                      {r.entry.subcategory ?? CATEGORY_LABELS[r.entry.category] ?? r.entry.category}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hints */}
        <div className={styles.footer}>
          <span><span className={styles.footerKey}>↑↓</span> navigate</span>
          <span><span className={styles.footerKey}>↵</span> open</span>
          <span><span className={styles.footerKey}>esc</span> close</span>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;
