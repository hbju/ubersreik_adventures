import React, { useState, useEffect } from 'react';
import {
    rolld100,
    calculateSuccessLevel,
    getApplicableTalents,
    applyTalentSLBonuses,
    checkCriticalResult,
    Character,
    Talent,
    useGameData
} from '@wfrp/shared';
import styles from './TalentSelectionModal.module.css';

interface UsedTalent {
    name: string;
    rank: number;
}

interface TalentSelectionModalProps {
    character: Character;
    testName: string;
    testId: string;
    baseTarget: number;
    fortunePoints: number;
    corruptionCurrent: number;
    corruptionMax: number;
    modifier?: number;
    onClose: () => void;
    onRoll: (result: {
        characterId: string;
        testName: string;
        targetNumber: number;
        rollResult: number;
        successLevel: number;
        usedTalents?: UsedTalent[];
        fortuneSpent: number;
        corruptionGained: number;
    }) => void;
}

export const TalentSelectionModal: React.FC<TalentSelectionModalProps> = ({
    character,
    testName,
    testId,
    baseTarget,
    fortunePoints,
    corruptionCurrent,
    corruptionMax,
    modifier = 0,
    onClose,
    onRoll
}) => {
    const { talents } = useGameData();

    const [localModifier, setLocalModifier] = useState(modifier);
    const [selectedTalents, setSelectedTalents] = useState<UsedTalent[]>([]);
    const [applicableTalents, setApplicableTalents] = useState<{ talent: Talent; rank: number }[]>(getApplicableTalents(character, testId, talents));
    const [showResult, setShowResult] = useState(false);
    const [rollCount, setRollCount] = useState(0);
    const [fortuneSpent, setFortuneSpent] = useState(0);
    const [corruptionGained, setCorruptionGained] = useState(0);
    const [rollResult, setRollResult] = useState<{
        roll: number;
        target: number;
        baseSL: number;
        finalSL: number;
        isCritical: boolean;
        isFumble: boolean;
    } | null>(null);

    const finalTarget = baseTarget + localModifier;

    // Pre-select SL bonus talents by default
    useEffect(() => {
        const autoSelect = applicableTalents
            .filter(t => t.talent.effects?.some(e => e.type === 'SL_BONUS_ON_SUCCESS'))
            .map(t => ({ name: t.talent.name, rank: t.rank }));
        setSelectedTalents(autoSelect);
    }, [applicableTalents]);

    const toggleTalent = (talent: Talent, rank: number) => {
        const isSelected = selectedTalents.some(t => t.name === talent.name);
        if (isSelected) {
            setSelectedTalents(selectedTalents.filter(t => t.name !== talent.name));
        } else {
            setSelectedTalents([...selectedTalents, { name: talent.name, rank }]);
        }
    };

    const calculateExpectedBonus = () => {
        let bonus = 0;
        selectedTalents.forEach(({ name, rank }) => {
            const talentData = applicableTalents.find(t => t.talent.name === name);
            if (talentData?.talent.effects) {
                talentData.talent.effects.forEach(effect => {
                    if (effect.type === 'SL_BONUS_ON_SUCCESS' && typeof effect.value === 'number') {
                        bonus += effect.value * rank;
                    }
                });
            }
        });
        return bonus;
    };

    const handleRoll = () => {
        const roll = rolld100();
        const baseSL = calculateSuccessLevel(roll, finalTarget);
        const finalSL = applyTalentSLBonuses(baseSL, selectedTalents, talents, character);
        const { isCritical, isFumble } = checkCriticalResult(roll, finalTarget);

        setRollResult({
            roll,
            target: finalTarget,
            baseSL,
            finalSL,
            isCritical,
            isFumble
        });
        setShowResult(true);
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
                setCorruptionGained(prev => prev + 1);
            }
        } else if (rollCount === 2) {
            setCorruptionGained(prev => prev + 1);
        }

        const result = rolld100();
        const sl = calculateSuccessLevel(result, finalTarget);
        const finalSL = applyTalentSLBonuses(sl, selectedTalents, talents, character);
        const { isCritical, isFumble } = checkCriticalResult(result, finalTarget);

        setRollResult({
            roll: result,
            target: finalTarget,
            baseSL: sl,
            finalSL: finalSL,
            isCritical,
            isFumble
        });

        setRollCount(prev => prev + 1);
    };

    const handleConfirm = () => {
        if (!rollResult) return;

        onRoll({
            characterId: character.id,
            testName,
            targetNumber: rollResult.target,
            rollResult: rollResult.roll,
            successLevel: rollResult.finalSL,
            usedTalents: selectedTalents.length > 0 ? selectedTalents : undefined,
            fortuneSpent: fortuneSpent,
            corruptionGained: corruptionGained,
        });
        onClose();
    };

    const canReroll = () => {
        if (rollCount >= 3) return false; // Max 3 rolls total (1 initial + 2 rerolls)
        if (rollCount === 1) {
            return (fortunePoints - fortuneSpent > 0) || (corruptionCurrent + corruptionGained < corruptionMax);
        }
        if (rollCount === 2) {
            return corruptionGained == 0;
        }
        return false;
    };

    const getRerollButtonText = () => {
        if (rollCount === 1 && fortunePoints - fortuneSpent > 0) {
            return `🔄 Reroll (Fortune Point)`;
        }

        return `🔄 Reroll (Corruption)`;
    };

    const formatSL = (sl: number): string => {
        if (sl === 0) return 'Marginal Success';
        if (sl > 0) return `Success (+${sl} SL)`;
        if (sl === -0.1) return 'Marginal Failure';
        return `Failure (${sl} SL)`;
    };

    const getTalentDescription = (talent: Talent, rank: number): string => {
        if (!talent.effects || talent.effects.length === 0) return 'Special effect - see description';

        const descriptions: string[] = [];
        talent.effects.forEach(effect => {
            switch (effect.type) {
                case 'SL_BONUS_ON_SUCCESS':
                    descriptions.push(`+${(effect.value as number) * rank} SL on success\n`);
                    break;
                case 'TEST_BONUS':
                    descriptions.push(`+${(effect.value as number) * rank} to test\n`);
                    break;
                case 'DAMAGE_BONUS':
                    descriptions.push(`+${(effect.value as number) * rank} damage\n`);
                    break;
                case 'PASSIVE':
                    descriptions.push(effect.value as string || 'Passive effect\n');
                    break;
                default:
                    descriptions.push('Special effect\n');
            }
        });
        if (talent.tests && talent.tests.length > 0) {
            descriptions.push(`Applies to tests: ${talent.tests.join(', ')}\n`);
        }
        return descriptions.join(', ');
    };

    if (showResult && rollResult) {
        console.log('Displaying result:', rollResult);
        return (
            <div className={styles.modalBackdrop}>
                <div className={`${styles.modalContent} ${rollResult.isCritical ? styles.critical : ''} ${rollResult.isFumble ? styles.fumble : ''}`}>
                    <h2>Test Result: {testName}</h2>

                    <div className={styles.resultDisplay}>
                        <div className={styles.rollInfo}>
                            <span className={styles.rollLabel}>Roll:</span>
                            <span className={styles.rollValue}>{rollResult.roll}</span>
                            <span className={styles.vsLabel}>vs</span>
                            <span className={styles.targetValue}>{rollResult.target}</span>
                        </div>

                        {rollResult.isCritical && (
                            <div className={styles.criticalBadge}>⚠️ CRITICAL SUCCESS!</div>
                        )}
                        {rollResult.isFumble && (
                            <div className={styles.fumbleBadge}>💥 FUMBLE!</div>
                        )}

                        <div className={styles.slBreakdown}>
                            <div className={styles.slRow}>
                                <span>Base Result:</span>
                                <strong>{formatSL(rollResult.baseSL)}</strong>
                            </div>

                            {selectedTalents.length > 0 && rollResult.baseSL >= 0 && (
                                <>
                                    <div className={styles.talentsUsed}>
                                        <span className={styles.talentsLabel}>Talents Used:</span>
                                        {selectedTalents.map((t, idx) => (
                                            <div key={idx} className={styles.talentItem}>
                                                • {t.name} (Rank {t.rank}): +{t.rank} SL
                                            </div>
                                        ))}
                                    </div>
                                    <div className={`${styles.slRow} ${styles.finalResult}`}>
                                        <span>Final Result:</span>
                                        <strong>{formatSL(rollResult.finalSL)}</strong>
                                    </div>
                                </>
                            )}

                            {rollResult.baseSL < 0 && (
                                <div className={styles.failureNote}>
                                    (Talents only apply on successful tests)
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.buttonGroup}>
                        {canReroll() && (
                            <button onClick={handleReroll} className={styles.secondaryButton}>
                                {getRerollButtonText()}
                            </button>
                        )}
                        <button onClick={handleConfirm} className={styles.primaryButton}>
                            Confirm & Send to GM
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.modalBackdrop}>
            <div className={styles.modalContent}>
                <h2>{testName} Test</h2>

                <div className={styles.testInfo}>
                    <div className={styles.infoRow}>
                        <span>Base Target:</span>
                        <strong>{baseTarget}</strong>
                    </div>
                    <div className={styles.infoRow}>
                        <span>Modifier:</span>
                        <input
                            type="number"
                            step="10"
                            value={localModifier}
                            onChange={(e) => setLocalModifier(parseInt(e.target.value, 10) || 0)}
                            className={styles.modifierInput}
                        />
                    </div>
                    <div className={`${styles.infoRow} ${styles.finalTarget}`}>
                        <span>Final Target:</span>
                        <strong>{finalTarget}</strong>
                    </div>
                </div>

                {applicableTalents.length > 0 && (
                    <div className={styles.talentSection}>
                        <h3>Select Talents to Use:</h3>
                        <div className={styles.talentList}>
                            {applicableTalents.map(({ talent, rank }) => {
                                const isSelected = selectedTalents.some(t => t.name === talent.name);
                                return (
                                    <div
                                        key={talent.id}
                                        className={`${styles.talentCheckbox} ${isSelected ? styles.selected : ''}`}
                                        onClick={() => toggleTalent(talent, rank)}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => { }}
                                            className={styles.checkbox}
                                        />
                                        <div className={styles.talentInfo}>
                                            <div className={styles.talentName}>
                                                {talent.name} (Rank {rank})
                                            </div>
                                            <div className={styles.talentEffect}>
                                                {getTalentDescription(talent, rank)}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {selectedTalents.length > 0 && (
                            <div className={styles.expectedBonus}>
                                Expected Bonus: +{calculateExpectedBonus()} SL on success
                            </div>
                        )}
                    </div>
                )}

                {applicableTalents.length === 0 && (
                    <div className={styles.noTalents}>
                        No applicable talents for this test
                    </div>
                )}

                <div className={styles.buttonGroup}>
                    <button onClick={onClose} className={styles.secondaryButton}>
                        Cancel
                    </button>
                    <button onClick={handleRoll} className={styles.primaryButton}>
                        Roll d100
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TalentSelectionModal;
