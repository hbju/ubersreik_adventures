import React, { useState } from 'react';
import {
    Character,
    Faction,
    ReputationEntry,
    KnowledgeLevel,
    getReputationLabel,
    getReputationColorStyle,
    getFactionCategoryIcon,
    getFactionCategoryName,
    clampReputation
} from '@wfrp/shared';
import styles from './CharacterReputationPanel.module.css';
import { useTranslation } from 'react-i18next';

interface CharacterReputationPanelProps {
    characters: Character[];
    factions: Faction[];
    onCharacterUpdate: (character: Character) => void;
    onClose: () => void;
}

const KNOWLEDGE_LEVELS: KnowledgeLevel[] = ['unknown', 'rumored', 'known'];

export const CharacterReputationPanel: React.FC<CharacterReputationPanelProps> = ({
    characters,
    factions,
    onCharacterUpdate,
    onClose,
}) => {
    const { t } = useTranslation();
    const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(
        characters.length > 0 ? characters[0].id : null
    );
    const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');

    const selectedCharacter = characters.find(c => c.id === selectedCharacterId);

    const getCharacterReputation = (character: Character, factionId: string): ReputationEntry => {
        const existing = character.reputations?.find(r => r.factionId === factionId);
        if (existing) return existing;

        // Return default values if no reputation entry exists
        const faction = factions.find(f => f.id === factionId);
        return {
            factionId,
            value: faction?.defaultReputation || 0,
            knowledgeLevel: 'unknown',
            notes: ''
        };
    };

    const updateCharacterReputation = (
        character: Character,
        factionId: string,
        updates: Partial<ReputationEntry>
    ) => {
        const existingReputations = character.reputations || [];
        const existingIndex = existingReputations.findIndex(r => r.factionId === factionId);

        let newReputations: ReputationEntry[];

        if (existingIndex >= 0) {
            newReputations = existingReputations.map((r, i) =>
                i === existingIndex ? { ...r, ...updates } : r
            );
        } else {
            const faction = factions.find(f => f.id === factionId);
            const newEntry: ReputationEntry = {
                factionId,
                value: faction?.defaultReputation || 0,
                knowledgeLevel: 'unknown',
                ...updates
            };
            newReputations = [...existingReputations, newEntry];
        }

        onCharacterUpdate({
            ...character,
            reputations: newReputations
        });
    };

    const handleRevealAll = (character: Character) => {
        if (!window.confirm(t('factions.confirmRevealAll', { name: character.name }))) return;

        const newReputations: ReputationEntry[] = factions.map(faction => {
            const existing = character.reputations?.find(r => r.factionId === faction.id);
            return {
                factionId: faction.id,
                value: existing?.value ?? faction.defaultReputation,
                knowledgeLevel: 'known',
                notes: existing?.notes || ''
            };
        });

        onCharacterUpdate({
            ...character,
            reputations: newReputations
        });
    };

    const handleResetAll = (character: Character) => {
        if (!window.confirm(t('factions.confirmResetAll', { name: character.name }))) return;

        onCharacterUpdate({
            ...character,
            reputations: []
        });
    };

    const getKnowledgeBadgeClass = (level: KnowledgeLevel): string => {
        switch (level) {
            case 'unknown': return styles.badgeUnknown;
            case 'rumored': return styles.badgeRumored;
            case 'known': return styles.badgeKnown;
        }
    };

    return (
        <>
            <div className={styles.overlay} onClick={onClose} />
            <div className={styles.panel}>
                <div className={styles.header}>
                    <h2>⚖️ {t('reputations.reputationTitle')}</h2>
                    <div className={styles.headerActions}>
                        <button
                            className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
                            onClick={() => setViewMode('list')}
                        >
                            📋 {t('reputations.listView')}
                        </button>
                        <button
                            className={`${styles.viewButton} ${viewMode === 'matrix' ? styles.active : ''}`}
                            onClick={() => setViewMode('matrix')}
                        >
                            📊 {t('reputations.matrixView')}
                        </button>
                        <button className={styles.closeButton} onClick={onClose}>
                            {t('common.close')}
                        </button>
                    </div>
                </div>

                <div className={styles.content}>
                    {viewMode === 'list' ? (
                        // List View
                        <>
                            <div className={styles.characterSelector}>
                                <label>{t('reputations.selectCharacter')}:</label>
                                <select
                                    value={selectedCharacterId || ''}
                                    onChange={(e) => setSelectedCharacterId(e.target.value)}
                                >
                                    {characters.filter(c => c.userId !== null).map(char => (
                                        <option key={char.id} value={char.id}>{char.name}</option>
                                    ))}
                                </select>
                                {selectedCharacter && (
                                    <div className={styles.quickActions}>
                                        <button
                                            className={styles.revealButton}
                                            onClick={() => handleRevealAll(selectedCharacter)}
                                        >
                                            👁️ {t('reputations.revealAll')}
                                        </button>
                                        <button
                                            className={styles.resetButton}
                                            onClick={() => handleResetAll(selectedCharacter)}
                                        >
                                            🔄 {t('reputations.resetAll')}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {selectedCharacter && (
                                <div className={styles.factionsList}>
                                    {factions.map(faction => {
                                        const rep = getCharacterReputation(selectedCharacter, faction.id);
                                        const colorStyle = getReputationColorStyle(rep.value);

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
                                                        ) : getFactionCategoryIcon(faction.category)}                          </span>
                                                    <div className={styles.factionInfo}>
                                                        <div className={styles.factionName}>{faction.name}</div>
                                                        <div className={styles.factionCategory}>
                                                            {t("factions.categories." + faction.category)}
                                                        </div>
                                                    </div>
                                                    <div
                                                        className={styles.reputationBadge}
                                                        style={{
                                                            color: colorStyle.color,
                                                            backgroundColor: colorStyle.backgroundColor
                                                        }}
                                                    >
                                                        {rep.value > 0 ? '+' : ''}{rep.value}
                                                        <span className={styles.reputationLabel}>
                                                            {t(`reputations.reputationLevels.${getReputationLabel(rep.value)}`)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className={styles.factionControls}>
                                                    <div className={styles.controlGroup}>
                                                        <label>{t('reputations.standings')}</label>
                                                        <div className={styles.sliderContainer}>
                                                            <input
                                                                type="range"
                                                                min="-100"
                                                                max="100"
                                                                value={rep.value}
                                                                onChange={(e) => updateCharacterReputation(
                                                                    selectedCharacter,
                                                                    faction.id,
                                                                    { value: clampReputation(parseInt(e.target.value)) }
                                                                )}
                                                            />
                                                            <input
                                                                type="number"
                                                                min="-100"
                                                                max="100"
                                                                value={rep.value}
                                                                onChange={(e) => updateCharacterReputation(
                                                                    selectedCharacter,
                                                                    faction.id,
                                                                    { value: clampReputation(parseInt(e.target.value) || 0) }
                                                                )}
                                                                className={styles.numberInput}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className={styles.controlGroup}>
                                                        <label>{t('reputations.knowledge')}</label>
                                                        <div className={styles.knowledgeButtons}>
                                                            {KNOWLEDGE_LEVELS.map(level => (
                                                                <button
                                                                    key={level}
                                                                    className={`${styles.knowledgeButton} ${rep.knowledgeLevel === level ? getKnowledgeBadgeClass(level) : ''
                                                                        }`}
                                                                    onClick={() => updateCharacterReputation(
                                                                        selectedCharacter,
                                                                        faction.id,
                                                                        { knowledgeLevel: level }
                                                                    )}
                                                                >
                                                                    {t(`reputations.knowledgeLevels.${level}`)}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className={styles.controlGroup}>
                                                        <label>{t('reputations.notes')}</label>
                                                        <input
                                                            type="text"
                                                            value={rep.notes || ''}
                                                            onChange={(e) => updateCharacterReputation(
                                                                selectedCharacter,
                                                                faction.id,
                                                                { notes: e.target.value }
                                                            )}
                                                            placeholder={t('reputations.notesPlaceholder')}
                                                            className={styles.notesInput}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {factions.length === 0 && (
                                        <div className={styles.emptyMessage}>
                                            {t('reputations.noFactionsCreated')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        // Matrix View
                        <div className={styles.matrixContainer}>
                            <table className={styles.matrix}>
                                <thead>
                                    <tr>
                                        <th className={styles.cornerCell}>{t('reputations.characterFaction')}</th>
                                        {factions.map(faction => (
                                            <th key={faction.id} className={styles.factionHeaderCell}>
                                                <span className={styles.matrixFactionIcon}>
                                                    {faction.icon !== '' ? (
                                                        <img
                                                            src={faction.icon!}
                                                            alt={faction.name}
                                                            className={styles.factionIconImage}
                                                        />
                                                    ) : getFactionCategoryIcon(faction.category)}                                                 </span>
                                                <span className={styles.matrixFactionName}>{faction.name}</span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {characters.filter(c => c.userId !== null).map(character => (
                                        <tr key={character.id}>
                                            <td className={styles.characterCell}>{character.name}</td>
                                            {factions.map(faction => {
                                                const rep = getCharacterReputation(character, faction.id);
                                                const colorStyle = getReputationColorStyle(rep.value);

                                                return (
                                                    <td
                                                        key={faction.id}
                                                        className={styles.reputationCell}
                                                        style={{ backgroundColor: colorStyle.backgroundColor }}
                                                    >
                                                        <div className={styles.cellContent}>
                                                            <span
                                                                className={`${styles.knowledgeIndicator} ${getKnowledgeBadgeClass(rep.knowledgeLevel)}`}
                                                                title={t(`reputations.knowledgeLevels.${rep.knowledgeLevel}`)}
                                                            >
                                                                {rep.knowledgeLevel === 'unknown' ? '❓' :
                                                                    rep.knowledgeLevel === 'rumored' ? '❔' : '✓'}
                                                            </span>
                                                            <span style={{ color: colorStyle.color }}>
                                                                {rep.value > 0 ? '+' : ''}{rep.value}
                                                            </span>
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {factions.length === 0 && (
                                <div className={styles.emptyMessage}>
                                    {t('reputations.noFactionsCreated')}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default CharacterReputationPanel;
