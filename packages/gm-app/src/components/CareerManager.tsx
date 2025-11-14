import React, { useState } from 'react';
import {
    getCareerLevelsForCharacter,
    allSkillsAndCharacteristics,
    talentsData,
    careersData,
    Character,
    Career,
    CareerLevel,
    CareerHistoryEntry
} from '@wfrp/shared';
import styles from './CareerManager.module.css';

interface CareerManagerProps {
    character: Character;
    onCharacterUpdate: (character: Character) => void;
    onClose: () => void;
}

const CareerManager: React.FC<CareerManagerProps> = ({ character, onCharacterUpdate, onClose }) => {
    const careers = careersData as Career[];
    const [selectedUnlockTab, setSelectedUnlockTab] = useState<'characteristics' | 'skills' | 'talents'>('characteristics');

    const currentCareer = careers.find(c => c.id === character.currentCareerId);
    const currentLevel = currentCareer?.career_level.find(lvl => lvl.id === character.currentCareerLevelId);

    const availableLevels = getCareerLevelsForCharacter(character, careers);

    const characteristicOptions = ['WS', 'BS', 'S', 'T', 'I', 'Ag', 'Dex', 'Int', 'WP', 'Fel'];

    const skillOptions = allSkillsAndCharacteristics
        .filter((sc: any) => sc.type === 'skill')
        .map((sc: any) => ({ id: sc.id, name: sc.name }))
        .concat(character.skills.map(s => ({ id: s.id, name: s.name })))
        .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

    const talentOptions = (talentsData as any[]).map(t => ({ id: t.id, name: t.name }));

    const toggleCharacteristic = (charId: string) => {
        const updatedCharacter = { ...character };
        const unlocked = updatedCharacter.unlockedCharacteristicIds || [];
        const charIdToChange = unlocked.find(c => c.toLowerCase() === charId.toLowerCase()) || charId;

        if (unlocked.map(id => id.toLowerCase()).includes(charId.toLowerCase())) {
            updatedCharacter.unlockedCharacteristicIds = unlocked.filter(c => c.toLowerCase() !== charId.toLowerCase());
        } else {
            updatedCharacter.unlockedCharacteristicIds = [...unlocked, charIdToChange];
        }
        onCharacterUpdate(updatedCharacter);
    };

    const toggleSkill = (skillId: string) => {
        const updatedCharacter = { ...character };
        const unlocked = updatedCharacter.unlockedSkillIds || [];
        const skillIdToChange = unlocked.find(s => s.toLowerCase() === skillId.toLowerCase()) || skillId;

        if (unlocked.map(id => id.toLowerCase()).includes(skillIdToChange.toLowerCase())) {
            updatedCharacter.unlockedSkillIds = unlocked.filter(s => s.toLowerCase() !== skillIdToChange.toLowerCase());
        } else {
            updatedCharacter.unlockedSkillIds = [...unlocked, skillIdToChange];
        }

        onCharacterUpdate(updatedCharacter);
    };

    const toggleTalent = (talentId: string) => {
        const updatedCharacter = { ...character };
        const unlocked = updatedCharacter.unlockedTalentIds || [];

        if (unlocked.includes(talentId)) {
            updatedCharacter.unlockedTalentIds = unlocked.filter(t => t !== talentId);
        } else {
            updatedCharacter.unlockedTalentIds = [...unlocked, talentId];
        }

        onCharacterUpdate(updatedCharacter);
    };

    const formatXP = (xp: number) => {
        return xp.toLocaleString();
    };

    // Group career history by career level
    const groupedHistory = (character.careerHistory || []).reduce((acc, entry) => {
        const key = `${entry.careerId}-${entry.careerLevelId}`;
        if (!acc[key]) {
            acc[key] = {
                careerName: entry.careerName,
                levelName: entry.levelName,
                entries: []
            };
        }
        acc[key].entries.push(entry);
        return acc;
    }, {} as Record<string, { careerName: string; levelName: string; entries: CareerHistoryEntry[] }>);

    return (
        <div className={styles.careerManager}>
            <h2 className={styles.title}>Career Management</h2>
            <button className={styles.closeButton} onClick={onClose}>Close</button>

            {/* Current Career Info */}
            <div className={styles.section}>
                <h3>Current Career</h3>
                <div className={styles.careerInfo}>
                    <div className={styles.infoRow}>
                        <span className={styles.label}>Career:</span>
                        <span className={styles.value}>{currentCareer?.name || 'Unknown'}</span>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.label}>Class:</span>
                        <span className={styles.value}>{currentCareer?.class || 'Unknown'}</span>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.label}>Level:</span>
                        <span className={styles.value}>
                            {currentLevel?.name || 'Unknown'} (Level {currentLevel?.lvl})
                        </span>
                    </div>
                    <div className={styles.infoRow}>
                        <span className={styles.label}>Status:</span>
                        <span className={styles.value}>{currentLevel?.status || 'Unknown'}</span>
                    </div>
                </div>
            </div>

            {/* Available Career Levels */}
            <div className={styles.section}>
                <h3>Available Career Levels</h3>
                <div className={styles.levelsList}>
                    {availableLevels.map(level => (
                        <div key={level.id} className={styles.levelCard}>
                            <h4>{level.name} (Level {level.lvl})</h4>
                            <div className={styles.levelDetails}>
                                <div>
                                    <strong>Characteristics:</strong> {level.characteristic_advances.join(', ')}
                                </div>
                                <div>
                                    <strong>Skills:</strong> {level.skills_ids.length} available
                                </div>
                                <div>
                                    <strong>Talents:</strong> {level.talent_ids.length} available
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* GM Unlocks */}
            <div className={styles.section}>
                <h3>GM Unlocks</h3>
                <p className={styles.description}>
                    Grant this character access to characteristics, skills, or talents outside their career path.
                </p>

                <div className={styles.tabs}>
                    <button
                        className={selectedUnlockTab === 'characteristics' ? styles.activeTab : styles.tab}
                        onClick={() => setSelectedUnlockTab('characteristics')}
                    >
                        Characteristics
                    </button>
                    <button
                        className={selectedUnlockTab === 'skills' ? styles.activeTab : styles.tab}
                        onClick={() => setSelectedUnlockTab('skills')}
                    >
                        Skills
                    </button>
                    <button
                        className={selectedUnlockTab === 'talents' ? styles.activeTab : styles.tab}
                        onClick={() => setSelectedUnlockTab('talents')}
                    >
                        Talents
                    </button>
                </div>

                <div className={styles.unlockContent}>
                    {selectedUnlockTab === 'characteristics' && (
                        <div className={styles.optionsList}>
                            {characteristicOptions.map(char => {
                                const isUnlocked = (character.unlockedCharacteristicIds || []).map(id => id.toLowerCase()).includes(char.toLowerCase());
                                return (
                                    <label key={char} className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={isUnlocked}
                                            onChange={() => toggleCharacteristic(char)}
                                        />
                                        <span className={isUnlocked ? styles.unlocked : ''}>{char}</span>
                                    </label>
                                );
                            })}
                        </div>
                    )}

                    {selectedUnlockTab === 'skills' && (
                        <div className={styles.optionsList}>
                            {skillOptions.map(skill => {
                                const isUnlocked = (character.unlockedSkillIds || []).includes(skill.id);
                                return (
                                    <label key={skill.id} className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={isUnlocked}
                                            onChange={() => toggleSkill(skill.id)}
                                        />
                                        <span className={isUnlocked ? styles.unlocked : ''}>{skill.name}</span>
                                    </label>
                                );
                            })}
                        </div>
                    )}

                    {selectedUnlockTab === 'talents' && (
                        <div className={styles.optionsList}>
                            {talentOptions.map(talent => {
                                const isUnlocked = (character.unlockedTalentIds || []).includes(talent.id);
                                return (
                                    <label key={talent.id} className={styles.checkboxLabel}>
                                        <input
                                            type="checkbox"
                                            checked={isUnlocked}
                                            onChange={() => toggleTalent(talent.id)}
                                        />
                                        <span className={isUnlocked ? styles.unlocked : ''}>{talent.name}</span>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Career History */}
            <div className={styles.section}>
                <h3>Career History</h3>
                <p className={styles.description}>
                    Complete history of all XP spent by this character.
                </p>

                {Object.keys(groupedHistory).length === 0 ? (
                    <p className={styles.emptyState}>No advancement history yet.</p>
                ) : (
                    <div className={styles.historyList}>
                        {Object.entries(groupedHistory).map(([key, group]) => (
                            <div key={key} className={styles.historyGroup}>
                                <h4 className={styles.historyGroupTitle}>
                                    {group.careerName} - {group.levelName}
                                </h4>
                                <table className={styles.historyTable}>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Type</th>
                                            <th>Advancement</th>
                                            <th>XP Spent</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {group.entries.map((entry, idx) => (
                                            <tr key={idx}>
                                                <td>{new Date(entry.timestamp).toLocaleDateString()}</td>
                                                <td className={styles.typeCell}>{entry.advancementType}</td>
                                                <td>{entry.advancementName}</td>
                                                <td className={styles.xpCell}>{formatXP(entry.xpSpent)} XP</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* XP Summary */}
            <div className={styles.section}>
                <h3>XP Summary</h3>
                <div className={styles.xpSummary}>
                    <div className={styles.xpRow}>
                        <span className={styles.label}>Total XP Spent:</span>
                        <span className={styles.xpValue}>{formatXP(character.xp.spent)} XP</span>
                    </div>
                    <div className={styles.xpRow}>
                        <span className={styles.label}>Current XP:</span>
                        <span className={styles.xpValue}>{formatXP(character.xp.current)} XP</span>
                    </div>
                    <div className={styles.xpRow}>
                        <span className={styles.label}>Total Earned:</span>
                        <span className={styles.xpValue}>
                            {formatXP(character.xp.current + character.xp.spent)} XP
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CareerManager;
