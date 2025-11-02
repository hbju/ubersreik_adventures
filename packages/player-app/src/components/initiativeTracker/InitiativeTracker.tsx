import React from 'react';
import { Combatant } from '@wfrp/shared';
import styles from './InitiativeTracker.module.css';

interface InitiativeTrackerProps {
    combatants: Combatant[];
    currentTurnId: string | null;
}

const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({
    combatants, currentTurnId
}) => {
    if (combatants.length === 0) {
        return null; // Don't show tracker if no combat is active
    }

    return (
        <div className={styles.trackerContainer}>
            <header className={styles.header}>
                <h3>Initiative Tracker</h3>
            </header>
            <ol className={styles.combatantList}>
                {combatants.map(c => (
                    <li key={c.id} className={c.id === currentTurnId ? styles.activeTurn : ''}>
                        <span className={styles.initiative}>{c.initiative ?? '-'}</span>
                        <span className={styles.name}>{c.name}</span>
                        <div className={styles.wounds}>
                            <span className={styles.woundsDisplay}>
                                {c.currentWounds} / {c.maxWounds}
                            </span>
                        </div>
                    </li>
                ))}
            </ol>
        </div>
    );
}

export default InitiativeTracker