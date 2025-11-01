import React, { useState } from 'react';
import { rolld100, calculateSuccessLevel } from '@wfrp/shared';
import styles from './TestModal.module.css';

interface TestModalProps {
  characterName: string;
  testName: string;
  baseTarget: number;
  onClose: () => void;
  onRoll: (result: any /* TestResultMessage['payload'] */) => void;
}

export const TestModal: React.FC<TestModalProps> = ({ characterName, testName, baseTarget, onClose, onRoll }) => {
  const [modifier, setModifier] = useState(0);
  const finalTarget = baseTarget + modifier;

  const handleRoll = () => {
    const roll = rolld100();
    const sl = calculateSuccessLevel(roll, finalTarget);
    onRoll({
      characterName,
      testName,
      targetNumber: finalTarget,
      rollResult: roll,
      successLevel: sl,
    });
    onClose();
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalContent}>
        <h2>{testName} Test</h2>
        <p>Target: {baseTarget} + ({modifier}) = <strong>{finalTarget}</strong></p>
        <div className={styles.inputGroup}>
          <label>Modifier:</label>
          <input 
            type="number"
            step="10"
            value={modifier}
            onChange={(e) => setModifier(parseInt(e.target.value, 10) || 0)}
            className={styles.modifierInput}
          />
        </div>
        <div className={styles.buttonGroup}>
          <button onClick={handleRoll}>Roll d100</button>
          <button onClick={onClose} className={styles.secondary}>Cancel</button>
        </div>
      </div>
    </div>
  );
};