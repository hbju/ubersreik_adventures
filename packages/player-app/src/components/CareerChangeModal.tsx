import React, { useState } from 'react';
import { Character, Career, CareerLevel, useGameData, getAvailableCareerChanges } from '@wfrp/shared';
import styles from './CareerChangeModal.module.css';

interface CareerChangeModalProps {
  character: Character;
  onRequestChange: (careerId: string, careerLevelId: string, careerName: string, levelName: string, xpCost: number) => void;
  onClose: () => void;
}

export const CareerChangeModal: React.FC<CareerChangeModalProps> = ({
  character,
  onRequestChange,
  onClose
}) => {
  const [selectedOption, setSelectedOption] = useState<{
    career: Career;
    level: CareerLevel;
    cost: number;
  } | null>(null);

  const gameData = useGameData();
  const careers = gameData.careers as Career[];
  
  const availableChanges = getAvailableCareerChanges(character, careers);

  // Group by cost and career class
  const sameCareer = availableChanges.filter(opt => opt.career.id === character.currentCareerId);
  const sameClass = availableChanges.filter(
    opt => opt.career.id !== character.currentCareerId && opt.cost === 100
  );
  const differentClass = availableChanges.filter(opt => opt.cost === 200);

  const handleRequestChange = () => {
    if (!selectedOption) return;
    
    onRequestChange(
      selectedOption.career.id,
      selectedOption.level.id,
      selectedOption.career.name,
      selectedOption.level.name,
      selectedOption.cost
    );
    onClose();
  };

  const renderOption = (opt: { career: Career; level: CareerLevel; cost: number }) => {
    const isSelected = selectedOption?.career.id === opt.career.id && selectedOption?.level.id === opt.level.id;
    const canAfford = character.xp.current >= opt.cost;

    return (
      <div
        key={`${opt.career.id}-${opt.level.id}`}
        className={`${styles.option} ${isSelected ? styles.selected : ''} ${!canAfford ? styles.disabled : ''}`}
        onClick={() => canAfford && setSelectedOption(opt)}
      >
        <div className={styles.optionHeader}>
          <h4>{opt.career.name}</h4>
          <span className={styles.cost}>{opt.cost} XP</span>
        </div>
        <div className={styles.optionBody}>
          <p className={styles.levelName}>{opt.level.name} (Level {opt.level.lvl})</p>
          <p className={styles.classInfo}><strong>Class:</strong> {opt.career.class}</p>
          <div className={styles.levelDetails}>
            <div className={styles.detailItem}>
              <strong>Characteristics:</strong> {opt.level.characteristic_advances.join(', ')}
            </div>
            <div className={styles.detailItem}>
              <strong>Skills:</strong> {opt.level.skills_ids.length} available
            </div>
            <div className={styles.detailItem}>
              <strong>Talents:</strong> {opt.level.talent_ids.length} available
            </div>
          </div>
        </div>
        {!canAfford && <div className={styles.insufficientXP}>Insufficient XP</div>}
      </div>
    );
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Change Career</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.content}>
          <div className={styles.info}>
            <p>Your Current XP: <strong>{character.xp.current}</strong></p>
            <p>Select a new career path to request approval from the GM.</p>
          </div>

          {sameCareer.length > 0 && (
            <div className={styles.section}>
              <h3>Advance Within Current Career (100 XP)</h3>
              <div className={styles.optionsList}>
                {sameCareer.map(renderOption)}
              </div>
            </div>
          )}

          {sameClass.length > 0 && (
            <div className={styles.section}>
              <h3>Change to Same Class Career (100 XP)</h3>
              <div className={styles.optionsList}>
                {sameClass.map(renderOption)}
              </div>
            </div>
          )}

          {differentClass.length > 0 && (
            <div className={styles.section}>
              <h3>Change to Different Class (200 XP)</h3>
              <div className={styles.optionsList}>
                {differentClass.map(renderOption)}
              </div>
            </div>
          )}
        </div>

        <div className={styles.actions}>
          <button
            className={styles.requestButton}
            onClick={handleRequestChange}
            disabled={!selectedOption}
          >
            Request Change
          </button>
          <button className={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
