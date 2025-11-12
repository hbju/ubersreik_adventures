import React, { useState } from 'react';
import styles from './ConditionTestModal.module.css';
import { Character } from '@wfrp/shared';
import { rolld100, calculateSuccessLevel } from '@wfrp/shared';

interface ConditionTestModalProps {
  character: Character;
  testId: string;
  conditionId: string;
  conditionName: string;
  testType: string;
  targetNumber: number;
  modifier: number;
  conditionCount: number;
  description: string;
  onResult: (testId: string, roll: number, sl: number, targetNumber: number) => void;
  onClose: () => void;
}

export const ConditionTestModal: React.FC<ConditionTestModalProps> = ({
  character,
  testId,
  conditionId,
  conditionName,
  testType,
  targetNumber: initialTarget,
  modifier,
  conditionCount,
  description,
  onResult,
  onClose,
}) => {
  const [phase, setPhase] = useState<'prepare' | 'result'>('prepare');
  const [roll, setRoll] = useState<number | null>(null);
  const [successLevel, setSuccessLevel] = useState<number>(0);
  const [targetNumber, setTargetNumber] = useState(initialTarget);
  const [canReroll, setCanReroll] = useState(true);
  const [rollHistory, setRollHistory] = useState<Array<{ roll: number; sl: number; type: string }>>([]);

  const effectiveTarget = targetNumber + modifier;

  const handleRoll = () => {
    const newRoll = rolld100();
    const sl = calculateSuccessLevel(newRoll, effectiveTarget);

    setRoll(newRoll);
    setSuccessLevel(sl);
    setRollHistory(prev => [...prev, { roll: newRoll, sl, type: 'normal' }]);
    setPhase('result');
  };

  const handleReroll = (type: 'fortune' | 'corruption') => {
    if (!canReroll || roll === null) return;

    const newRoll = rolld100();
    const sl = calculateSuccessLevel(newRoll, effectiveTarget);

    setRoll(newRoll);
    setSuccessLevel(sl);
    setRollHistory(prev => [...prev, { roll: newRoll, sl, type }]);
    setCanReroll(false);

    // In a real implementation, you'd spend the fortune/corruption point here
  };

  const handleConfirm = () => {
    if (roll !== null) {
      onResult(testId, roll, successLevel, effectiveTarget);
      onClose();
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalContent}>
        <button className={styles.closeButton} onClick={handleCancel}>×</button>

        <div className={styles.header}>
          <h2>Condition Test: {conditionName}</h2>
          {conditionCount > 1 && <p className={styles.conditionCount}>({conditionCount} instances)</p>}
        </div>

        <div className={styles.conditionInfo}>
          <div className={styles.infoRow}>
            <span className={styles.label}>Test Type:</span>
            <span className={styles.value}>{testType}</span>
          </div>
          <div className={styles.infoRow}>
            <span className={styles.label}>Target:</span>
            <span className={styles.value}>{effectiveTarget}</span>
          </div>
          {modifier !== 0 && (
            <div className={styles.infoRow}>
              <span className={styles.label}>Modifier:</span>
              <span className={styles.value}>{modifier > 0 ? '+' : ''}{modifier}</span>
            </div>
          )}
        </div>

        <div className={styles.description}>
          <h3>Effect</h3>
          <p>{description}</p>
        </div>

        {phase === 'prepare' && (
          <div className={styles.preparePhase}>
            <div className={styles.targetAdjust}>
              <label>Adjust Target Number:</label>
              <input
                type="number"
                value={targetNumber}
                onChange={(e) => setTargetNumber(parseInt(e.target.value) || 0)}
                step="10"
              />
              <span className={styles.effectiveTarget}>
                Effective: {effectiveTarget}
              </span>
            </div>

            <button className={styles.rollButton} onClick={handleRoll}>
              Roll {testType} Test
            </button>
          </div>
        )}

        {phase === 'result' && roll !== null && (
          <div className={styles.resultPhase}>
            <div className={styles.rollResult}>
              <div className={styles.rollDisplay}>
                <span className={styles.rollLabel}>Roll:</span>
                <span className={styles.rollValue}>{roll}</span>
              </div>
              <div className={styles.slDisplay}>
                <span className={styles.slLabel}>Success Level:</span>
                <span className={`${styles.slValue} ${successLevel >= 0 ? styles.success : styles.failure}`}>
                  {successLevel >= 0 ? '+' : ''}{successLevel}
                </span>
              </div>
            </div>

            {successLevel >= 0 ? (
              <div className={styles.successMessage}>
                <h3>✓ Success!</h3>
                <p>
                  You remove <strong>{Math.min(1 + successLevel, conditionCount)}</strong> {conditionName} condition
                  {Math.min(1 + successLevel, conditionCount) > 1 ? 's' : ''}.
                </p>
              </div>
            ) : (
              <div className={styles.failureMessage}>
                <h3>✗ Failed</h3>
                <p>The {conditionName} condition persists.</p>
              </div>
            )}

            {rollHistory.length > 0 && (
              <div className={styles.rollHistory}>
                <h4>Roll History:</h4>
                {rollHistory.map((entry, index) => (
                  <div key={index} className={styles.historyEntry}>
                    <span className={styles.historyType}>
                      {entry.type === 'fortune' ? '🍀 Fortune Reroll' : entry.type === 'corruption' ? '💀 Corruption Reroll' : '🎲 Initial Roll'}
                    </span>
                    <span className={styles.historyRoll}>{entry.roll}</span>
                    <span className={`${styles.historySL} ${entry.sl >= 0 ? styles.success : styles.failure}`}>
                      SL {entry.sl >= 0 ? '+' : ''}{entry.sl}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.rerollSection}>
              {canReroll && character.status.fortune.current > 0 && (
                <button className={styles.rerollButton} onClick={() => handleReroll('fortune')}>
                  🍀 Spend Fortune Point to Reroll
                </button>
              )}
              {canReroll && character.status.corruption.current > 0 && (
                <button className={styles.rerollButton} onClick={() => handleReroll('corruption')}>
                  💀 Spend Corruption Point to Reroll
                </button>
              )}
              {!canReroll && <p className={styles.rerollUsed}>Reroll already used for this test</p>}
            </div>

            <div className={styles.actionButtons}>
              <button className={styles.confirmButton} onClick={handleConfirm}>
                Confirm & Send Result
              </button>
              <button className={styles.cancelButton} onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
