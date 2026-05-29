import React, { useState, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Notebook, NotebookPage } from '../../types/notebook.types';
import { createPage, updatePage, deletePage, reorderPages, sortByManual, sortByTitle, sortByUpdatedAt } from '../../utils/notebook';
import styles from './NotebookView.module.css';
import { useDebouncedCallback } from '../../hooks/useDebounce';

type SortMode = 'manual' | 'title' | 'updatedAt';

export interface NotebookViewProps {
    notebook: Notebook;
    editable: boolean;
    onChange?: (notebook: Notebook) => void;
}

export const NotebookView: React.FC<NotebookViewProps> = ({ notebook, editable, onChange }) => {
    const [activePageId, setActivePageId] = useState<string | null>(() => {
        const sorted = sortByManual(notebook.pages);
        return sorted.length > 0 ? sorted[0].id : null;
    });
    const [showPreview, setShowPreview] = useState(false);
    const [sortMode, setSortMode] = useState<SortMode>('manual');
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [localNotebook, setLocalNotebook] = useState(notebook);

    const getSortedPages = useCallback((): NotebookPage[] => {
        switch (sortMode) {
            case 'title': return sortByTitle(localNotebook.pages);
            case 'updatedAt': return sortByUpdatedAt(localNotebook.pages);
            default: return sortByManual(localNotebook.pages);
        }
    }, [localNotebook.pages, sortMode]);

    const sortedPages = getSortedPages();
    const activePage = localNotebook.pages.find(p => p.id === activePageId) || null;

    const debouncedChange = useDebouncedCallback((updated: Notebook) => {
        onChange?.(updated);
    }, 300);

    const handleAddPage = () => {
        const title = `New Page ${localNotebook.pages.length + 1}`;
        const updated = createPage(localNotebook, title);
        const newPage = updated.pages[updated.pages.length - 1];
        setActivePageId(newPage.id);
        setLocalNotebook(updated);
        debouncedChange(updated);
    };

    const handleDeletePage = (pageId: string) => {
        const updated = deletePage(localNotebook, pageId);
        if (activePageId === pageId) {
            const sorted = sortByManual(updated.pages);
            setActivePageId(sorted.length > 0 ? sorted[0].id : null);
        }
        setLocalNotebook(updated);
        debouncedChange(updated);
    };

    const handleTitleChange = (pageId: string, newTitle: string) => {
        const updated = updatePage(localNotebook, pageId, { title: newTitle });
        setLocalNotebook(updated);
        debouncedChange(updated);
    };

    const handleContentChange = (pageId: string, newContent: string) => {
        const updated = updatePage(localNotebook, pageId, { content: newContent });
        setLocalNotebook(updated);
        debouncedChange(updated);
    };

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent, index: number) => {
        if (sortMode !== 'manual') return;
        setDragIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (dragIndex === null || sortMode !== 'manual') return;
        setDragOverIndex(index);
    };

    const handleDragEnd = () => {
        if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex && sortMode === 'manual') {
            const updated = reorderPages(localNotebook, dragIndex, dragOverIndex);
            setLocalNotebook(updated);
            debouncedChange(updated);
        }
        setDragIndex(null);
        setDragOverIndex(null);
    };

    return (
        <div className={styles.notebookContainer}>
            {/* Sidebar */}
            <div className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                    <h3 className={styles.sidebarTitle}>📓 Notebook</h3>
                    {editable && (
                        <button className={styles.addPageBtn} onClick={handleAddPage} title="Add page">
                            +
                        </button>
                    )}
                </div>

                {/* Sort controls */}
                <div className={styles.sortControls}>
                    <button
                        className={`${styles.sortBtn} ${sortMode === 'manual' ? styles.sortBtnActive : ''}`}
                        onClick={() => setSortMode('manual')}
                    >
                        Manual
                    </button>
                    <button
                        className={`${styles.sortBtn} ${sortMode === 'title' ? styles.sortBtnActive : ''}`}
                        onClick={() => setSortMode('title')}
                    >
                        A-Z
                    </button>
                    <button
                        className={`${styles.sortBtn} ${sortMode === 'updatedAt' ? styles.sortBtnActive : ''}`}
                        onClick={() => setSortMode('updatedAt')}
                    >
                        Recent
                    </button>
                </div>

                {/* Page list */}
                <div className={styles.pageList}>
                    {sortedPages.map((page, index) => (
                        <div
                            key={page.id}
                            className={`${styles.pageItem} ${page.id === activePageId ? styles.pageItemActive : ''} ${dragIndex === index ? styles.pageItemDragging : ''}`}
                            onClick={() => setActivePageId(page.id)}
                            draggable={editable && sortMode === 'manual'}
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnd={handleDragEnd}
                        >
                            {editable && sortMode === 'manual' && (
                                <span className={styles.dragHandle}>⠿</span>
                            )}
                            <span className={styles.pageTitle}>{page.title || 'Untitled'}</span>
                            {editable && (
                                <button
                                    className={styles.deletePageBtn}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeletePage(page.id);
                                    }}
                                    title="Delete page"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Main content */}
            <div className={styles.content}>
                {activePage ? (
                    <>
                        <div className={styles.contentHeader}>
                            {editable ? (
                                <input
                                    className={styles.titleInput}
                                    value={activePage.title}
                                    onChange={(e) => handleTitleChange(activePage.id, e.target.value)}
                                    placeholder="Page title..."
                                />
                            ) : (
                                <span className={styles.titleReadonly}>{activePage.title}</span>
                            )}
                            <button
                                className={`${styles.previewToggle} ${showPreview ? styles.previewToggleActive : ''}`}
                                onClick={() => setShowPreview(!showPreview)}
                            >
                                {showPreview ? '✏️ Edit' : '👁️ Preview'}
                            </button>
                        </div>

                        {!showPreview && editable ? (
                            <div className={styles.editor}>
                                <textarea
                                    ref={textareaRef}
                                    className={styles.textarea}
                                    value={activePage.content}
                                    onChange={(e) => handleContentChange(activePage.id, e.target.value)}
                                    placeholder="Write your notes in markdown..."
                                />
                            </div>
                        ) : (
                            <div className={styles.preview}>
                                <div className={styles.markdownContent}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {activePage.content || '*No content yet.*'}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className={styles.emptyState}>
                        <div className={styles.emptyStateIcon}>📓</div>
                        <div className={styles.emptyStateTitle}>
                            {localNotebook.pages.length === 0 ? 'No Pages Yet' : 'Select a Page'}
                        </div>
                        <div className={styles.emptyStateText}>
                            {localNotebook.pages.length === 0
                                ? 'Click the + button to create your first notebook page.'
                                : 'Select a page from the sidebar to view or edit it.'}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotebookView;
