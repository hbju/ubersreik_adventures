import React from 'react';
import { fumblesData } from '@wfrp/shared';
import styles from './FumbleModal.module.css';

interface FumbleModalProps {
  fumbleRoll: number;
  onClose: () => void;
  onApplyEffect?: (effect: string, duration: string) => void;
}

export const FumbleModal: React.FC<FumbleModalProps> = ({
  fumbleRoll,
  onClose,
  onApplyEffect
}) => {
  const fumble = fumblesData.find(f => {
    const [min, max] = f.roll.split('-').map(n => parseInt(n));
    return fumbleRoll >= min && fumbleRoll <= max;
  });

  if (!fumble) {
    return (
      <div className={styles.modalBackdrop}>
        <div className={styles.modalContent}>
          <h2>💥 FUMBLE!</h2>
          <p>Roll: {fumbleRoll}</p>
          <p>Fumble result not found.</p>
          <div className={styles.buttonGroup}>
            <button onClick={onClose} className={styles.primaryButton}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  const [title, description] = fumble.description.includes(':')
    ? fumble.description.split(':').map(s => s.trim())
    : [fumble.description, ''];

  const handleApplyEffect = () => {
    if (onApplyEffect) {
      onApplyEffect(fumble.effect, fumble.duration);
    }
    onClose();
  };

  const formatDuration = (duration: string): string => {
    switch (duration) {
      case 'immediate':
        return 'Immediate';
      case 'rounds_d10':
        return '1d10 Rounds';
      case '1_turn':
        return '1 Turn';
      case 'until_medical_attention':
        return 'Until Medical Attention';
      default:
        return duration;
    }
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalContent}>
        <div className={styles.header}>
          <h2>💥 FUMBLE!</h2>
        </div>
        
        <div className={styles.fumbleInfo}>
          <div className={styles.infoRow}>
            <span className={styles.label}>Roll:</span>
            <span className={styles.value}>{fumbleRoll}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.label}>Range:</span>
            <span className={styles.value}>{fumble.roll}</span>
          </div>
        </div>

        <div className={styles.resultSection}>
          <h3 className={styles.resultTitle}>{title}</h3>
          {description && (
            <p className={styles.resultDescription}>{description}</p>
          )}
        </div>

        <div className={styles.effectsSection}>
          <div className={styles.effectRow}>
            <span className={styles.effectLabel}>Effect:</span>
            <span className={styles.effectValue}>{fumble.effect}</span>
          </div>
          <div className={styles.effectRow}>
            <span className={styles.effectLabel}>Duration:</span>
            <span className={styles.effectValue}>{formatDuration(fumble.duration)}</span>
          </div>
        </div>

        <div className={styles.buttonGroup}>
          {onApplyEffect && (
            <button onClick={handleApplyEffect} className={styles.primaryButton}>
              Apply Effect & Close
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
