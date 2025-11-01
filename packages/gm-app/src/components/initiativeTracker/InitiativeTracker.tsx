import React from 'react';
import { Combatant, rollDice } from '@wfrp/shared';
import styles from './InitiativeTracker.module.css';

interface InitiativeTrackerProps {
    combatants: Combatant[];
    onSetCombatants: (combatants: Combatant[]) => void;
    onUpdateCombatant: (combatant: Combatant) => void;
    onClearCombatants: () => void;
    currentTurnId: string | null;
    onSetCurrentTurnId: (id: string | null) => void;
}

const InitiativeTracker: React.FC<InitiativeTrackerProps> = ({
    combatants, onSetCombatants, onUpdateCombatant, onClearCombatants, currentTurnId, onSetCurrentTurnId
}) => {
    const handleRollInitiative = () => {
        const rolledCombatants = combatants.map(c => ({
            ...c,
            initiative: c.baseAg + c.baseInitiative + rollDice(1, 10),
        }));

        const sorted = rolledCombatants.sort((a, b) => (b.initiative ?? 0) - (a.initiative ?? 0) || b.baseInitiative - a.initiative);
        onSetCombatants(sorted);
        onSetCurrentTurnId(sorted[0]?.id || null);
    };

    const handleNextTurn = () => {
        if (!currentTurnId || combatants.length === 0) return;

        const currentIndex = combatants.findIndex(c => c.id === currentTurnId);
        const nextIndex = (currentIndex + 1) % combatants.length;
        onSetCurrentTurnId(combatants[nextIndex].id);
    }

    const handleWoundsChange = (combatantId: string, newWounds: number) => {
        const combatant = combatants.find(c => c.id === combatantId);
        if (combatant)
            onUpdateCombatant({ ...combatant, currentWounds: newWounds });
    };

    return (
        <div className={styles.trackerContainer}>
            <header className={styles.header}>
                <h3>Encounter</h3>
                <div className={styles.actions}>
                    <button onClick={handleRollInitiative}>Roll Init</button>
                    <button onClick={handleNextTurn}>Next Turn</button>
                    <button onClick={onClearCombatants} className={styles.clearBtn}>Clear</button>
                </div>
            </header>
            <ol className={styles.combatantList}>
                {combatants.map(c => (
                    <li key={c.id} className={c.id === currentTurnId ? styles.activeTurn : ''}>
                        <span className={styles.initiative}>{c.initiative ?? '-'}</span>
                        <span className={styles.name}>{c.name}</span>
                        <div className={styles.wounds}>
                            <input
                                type="number"
                                value={c.currentWounds}
                                onChange={(e) => handleWoundsChange(c.id, Math.min(Math.max(parseInt(e.target.value), 0), c.maxWounds) || 0)}
                            /> / {c.maxWounds}
                        </div>
                    </li>
                ))}
            </ol>
        </div>
    );
}

export default InitiativeTracker