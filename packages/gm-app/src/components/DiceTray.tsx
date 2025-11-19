import React, { useState } from 'react';
import styles from './DiceTray.module.css';

interface DiceTrayProps {
    onClose: () => void;
    onLogEntry: (type: 'roll' | 'system' | 'info', content: string) => void;
}

const DiceTray: React.FC<DiceTrayProps> = ({ onClose, onLogEntry }) => {
    const [customFormula, setCustomFormula] = useState('');
    const [lastResult, setLastResult] = useState<string | null>(null);

    const rollDice = (formula: string) => {
        try {
            // Simple parser for XdY+Z
            const match = formula.match(/^(\d*)d(\d+)([+-]\d+)?$/);
            
            let result = 0;
            let details = '';
            let total = 0;

            if (match) {
                const count = match[1] ? parseInt(match[1]) : 1;
                const sides = parseInt(match[2]);
                const modifier = match[3] ? parseInt(match[3]) : 0;

                const rolls = [];
                for (let i = 0; i < count; i++) {
                    rolls.push(Math.floor(Math.random() * sides) + 1);
                }

                const sum = rolls.reduce((a, b) => a + b, 0);
                total = sum + modifier;
                
                details = `Rolled ${formula}: [${rolls.join(', ')}]${modifier ? (modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`) : ''} = ${total}`;
            } else {
                // Fallback for simple numbers or invalid format (just try to eval safely-ish or fail)
                // For now, only support XdY+Z format strictly or single die
                if (formula === 'd100') {
                    total = Math.floor(Math.random() * 100) + 1;
                    details = `Rolled d100: ${total}`;
                } else if (formula === 'd10') {
                    total = Math.floor(Math.random() * 10) + 1;
                    details = `Rolled d10: ${total}`;
                } else {
                    // Try to parse simple math if it's just a number
                    if (!isNaN(Number(formula))) {
                         total = Number(formula);
                         details = `Value: ${total}`;
                    } else {
                        throw new Error("Invalid formula");
                    }
                }
            }

            setLastResult(details);
            onLogEntry('roll', details);
        } catch (e) {
            setLastResult("Invalid formula");
        }
    };

    const handleCustomRoll = (e: React.FormEvent) => {
        e.preventDefault();
        if (customFormula) {
            rollDice(customFormula);
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>Dice Tray</h2>
                <button onClick={onClose} className={styles.closeButton}>✖</button>
            </div>
            
            <div className={styles.quickRolls}>
                <button onClick={() => rollDice('1d100')}>d100</button>
                <button onClick={() => rollDice('1d10')}>d10</button>
                <button onClick={() => rollDice('2d10')}>2d10</button>
                <button onClick={() => rollDice('1d5')}>d5</button>
            </div>

            <form onSubmit={handleCustomRoll} className={styles.customRoll}>
                <input 
                    type="text" 
                    value={customFormula} 
                    onChange={(e) => setCustomFormula(e.target.value)} 
                    placeholder="e.g. 2d10+5"
                />
                <button type="submit">Roll</button>
            </form>

            {lastResult && (
                <div className={styles.result}>
                    {lastResult}
                </div>
            )}
        </div>
    );
};

export default DiceTray;
