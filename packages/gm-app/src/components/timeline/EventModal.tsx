import React, { useState, useEffect } from 'react';
import {
  GameDate,
  TimelineEvent,
  formatDate,
  DEFAULT_EVENT_TAGS
} from '@wfrp/shared';
import styles from './TimelineManager.module.css';

interface EventModalProps {
  event: TimelineEvent | null;
  date: GameDate;
  availableTags: string[];
  onSave: (event: TimelineEvent) => void;
  onDelete: (eventId: string) => void;
  onClose: () => void;
}

export const EventModal: React.FC<EventModalProps> = ({
  event,
  date,
  availableTags,
  onSave,
  onDelete,
  onClose
}) => {
  const isEditing = event !== null;
  
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(event?.tags || []);
  const [color, setColor] = useState(event?.color || DEFAULT_EVENT_TAGS['Plot']);
  const [isHidden, setIsHidden] = useState(event?.isHidden || false);

  // Update color when tags change
  useEffect(() => {
    if (selectedTags.length > 0 && !event?.color) {
      // Set color based on first tag
      const firstTag = selectedTags[0];
      if (DEFAULT_EVENT_TAGS[firstTag]) {
        setColor(DEFAULT_EVENT_TAGS[firstTag]);
      }
    }
  }, [selectedTags, event?.color]);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert('Please enter a title for the event.');
      return;
    }

    const savedEvent: TimelineEvent = {
      id: event?.id || crypto.randomUUID(),
      date: event?.date || date,
      title: title.trim(),
      description: description.trim(),
      tags: selectedTags,
      color,
      isHidden
    };

    onSave(savedEvent);
  };

  const handleDelete = () => {
    if (event && window.confirm(`Delete "${event.title}"? This cannot be undone.`)) {
      onDelete(event.id);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>{isEditing ? 'Edit Event' : 'Create Event'}</h2>
          <div className={styles.modalDate}>
            📅 {formatDate(event?.date || date, true)}
          </div>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Title *</label>
            <input
              type="text"
              className={styles.formInput}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Event title..."
              autoFocus
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description</label>
            <textarea
              className={styles.formTextarea}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Event details..."
              rows={4}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Tags</label>
            <div className={styles.tagSelector}>
              {availableTags.map(tag => (
                <button
                  key={tag}
                  className={`${styles.tagButton} ${selectedTags.includes(tag) ? styles.tagSelected : ''}`}
                  onClick={() => handleTagToggle(tag)}
                  style={{
                    borderColor: DEFAULT_EVENT_TAGS[tag] || '#6c757d',
                    backgroundColor: selectedTags.includes(tag)
                      ? (DEFAULT_EVENT_TAGS[tag] || '#6c757d')
                      : 'transparent',
                    color: selectedTags.includes(tag) ? '#fff' : '#d4af37'
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Color</label>
              <input
                type="color"
                className={styles.formColorPicker}
                value={color}
                onChange={e => setColor(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                <input
                  type="checkbox"
                  checked={isHidden}
                  onChange={e => setIsHidden(e.target.checked)}
                />
                Hidden from Players
              </label>
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          {isEditing && (
            <button className={styles.deleteButton} onClick={handleDelete}>
              Delete Event
            </button>
          )}
          <div className={styles.modalActions}>
            <button className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
            <button className={styles.saveButton} onClick={handleSave}>
              {isEditing ? 'Save Changes' : 'Create Event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventModal;
