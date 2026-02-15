import React, { useState, useMemo, useCallback } from 'react';
import {
    Character,
    Career,
    useGameData,
    generateBaseNPC,
    applyCareerLevel,
    buildNPCBiography,
    NPCCareerHistoryStep,
    CareerLevelSimulationResult,
    Talent,
    calculateCharacteristicValue,
    speciesData,
} from '@wfrp/shared';
import styles from './NPCGeneratorWizard.module.css';

interface NPCGeneratorWizardProps {
    onClose: () => void;
    onComplete: (character: Character) => void;
}

type Step = 'origin' | 'career-loop';

const CHAR_KEYS = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'] as const;
const CHAR_LABELS: Record<string, string> = {
    ws: 'WS', bs: 'BS', s: 'S', t: 'T', i: 'I',
    ag: 'Ag', dex: 'Dex', int: 'Int', wp: 'WP', fel: 'Fel'
};

interface SpeciesDataItem {
    id: string;
    name: string;
    base_stats: Record<string, number>;
    fate: number;
    resilience: number;
    extra_points: number;
    movement: number;
}

// Name lists for random name generation
const namesBySpecies: Record<string, { first: string[]; last: string[] }> = {
    human: {
        first: ['Albrecht', 'Gunnar', 'Elsa', 'Katrin', 'Hans', 'Sigrid', 'Ludwig', 'Mathilde', 'Ulrich', 'Karl', 'Heinrich', 'Greta', 'Friedrich', 'Helga', 'Otto'],
        last: ['Weber', 'Hoffman', 'Schmidt', 'Fischer', 'Schneider', 'Bauer', 'Klein', 'Vogt', 'Miller', 'Wagner', 'Koch', 'Braun']
    },
    dwarf: {
        first: ['Gorrin', 'Thorgrim', 'Bardin', 'Durgrim', 'Kazador', 'Ungrim', 'Morgrim', 'Snorri', 'Gotrek', 'Brokk', 'Dagni', 'Valda'],
        last: ['Ironbeard', 'Stoneforge', 'Axebiter', 'Goldholm', 'Hammerfist', 'Deepdelver', 'Tunnelhelm', 'Boulderback']
    },
    halfling: {
        first: ['Pip', 'Milo', 'Samwise', 'Bandobras', 'Tobold', 'Falco', 'Daisy', 'Marigold', 'Rosie', 'Peony'],
        last: ['Greenhill', 'Shortwick', 'Puddifoot', 'Goodbarrel', 'Thorngage', 'Burrows']
    },
    elf: {
        first: ['Aelindril', 'Caladrel', 'Thalion', 'Galion', 'Aerindel', 'Faenor', 'Athelwyn', 'Selendra', 'Caelith'],
        last: ['Silverleaf', 'Stormbow', 'Dawnweaver', 'Moonshadow', 'Starfire']
    },
    wood_elf: {
        first: ['Aelindril', 'Naestra', 'Finduilas', 'Galion', 'Alith', 'Larethin', 'Ariel', 'Caelith'],
        last: ['Wildwood', 'Deeproot', 'Thornbark', 'Greenveil', 'Hawkeye']
    }
};

function randomName(speciesId: string): string {
    const names = namesBySpecies[speciesId] || namesBySpecies.human;
    const first = names.first[Math.floor(Math.random() * names.first.length)];
    const last = names.last[Math.floor(Math.random() * names.last.length)];
    return `${first} ${last}`;
}

const NPCGeneratorWizard: React.FC<NPCGeneratorWizardProps> = ({ onClose, onComplete }) => {
    const gameData = useGameData();

    // ── Step tracking ──
    const [currentStep, setCurrentStep] = useState<Step>('origin');

    // ── Step 1: Origin ──
    const [speciesId, setSpeciesId] = useState<string>('human');
    const [npcName, setNpcName] = useState<string>('');

    // ── Character being built ──
    const [character, setCharacter] = useState<Character | null>(null);

    // ── Career loop state ──
    const [selectedCareerClass, setSelectedCareerClass] = useState<string>('');
    const [selectedCareerId, setSelectedCareerId] = useState<string>('');
    const [selectedLevel, setSelectedLevel] = useState<number>(1);
    const [talentCount, setTalentCount] = useState<number>(1);
    const [lastResult, setLastResult] = useState<CareerLevelSimulationResult | null>(null);
    const [historySteps, setHistorySteps] = useState<NPCCareerHistoryStep[]>([]);
    const [hasSimulated, setHasSimulated] = useState(false);

    // ── Derived data ──
    const speciesList = speciesData as SpeciesDataItem[];

    const careerClasses = useMemo(() => {
        const classes = new Set<string>();
        gameData.careers.forEach(c => {
            if (c.class) classes.add(c.class);
        });
        return Array.from(classes).sort();
    }, [gameData.careers]);

    const filteredCareers = useMemo(() => {
        if (!selectedCareerClass) return gameData.careers;
        return gameData.careers.filter(c => c.class === selectedCareerClass);
    }, [gameData.careers, selectedCareerClass]);

    const selectedCareer = useMemo(() => {
        return gameData.careers.find(c => c.id === selectedCareerId) || null;
    }, [gameData.careers, selectedCareerId]);

    const availableLevels = useMemo(() => {
        if (!selectedCareer) return [];
        return selectedCareer.career_level.map(cl => ({
            id: cl.id,
            name: cl.name,
            lvl: cl.lvl
        }));
    }, [selectedCareer]);

    const selectedCareerLevel = useMemo(() => {
        if (!selectedCareer) return null;
        return selectedCareer.career_level.find(cl => cl.lvl === selectedLevel) || null;
    }, [selectedCareer, selectedLevel]);

    // Current career's last simulated level to enable "advance" button
    const lastStepForCurrentCareer = useMemo(() => {
        if (historySteps.length === 0) return null;
        const last = historySteps[historySteps.length - 1];
        return last;
    }, [historySteps]);

    const canAdvanceTier = useMemo(() => {
        if (!lastStepForCurrentCareer || !selectedCareer) return false;
        // Can advance if the last step was for the current career and there's a next level
        if (lastStepForCurrentCareer.careerId !== selectedCareerId) return false;
        const nextLevel = lastStepForCurrentCareer.level + 1;
        return selectedCareer.career_level.some(cl => cl.lvl === nextLevel);
    }, [lastStepForCurrentCareer, selectedCareer, selectedCareerId]);

    // ── Step 1: Generate base NPC ──
    const handleGenerateBase = useCallback(() => {
        const name = npcName.trim() || randomName(speciesId);
        if (!npcName.trim()) setNpcName(name);

        const baseChar = generateBaseNPC(speciesId, name, gameData.skills, gameData.talents);
        setCharacter(baseChar);
        setCurrentStep('career-loop');
        setLastResult(null);
        setHasSimulated(false);
    }, [speciesId, npcName, gameData.skills]);

    const handleRandomizeName = useCallback(() => {
        setNpcName(randomName(speciesId));
    }, [speciesId]);

    // ── Step 2: Simulate career level ──
    const handleSimulateLevel = useCallback(() => {
        if (!character || !selectedCareer || !selectedCareerLevel) return;

        const { character: updated, result } = applyCareerLevel(
            character,
            selectedCareer,
            selectedCareerLevel,
            gameData.skills,
            gameData.talents,
            talentCount
        );

        setCharacter(updated);
        setLastResult(result);
        setHasSimulated(true);

        const step: NPCCareerHistoryStep = {
            careerId: selectedCareer.id,
            careerName: selectedCareer.name,
            careerLevelId: selectedCareerLevel.id,
            levelName: selectedCareerLevel.name,
            level: selectedCareerLevel.lvl,
            simulationResult: result
        };
        setHistorySteps(prev => [...prev, step]);
    }, [character, selectedCareer, selectedCareerLevel, gameData.skills, gameData.talents, talentCount]);

    // ── Decision: Advance tier ──
    const handleAdvanceTier = useCallback(() => {
        if (!selectedCareer || !lastStepForCurrentCareer) return;
        const nextLvl = lastStepForCurrentCareer.level + 1;
        setSelectedLevel(nextLvl);
        setLastResult(null);
        setHasSimulated(false);
    }, [selectedCareer, lastStepForCurrentCareer]);

    // ── Decision: Switch career ──
    const handleSwitchCareer = useCallback(() => {
        setSelectedCareerId('');
        setSelectedCareerClass('');
        setSelectedLevel(1);
        setLastResult(null);
        setHasSimulated(false);
    }, []);

    // ── Decision: Finish ──
    const handleFinish = useCallback(() => {
        if (!character) return;

        const biography = buildNPCBiography(historySteps);
        const finalChar: Character = {
            ...character,
            name: npcName.trim() || character.name,
            lore: {
                ...(character.lore || { gmNotes: '', background: [] }),
                biography
            }
        };
        onComplete(finalChar);
    }, [character, historySteps, npcName, onComplete]);

    // ── Helper: resolve skill name ──
    const getSkillName = useCallback((skillId: string): string => {
        if (!character) return skillId;
        const skill = character.skills.find(s => s.id === skillId);
        if (skill) return skill.name;
        const def = gameData.skills.find(s => s.id === skillId);
        return def?.name || skillId;
    }, [character, gameData.skills]);

    // ── Helper: resolve talent name ──
    const getTalentName = useCallback((talentId: string): string => {
        const t = gameData.talents.find(t => t.id === talentId);
        return t?.name || talentId;
    }, [gameData.talents]);

    // ── Render: Origin step ──
    const renderOriginStep = () => (
        <div className={styles.originStep}>
            <h3 style={{ color: '#d4af37', margin: 0 }}>Step 1: Origin</h3>
            <p style={{ color: '#aaa', fontSize: '0.9rem' }}>
                Choose the NPC's species and name. Base characteristics will be randomly rolled.
            </p>

            <div className={styles.formRow}>
                <label>Species</label>
                <select
                    value={speciesId}
                    onChange={e => setSpeciesId(e.target.value)}
                >
                    {speciesList.map(sp => (
                        <option key={sp.id} value={sp.id}>{sp.name}</option>
                    ))}
                </select>
            </div>

            <div className={styles.formRow}>
                <label>Name</label>
                <input
                    type="text"
                    value={npcName}
                    onChange={e => setNpcName(e.target.value)}
                    placeholder="Enter name or randomize..."
                />
                <button className={styles.randomizeBtn} onClick={handleRandomizeName}>
                    🎲 Random
                </button>
            </div>

            <button
                className={styles.simulateBtn}
                onClick={handleGenerateBase}
            >
                Generate Base Character
            </button>
        </div>
    );

    // ── Render: Character stats (left panel) ──
    const renderCharacterStats = () => {
        if (!character) return null;

        const advancedSkills = character.skills.filter(s => s.advances > 0);

        return (
            <div className={styles.leftPanel}>
                <h3 className={styles.panelTitle}>
                    {character.name} ({character.species})
                </h3>

                {/* Characteristics */}
                <div className={styles.statsGrid}>
                    {CHAR_KEYS.map(key => {
                        const char = character.characteristics[key];
                        const total = calculateCharacteristicValue(char);
                        return (
                            <div key={key} className={styles.statLine}>
                                <span className={styles.statKey}>{CHAR_LABELS[key]}</span>
                                <span>
                                    <span className={styles.statVal}>{total}</span>
                                    {char.advances > 0 && (
                                        <span className={styles.statAdv}> (+{char.advances})</span>
                                    )}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Wounds / Fate / Resilience */}
                <div className={styles.woundsDisplay}>
                    <div className={styles.woundStat}>
                        <span className={styles.woundLabel}>W:</span>
                        <span className={styles.woundValue}>{character.status.wounds.max}</span>
                    </div>
                    <div className={styles.woundStat}>
                        <span className={styles.woundLabel}>Fate:</span>
                        <span className={styles.woundValue}>{character.status.fate.max}</span>
                    </div>
                    <div className={styles.woundStat}>
                        <span className={styles.woundLabel}>Res:</span>
                        <span className={styles.woundValue}>{character.status.resilience.max}</span>
                    </div>
                    <div className={styles.woundStat}>
                        <span className={styles.woundLabel}>Mv:</span>
                        <span className={styles.woundValue}>{character.movement}</span>
                    </div>
                </div>

                {/* Skills with advances */}
                {advancedSkills.length > 0 && (
                    <>
                        <h4 className={styles.panelTitle}>Skills</h4>
                        <div className={styles.skillsList}>
                            {advancedSkills
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map(skill => {
                                    const charKey = skill.characteristic as keyof Character['characteristics'];
                                    const charVal = calculateCharacteristicValue(character.characteristics[charKey]);
                                    const totalSkill = charVal + skill.advances;
                                    return (
                                        <div key={skill.id} className={styles.skillItem}>
                                            <span className={styles.skillName}>{skill.name}</span>
                                            <span className={styles.skillValue}>
                                                {totalSkill} (+{skill.advances})
                                            </span>
                                        </div>
                                    );
                                })}
                        </div>
                    </>
                )}

                {/* Talents */}
                {Object.keys(character.talents).length > 0 && (
                    <>
                        <h4 className={styles.panelTitle}>Talents</h4>
                        <div className={styles.talentsList}>
                            {Object.entries(character.talents).map(([tid, rank]) => (
                                <span key={tid} className={styles.talentChip}>
                                    {getTalentName(tid)}{rank > 1 ? ` ×${rank}` : ''}
                                </span>
                            ))}
                        </div>
                    </>
                )}

                {/* Career History */}
                {historySteps.length > 0 && (
                    <>
                        <h4 className={styles.panelTitle}>Career History</h4>
                        <ul className={styles.historyList}>
                            {historySteps.map((step, idx) => (
                                <li key={idx} className={styles.historyItem}>
                                    <span className={styles.historyIndex}>{idx + 1}.</span>
                                    <span className={styles.historyText}>
                                        {step.careerName} — {step.levelName} (Lvl {step.level})
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </>
                )}
            </div>
        );
    };

    // ── Render: Career selector & simulation results (right panel) ──
    const renderCareerPanel = () => (
        <div className={styles.rightPanel}>
            <h3 className={styles.panelTitle}>Career Path</h3>

            <div className={styles.careerSelector}>
                {/* Career class filter */}
                <div className={styles.formRow}>
                    <label>Class</label>
                    <select
                        value={selectedCareerClass}
                        onChange={e => {
                            setSelectedCareerClass(e.target.value);
                            setSelectedCareerId('');
                            setSelectedLevel(1);
                            setLastResult(null);
                            setHasSimulated(false);
                        }}
                    >
                        <option value="">— All Classes —</option>
                        {careerClasses.map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                        ))}
                    </select>
                </div>

                {/* Career selection */}
                <div className={styles.formRow}>
                    <label>Career</label>
                    <select
                        value={selectedCareerId}
                        onChange={e => {
                            setSelectedCareerId(e.target.value);
                            setSelectedLevel(1);
                            setLastResult(null);
                            setHasSimulated(false);
                        }}
                    >
                        <option value="">— Select Career —</option>
                        {filteredCareers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {/* Level selection */}
                {selectedCareer && (
                    <div className={styles.formRow}>
                        <label>Level</label>
                        <select
                            value={selectedLevel}
                            onChange={e => {
                                setSelectedLevel(parseInt(e.target.value));
                                setLastResult(null);
                                setHasSimulated(false);
                            }}
                        >
                            {availableLevels.map(lv => (
                                <option key={lv.id} value={lv.lvl}>
                                    {lv.lvl} — {lv.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Talent count */}
                <div className={styles.talentCountRow}>
                    <label>Talents to add:</label>
                    <input
                        type="number"
                        min={0}
                        max={5}
                        value={talentCount}
                        onChange={e => setTalentCount(Math.max(0, Math.min(5, parseInt(e.target.value) || 0)))}
                    />
                </div>

                {/* Level preview */}
                {selectedCareerLevel && !hasSimulated && (
                    <div className={styles.levelPreview}>
                        <h5>{selectedCareerLevel.name} — Preview</h5>
                        <div className={styles.sectionLabel}>Characteristics</div>
                        <div className={styles.previewRow}>
                            {(selectedCareerLevel.characteristic_advances || []).map(ch => (
                                <span key={ch} className={styles.previewChip}>
                                    {CHAR_LABELS[ch] || ch}
                                </span>
                            ))}
                        </div>
                        <div className={styles.sectionLabel}>Skills</div>
                        <div className={styles.previewRow}>
                            {(selectedCareerLevel.skills_ids || []).map(sid => (
                                <span key={sid} className={styles.previewChip}>
                                    {getSkillName(sid)}
                                </span>
                            ))}
                        </div>
                        <div className={styles.sectionLabel}>Talents</div>
                        <div className={styles.previewRow}>
                            {(selectedCareerLevel.talent_ids || []).map(tid => (
                                <span key={tid} className={styles.previewChip}>
                                    {getTalentName(tid)}
                                </span>
                            ))}
                        </div>
                        <div className={styles.sectionLabel}>Status: {selectedCareerLevel.status}</div>
                    </div>
                )}

                {/* Simulate button */}
                <button
                    className={styles.simulateBtn}
                    disabled={!selectedCareerId || !selectedCareerLevel || hasSimulated}
                    onClick={handleSimulateLevel}
                >
                    ⚔ Simulate Level
                </button>
            </div>

            {/* Simulation results */}
            {lastResult && (
                <div className={styles.resultsBox}>
                    <h4>Simulation Results: {lastResult.careerName} — {lastResult.levelName}</h4>

                    {Object.keys(lastResult.characteristicAdvances).length > 0 && (
                        <div className={styles.resultSection}>
                            <h5>Characteristic Advances</h5>
                            <div className={styles.resultList}>
                                {Object.entries(lastResult.characteristicAdvances).map(([key, val]) => (
                                    <span key={key} className={styles.resultChip}>
                                        +{val} {CHAR_LABELS[key] || key}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {Object.keys(lastResult.skillAdvances).length > 0 && (
                        <div className={styles.resultSection}>
                            <h5>Skill Advances</h5>
                            <div className={styles.resultList}>
                                {Object.entries(lastResult.skillAdvances).map(([sid, val]) => (
                                    <span key={sid} className={styles.resultChip}>
                                        +{val} {getSkillName(sid)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {lastResult.talentsAdded.length > 0 && (
                        <div className={styles.resultSection}>
                            <h5>Talents Added</h5>
                            <div className={styles.resultList}>
                                {lastResult.talentsAdded.map(tid => (
                                    <span key={tid} className={styles.resultChipTalent}>
                                        {getTalentName(tid)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Decision buttons — only shown after simulation */}
            {hasSimulated && (
                <div className={styles.decisionBox}>
                    <h4>What's Next?</h4>

                    {/* Advance tier */}
                    {canAdvanceTier && (
                        <button
                            className={`${styles.decisionBtn} ${styles.advanceBtn}`}
                            onClick={handleAdvanceTier}
                        >
                            ▲ Advance to {selectedCareer?.career_level.find(cl => cl.lvl === (lastStepForCurrentCareer?.level || 0) + 1)?.name || 'Next Level'}
                            {' '}(Level {(lastStepForCurrentCareer?.level || 0) + 1})
                        </button>
                    )}

                    {/* Switch career */}
                    <button
                        className={`${styles.decisionBtn} ${styles.switchBtn}`}
                        onClick={handleSwitchCareer}
                    >
                        ↻ Switch to a Different Career
                    </button>

                    {/* Finish */}
                    <button
                        className={`${styles.decisionBtn} ${styles.finishBtn}`}
                        onClick={handleFinish}
                    >
                        ✓ Finish & Save NPC
                    </button>
                </div>
            )}
        </div>
    );

    // ── Render: Career loop step ──
    const renderCareerLoopStep = () => (
        <div className={styles.careerLoopStep}>
            {renderCharacterStats()}
            {renderCareerPanel()}
        </div>
    );

    return (
        <div className={styles.overlay}>
            <div className={styles.container}>
                {/* Header */}
                <div className={styles.header}>
                    <h2>
                        NPC Generator
                        {character ? `: ${character.name} (${character.species})` : ''}
                    </h2>
                    <div className={styles.headerRight}>
                        <button className={styles.closeBtn} onClick={onClose}>✕ Close</button>
                    </div>
                </div>

                {/* Step indicator */}
                <div className={styles.stepIndicator}>
                    <span className={`${styles.stepBadge} ${currentStep === 'origin' ? styles.active : character ? styles.completed : ''}`}>
                        1. Origin
                    </span>
                    <span className={`${styles.stepBadge} ${currentStep === 'career-loop' ? styles.active : ''}`}>
                        2. Career Path
                    </span>
                </div>

                {/* Content */}
                <div className={styles.content}>
                    {currentStep === 'origin' && renderOriginStep()}
                    {currentStep === 'career-loop' && renderCareerLoopStep()}
                </div>

                {/* Footer */}
                <div className={styles.footer}>
                    <div className={styles.footerInfo}>
                        {historySteps.length > 0
                            ? `${historySteps.length} career step${historySteps.length > 1 ? 's' : ''} simulated`
                            : 'Advanced NPC Career Path Simulator'
                        }
                    </div>
                    {currentStep === 'career-loop' && historySteps.length > 0 && !hasSimulated && (
                        <button
                            className={`${styles.button} ${styles.primary}`}
                            onClick={handleFinish}
                        >
                            Finish & Save
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NPCGeneratorWizard;
