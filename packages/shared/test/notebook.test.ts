import { describe, it, expect } from 'vitest';
import {
    createNotebook,
    createPage,
    updatePage,
    deletePage,
    reorderPages,
    sortByManual,
    sortByTitle,
    sortByUpdatedAt,
} from '../src/utils/notebook';
import type { Notebook } from '../src/types/notebook.types';

describe('notebook utils', () => {
    describe('createNotebook', () => {
        it('creates an empty notebook', () => {
            const nb = createNotebook();
            expect(nb.pages).toEqual([]);
        });
    });

    describe('createPage', () => {
        it('adds a page to an empty notebook', () => {
            const nb = createNotebook();
            const result = createPage(nb, 'First Page', 'Hello');
            expect(result.pages).toHaveLength(1);
            expect(result.pages[0].title).toBe('First Page');
            expect(result.pages[0].content).toBe('Hello');
            expect(result.pages[0].order).toBe(0);
        });

        it('adds pages with incrementing order', () => {
            let nb = createNotebook();
            nb = createPage(nb, 'Page 1');
            nb = createPage(nb, 'Page 2');
            nb = createPage(nb, 'Page 3');
            expect(nb.pages).toHaveLength(3);
            expect(nb.pages[0].order).toBe(0);
            expect(nb.pages[1].order).toBe(1);
            expect(nb.pages[2].order).toBe(2);
        });

        it('sets createdAt and updatedAt timestamps', () => {
            const nb = createNotebook();
            const result = createPage(nb, 'Test');
            const page = result.pages[0];
            expect(page.createdAt).toBeDefined();
            expect(page.updatedAt).toBeDefined();
            expect(new Date(page.createdAt).getTime()).toBeGreaterThan(0);
        });

        it('generates unique IDs', () => {
            let nb = createNotebook();
            nb = createPage(nb, 'Page 1');
            nb = createPage(nb, 'Page 2');
            expect(nb.pages[0].id).not.toBe(nb.pages[1].id);
        });
    });

    describe('updatePage', () => {
        it('updates page title', () => {
            let nb = createNotebook();
            nb = createPage(nb, 'Old Title');
            const pageId = nb.pages[0].id;
            const result = updatePage(nb, pageId, { title: 'New Title' });
            expect(result.pages[0].title).toBe('New Title');
            expect(result.pages[0].content).toBe('');
        });

        it('updates page content', () => {
            let nb = createNotebook();
            nb = createPage(nb, 'Title', 'old content');
            const pageId = nb.pages[0].id;
            const result = updatePage(nb, pageId, { content: 'new content' });
            expect(result.pages[0].content).toBe('new content');
            expect(result.pages[0].title).toBe('Title');
        });

        it('updates updatedAt timestamp', () => {
            const nb: Notebook = {
                pages: [{
                    id: 'test-page',
                    title: 'Title',
                    content: 'old',
                    order: 0,
                    createdAt: '2024-01-01T00:00:00.000Z',
                    updatedAt: '2024-01-01T00:00:00.000Z',
                }],
            };
            const result = updatePage(nb, 'test-page', { content: 'changed' });
            expect(result.pages[0].updatedAt).not.toBe('2024-01-01T00:00:00.000Z');
            expect(new Date(result.pages[0].updatedAt).getTime()).toBeGreaterThan(
                new Date('2024-01-01T00:00:00.000Z').getTime()
            );
        });

        it('does not modify other pages', () => {
            let nb = createNotebook();
            nb = createPage(nb, 'Page 1', 'content 1');
            nb = createPage(nb, 'Page 2', 'content 2');
            const pageId = nb.pages[0].id;
            const result = updatePage(nb, pageId, { title: 'Changed' });
            expect(result.pages[1].title).toBe('Page 2');
            expect(result.pages[1].content).toBe('content 2');
        });
    });

    describe('deletePage', () => {
        it('removes a page', () => {
            let nb = createNotebook();
            nb = createPage(nb, 'Page 1');
            nb = createPage(nb, 'Page 2');
            const pageId = nb.pages[0].id;
            const result = deletePage(nb, pageId);
            expect(result.pages).toHaveLength(1);
            expect(result.pages[0].title).toBe('Page 2');
        });

        it('recomputes order after deletion', () => {
            let nb = createNotebook();
            nb = createPage(nb, 'Page 1');
            nb = createPage(nb, 'Page 2');
            nb = createPage(nb, 'Page 3');
            const middlePageId = nb.pages[1].id;
            const result = deletePage(nb, middlePageId);
            expect(result.pages[0].order).toBe(0);
            expect(result.pages[1].order).toBe(1);
        });

        it('handles deleting last page', () => {
            let nb = createNotebook();
            nb = createPage(nb, 'Only Page');
            const pageId = nb.pages[0].id;
            const result = deletePage(nb, pageId);
            expect(result.pages).toHaveLength(0);
        });

        it('does nothing for non-existent page id', () => {
            let nb = createNotebook();
            nb = createPage(nb, 'Page 1');
            const result = deletePage(nb, 'non-existent-id');
            expect(result.pages).toHaveLength(1);
        });
    });

    describe('reorderPages', () => {
        it('moves a page from first to last', () => {
            let nb = createNotebook();
            nb = createPage(nb, 'Page A');
            nb = createPage(nb, 'Page B');
            nb = createPage(nb, 'Page C');
            const result = reorderPages(nb, 0, 2);
            const sorted = sortByManual(result.pages);
            expect(sorted[0].title).toBe('Page B');
            expect(sorted[1].title).toBe('Page C');
            expect(sorted[2].title).toBe('Page A');
        });

        it('moves a page from last to first', () => {
            let nb = createNotebook();
            nb = createPage(nb, 'Page A');
            nb = createPage(nb, 'Page B');
            nb = createPage(nb, 'Page C');
            const result = reorderPages(nb, 2, 0);
            const sorted = sortByManual(result.pages);
            expect(sorted[0].title).toBe('Page C');
            expect(sorted[1].title).toBe('Page A');
            expect(sorted[2].title).toBe('Page B');
        });

        it('recomputes order values sequentially', () => {
            let nb = createNotebook();
            nb = createPage(nb, 'Page A');
            nb = createPage(nb, 'Page B');
            nb = createPage(nb, 'Page C');
            const result = reorderPages(nb, 0, 2);
            const sorted = sortByManual(result.pages);
            expect(sorted[0].order).toBe(0);
            expect(sorted[1].order).toBe(1);
            expect(sorted[2].order).toBe(2);
        });

        it('handles same index (no-op)', () => {
            let nb = createNotebook();
            nb = createPage(nb, 'Page A');
            nb = createPage(nb, 'Page B');
            const result = reorderPages(nb, 0, 0);
            const sorted = sortByManual(result.pages);
            expect(sorted[0].title).toBe('Page A');
            expect(sorted[1].title).toBe('Page B');
        });
    });

    describe('sort helpers', () => {
        function makeNotebook(): Notebook {
            return {
                pages: [
                    { id: '1', title: 'Zebra', content: '', order: 2, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-03T00:00:00Z' },
                    { id: '2', title: 'Apple', content: '', order: 0, createdAt: '2024-01-02T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
                    { id: '3', title: 'Mango', content: '', order: 1, createdAt: '2024-01-03T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z' },
                ],
            };
        }

        it('sortByManual sorts by order ascending', () => {
            const sorted = sortByManual(makeNotebook().pages);
            expect(sorted.map(p => p.title)).toEqual(['Apple', 'Mango', 'Zebra']);
        });

        it('sortByTitle sorts alphabetically case-insensitive', () => {
            const sorted = sortByTitle(makeNotebook().pages);
            expect(sorted.map(p => p.title)).toEqual(['Apple', 'Mango', 'Zebra']);
        });

        it('sortByUpdatedAt sorts most recent first', () => {
            const sorted = sortByUpdatedAt(makeNotebook().pages);
            expect(sorted.map(p => p.title)).toEqual(['Zebra', 'Mango', 'Apple']);
        });

        it('sort functions do not mutate the original array', () => {
            const pages = makeNotebook().pages;
            const originalOrder = pages.map(p => p.id);
            sortByManual(pages);
            sortByTitle(pages);
            sortByUpdatedAt(pages);
            expect(pages.map(p => p.id)).toEqual(originalOrder);
        });
    });
});
