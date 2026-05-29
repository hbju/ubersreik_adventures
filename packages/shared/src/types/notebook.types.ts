export interface NotebookPage {
    id: string;
    title: string;
    content: string; // markdown
    order: number;
    createdAt: string; // ISO timestamp
    updatedAt: string; // ISO timestamp
}

export interface Notebook {
    pages: NotebookPage[];
}
