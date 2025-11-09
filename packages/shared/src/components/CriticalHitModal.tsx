import React from 'react';
import { criticalHitsData } from '@wfrp/shared';
import styles from './CriticalHitModal.module.css';

interface CriticalHitModalProps {
  location: string;
  wounds: number;
  onClose: () => void;
  onApplyEffects?: (effects: string[]) => void;
}

export const CriticalHitModal: React.FC<CriticalHitModalProps> = ({
  location,
  wounds,
  onClose,
  onApplyEffects
}) => {
  const normalizedLocation = location.toLowerCase().replace(/\s+/g, '-');
  const locationData = criticalHitsData.find(c => c.location === normalizedLocation);
  
  if (!locationData) {
    return (
      <div className={styles.modalBackdrop}>
        <div className={styles.modalContent}>
          <h2>⚠️ CRITICAL HIT!</h2>
          <p>Location: {location}</p>
          <p>Wounds Dealt: {wounds}</p>
          <p>Critical hit data not found for this location.</p>
          <div className={styles.buttonGroup}>
            <button onClick={onClose} className={styles.primaryButton}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  const result = locationData.results.find(r => 
    wounds >= r.minWounds && (r.maxWounds === null || wounds <= r.maxWounds)
  );

  if (!result) {
    return (
      <div className={styles.modalBackdrop}>
        <div className={styles.modalContent}>
          <h2>⚠️ CRITICAL HIT!</h2>
          <p>Location: {location}</p>
          <p>Wounds Dealt: {wounds}</p>
          <p>No critical result found for this wound level.</p>
          <div className={styles.buttonGroup}>
            <button onClick={onClose} className={styles.primaryButton}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  const [title, description] = result.description.split(':').map(s => s.trim());

  const handleApplyEffects = () => {
    if (onApplyEffects) {
      // Parse the effect string and extract condition names
      const effects = result.effect.split('_').filter(e => 
        !e.match(/^\d+$/) && e !== 'and'
      );
      onApplyEffects(effects);
    }
    onClose();
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalContent}>
        <div className={styles.header}>
          <h2>⚠️ CRITICAL HIT!</h2>
        </div>
        
        <div className={styles.criticalInfo}>
          <div className={styles.infoRow}>
            <span className={styles.label}>Location:</span>
            <span className={styles.value}>{location}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.label}>Wounds Dealt:</span>
            <span className={styles.value}>{wounds}</span>
          </div>
        </div>

        <div className={styles.resultSection}>
          <h3 className={styles.resultTitle}>{title}</h3>
          <p className={styles.resultDescription}>{description}</p>
        </div>

        <div className={styles.effectsSection}>
          <h4>Effect Code:</h4>
          <div className={styles.effectCode}>{result.effect}</div>
          <p className={styles.effectNote}>
            GM should apply appropriate conditions and injuries to the target.
          </p>
        </div>

        <div className={styles.buttonGroup}>
          {onApplyEffects && (
            <button onClick={handleApplyEffects} className={styles.primaryButton}>
              Apply Effects & Close
            </button>
          )}
          <button onClick={onClose} className={styles.secondaryButton}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
