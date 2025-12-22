import React from 'react';
import styles from './RollQueueCard.module.css';
import { QueuedRoll } from '@wfrp/shared';

interface RollQueueCardProps {
    roll: QueuedRoll;
    onAssignAttacker: () => void;
    onAssignDefender: () => void;
    onDismiss: () => void;
}

export const RollQueueCard: React.FC<RollQueueCardProps> = ({
    roll,
    onAssignAttacker,
    onAssignDefender,
    onDismiss
}) => {
    const intentIcon = '🎲';
    const intentLabel = 'Skill';
    const slSign = roll.successLevel >= 0 ? '+' : '';
    
    const timeAgo = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ago`;
    };

    return (
        <div className={styles.rollCard}>
            <div className={styles.header}>
                <span className={styles.intent}>{intentIcon} {intentLabel}</span>
                <button className={styles.dismissBtn} onClick={onDismiss} title="Dismiss">×</button>
            </div>
            <div className={styles.characterName}>{roll.characterName}</div>
            <div className={styles.skillInfo}>
                <span className={styles.skillName}>{roll.skillName}</span>
                {roll.weaponName && <span className={styles.weaponName}>({roll.weaponName})</span>}
            </div>
            <div className={styles.rollDetails}>
                <span className={styles.roll}>Rolled: {roll.rollResult}</span>
                <span className={styles.target}>vs {roll.targetNumber}</span>
            </div>
            <div className={`${styles.successLevel} ${roll.successLevel >= 0 ? styles.success : styles.failure}`}>
                SL: {slSign}{Math.round(roll.successLevel)}
            </div>
            <div className={styles.timestamp}>{timeAgo(roll.timestamp)}</div>
            <div className={styles.actions}>
                <button 
                    className={`${styles.assignBtn} ${styles.attackerBtn}`}
                    onClick={onAssignAttacker}
                    title="Assign as Attacker"
                >
                    ← Attacker
                </button>
                <button 
                    className={`${styles.assignBtn} ${styles.defenderBtn}`}
                    onClick={onAssignDefender}
                    title="Assign as Defender"
                >
                    Defender →
                </button>
            </div>
        </div>
    );
};

export default RollQueueCard;
