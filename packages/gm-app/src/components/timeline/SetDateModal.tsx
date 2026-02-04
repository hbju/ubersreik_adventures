import React, { useState } from 'react';
import { GameDate, MONTHS } from '@wfrp/shared';
import styles from './TimelineManager.module.css';

interface SetDateModalProps {
  currentDate: GameDate;
  onSetDate: (date: GameDate) => void;
  onClose: () => void;
}

export const SetDateModal: React.FC<SetDateModalProps> = ({
  currentDate,
  onSetDate,
  onClose
}) => {
  const [year, setYear] = useState(currentDate.year);
  const [monthIndex, setMonthIndex] = useState(currentDate.monthIndex);
  const [day, setDay] = useState(currentDate.day);

  const maxDays = MONTHS[monthIndex].days;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate day is within month range
    const validDay = Math.min(Math.max(1, day), maxDays);
    
    onSetDate({
      year,
      monthIndex,
      day: validDay
    });
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalSmall} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Set Date</h2>
          <button className={styles.modalClose} onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Day</label>
                <input
                  type="number"
                  className={styles.formInput}
                  value={day}
                  onChange={e => setDay(Math.min(maxDays, Math.max(1, parseInt(e.target.value) || 1)))}
                  min={1}
                  max={maxDays}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Month</label>
                <select
                  className={styles.formSelect}
                  value={monthIndex}
                  onChange={e => {
                    const newMonth = parseInt(e.target.value);
                    setMonthIndex(newMonth);
                    // Adjust day if it exceeds new month's days
                    setDay(prev => Math.min(prev, MONTHS[newMonth].days));
                  }}
                >
                  {MONTHS.map((month, index) => (
                    <option key={month.name} value={index}>
                      {month.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Year</label>
                <input
                  type="number"
                  className={styles.formInput}
                  value={year}
                  onChange={e => setYear(parseInt(e.target.value) || 2512)}
                  min={1}
                />
              </div>
            </div>

            <div className={styles.quickDates}>
              <span className={styles.quickDatesLabel}>Quick Set:</span>
              <button
                type="button"
                className={styles.quickDateButton}
                onClick={() => { setYear(2512); setMonthIndex(2); setDay(1); }}
              >
                Start of 2512
              </button>
              <button
                type="button"
                className={styles.quickDateButton}
                onClick={() => { setYear(2513); setMonthIndex(0); setDay(1); }}
              >
                Start of 2513
              </button>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <div className={styles.modalActions}>
              <button type="button" className={styles.cancelButton} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className={styles.saveButton}>
                Set Date
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SetDateModal;
