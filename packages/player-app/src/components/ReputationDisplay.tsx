import React from 'react';
import {
  Character,
  Faction,
  ReputationEntry,
  getReputationLabel,
  getReputationColorStyle,
  getFactionCategoryIcon,
  getFactionCategoryName,
  useGameData
} from '@wfrp/shared';
import styles from './ReputationDisplay.module.css';
import { useTranslation } from 'react-i18next';

interface ReputationDisplayProps {
  character: Character;
  factions: Faction[];
}

export const ReputationDisplay: React.FC<ReputationDisplayProps> = ({
  character,
  factions,
}) => {
  const { t } = useTranslation();
  const { mapData } = useGameData();

  const getCharacterReputation = (factionId: string): ReputationEntry | null => {
    return character.reputations?.find(r => r.factionId === factionId) || null;
  };

  const getFactionKnowledgeLevel = (factionId: string): 'unknown' | 'rumored' | 'known' => {
    const rep = getCharacterReputation(factionId);
    return rep?.knowledgeLevel || 'unknown';
  };

  // Sort factions by knowledge level (known first, then rumored, then unknown; then by status; then name)
  const sortedFactions = [...factions].sort((a, b) => {
    const levelOrder = { known: 0, rumored: 1, unknown: 2 };
    const levelA = getFactionKnowledgeLevel(a.id);
    const levelB = getFactionKnowledgeLevel(b.id);
    if (levelOrder[levelA] !== levelOrder[levelB]) {
      return levelOrder[levelA] - levelOrder[levelB];
    }
    const repA = getCharacterReputation(a.id);
    const repB = getCharacterReputation(b.id);
    const valueA = repA?.value || 0;
    const valueB = repB?.value || 0;
    if (valueA !== valueB) {
      return valueB - valueA; // Higher reputation first
    }
    return a.name.localeCompare(b.name);
  });
  

  const knownFactions = sortedFactions.filter(f => getFactionKnowledgeLevel(f.id) === 'known');
  const rumoredFactions = sortedFactions.filter(f => getFactionKnowledgeLevel(f.id) === 'rumored');
  const unknownFactions = sortedFactions.filter(f => getFactionKnowledgeLevel(f.id) === 'unknown');

  const renderKnownFaction = (faction: Faction) => {
    const rep = getCharacterReputation(faction.id);
    const value = rep?.value ?? 0;
    const colorStyle = getReputationColorStyle(value);

    return (
      <div key={faction.id} className={styles.factionCard}>
        <div className={styles.factionHeader}>
          <span className={styles.factionIcon}>
            {faction.icon !== '' ? (
              <img
                src={faction.icon!}
                alt={faction.name}
                className={styles.factionIconImage}
              />
            ) : getFactionCategoryIcon(faction.category)}
          </span>
          <div className={styles.factionInfo}>
            <div className={styles.factionName}>{faction.name}</div>
            <div className={styles.factionCategory}>
              {getFactionCategoryName(faction.category)}
            </div>
          </div>
          <div
            className={styles.standingBadge}
            style={{
              color: colorStyle.color,
              backgroundColor: colorStyle.backgroundColor
            }}
          >
            <span className={styles.standingValue}>
              {value > 0 ? '+' : ''}{value}
            </span>
            <span className={styles.standingLabel}>
              {t(`reputations.reputationLevels.${getReputationLabel(value).toLowerCase()}`)}
            </span>
          </div>
        </div>
        <div className={styles.factionContent}>
          <div className={styles.factionDescription}>
            {faction.description}
          </div>
          <div className={styles.factionNotes}>
            <b style={{color: "#d4af37"}}>Faction Leader :</b> {faction.head || t('reputations.unknown')}
            <br />
            <b style={{color: "#d4af37"}}>Faction HQ :</b> {mapData.locations.find(loc => loc.id === faction.hq)?.name || t('reputations.unknown')}
          </div>
        </div>
      </div>
    );
  };

  const renderRumoredFaction = (faction: Faction) => {
    return (
      <div key={faction.id} className={`${styles.factionCard} ${styles.rumoredCard}`}>
        <div className={styles.factionHeader}>
          <span className={styles.factionIcon}>❔</span>
          <div className={styles.factionInfo}>
            <div className={styles.factionName}>{faction.name}</div>
            <div className={styles.factionCategory}>
              {t('factions.categories.' + faction.category)}
            </div>
          </div>
          <div className={styles.rumoredBadge}>
            {t('reputations.rumoredStanding')}
          </div>
        </div>
        <div className={styles.rumoredDescription}>
          {t('reputations.rumoredDescription')}
        </div>
      </div>
    );
  };

  const renderUnknownFaction = () => {
    return (
      <div className={`${styles.factionCard} ${styles.unknownCard}`}>
        <div className={styles.factionHeader}>
          <span className={styles.factionIcon}>❓</span>
          <div className={styles.factionInfo}>
            <div className={styles.factionName}>{t('reputations.undiscovered')}</div>
            <div className={styles.factionCategory}>
              {t('reputations.unknown')}
            </div>
          </div>
        </div>
        <div className={styles.unknownDescription}>
          {t('reputations.unknownDescription')}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>⚖️ {t('reputations.standings')}</h2>
        <p className={styles.subtitle}>{t('reputations.standingsDescription')}</p>
      </div>

      <div className={styles.content}>
        {/* Known Factions */}
        {knownFactions.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              ✓ {t('reputations.knownFactions')} ({knownFactions.length})
            </h3>
            <div className={styles.factionsGrid}>
              {knownFactions.map(renderKnownFaction)}
            </div>
          </div>
        )}

        {/* Rumored Factions */}
        {rumoredFactions.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              ❔ {t('reputations.rumoredFactions')} ({rumoredFactions.length})
            </h3>
            <div className={styles.factionsGrid}>
              {rumoredFactions.map(renderRumoredFaction)}
            </div>
          </div>
        )}

        {/* Unknown Factions */}
        {unknownFactions.length > 0 && (
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              ❓ {t('reputations.undiscoveredFactions')} ({unknownFactions.length})
            </h3>
            <div className={styles.factionsGrid}>
              {unknownFactions.map(() => renderUnknownFaction())}
            </div>
          </div>
        )}

        {factions.length === 0 && (
          <div className={styles.emptyState}>
            <p>{t('reputations.noFactionsYet')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReputationDisplay;
