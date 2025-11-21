import React, { useState, useMemo } from 'react';
import { calculateTalentAdvanceCost, Character, getMaxRanks, Talent, useGameData } from '@wfrp/shared';
import styles from './TalentSelectorModal.module.css';

interface TalentSelectorModalProps {
    onClose: () => void;
    onSelect: (talent: Talent) => void;
    character: Character;
}

export const TalentSelectorModal: React.FC<TalentSelectorModalProps> = ({ onClose, onSelect, character }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const gameData = useGameData();
    const allTalents = useMemo(() => gameData.talents as Talent[], [gameData]);

    const filteredTalents = useMemo(() => {
        if (!searchTerm.trim()) return allTalents;
        const lowerSearch = searchTerm.toLowerCase();
        return allTalents.filter(talent =>
            talent.name.toLowerCase().includes(lowerSearch) ||
            talent.description.toLowerCase().includes(lowerSearch)
        );
    }, [allTalents, searchTerm]);

    return (
        <div className={styles.modalBackdrop} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h2>Talents</h2>
                    <button className={styles.closeButton} onClick={onClose}>&times;</button>
                </div>

                <div className={styles.searchBar}>
                    <input
                        type="text"
                        placeholder="Search talents..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>

                <div className={styles.talentList}>
                    {filteredTalents.map(talent => {
                        const currentRank = character.talents[talent.id] || 0;
                        const maxRanks = getMaxRanks(talent, character);
                        const atMaxRank = currentRank >= maxRanks;

                        return (
                            <div key={talent.id} className={styles.talentCard}>
                                <div className={styles.talentHeader}>
                                    <h3 className={styles.talentName}>{talent.name}</h3>
                                    <div className={styles.talentRank}>
                                        Rank: {currentRank} / {maxRanks}
                                    </div>
                                </div>

                                <p className={styles.talentDescription}>{talent.description}</p>

                                {talent.effects && talent.effects.length > 0 && talent.effects.some(effect => effect.type === 'SL_BONUS_ON_SUCCESS') && (
                                    <div className={styles.talentTests}>
                                        <strong>Tests:</strong> {talent.tests.join(', ')}
                                    </div>
                                )}

                                <div className={styles.talentFooter}>
                                    <button
                                        onClick={() => onSelect(talent)}
                                        disabled={atMaxRank}
                                        className={styles.buyButton}
                                    >
                                        {atMaxRank ? 'Max' : 'Add'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
