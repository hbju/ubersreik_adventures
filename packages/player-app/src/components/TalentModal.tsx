import React, { useState, useMemo } from 'react';
import { Character, Talent, calculateTalentAdvanceCost, talentsData } from '@wfrp/shared';
import styles from './TalentModal.module.css';

interface TalentModalProps {
  character: Character;
  onClose: () => void;
  onBuyTalent: (talentId: string, cost: number) => void;
}

export const TalentModal: React.FC<TalentModalProps> = ({ character, onClose, onBuyTalent }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const getMaxRanks = (talent: Talent): number => {
    if (typeof talent.max_ranks === 'number') {
      return talent.max_ranks;
    }
    
    const charKey = talent.max_ranks as keyof Character['characteristics'];
    if (character.characteristics[charKey]) {
      const char = character.characteristics[charKey];
      return Math.floor((char.initial + char.advances + char.talents + char.modifier) / 10);
    }
    
    return 1;
  };

  const filteredTalents = useMemo(() => {
    const talents = talentsData as Talent[];
    if (!searchTerm.trim()) {
      return talents;
    }

    const lowerSearch = searchTerm.toLowerCase();
    return talents.filter(talent =>
      talent.name.toLowerCase().includes(lowerSearch) ||
      talent.description.toLowerCase().includes(lowerSearch)
    );
  }, [searchTerm]);

  const handleBuy = (talent: Talent) => {
    const currentRank = character.talents[talent.id] || 0;
    const maxRanks = getMaxRanks(talent);
    
    if (currentRank >= maxRanks) {
      return;
    }
    
    // Assume talent is in career for now (could be enhanced with career checking)
    const cost = calculateTalentAdvanceCost(talent.id, character, true);
    
    if (character.xp.current < cost) {
      return;
    }
    
    onBuyTalent(talent.id, cost);
  };

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

        <div className={styles.xpDisplay}>
          <span>Available XP: <strong>{character.xp.current}</strong></span>
        </div>

        <div className={styles.talentList}>
          {filteredTalents.map(talent => {
            const currentRank = character.talents[talent.id] || 0;
            const maxRanks = getMaxRanks(talent);
            const cost = calculateTalentAdvanceCost(talent.id, character, true);
            const canAfford = character.xp.current >= cost;
            const atMaxRank = currentRank >= maxRanks;
            const canBuy = canAfford && !atMaxRank;

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
                    <strong>Tests:</strong> {talent.effects.filter(effect => effect.type === 'SL_BONUS_ON_SUCCESS').map(effect => effect.appliesTo).join(', ')}
                  </div>
                )}

                <div className={styles.talentFooter}>
                  <span className={styles.talentCost}>
                    {atMaxRank ? 'Max Rank' : `Cost: ${cost} XP`}
                  </span>
                  <button
                    onClick={() => handleBuy(talent)}
                    disabled={!canBuy}
                    className={styles.buyButton}
                  >
                    {atMaxRank ? 'Max' : canAfford ? 'Buy' : 'Cannot Afford'}
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
