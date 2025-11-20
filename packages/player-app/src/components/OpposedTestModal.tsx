import React, { useState } from 'react';
import { rolld100, calculateSuccessLevel } from '@wfrp/shared';
import styles from './OpposedTestModal.module.css';

interface OpposedTestModalProps {
    testId: string;
    role: 'attacker' | 'defender';
    skillName: string;
    targetNumber: number;
    modifier: number;
    fortunePoints: number;
    corruptionCurrent: number;
    corruptionMax: number;
    onRollComplete: (rollResult: number, successLevel: number, fortuneSpent: number, corruptionGained: number) => void;
    onClose: () => void;
}

export const OpposedTestModal: React.FC<OpposedTestModalProps> = ({
    testId,
    role,
    skillName,
    targetNumber,
    modifier,
    fortunePoints,
    corruptionCurrent,
    corruptionMax,
    onRollComplete,
    onClose
}) => {
    const [rolled, setRolled] = useState(false);
    const [rollResult, setRollResult] = useState<number | null>(null);
    const [successLevel, setSuccessLevel] = useState<number | null>(null);
    const [rollCount, setRollCount] = useState(0);
    const [fortuneSpent, setFortuneSpent] = useState(0);
    const [corruptionGained, setCorruptionGained] = useState(0);

    const finalTarget = targetNumber + modifier;

    const handleRoll = () => {
        const result = rolld100();
        const sl = calculateSuccessLevel(result, finalTarget);
        
        setRollResult(result);
        setSuccessLevel(sl);
        setRolled(true);
        setRollCount(prev => prev + 1);
    };

    const handleReroll = () => {
        // Determine cost for this reroll
        if (rollCount === 1) {
            // First reroll
            if (fortunePoints - fortuneSpent > 0) {
                // Use Fortune point
                setFortuneSpent(prev => prev + 1);
            } else {
                // No Fortune, must use Corruption
                if (corruptionCurrent + corruptionGained < corruptionMax) {
                    setCorruptionGained(prev => prev + 1);
                } else {
                    alert('Cannot reroll: at maximum Corruption!');
                    return;
                }
            }
        } else if (rollCount === 2) {
            // Second reroll - must use Corruption
            if (corruptionCurrent + corruptionGained < corruptionMax) {
                setCorruptionGained(prev => prev + 1);
            } else {
                alert('Cannot reroll: at maximum Corruption!');
                return;
            }
        }

        // Perform the reroll
        const result = rolld100();
        const sl = calculateSuccessLevel(result, finalTarget);
        
        setRollResult(result);
        setSuccessLevel(sl);
        setRollCount(prev => prev + 1);
    };

    const handleConfirm = () => {
        if (rollResult !== null && successLevel !== null) {
            onRollComplete(rollResult, successLevel, fortuneSpent, corruptionGained);
            onClose();
        }
    };

    const canReroll = () => {
        if (rollCount >= 3) return false; // Max 3 rolls total (1 initial + 2 rerolls)
        if (rollCount === 1) {
            // Can reroll if have Fortune. Can always gain corruption
            return (fortunePoints - fortuneSpent > 0);
        }
        if (rollCount === 2) {
            // Can only reroll with Corruption
            return corruptionGained == 0;
        }
        return false;
    };

    const getRerollButtonText = () => {
        if (rollCount === 1) {
            if (fortunePoints - fortuneSpent > 0) {
                return `🔄 Reroll (Fortune Point)`;
            } else {
                return `🔄 Reroll (Corruption Point)`;
            }
        }
        return `🔄 Reroll (Corruption Point)`;
    };

    const getRoleText = () => {
        if (role === 'attacker') {
            return 'You are attacking!';
        }
        return 'You are defending!';
    };

    const getRoleClass = () => {
        return role === 'attacker' ? styles.attackRole : styles.defendRole;
    };

    return (
        <div className={styles.modalBackdrop} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={getRoleClass()}>{getRoleText()}</h2>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>

                <div className={styles.body}>
                    <div className={styles.testInfo}>
                        <div className={styles.infoRow}>
                            <span className={styles.label}>Skill/Test:</span>
                            <span className={styles.value}>{skillName}</span>
                        </div>
                        <div className={styles.infoRow}>
                            <span className={styles.label}>Base Target:</span>
                            <span className={styles.value}>{targetNumber}</span>
                        </div>
                        {modifier !== 0 && (
                            <div className={styles.infoRow}>
                                <span className={styles.label}>Modifier:</span>
                                <span className={styles.value}>{modifier > 0 ? '+' : ''}{modifier}</span>
                            </div>
                        )}
                        <div className={styles.infoRow}>
                            <span className={styles.label}>Final Target:</span>
                            <span className={`${styles.value} ${styles.finalTarget}`}>{finalTarget}</span>
                        </div>
                    </div>

                    <div className={styles.resourceInfo}>
                        <div className={styles.resourceItem}>
                            <span className={styles.resourceLabel}>Fortune:</span>
                            <span className={styles.resourceValue}>{fortunePoints - fortuneSpent}</span>
                        </div>
                        <div className={styles.resourceItem}>
                            <span className={styles.resourceLabel}>Corruption:</span>
                            <span className={styles.resourceValue}>{corruptionCurrent + corruptionGained} / {corruptionMax}</span>
                        </div>
                    </div>

                    {!rolled ? (
                        <button className={styles.rollButton} onClick={handleRoll}>
                            🎲 Roll d100
                        </button>
                    ) : (
                        <div className={styles.resultSection}>
                            <div className={styles.rollDisplay}>
                                <span className={styles.rollLabel}>Your Roll:</span>
                                <span className={styles.rollValue}>{rollResult}</span>
                            </div>
                            <div className={styles.slDisplay}>
                                <span className={styles.slLabel}>Success Level:</span>
                                <span className={`${styles.slValue} ${successLevel! >= 0 ? styles.success : styles.failure}`}>
                                    {successLevel! > 0 ? '+' : ''}{Math.round(successLevel!)}
                                </span>
                            </div>
                            {canReroll() && (
                                <button className={styles.rerollButton} onClick={handleReroll}>
                                    {getRerollButtonText()}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className={styles.footer}>
                    {rolled && (
                        <button className={styles.confirmButton} onClick={handleConfirm}>
                            Send Result to GM
                        </button>
                    )}
                    <button className={styles.cancelButton} onClick={onClose}>
                        {rolled ? 'Close' : 'Cancel'}
                    </button>
                </div>
            </div>
        </div>
    );
};
