import React, { useState } from 'react';
import { JournalEntry } from '@wfrp/shared';
import styles from './JournalView.module.css';

interface JournalViewProps {
  journal: JournalEntry[];
}

export const JournalView: React.FC<JournalViewProps> = ({ journal }) => {
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  const toggleEntry = (entryId: string) => {
    setExpandedEntryId((current) => (current === entryId ? null : entryId));
  };

  if (journal.length === 0) {
    return (
      <div className={styles.journalView}>
        <div className={styles.header}>
          <h1>📜 Your Journal</h1>
        </div>
        <div className={styles.emptyState}>
          Your journal is empty. The GM will share information with you as you discover it during your adventures.
        </div>
      </div>
    );
  }

  return (
    <div className={styles.journalView}>
      <div className={styles.header}>
        <h1>📜 Your Journal</h1>
        <p style={{ margin: '10px 0 0 0', color: '#aaa', fontSize: '14px' }}>
          {journal.length} {journal.length === 1 ? 'entry' : 'entries'}
        </p>
      </div>

      <div className={styles.entriesGrid}>
        {journal.map((entry) => {
          const isExpanded = expandedEntryId === entry.id;

          return (
            <div
              key={entry.id}
              className={`${styles.entryCard} ${isExpanded ? styles.expanded : ''}`}
              onClick={() => toggleEntry(entry.id)}
            >
              <div className={styles.entryHeader}>
                <h2 className={styles.entryTitle}>{entry.title}</h2>
                <span className={`${styles.expandIcon} ${isExpanded ? styles.expanded : ''}`}>
                  {isExpanded ? '▲' : '▼'}
                </span>
              </div>

              {!isExpanded && (
                <div className={styles.entryPreview}>{entry.content}</div>
              )}

              {isExpanded && (
                <>
                  <div className={styles.entryContent}>{entry.content}</div>
                  {entry.imageData && (
                    <img
                      src={entry.imageData}
                      alt={entry.title}
                      className={styles.entryImage}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default JournalView;
