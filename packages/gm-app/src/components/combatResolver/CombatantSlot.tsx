import React from 'react';
import styles from './CombatantSlot.module.css';
import { QueuedRoll, Character, Combatant, Talent } from '@wfrp/shared';

interface AssignedRoll {
    characterId: string;
    characterName: string;
    skillName: string;
    rollResult: number;
    targetNumber: number;
    successLevel: number;
    weaponName?: string;
    weaponDamage?: number;
    usedTalents?: { name: string; rank: number }[];
    isNpc?: boolean;
}

interface CombatantSlotProps {
    role: 'attacker' | 'defender';
    assignedRoll: AssignedRoll | null;
    characters: Character[];
    combatants: Combatant[];
    fudge?: number;
    applicableTalents?: Array<{ talent: Talent; rank: number }>;
    onClear: () => void;
    onNpcRoll: (characterId: string, skillId: string, weaponId?: string) => void;
    onChangeSuccessLevel?: (newSL: number) => void;
    onChangeFudge?: (newFudge: number) => void;
    onToggleNpcTalent?: (talentName: string, rank: number) => void;
}

export const CombatantSlot: React.FC<CombatantSlotProps> = ({
    role,
    assignedRoll,
    characters,
    combatants,
    fudge = 0,
    applicableTalents = [],
    onClear,
    onNpcRoll,
    onChangeFudge,
    onToggleNpcTalent
}) => {
    const [selectedNpcId, setSelectedNpcId] = React.useState<string>('');

    const roleLabel = role === 'attacker' ? 'ATTACKER' : 'DEFENDER';
    const roleClass = role === 'attacker' ? styles.attacker : styles.defender;

    // Get NPCs (characters without userId or combatants that aren't players)
    const npcs = React.useMemo(() => {
        const combatantNpcs = combatants
            .filter(c => !c.isPlayer)
            .map(c => {
                const char = characters.find(ch => ch.id === c.sourceId);
                return char || {
                    id: c.sourceId,
                    name: c.name,
                    skills: [],
                    inventory: { weapons: {} },
                    characteristics: {} as Character['characteristics']
                };
            });

        // Merge and deduplicate
        const allNpcs = [...characters];
        combatantNpcs.forEach(npc => {
            if (!allNpcs.find(n => n.id === npc.id)) {
                allNpcs.push(npc as Character);
            }
        });
        return allNpcs;
    }, [characters, combatants]);

    const selectedNpc = npcs.find(n => n.id === selectedNpcId);

    if (assignedRoll) {
        const rolledSL = assignedRoll.successLevel;
        const totalSL = rolledSL + fudge;
        const slSign = totalSL >= 0 ? '+' : '';
        return (
            <div className={`${styles.slot} ${roleClass} ${styles.filled}`}>
                <div className={styles.header}>
                    <span className={styles.roleLabel}>{roleLabel}</span>
                    <button className={styles.clearBtn} onClick={onClear} title="Clear">×</button>
                </div>
                <div className={styles.content}>
                    <div className={styles.characterName}>{assignedRoll.characterName}</div>
                    {assignedRoll.isNpc && <span className={styles.npcBadge}>NPC</span>}
                    <div className={styles.skillInfo}>
                        <span className={styles.skillName}>{assignedRoll.skillName}</span>
                        {assignedRoll.weaponName && (
                            <span className={styles.weaponName}>({assignedRoll.weaponName})</span>
                        )}
                    </div>
                    <div className={styles.rollDetails}>
                        <span>Roll: {assignedRoll.rollResult}</span>
                        <span>Target: {assignedRoll.targetNumber}</span>
                    </div>
                    {
                        assignedRoll.usedTalents && assignedRoll.usedTalents.length > 0 && (
                            <div className={styles.usedTalentsContainer}>
                                Used Talents:
                                {assignedRoll.usedTalents.map(t => {
                                    return (
                                        <span key={t.name} className={styles.usedTalent}>
                                            {t.name} (Rank {t.rank})
                                        </span>
                                    );
                                })}
                            </div>
                        )
                    }
                    <div className={`${styles.successLevel} ${totalSL >= 0 ? styles.success : styles.failure}`}>
                    SL {slSign}{totalSL}
                    </div>
                    {onChangeFudge && (
                        <div className={styles.fudgeControls}>
                            <span className={styles.fudgeLabel}>GM Modifier:</span>
                            <button
                                className={styles.fudgeBtn}
                                onClick={() => onChangeFudge(fudge - 1)}
                            >−</button>
                            <span className={`${styles.fudgeValue} ${fudge !== 0 ? styles.fudgeActive : ''}`}>
                                {fudge >= 0 ? '+' : ''}{fudge}
                            </span>
                            <button
                                className={styles.fudgeBtn}
                                onClick={() => onChangeFudge(fudge + 1)}
                            >+</button>
                            <button
                                className={styles.fudgeResetBtn}
                                onClick={() => onChangeFudge(0)}
                                title="Reset modifier"
                            >↺</button>
                        </div>
                    )}
                    {assignedRoll.isNpc && applicableTalents.length > 0 && onToggleNpcTalent && (
                        <div className={styles.npcTalentSection}>
                            <span className={styles.npcTalentLabel}>Applicable Talents:</span>
                            {applicableTalents.map(({ talent, rank }) => {
                                const isChecked = (assignedRoll.usedTalents || []).some(t => t.name === talent.name);
                                const effectSummary = talent.effects
                                    ?.map(e => {
                                        const val = typeof e.value === 'number' ? e.value * rank : e.value;
                                        return `${e.type.replace(/_/g, ' ')}: ${val}`; 
                                    })
                                    .join(', ').concat(talent.tests ? ` | Tests: ${talent.tests.join(', ')}` : '');
                                return (
                                    <label key={talent.id} className={styles.npcTalentCheckbox}>
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => onToggleNpcTalent(talent.name, rank)}
                                        />
                                        <span className={styles.npcTalentName}>{talent.name}</span>
                                        <span className={styles.npcTalentRank}>×{rank}</span>
                                        {effectSummary && (
                                            <span className={styles.npcTalentEffect}>{effectSummary}</span>
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles.slot} ${roleClass} ${styles.empty}`}>
            <div className={styles.header}>
                <span className={styles.roleLabel}>{roleLabel}</span>
            </div>
            <div className={styles.emptyContent}>
                <p className={styles.instructions}>
                    Click a roll from the queue below, or select an NPC to roll:
                </p>
                <div className={styles.npcControls}>
                    <select
                        value={selectedNpcId}
                        onChange={(e) => setSelectedNpcId(e.target.value)}
                        className={styles.npcSelect}
                    >
                        <option value="">Select NPC...</option>
                        {npcs.map(npc => (
                            <option key={npc.id} value={npc.id}>{npc.name}</option>
                        ))}
                    </select>
                    {selectedNpc && (
                        <NpcQuickActions
                            character={selectedNpc}
                            role={role}
                            onRoll={onNpcRoll}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

interface NpcQuickActionsProps {
    character: Character;
    role: 'attacker' | 'defender';
    onRoll: (characterId: string, skillId: string, weaponId?: string) => void;
}

const NpcQuickActions: React.FC<NpcQuickActionsProps> = ({ character, role, onRoll }) => {
    // Get equipped weapons
    const weaponIds = Object.entries(character.inventory?.weapons || {})
        .filter(([_, count]) => count > 0)
        .map(([id]) => id);

    // Get combat skills
    const meleeSkills = character.skills?.filter(s => s.id?.startsWith('melee')) || [];
    const rangedSkills = character.skills?.filter(s => s.id !== 'ranged' && s.id?.startsWith('ranged')) || [];
    const dodgeSkill = character.skills?.find(s => s.id === 'dodge');
    const otherSkills = character.skills?.filter(s => s.id !== 'melee' && s.id !== 'dodge') || [];

    return (
        <div className={styles.quickActions}>
            {role === 'attacker' ? (
                <>
                    <div className={styles.actionGroup}>
                        <span className={styles.actionLabel}>Attack:</span>
                        {meleeSkills.length > 0 ? (
                            meleeSkills.map(skill => (
                                <button
                                    key={skill.id}
                                    className={styles.actionBtn}
                                    onClick={() => onRoll(character.id, skill.id)}
                                >
                                    ⚔️ {skill.name}
                                </button>
                            ))
                        ) : (
                            <button
                                className={styles.actionBtn}
                                onClick={() => onRoll(character.id, 'ws')}
                            >
                                ⚔️ WS
                            </button>
                        )}
                        {rangedSkills.length > 0 && (
                            rangedSkills.map(skill => (
                                <button
                                    key={skill.id}
                                    className={styles.actionBtn}
                                    onClick={() => onRoll(character.id, skill.id)}
                                >
                                    🏹 {skill.name}
                                </button>
                            ))
                        )}
                    </div>
                </>
            ) : (
                <>
                    <div className={styles.actionGroup}>
                        <span className={styles.actionLabel}>Defend:</span>
                        <button
                            className={styles.actionBtn}
                            onClick={() => onRoll(character.id, dodgeSkill?.id || 'ag')}
                        >
                            🏃 Dodge
                        </button>
                        {meleeSkills.length > 0 && (
                            <button
                                className={styles.actionBtn}
                                onClick={() => onRoll(character.id, meleeSkills[0].id)}
                            >
                                🛡️ Parry
                            </button>
                        )}
                    </div>
                </>
            )}
            {otherSkills.length > 0 && (
                <div className={styles.actionGroup}>
                    <select
                        className={styles.skillSelect}
                        onChange={(e) => e.target.value && onRoll(character.id, e.target.value)}
                        defaultValue=""
                    >
                        <option value="">Other Skills...</option>
                        {otherSkills.map(skill => (
                            <option key={skill.id} value={skill.id}>{skill.name}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
};

export default CombatantSlot;
