import React, { useState, useMemo, useEffect } from 'react';
import { Character, Motivation, useGameData } from '@wfrp/shared';
import styles from './DramatisPersonae.module.css';
import { useTranslation } from 'react-i18next';
import { RelationshipGraph } from './RelationshipGraph';

interface DramatisPersonaeProps {
    characters: Character[];
    motivations: Motivation[];
    onClose: () => void;
    onOpenLoreEditor: (character: Character) => void;
}

type ViewFilter = 'all' | 'npc' | 'pc' | 'minion';

export const DramatisPersonae: React.FC<DramatisPersonaeProps> = ({
    characters,
    motivations,
    onClose,
    onOpenLoreEditor,
}) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
    const [imageCache, setImageCache] = useState<Record<string, string>>({});
    const [showGraph, setShowGraph] = useState(false);

    // Load images for characters that have imageUrl
    useEffect(() => {
        const loadImages = async () => {
            const cache: Record<string, string> = {};
            for (const char of characters) {
                if (char.lore?.imageUrl) {
                    try {
                        const dataUrl = await window.ipcRenderer.loadCharacterImage(char.lore.imageUrl);
                        if (dataUrl) {
                            cache[char.id] = dataUrl;
                        }
                    } catch {
                        // Image not available
                    }
                }
            }
            setImageCache(cache);
        };
        loadImages();
    }, [characters]);

    const filteredCharacters = useMemo(() => {
        return characters.filter(c => {
            // Apply view filter
            if (viewFilter === 'npc' && c.userId !== null) return false;
            if (viewFilter === 'pc' && c.userId === null) return false;
            if (viewFilter === 'minion' && !c.isMinion) return false;

            // Apply search
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const nameMatch = c.name.toLowerCase().includes(term);
                const tagMatch = c.tags?.some(tag => tag.toLowerCase().includes(term));
                const motivationMatch = c.lore?.motivationKey?.toLowerCase().includes(term);
                return nameMatch || tagMatch || motivationMatch;
            }
            return true;
        });
    }, [characters, viewFilter, searchTerm]);

    const getMotivationName = (key?: string) => {
        if (!key) return null;
        return motivations.find(m => m.name === key)?.name || key;
    };

    return (
        <div className={styles.dramatisPersonae}>
            <div className={styles.header}>
                <h2>🎭 {t('lore.dramatisPersonae', 'Dramatis Personae')}</h2>
                <div className={styles.headerActions}>
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder={t('lore.searchCharacters', 'Search characters...')}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                    <div className={styles.filterGroup}>
                        {(['all', 'npc', 'pc', 'minion'] as ViewFilter[]).map(f => (
                            <button
                                key={f}
                                className={`${styles.filterChip} ${viewFilter === f ? styles.filterChipActive : ''}`}
                                onClick={() => setViewFilter(f)}
                            >
                                {t(`lore.filter.${f}`, f === 'all' ? 'All' : f === 'npc' ? 'NPCs' : f === 'pc' ? 'PCs' : 'Minions')}
                            </button>
                        ))}
                    </div>
                    <button
                        className={styles.graphButton}
                        onClick={() => setShowGraph(true)}
                    >
                        🕸️ {t('lore.relationshipWeb', 'Relationship Web')}
                    </button>
                    <button className={styles.closeButton} onClick={onClose}>
                        ✖ {t('common.close', 'Close')}
                    </button>
                </div>
            </div>

            <div className={styles.content}>
                {filteredCharacters.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p>🎭</p>
                        <p>{t('lore.noCharactersFound', 'No characters found.')}</p>
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {filteredCharacters.map(character => (
                            <LoreCard
                                key={character.id}
                                character={character}
                                motivationLabel={getMotivationName(character.lore?.motivationKey)}
                                imageDataUrl={imageCache[character.id]}
                                onClick={() => onOpenLoreEditor(character)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Relationship Graph Overlay */}
            {showGraph && (
                <RelationshipGraph
                    characters={characters}
                    imageCache={imageCache}
                    onClose={() => setShowGraph(false)}
                    onOpenLoreEditor={onOpenLoreEditor}
                />
            )}
        </div>
    );
};

// === Lore Card Sub-Component === //

interface LoreCardProps {
    character: Character;
    motivationLabel: string | null;
    imageDataUrl?: string;
    onClick: () => void;
}

const LoreCard: React.FC<LoreCardProps> = ({ character, motivationLabel, imageDataUrl, onClick }) => {
    const gmNote = character.lore?.gmNotes;
    const relationships = character.lore?.relationships || [];

    const careers = useGameData().careers;
    const characterCareer = careers.find(c => c.career_level.some(lvl => lvl.id === character.currentCareerLevelId));

    return (
        <div className={styles.loreCard} onClick={onClick}>
            <div className={styles.cardImageContainer}>
                {imageDataUrl ? (
                    <img src={imageDataUrl} alt={character.name} className={styles.cardImage} />
                ) : (
                    <span className={styles.cardImagePlaceholder}>🎭</span>
                )}
                {character.isMinion && <span className={styles.minionBadge}>MINION</span>}
                {character.userId && <span className={styles.pcBadge}>PC</span>}
            </div>
            <div className={styles.cardBody}>
                <h3 className={styles.cardName}>{character.name}</h3>
                <p className={styles.cardSpecies}>{character.species} • {characterCareer?.name || '—'}</p>

                {motivationLabel && (
                    <span className={styles.cardMotivation}>
                        🔥 {motivationLabel}
                    </span>
                )}

                {gmNote && gmNote.trim().length > 0 && (
                    <p className={styles.cardNote}>{gmNote}</p>
                )}

                {character.tags && character.tags.length > 0 && (
                    <div className={styles.cardTags}>
                        {character.tags.slice(0, 3).map(tag => (
                            <span key={tag} className={styles.cardTag}>{tag}</span>
                        ))}
                    </div>
                )}

                {relationships.length > 0 && (
                    <span className={styles.cardRelationshipCount}>
                        🔗 {relationships.length} tie{relationships.length > 1 ? 's' : ''}
                    </span>
                )}
            </div>
        </div>
    );
};

export default DramatisPersonae;
