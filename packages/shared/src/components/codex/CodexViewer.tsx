import React, { useMemo, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useCodex } from '../../hooks/useCodex';
import type { CodexEntry, CodexCategory } from '../../types/codex.types';
import { TalentCodexDisplay } from './renderers/TalentCodexDisplay';
import { SkillCodexDisplay } from './renderers/SkillCodexDisplay';
import { CareerCodexDisplay } from './renderers/CareerCodexDisplay';
import { ConditionCodexDisplay } from './renderers/ConditionCodexDisplay';
import { QualityCodexDisplay } from './renderers/QualityCodexDisplay';
import styles from './CodexViewer.module.css';

const CATEGORY_ORDER: CodexCategory[] = [
    'core-rules',
    'combat',
    'magic',
    'skills',
    'talents',
    'careers',
    'conditions',
    'qualities',
];

const CATEGORY_ICONS: Record<string, string> = {
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
    'core-rules': 'Core Rules',
    combat: 'Combat',
    magic: 'Magic',
    equipment: 'Equipment',
};

// ── Cross-link resolver ──────────────────────────────────────────────────────
// Converts internal /codex/... links into onClick handlers that navigate within
// the codex rather than reloading the page.

function useCodexLinkHandler() {
    const { openEntry, entries } = useCodex();

    const handleClick = useCallback(
        (href: string) => {
            // Expect links like /codex/condition/condition_ablaze or /codex/talent/ambidextrous
            const match = href.match(/\/codex\/(\w+[-\w]*)\/?([\w-]*)$/);
            if (!match) return;

            const [, typeOrCategory, slug] = match;

            // Try direct ID match  e.g. "talent:ambidextrous"
            if (slug) {
                const directId = `${typeOrCategory}:${slug}`;
                const entry = entries.find((e) => e.id === directId);
                if (entry) {
                    openEntry(entry.id);
                    return;
                }
            }

            // Try markdown file id  e.g. "md:combat/grappling"
            const mdId = slug ? `md:${typeOrCategory}/${slug}` : `md:${typeOrCategory}`;
            const mdEntry = entries.find((e) => e.id === mdId);
            if (mdEntry) {
                openEntry(mdEntry.id);
                return;
            }

            // Try matching by category only (e.g. /codex/conditions — show first entry)
            const catEntries = entries.filter((e) => e.category === typeOrCategory);
            if (catEntries.length > 0) {
                openEntry(catEntries[0].id);
            }
        },
        [entries, openEntry],
    );

    return handleClick;
}

// ── Main component ───────────────────────────────────────────────────────────

export function CodexViewer() {
    const {
        isViewerOpen,
        closeViewer,
        activeEntry,
        setActiveEntry,
        byCategory,
        bookmarkedIds,
        isBookmarked,
        toggleBookmark,
        entries,
    } = useCodex();

    const [sidebarFilter, setSidebarFilter] = useState('');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const handleLink = useCodexLinkHandler();

    // Bookmarked entries
    const bookmarkedEntries = useMemo(
        () => bookmarkedIds.map((id) => entries.find((e) => e.id === id)).filter(Boolean) as CodexEntry[],
        [bookmarkedIds, entries],
    );

    const toggleGroup = useCallback((cat: string) => {
        setCollapsedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    }, []);

    const filterLc = sidebarFilter.toLowerCase();

    if (!isViewerOpen) return null;

    return (
        <div className={styles.overlay} onClick={closeViewer}>
            <div className={styles.container} onClick={(e) => e.stopPropagation()}>
                {/* ── Sidebar ──────────────────────────────────────────────── */}
                <aside className={styles.sidebar}>
                    <div className={styles.sidebarHeader}>
                        <span className={styles.sidebarTitle}>📚 Codex</span>
                        <button className={styles.sidebarClose} onClick={closeViewer} title="Close">
                            ✕
                        </button>
                    </div>

                    <input
                        className={styles.sidebarSearch}
                        type="text"
                        placeholder="Filter…"
                        value={sidebarFilter}
                        onChange={(e) => setSidebarFilter(e.target.value)}
                    />

                    <div className={styles.sidebarList}>
                        {/* Bookmarks */}
                        {bookmarkedEntries.length > 0 && (
                            <div className={styles.sidebarGroup}>
                                <div className={styles.sidebarGroupHeader} onClick={() => toggleGroup('bookmarks')}>
                                    <span className={styles.sidebarGroupIcon}>⭐</span>
                                    Bookmarks
                                    <span className={styles.sidebarGroupCount}>{bookmarkedEntries.length}</span>
                                </div>
                                {!collapsedGroups.has('bookmarks') &&
                                    bookmarkedEntries
                                        .filter((e) => !filterLc || e.title.toLowerCase().includes(filterLc))
                                        .map((entry) => (
                                            <button
                                                key={entry.id}
                                                className={`${styles.sidebarItem} ${activeEntry?.id === entry.id ? styles.active : ''}`}
                                                onClick={() => setActiveEntry(entry)}
                                                title={entry.title}
                                            >
                                                <span className={styles.bookmarkIcon}>⭐</span>
                                                {entry.title}
                                            </button>
                                        ))}
                            </div>
                        )}

                        {/* Category groups */}
                        {CATEGORY_ORDER.map((cat) => {
                            const catEntries = byCategory[cat];
                            if (!catEntries || catEntries.length === 0) return null;
                            const filtered = filterLc
                                ? catEntries.filter((e) => e.title.toLowerCase().includes(filterLc))
                                : catEntries;
                            if (filtered.length === 0) return null;

                            return (
                                <div key={cat} className={styles.sidebarGroup}>
                                    <div className={styles.sidebarGroupHeader} onClick={() => toggleGroup(cat)}>
                                        <span className={styles.sidebarGroupIcon}>{CATEGORY_ICONS[cat] ?? '📄'}</span>
                                        {CATEGORY_LABELS[cat] ?? cat}
                                        <span className={styles.sidebarGroupCount}>{filtered.length}</span>
                                    </div>
                                    {!collapsedGroups.has(cat) &&
                                        filtered.map((entry) => (
                                            <button
                                                key={entry.id}
                                                className={`${styles.sidebarItem} ${activeEntry?.id === entry.id ? styles.active : ''}`}
                                                onClick={() => setActiveEntry(entry)}
                                                title={entry.title}
                                            >
                                                {entry.title}
                                            </button>
                                        ))}
                                </div>
                            );
                        })}
                    </div>
                </aside>

                {/* ── Main reading pane ────────────────────────────────────── */}
                <div className={styles.mainPane}>
                    {activeEntry ? (
                        <>
                            <div className={styles.mainHeader}>
                                <span className={styles.mainTitle}>{activeEntry.title}</span>
                                <span className={styles.categoryBadge}>
                                    {CATEGORY_LABELS[activeEntry.category] ?? activeEntry.category}
                                </span>
                                <button
                                    className={`${styles.bookmarkButton} ${isBookmarked(activeEntry.id) ? styles.bookmarked : ''}`}
                                    onClick={() => toggleBookmark(activeEntry.id)}
                                    title={isBookmarked(activeEntry.id) ? 'Remove bookmark' : 'Add bookmark'}
                                >
                                    {isBookmarked(activeEntry.id) ? '★' : '☆'}
                                </button>
                            </div>
                            <div className={styles.mainContent}>
                                <EntryRenderer entry={activeEntry} onLinkClick={handleLink} />
                            </div>
                        </>
                    ) : (
                        <div className={styles.emptyPane}>
                            <span className={styles.emptyIcon}>📚</span>
                            <span>Select an entry from the sidebar</span>
                            <span>or press <strong>Ctrl+K</strong> to search</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Entry renderer (delegates to type-specific renderer) ─────────────────────

interface EntryRendererProps {
    entry: CodexEntry;
    onLinkClick: (href: string) => void;
}

function EntryRenderer({ entry, onLinkClick }: EntryRendererProps) {
    if (entry.type === 'markdown') {
        return (
            <div className={styles.markdownBody}>
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        a: ({ href, children }) => (
                            <a
                                href={href}
                                onClick={(e) => {
                                    if (href && href.startsWith('/codex/')) {
                                        e.preventDefault();
                                        onLinkClick(href);
                                    }
                                }}
                            >
                                {children}
                            </a>
                        ),
                    }}
                >
                    {entry.content as string}
                </ReactMarkdown>
            </div>
        );
    }

    // JSON-based entries
    switch (entry.category) {
        case 'talents':
            return <TalentCodexDisplay data={entry.content} />;
        case 'skills':
            return <SkillCodexDisplay data={entry.content} />;
        case 'careers':
            return <CareerCodexDisplay data={entry.content} onLinkClick={onLinkClick} />;
        case 'conditions':
            return <ConditionCodexDisplay data={entry.content} />;
        case 'qualities':
            return <QualityCodexDisplay data={entry.content} />;
        default:
            return (
                <div className={styles.jsonDisplay}>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#8a8aaa' }}>
                        {JSON.stringify(entry.content, null, 2)}
                    </pre>
                </div>
            );
    }
}

export default CodexViewer;
