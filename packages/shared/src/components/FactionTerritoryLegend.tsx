import React, { useMemo } from 'react';
import styles from './FactionTerritoryLegend.module.css';
import { Location, Faction, KnowledgeLevel, ReputationEntry, LocationTerritory } from '../types/wfrp.types';

export interface FactionTerritoryLegendProps {
    locations: Location[];
    factions: Faction[];
    locationTerritories?: Record<string, LocationTerritory>;
    isGM?: boolean;
    characterReputations?: ReputationEntry[];
    visible?: boolean;
}

/** Default faction colors by category when no explicit color is set */
const DEFAULT_FACTION_COLORS: Record<string, string> = {
    government: '#4488cc',
    noble_house: '#9966cc',
    guild: '#cc8833',
    criminal: '#cc3333',
    religious: '#33aa88',
    military: '#666699',
    cult: '#993366',
    other: '#888888',
};

/** Resolve the display color for a faction */
function resolveFactionColor(faction: Faction, knowledge: KnowledgeLevel): string {
    if (faction.color) return faction.color;
    return (DEFAULT_FACTION_COLORS[faction.category] || '#888888');
}

/** Determine the knowledge level a player has of a faction */
function getKnowledgeForFaction(
    factionId: string,
    reputations: ReputationEntry[],
): KnowledgeLevel {
    const entry = reputations.find(r => r.factionId === factionId);
    return entry?.knowledgeLevel ?? 'unknown';
}

const FactionTerritoryLegend: React.FC<FactionTerritoryLegendProps> = ({ 
    locations,
    factions,
    locationTerritories = {},
    isGM = false,
    characterReputations = [],
    visible = true,
}) => {
    const legendFactions = useMemo(() => {
        const seen = new Map<string, { name: string; color: string; knowledge: KnowledgeLevel }>();
        for (const loc of locations) {
            const territory = locationTerritories[loc.id];
            if (territory?.controllingFactionId) {
                const faction = factions.find(f => f.id === territory.controllingFactionId);
                if (faction) {
                    const knowledge = getKnowledgeForFaction(faction.id, characterReputations);
                    if (!seen.has(faction.id) || seen.get(faction.id)?.knowledge !== 'known') {
                        seen.set(faction.id, {
                            name: faction.name,
                            color: resolveFactionColor(faction, knowledge),
                            knowledge,
                        });
                    }
                }
            }
        }
        return Array.from(seen.entries()).map(([id, v]) => ({ id, ...v }));
    }, [locations, factions, locationTerritories, characterReputations]);

    return (<>{factions.length > 0 && (
        <div className={styles.legend}>
            <div className={styles.legendHeader}>
                <span>🏰</span> Territories
            </div>
            <div className={styles.legendItems}>
                {legendFactions.map(f => (
                    <div
                        key={f.id}
                        className={`${styles.legendItem} ${f.knowledge === 'rumored' ? styles.legendRumored : ''}`}
                    >
                        <div
                            className={styles.legendSwatch}
                            style={{ backgroundColor: f.color }}
                        />
                        <span className={styles.legendLabel}>
                            {f.knowledge === 'rumored' ? `${f.name} (?)` : f.name}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )}
    </>);
}

export default FactionTerritoryLegend;