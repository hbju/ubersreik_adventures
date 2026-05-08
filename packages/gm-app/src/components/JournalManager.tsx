import React, { useState, useRef } from 'react';
import { JournalEntry, Character } from '@wfrp/shared';
import styles from './JournalManager.module.css';
import { useJournalContext } from '../context/JournalContext';

interface JournalManagerProps {
  characters: Character[];
  onClose: () => void;
}

export const JournalManager: React.FC<JournalManagerProps> = ({
  characters,
  onClose,
}) => {
  const { entries, createEntry, updateEntry, deleteEntry, isLoading, error } = useJournalContext();
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateEntry = () => {
    const newEntry: JournalEntry = {
      id: crypto.randomUUID(),
      title: 'New Entry',
      content: '',
      imageData: undefined,
      sharedWith: [],
    };
    setSelectedEntry(newEntry);
    setEditingEntry(newEntry);
  };

  const handleSelectEntry = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setEditingEntry({ ...entry });
  };

  const handleSaveEntry = async () => {
    if (!editingEntry) return;

    const existingEntry = entries.find((e) => e.id === editingEntry.id);
    let result;
    if (existingEntry) {
      result = await updateEntry(editingEntry);
    } else {
      result = await createEntry(editingEntry);
    }

    if (result?.error) {
      alert(`Failed to save journal entry: ${result.error.message}`);
      return;
    }

    setSelectedEntry(editingEntry);
  };

  const handleDeleteEntry = async () => {
    if (!editingEntry) return;

    if (
      window.confirm(
        `Are you sure you want to delete "${editingEntry.title}"? This cannot be undone.`
      )
    ) {
      const result = await deleteEntry(editingEntry.id);
      if (result?.error) {
        alert(`Failed to delete journal entry: ${result.error.message}`);
        return;
      }
      setSelectedEntry(null);
      setEditingEntry(null);
    }
  };

  const handleFieldChange = (
    field: keyof JournalEntry,
    value: string | string[] | undefined
  ) => {
    if (!editingEntry) return;
    setEditingEntry({ ...editingEntry, [field]: value });
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('Image must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target?.result as string;
      handleFieldChange('imageData', base64Data);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    handleFieldChange('imageData', undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleToggleCharacter = (characterId: string) => {
    if (!editingEntry) return;

    const sharedWith = editingEntry.sharedWith.filter((id) => id !== 'all');
    const isShared = sharedWith.includes(characterId);

    const newSharedWith = isShared
      ? sharedWith.filter((id) => id !== characterId)
      : [...sharedWith, characterId];

    handleFieldChange('sharedWith', newSharedWith);
  };

  const handleToggleAll = () => {
    if (!editingEntry) return;

    const hasAll = editingEntry.sharedWith.includes('all');
    const newSharedWith = hasAll ? editingEntry.sharedWith.filter((id) => id !== 'all') : [...editingEntry.sharedWith, 'all'];

    handleFieldChange('sharedWith', newSharedWith);
  };

  const isSharedWithAll = editingEntry?.sharedWith.includes('all') ?? false;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.journalManager}>
        <div className={styles.header}>
          <h2>📜 Journal Manager</h2>
          <button className={styles.closeButton} onClick={onClose}>
            Close
          </button>
        </div>

        <div className={styles.content}>
          {error && (
            <div style={{ color: '#ff6b6b', padding: '8px 12px' }}>
              {error}
            </div>
          )}
          {isLoading && (
            <div style={{ color: '#aaa', padding: '8px 12px' }}>
              Loading journal entries...
            </div>
          )}
          {/* Sidebar with entry list */}
          <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <button className={styles.createButton} onClick={handleCreateEntry}>
                ➕ Create New Entry
              </button>
            </div>

            <div className={styles.entriesList}>
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className={`${styles.entryItem} ${selectedEntry?.id === entry.id ? styles.selected : ''
                    }`}
                  onClick={() => handleSelectEntry(entry)}
                >
                  <div className={styles.entryTitle}>{entry.title}</div>
                  <div className={styles.entryShared}>
                    {entry.sharedWith.includes('all')
                      ? 'Shared with: All'
                      : entry.sharedWith.length > 0
                        ? `Shared with: ${entry.sharedWith.length} character(s)`
                        : 'Not shared'}
                  </div>
                </div>
              ))}
              {entries.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>
                  No entries yet. Create one to get started!
                </div>
              )}
            </div>
          </div>

          {/* Editor panel */}
          <div className={styles.editor}>
            {editingEntry ? (
              <>
                <div className={styles.formGroup}>
                  <label>Title</label>
                  <input
                    type="text"
                    value={editingEntry.title}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                    placeholder="Enter entry title..."
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Content</label>
                  <textarea
                    value={editingEntry.content}
                    onChange={(e) => handleFieldChange('content', e.target.value)}
                    placeholder="Enter entry content... You can describe lore, clues, or information the players discover."
                  />
                </div>

                <div className={styles.formGroup}>
                  <label>Image (Optional, max 2MB)</label>
                  <div className={styles.imageUploadSection}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className={styles.fileInput}
                    />
                    {editingEntry.imageData && (
                      <div className={styles.imagePreview}>
                        <img
                          src={editingEntry.imageData}
                          alt="Preview"
                          className={styles.previewImage}
                        />
                        <button
                          type="button"
                          className={styles.removeImageButton}
                          onClick={handleRemoveImage}
                        >
                          ✕ Remove Image
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.sharingSection}>
                  <h3>Share With</h3>

                  <div className={styles.allCheckbox}>
                    <label className={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={isSharedWithAll}
                        onChange={handleToggleAll}
                      />
                      <strong>Share with all players</strong>
                    </label>
                  </div>

                  {!isSharedWithAll && (
                    <div className={styles.characterCheckboxes}>
                      {characters.filter(c => c.userId != null).map((character) => (
                        <label key={character.id} className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={editingEntry.sharedWith.includes(character.id)}
                            onChange={() => handleToggleCharacter(character.id)}
                          />
                          {character.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.actions}>
                  <button className={styles.saveButton} onClick={handleSaveEntry}>
                    💾 Save Entry
                  </button>
                  {entries.some((e) => e.id === editingEntry.id) && (
                    <button className={styles.deleteButton} onClick={handleDeleteEntry}>
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.noSelection}>
                Select an entry to edit or create a new one
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default JournalManager;
