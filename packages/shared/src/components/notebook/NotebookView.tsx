import React, { useState, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Notebook, NotebookPage } from '../../types/notebook.types';
import { createPage, updatePage, deletePage, reorderPages, sortPages } from '../../utils/notebook';
import { useDebouncedCallback } from '../../hooks/useDebounce';
import './NotebookView.css';

interface NotebookViewProps {
    notebook: Notebook;
    editable?: boolean;
    onChange?: (notebook: Notebook) => void;
}

export const NotebookView: React.FC<NotebookViewProps> = ({ notebook, editable = false, onChange }) => {
    const sorted = sortPages(notebook.pages);
    const [selectedId, setSelectedId] = useState<string>(sorted[0]?.id ?? '');
    const [isPreview, setIsPreview] = useState(false);
    const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
    const [titleDraft, setTitleDraft] = useState('');
    const dragSourceRef = useRef<number | null>(null);

    const selectedPage = notebook.pages.find(p => p.id === selectedId) ?? sorted[0] ?? null;

    const emit = useCallback((nb: Notebook) => onChange?.(nb), [onChange]);

    // Auto-select first page after add/delete
    const selectOrFirst = useCallback((nb: Notebook, preferredId?: string) => {
        const pages = sortPages(nb.pages);
        const target = preferredId ? pages.find(p => p.id === preferredId) : null;
        setSelectedId(target?.id ?? pages[0]?.id ?? '');
    }, []);

    const handleAddPage = () => {
        if (!editable) return;
        const nb = createPage(notebook, 'New Page', '');
        const newPage = sortPages(nb.pages).at(-1)!;
        emit(nb);
        selectOrFirst(nb, newPage.id);
        if (editable) {
            setEditingTitleId(newPage.id);
            setTitleDraft(newPage.title);
        }
    };

    const handleDeletePage = (pageId: string) => {
        if (!editable) return;
        const nb = deletePage(notebook, pageId);
        emit(nb);
        selectOrFirst(nb);
    };

    const debouncedContentUpdate = useDebouncedCallback((pageId: string, content: string) => {
        emit(updatePage(notebook, pageId, { content }));
    }, 400);

    const [localContent, setLocalContent] = useState<Record<string, string>>({});

    const handleContentChange = (pageId: string, content: string) => {
        setLocalContent(prev => ({ ...prev, [pageId]: content }));
        debouncedContentUpdate(pageId, content);
    };

    const getContent = (page: NotebookPage) =>
        localContent[page.id] !== undefined ? localContent[page.id] : page.content;

    const handleTitleCommit = (pageId: string) => {
        if (titleDraft.trim()) {
            emit(updatePage(notebook, pageId, { title: titleDraft.trim() }));
        }
        setEditingTitleId(null);
    };

    // Drag-to-reorder
    const handleDragStart = (index: number) => { dragSourceRef.current = index; };

    const handleDrop = (targetIndex: number) => {
        if (dragSourceRef.current === null || dragSourceRef.current === targetIndex) return;
        const nb = reorderPages(notebook, dragSourceRef.current, targetIndex);
        emit(nb);
        dragSourceRef.current = null;
    };

    const handleDragOver = (e: React.DragEvent) => e.preventDefault();

    return (
        <div className="notebook-view">
            {/* Sidebar */}
            <aside className="notebook-sidebar">
                <div className="notebook-sidebar-header">
                    <span className="notebook-sidebar-title">Pages</span>
                    {editable && (
                        <button
                            className="notebook-add-btn"
                            onClick={handleAddPage}
                            title="Add page"
                        >
                            +
                        </button>
                    )}
                </div>
                <ul className="notebook-page-list">
                    {sorted.map((page, index) => (
                        <li
                            key={page.id}
                            className={`notebook-page-item${page.id === selectedId ? ' selected' : ''}`}
                            onClick={() => setSelectedId(page.id)}
                            draggable={editable}
                            onDragStart={() => handleDragStart(index)}
                            onDragOver={handleDragOver}
                            onDrop={() => handleDrop(index)}
                        >
                            {editingTitleId === page.id ? (
                                <input
                                    className="notebook-title-input"
                                    value={titleDraft}
                                    autoFocus
                                    onChange={e => setTitleDraft(e.target.value)}
                                    onBlur={() => handleTitleCommit(page.id)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleTitleCommit(page.id);
                                        if (e.key === 'Escape') setEditingTitleId(null);
                                    }}
                                    onClick={e => e.stopPropagation()}
                                />
                            ) : (
                                <span
                                    className="notebook-page-title"
                                    onDoubleClick={editable ? () => {
                                        setEditingTitleId(page.id);
                                        setTitleDraft(page.title);
                                    } : undefined}
                                    title={editable ? 'Double-click to rename' : page.title}
                                >
                                    {page.title || 'Untitled'}
                                </span>
                            )}
                            {editable && sorted.length > 1 && (
                                <button
                                    className="notebook-delete-btn"
                                    title="Delete page"
                                    onClick={e => { e.stopPropagation(); handleDeletePage(page.id); }}
                                >
                                    ×
                                </button>
                            )}
                        </li>
                    ))}
                    {sorted.length === 0 && (
                        <li className="notebook-empty-list">No pages yet.</li>
                    )}
                </ul>
            </aside>

            {/* Editor / Viewer */}
            <main className="notebook-main">
                {selectedPage ? ( 
                    <>
                        <div className="notebook-toolbar">
                            <span className="notebook-page-name">{selectedPage.title || 'Untitled'}</span>
                            {editable && (
                                <button
                                    className={`notebook-preview-btn${isPreview ? ' active' : ''}`}
                                    onClick={() => setIsPreview(v => !v)}
                                >
                                    {isPreview ? '✏️ Edit' : '👁 Preview'}
                                </button>
                            )}
                        </div>
                        {(!editable || isPreview) ? (
                            <div className="notebook-preview">
                                {getContent(selectedPage) ? (
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {getContent(selectedPage)}
                                    </ReactMarkdown>
                                ) : (
                                    <p className="notebook-empty-content">This page is empty.</p>
                                )}
                            </div>
                        ) : (
                            <textarea
                                className="notebook-editor"
                                value={getContent(selectedPage)}
                                onChange={e => handleContentChange(selectedPage.id, e.target.value)}
                                placeholder="Write in markdown..."
                                spellCheck
                            />
                        )}
                    </>
                ) : (
                    <div className="notebook-no-page">
                        {editable
                            ? 'Click + to create your first page.'
                            : 'No pages in this notebook.'}
                    </div>
                )}
            </main>
        </div>
    );
};

export default NotebookView;
