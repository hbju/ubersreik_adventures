import type { Notebook, NotebookPage } from '../types/notebook.types';

/**
 * Generate a unique ID for a notebook page
 */
function generatePageId(): string {
    return `page-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new empty notebook
 */
export function createNotebook(): Notebook {
    return { pages: [] };
}

/**
 * Create a new page and add it to the notebook
 */
export function createPage(notebook: Notebook, title: string, content: string = ''): Notebook {
    const now = new Date().toISOString();
    const maxOrder = notebook.pages.length > 0
        ? Math.max(...notebook.pages.map(p => p.order))
        : -1;

    const newPage: NotebookPage = {
        id: generatePageId(),
        title,
        content,
        order: maxOrder + 1,
        createdAt: now,
        updatedAt: now,
    };

    return {
        pages: [...notebook.pages, newPage],
    };
}

/**
 * Update an existing page's content and/or title
 */
export function updatePage(
    notebook: Notebook,
    pageId: string,
    updates: Partial<Pick<NotebookPage, 'title' | 'content'>>
): Notebook {
    return {
        pages: notebook.pages.map(page =>
            page.id === pageId
                ? { ...page, ...updates, updatedAt: new Date().toISOString() }
                : page
        ),
    };
}

/**
 * Delete a page from the notebook and recompute order values
 */
export function deletePage(notebook: Notebook, pageId: string): Notebook {
    const filtered = notebook.pages.filter(p => p.id !== pageId);
    return {
        pages: recomputeOrder(filtered),
    };
}

/**
 * Reorder pages: move the page at `fromIndex` to `toIndex` (both based on sorted order)
 */
export function reorderPages(notebook: Notebook, fromIndex: number, toIndex: number): Notebook {
    const sorted = sortByManual(notebook.pages);
    const [moved] = sorted.splice(fromIndex, 1);
    if (!moved) return notebook;
    sorted.splice(toIndex, 0, moved);

    return {
        pages: recomputeOrder(sorted),
    };
}

/**
 * Recompute `order` values sequentially (0, 1, 2, ...)
 */
function recomputeOrder(pages: NotebookPage[]): NotebookPage[] {
    return pages.map((page, index) => ({
        ...page,
        order: index,
    }));
}

export function sortPages(pages: NotebookPage[], method: 'manual' | 'title' | 'updatedAt' = 'manual'): NotebookPage[] {
    switch (method) {
        case 'title':
            return sortByTitle(pages);
        case 'updatedAt':
            return sortByUpdatedAt(pages);
        default:
            return sortByManual(pages);
    }
}

/**
 * Sort pages by their manual order field (ascending)
 */
export function sortByManual(pages: NotebookPage[]): NotebookPage[] {
    return [...pages].sort((a, b) => a.order - b.order);
}

/**
 * Sort pages by title (alphabetical, case-insensitive)
 */
export function sortByTitle(pages: NotebookPage[]): NotebookPage[] {
    return [...pages].sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
}

/**
 * Sort pages by last updated (most recent first)
 */
export function sortByUpdatedAt(pages: NotebookPage[]): NotebookPage[] {
    return [...pages].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
