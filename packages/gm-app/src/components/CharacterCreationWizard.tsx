import React, { useState } from 'react';
import styles from './CharacterCreationWizard.module.css';
import {
    speciesData,
    careersData,
    Character,
    createBlankCharacter,
    allSkillsAndCharacteristics,
    talentsData,
    Career,
    Skill,
    Characteristic
} from '@wfrp/shared';

interface CharacterCreationWizardProps {
    onClose: () => void;
    onComplete: (character: Character) => void;
}

type Step = 'species' | 'career' | 'attributes' | 'details' | 'summary';

const CharacterCreationWizard: React.FC<CharacterCreationWizardProps> = ({ onClose, onComplete }) => {
    const [currentStep, setCurrentStep] = useState<Step>('species');
    const [character, setCharacter] = useState<Character>(createBlankCharacter());
    const [xpLog, setXpLog] = useState<{ reason: string, amount: number }[]>([]);

    // Step 1: Species
    const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null);

    // Step 2: Career
    const [rolledCareers, setRolledCareers] = useState<Career[]>([]);
    const [selectedCareerId, setSelectedCareerId] = useState<string | null>(null);

    // Step 3: Attributes
    const [rolledAttributes, setRolledAttributes] = useState<number[]>([]);
    const [attributeMode, setAttributeMode] = useState<'roll' | 'assign' | 'pointbuy' | null>(null);
    const [assignedAttributes, setAssignedAttributes] = useState<Record<string, number>>({});

    // Step 4: Details
    const [fateResilienceAllocated, setFateResilienceAllocated] = useState<{ fate: number, resilience: number }>({ fate: 0, resilience: 0 });
    const [selectedSkills, setSelectedSkills] = useState<{ skillId: string, advances: number }[]>([]);
    const [selectedTalents, setSelectedTalents] = useState<string[]>([]);
    const [startingSkillsAdvances, setStartingSkillsAdvances] = useState<Record<string, number>>({});

    const addXp = (amount: number, reason: string) => {
        setXpLog(prev => [...prev, { reason, amount }]);
        setCharacter(prev => ({
            ...prev,
            xp: {
                ...prev.xp,
                current: prev.xp.current + amount
            }
        }));
    };

    // --- Step 1: Species Logic ---
    const rollSpecies = () => {
        const roll = Math.floor(Math.random() * 100) + 1;
        let speciesId = 'human';
        if (roll <= 90) speciesId = 'human';
        else if (roll <= 94) speciesId = 'halfling';
        else if (roll <= 98) speciesId = 'dwarf';
        else if (roll <= 99) speciesId = 'elf'; // High Elf
        else speciesId = 'wood_elf';

        setSelectedSpeciesId(speciesId);
        addXp(20, 'Random Species');
        nextStep();
    };

    const selectSpecies = (id: string) => {
        setSelectedSpeciesId(id);
        nextStep();
    };

    // --- Step 2: Career Logic ---
    const rollCareer = (count: number) => {
        const species = speciesData.find(s => s.id === selectedSpeciesId);
        if (!species) return;

        // Filter careers available to species
        const availableCareers = (careersData as Career[]).filter(c => c.races.includes(species.name) || c.races.includes(species.id)); // Check data consistency later

        const rolled: Career[] = [];
        for (let i = 0; i < count; i++) {
            const random = availableCareers[Math.floor(Math.random() * availableCareers.length)];
            rolled.push(random);
        }
        setRolledCareers(rolled);

        if (count === 1) {
            setSelectedCareerId(rolled[0].id);
            addXp(50, 'Random Career');
            // Auto advance if only 1
        } else {
            // User must choose from rolled
        }
    };

    const confirmCareer = (careerId: string) => {
        setSelectedCareerId(careerId);
        if (rolledCareers.length > 1) {
            addXp(25, 'Chosen from Random Careers');
        }
        nextStep();
    };

    // --- Step 3: Attributes Logic ---
    const rollAttributes = () => {
        const rolls = Array(10).fill(0).map(() => Math.floor(Math.random() * 10) + Math.floor(Math.random() * 10) + 2);
        setRolledAttributes(rolls);
        setAttributeMode('roll');

        // Auto assign in order
        const species = speciesData.find(s => s.id === selectedSpeciesId);
        if (!species) return;

        const stats = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'];
        const newStats: any = {};
        stats.forEach((stat, index) => {
            newStats[stat] = rolls[index];
        });
        setAssignedAttributes(newStats);
        addXp(50, 'Random Attributes');
        // nextStep(); // Let user see results first
    };

    const rollAndAssignAttributes = () => {
        const rolls = Array(10).fill(0).map(() => Math.floor(Math.random() * 10) + Math.floor(Math.random() * 10) + 2);
        setRolledAttributes(rolls);
        setAttributeMode('assign');
        setAssignedAttributes({});
        addXp(25, 'Random Attributes (Assigned)');
    };

    const pointBuyAttributes = () => {
        setAttributeMode('pointbuy');
        setAssignedAttributes({});
        // 100 points to distribute
    };

    // --- Navigation ---
    const nextStep = () => {
        if (currentStep === 'species') setCurrentStep('career');
        else if (currentStep === 'career') setCurrentStep('attributes');
        else if (currentStep === 'attributes') setCurrentStep('details');
        else if (currentStep === 'details') setCurrentStep('summary');
    };

    const finish = () => {
        // Construct final character object
        const species = speciesData.find(s => s.id === selectedSpeciesId);
        const career = (careersData as Career[]).find(c => c.id === selectedCareerId);
        if (!species || !career) return;

        const finalChar = { ...character };
        finalChar.name = "New Character"; // Prompt for name?
        finalChar.currentCareerId = career.id;
        finalChar.currentCareerLevelId = career.career_level[0].id;

        // Apply stats
        Object.entries(assignedAttributes).forEach(([key, value]) => {
            const base = (species.base_stats as any)[key];
            (finalChar.characteristics as any)[key].initial = base + value;
        });

        // Apply Fate/Resilience
        finalChar.status.fate.max = species.fate + fateResilienceAllocated.fate;
        finalChar.status.fate.current = finalChar.status.fate.max;
        finalChar.status.fortune.max = finalChar.status.fate.max;
        finalChar.status.fortune.current = finalChar.status.fate.max;

        finalChar.status.resilience.max = species.resilience + fateResilienceAllocated.resilience;
        finalChar.status.resilience.current = finalChar.status.resilience.max;
        finalChar.status.resolve.max = finalChar.status.resilience.max;
        finalChar.status.resolve.current = finalChar.status.resilience.max;

        finalChar.status.wounds.max =
            Math.floor((finalChar.characteristics.s.initial + finalChar.characteristics.t.initial + (2 * finalChar.characteristics.wp.initial)) / 10);
        // Note: Wounds calc depends on size (Halfling is different). Need size logic.
        // Halfling: (2xTB + WB) / 10 ? No, (SB+2xTB+WB)/10 usually.
        // Standard: SB + 2xTB + WB.
        // Small: 2xTB + WB.
        // Large: SB + 2xTB + WB + ...
        // For now use standard or check species traits.
        if (species.id === 'halfling') {
            finalChar.status.wounds.max = Math.floor(((2 * finalChar.characteristics.t.initial) + finalChar.characteristics.wp.initial) / 10);
        } else {
            finalChar.status.wounds.max = Math.floor((finalChar.characteristics.s.initial + (2 * finalChar.characteristics.t.initial) + finalChar.characteristics.wp.initial) / 10);
        }
        finalChar.status.wounds.current = finalChar.status.wounds.max;

        // Apply Skills
        // ... logic to add skills to finalChar.skills

        onComplete(finalChar);
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h2>Character Creation</h2>
                    <div className={styles.steps}>
                        <span className={`${styles.step} ${currentStep === 'species' ? styles.active : ''}`}>Species</span>
                        <span className={`${styles.step} ${currentStep === 'career' ? styles.active : ''}`}>Career</span>
                        <span className={`${styles.step} ${currentStep === 'attributes' ? styles.active : ''}`}>Attributes</span>
                        <span className={`${styles.step} ${currentStep === 'details' ? styles.active : ''}`}>Details</span>
                    </div>
                    <button onClick={onClose} className={styles.button}>✖</button>
                </div>

                <div className={styles.content}>
                    {currentStep === 'species' && (
                        <div>
                            <h3>Choose Species</h3>
                            <div className={styles.grid}>
                                <div className={styles.optionCard} onClick={rollSpecies}>
                                    <h4>🎲 Roll Random</h4>
                                    <p>Gain +20 XP</p>
                                </div>
                                {speciesData.map(s => (
                                    <div key={s.id} className={styles.optionCard} onClick={() => selectSpecies(s.id)}>
                                        <h4>{s.name}</h4>
                                        <p>0 XP</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {currentStep === 'career' && (
                        <div>
                            <h3>Choose Career</h3>
                            {rolledCareers.length === 0 ? (
                                <div className={styles.grid}>
                                    <div className={styles.optionCard} onClick={() => rollCareer(1)}>
                                        <h4>🎲 Roll Random (1)</h4>
                                        <p>Gain +50 XP</p>
                                    </div>
                                    <div className={styles.optionCard} onClick={() => rollCareer(3)}>
                                        <h4>🎲 Roll 3, Choose 1</h4>
                                        <p>Gain +25 XP</p>
                                    </div>
                                    <div className={styles.optionCard} onClick={() => setRolledCareers((careersData as Career[]))}>
                                        <h4>Select Manually</h4>
                                        <p>0 XP</p>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <p>Select one of the rolled careers:</p>
                                    <div className={styles.grid}>
                                        {rolledCareers.map(c => (
                                            <div key={c.id} className={`${styles.optionCard} ${selectedCareerId === c.id ? styles.selected : ''}`} onClick={() => confirmCareer(c.id)}>
                                                <h4>{c.name}</h4>
                                                <p>{c.class}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ... Implement other steps ... */}
                    {currentStep === 'attributes' && (
                        <div>
                            <h3>Attributes</h3>
                            {!attributeMode ? (
                                <div className={styles.grid}>
                                    <div className={styles.optionCard} onClick={rollAttributes}>
                                        <h4>🎲 Roll All (In Order)</h4>
                                        <p>Gain +50 XP</p>
                                    </div>
                                    <div className={styles.optionCard} onClick={rollAndAssignAttributes}>
                                        <h4>🎲 Roll & Assign</h4>
                                        <p>Gain +25 XP</p>
                                    </div>
                                    <div className={styles.optionCard} onClick={pointBuyAttributes}>
                                        <h4>Point Buy</h4>
                                        <p>0 XP</p>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className={styles.attributeGrid}>
                                    <span>Char</span><span>Initial</span>
                                    {Object.entries(assignedAttributes).map(([attr, value]) => (
                                        <React.Fragment key={attr}>
                                            <label>{attr.toUpperCase()}</label>
                                            <label>{value}</label>
                                        </React.Fragment>
                                    ))}
                                    <label>Total</label>
                                    <label>{Object.values(assignedAttributes).reduce((a, b) => a + b, 0)}</label>
                                    </div>
                                    <button onClick={nextStep} className={`${styles.button} ${styles.primary}`}>Confirm Attributes</button>
                                </div>
                            )}
                        </div>
                    )}

                    {currentStep === 'details' && (
                        <div>
                            <h3>Details</h3>
                            <p>Skills, Talents, Fate/Resilience allocation...</p>
                            <button onClick={finish} className={`${styles.button} ${styles.primary}`}>Finish</button>
                        </div>
                    )}

                </div>

                <div className={styles.footer}>
                    <span>Total XP Bonus: {xpLog.reduce((a, b) => a + b.amount, 0)}</span>
                    {selectedSpeciesId && <span>Species: {speciesData.find(s => s.id === selectedSpeciesId)?.name}</span>}
                    {selectedCareerId && <span>Career: {(careersData as Career[]).find(c => c.id === selectedCareerId)?.name}</span>}
                </div>
            </div>
        </div>
    );
};

export default CharacterCreationWizard;
