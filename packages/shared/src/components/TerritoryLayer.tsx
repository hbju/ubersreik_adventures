import React, { useMemo } from 'react';
import styles from './TerritoryLayer.module.css';
import { Location, Faction, KnowledgeLevel, ReputationEntry, LocationTerritory } from '../types/wfrp.types';

/**
 * Props for the TerritoryLayer component.
 *
 * - `locations`: All locations on the current map.
 * - `factions`: All factions in the campaign.
 * - `locationTerritories`: GM-assigned territory data (locationId → territory).
 * - `isGM`: If true, render everything without knowledge filtering.
 * - `characterReputations`: The current player-character's reputation entries (ignored when isGM).
 * - `visible`: Whether the overlay is visible at all.
 */
export interface TerritoryLayerProps {
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

/** Convert an influenceWeight (1-5) to a pixel radius for the SVG circle */
function weightToRadius(weight: number): number {
    // weight 1 → 80px, weight 5 → 320px  (linear scale)
    const clamped = Math.max(1, Math.min(5, weight));
    return 40 + clamped * 56;
}

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

interface TerritoryCircle {
    x: number;
    y: number;
    radius: number;
    color: string;
    factionId: string;
    factionName: string;
    knowledge: KnowledgeLevel;
}

const TerritoryLayer: React.FC<TerritoryLayerProps> = ({
    locations,
    factions,
    locationTerritories = {},
    isGM = false,
    characterReputations = [],
    visible = true,
}) => {
    const circles = useMemo<TerritoryCircle[]>(() => {
        if (!visible) return [];

        const result: TerritoryCircle[] = [];

        for (const loc of locations) {
            // Check locationTerritories first, then fall back to Location fields
            const territory = locationTerritories[loc.id];
            const factionId = territory?.controllingFactionId || loc.controllingFactionId;
            const weight = territory?.influenceWeight ?? loc.influenceWeight ?? 1;

            if (!factionId) continue;

            const faction = factions.find(f => f.id === factionId);
            if (!faction) continue;

            const knowledge: KnowledgeLevel = isGM
                ? 'known'
                : getKnowledgeForFaction(faction.id, characterReputations);

            // Player fog-of-war: skip unknown factions entirely
            if (!isGM && knowledge === 'unknown') continue;

            result.push({
                x: loc.coords.x,
                y: loc.coords.y,
                radius: weightToRadius(weight),
                color: resolveFactionColor(faction, knowledge),
                factionId: faction.id,
                factionName: faction.name,
                knowledge,
            });
        }

        return result;
    }, [locations, factions, locationTerritories, isGM, characterReputations, visible]);

    if (!visible || circles.length === 0) return null;

    return (
        <>
            {/* SVG overlay rendered at map-coordinate space (parent handles transforms) */}
            <svg
                className={styles.territoryLayer}
                preserveAspectRatio="none"
                style={{ overflow: 'visible' }}
            >
                <defs>
                    {/* Hatched pattern for optional conflict visualization */}
                    <pattern
                        id="territory-hatch"
                        patternUnits="userSpaceOnUse"
                        width="8"
                        height="8"
                        patternTransform="rotate(45)"
                    >
                        <line
                            x1="0" y1="0" x2="0" y2="8"
                            stroke="rgba(255,255,255,0.15)"
                            strokeWidth="2"
                        />
                    </pattern>
                </defs>
                <g style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.6, pointerEvents: 'none', zIndex: 1 }}>
                    {circles.map((circle, i) => {
                        const cssClass = isGM
                            ? styles.gmView
                            : circle.knowledge === 'rumored'
                                ? styles.rumored
                                : styles.known;

                        return (
                            <circle
                                key={`${circle.factionId}-${i}`}
                                cx={circle.x}
                                cy={circle.y}
                                r={circle.radius}
                                fill={circle.color}
                                className={cssClass}
                                style={{ mixBlendMode: 'normal' }}
                            />
                        );
                    })}
                </g>
            </svg>
        </>
    );
};

export default TerritoryLayer;
