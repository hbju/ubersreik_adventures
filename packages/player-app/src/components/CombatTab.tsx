import React from 'react';
import {
    Character,
    Armor,
    Weapon,
    useGameData,
    EditableField,
    calculateCharacteristicValue,
    QualityTooltip
} from '@wfrp/shared';
import './CombatTab.css';

interface CombatTabProps {
    character: Character;
    isEditMode: boolean;
    onCharacterUpdate: (updates: Partial<Character>) => void;
}

interface ArmourPoints {
    head: number;
    body: number;
    leftArm: number;
    rightArm: number;
    leftLeg: number;
    rightLeg: number;
}

export const CombatTab: React.FC<CombatTabProps> = ({
    character,
    isEditMode,
    onCharacterUpdate
}) => {
    const { weapons: weaponsData, armor: armorData, conditions: conditionsData } = useGameData();

    // Calculate armour points per location from equipped armor
    const calculateArmourPoints = (): ArmourPoints => {
        const ap: ArmourPoints = {
            head: 0,
            body: 0,
            leftArm: 0,
            rightArm: 0,
            leftLeg: 0,
            rightLeg: 0
        };

        const armorById = Object.fromEntries((armorData as Armor[]).map(a => [a.id, a]));

        Object.entries(character.inventory.armor).forEach(([armorId, count]) => {
            if (count <= 0) return;
            const armor = armorById[armorId];
            if (!armor) return;

            armor.locations.forEach(location => {
                const loc = location.toLowerCase();
                if (loc.includes('head')) ap.head += armor.ap;
                if (loc.includes('body') || loc.includes('torso')) ap.body += armor.ap;
                if (loc.includes('arm')) {
                    ap.leftArm += armor.ap;
                    ap.rightArm += armor.ap;
                }
                if (loc.includes('left arm')) ap.leftArm += armor.ap;
                if (loc.includes('right arm')) ap.rightArm += armor.ap;
                if (loc.includes('leg')) {
                    ap.leftLeg += armor.ap;
                    ap.rightLeg += armor.ap;
                }
                if (loc.includes('left leg')) ap.leftLeg += armor.ap;
                if (loc.includes('right leg')) ap.rightLeg += armor.ap;
            });
        });

        return ap;
    };

    const armourPoints = calculateArmourPoints();

    // Get equipped weapons
    const weaponById = Object.fromEntries((weaponsData as Weapon[]).map(w => [w.id, w]));
    const equippedWeapons = Object.entries(character.inventory.weapons)
        .filter(([_, count]) => count > 0)
        .map(([weaponId]) => weaponById[weaponId])
        .filter(Boolean) as Weapon[];

    console.log(equippedWeapons)

    // Get condition names
    const getConditionName = (conditionId: string): string => {
        const condition = conditionsData.find((c: any) => c.id === conditionId);
        return condition ? condition.name : conditionId;
    };

    const handleWoundsChange = (value: number) => {
        onCharacterUpdate({
            status: {
                ...character.status,
                wounds: {
                    ...character.status.wounds,
                    current: Math.max(0, Math.min(value, character.status.wounds.max))
                }
            }
        });
    };

    // Calculate damage for weapons
    const getWeaponDamage = (weapon: Weapon): string => {
        // Parse the damage string (e.g., "+SB+4" means Strength Bonus + 4)
        const damage = weapon.damage;
        if (!damage) return '—';
        
        // If it contains SB, calculate it
        if (damage.includes('SB')) {
            const sb = Math.floor(calculateCharacteristicValue(character.characteristics.s) / 10);
            // Parse the modifier if any
            const match = damage.match(/SB([+-]?\d+)?/);
            if (match) {
                const modifier = match[1] ? parseInt(match[1]) : 0;
                return `${sb + modifier}`;
            }
        }
        return damage;
    };

    return (
        <div className="combat-tab">
            {/* Weapons Panel */}
            <div className="combat-panel weapons-panel">
                <h3 className="panel-title">Weapons</h3>
                <div className="weapons-list">
                    {equippedWeapons.length === 0 ? (
                        <p className="empty-message">No weapons equipped</p>
                    ) : (
                        equippedWeapons.map(weapon => (
                            <div key={weapon.id} className="weapon-card">
                                <div className="weapon-header">
                                    <span className="weapon-name">{weapon.name}</span>
                                    <span className="weapon-group">{weapon.group}</span>
                                </div>
                                <div className="weapon-stats">
                                    <div className="weapon-stat">
                                        <span className="stat-label">Damage:</span>
                                        <span className="stat-value">{getWeaponDamage(weapon)}</span>
                                    </div>
                                    <div className="weapon-stat">
                                        <span className="stat-label">Reach:</span>
                                        <span className="stat-value">{weapon.reach || '—'}</span>
                                    </div>
                                </div>
                                {weapon.qualities && weapon.qualities.length > 0 && (
                                    <div className="weapon-qualities">
                                        <span className="qualities-label">Qualities:</span>
                                        <span className="qualities-list">
                                            {weapon.qualities.map((quality, index) => (
                                                <React.Fragment key={quality}>
                                                    <QualityTooltip qualityString={quality} className="quality-tag" />
                                                    {index < weapon.qualities.length - 1 && ', '}
                                                </React.Fragment>
                                            ))}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Armour Silhouette Panel */}
            <div className="combat-panel silhouette-panel">
                <h3 className="panel-title">Armour Points</h3>
                <div className="silhouette-container">
                    <svg viewBox="0 0 200 350" className="body-silhouette">
                        {/* Head */}
                        <circle cx="100" cy="35" r="30" className="body-part head" />
                        <text x="100" y="42" className="ap-text">{armourPoints.head}</text>
                        
                        {/* Body/Torso */}
                        <rect x="60" y="70" width="80" height="100" rx="10" className="body-part body" />
                        <text x="100" y="125" className="ap-text">{armourPoints.body}</text>
                        
                        {/* Left Arm */}
                        <rect x="20" y="70" width="35" height="90" rx="8" className="body-part left-arm" />
                        <text x="37" y="120" className="ap-text ap-text-small">{armourPoints.leftArm}</text>
                        
                        {/* Right Arm */}
                        <rect x="145" y="70" width="35" height="90" rx="8" className="body-part right-arm" />
                        <text x="162" y="120" className="ap-text ap-text-small">{armourPoints.rightArm}</text>
                        
                        {/* Left Leg */}
                        <rect x="60" y="180" width="35" height="120" rx="8" className="body-part left-leg" />
                        <text x="77" y="245" className="ap-text ap-text-small">{armourPoints.leftLeg}</text>
                        
                        {/* Right Leg */}
                        <rect x="105" y="180" width="35" height="120" rx="8" className="body-part right-leg" />
                        <text x="122" y="245" className="ap-text ap-text-small">{armourPoints.rightLeg}</text>
                    </svg>
                    
                    <div className="silhouette-legend">
                        <div className="legend-item">
                            <span className="legend-label">Head:</span>
                            <span className="legend-value">{armourPoints.head}</span>
                        </div>
                        <div className="legend-item">
                            <span className="legend-label">Body:</span>
                            <span className="legend-value">{armourPoints.body}</span>
                        </div>
                        <div className="legend-item">
                            <span className="legend-label">Arms:</span>
                            <span className="legend-value">{armourPoints.leftArm}/{armourPoints.rightArm}</span>
                        </div>
                        <div className="legend-item">
                            <span className="legend-label">Legs:</span>
                            <span className="legend-value">{armourPoints.leftLeg}/{armourPoints.rightLeg}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Panel */}
            <div className="combat-panel status-panel">
                <h3 className="panel-title">Combat Status</h3>
                
                <div className="wounds-section">
                    <span className="wounds-label">Wounds:</span>
                    <div className="wounds-control">
                        {isEditMode ? (
                            <input
                                type="number"
                                value={character.status.wounds.current}
                                onChange={(e) => handleWoundsChange(parseInt(e.target.value) || 0)}
                                min={0}
                                max={character.status.wounds.max}
                                className="wounds-input"
                            />
                        ) : (
                            <span className="wounds-current">{character.status.wounds.current}</span>
                        )}
                        <span className="wounds-separator">/</span>
                        <span className="wounds-max">{character.status.wounds.max}</span>
                    </div>
                    <div className="wounds-bar">
                        <div 
                            className="wounds-fill"
                            style={{ 
                                width: `${(character.status.wounds.current / character.status.wounds.max) * 100}%`,
                                backgroundColor: character.status.wounds.current <= character.status.wounds.max * 0.25 
                                    ? '#dc2626' 
                                    : character.status.wounds.current <= character.status.wounds.max * 0.5 
                                        ? '#f59e0b' 
                                        : '#22c55e'
                            }}
                        />
                    </div>
                </div>

                <div className="advantage-section">
                    <span className="advantage-label">Advantage:</span>
                    <span className="advantage-value">0</span>
                </div>

                {/* Conditions */}
                <div className="conditions-section">
                    <h4 className="conditions-title">Conditions</h4>
                    {character.conditions.length === 0 ? (
                        <p className="empty-message">No active conditions</p>
                    ) : (
                        <div className="conditions-list">
                            {character.conditions.map((condition, index) => (
                                <div key={`${condition.id}-${index}`} className="condition-item">
                                    <span className="condition-name">{getConditionName(condition.id)}</span>
                                    {condition.stack > 1 && (
                                        <span className="condition-stack">×{condition.stack}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CombatTab;
