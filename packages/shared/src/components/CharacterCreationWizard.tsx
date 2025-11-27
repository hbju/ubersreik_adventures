import React, { useState, useMemo } from 'react';
import styles from './CharacterCreationWizard.module.css';
import {
    speciesData,
    Character,
    createBlankCharacter,
    Career,
    Skill,
    Talent,
    calculateCharacteristicBonus,
    useGameData,
    SkillCharDefinition,
    rolld100,
    isSkillGrouped,
    getGroupedSkill,
    calculateEffectiveMaxWounds
} from '@wfrp/shared';

interface CharacterCreationWizardProps {
    onClose: () => void;
    onComplete: (character: Character) => void;
}

interface SpeciesDataItem {
    id: string;
    name: string;
    base_stats: Record<string, number>;
    fate: number;
    resilience: number;
    extra_points: number;
    movement: number;
    skills: string[];
    talents: string[][];
}

type Step = 'species' | 'career' | 'attributes' | 'fateResilience' | 'speciesSkillsTalents' | 'careerSkillsTalents' | 'summary';

const CHARACTERISTIC_KEYS = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'] as const;

const CharacterCreationWizard: React.FC<CharacterCreationWizardProps> = ({ onClose, onComplete }) => {
    const gameData = useGameData();

    const [currentStep, setCurrentStep] = useState<Step>('species');
    const [character, setCharacter] = useState<Character>(createBlankCharacter(gameData.skills));
    const [xpLog, setXpLog] = useState<{ reason: string, amount: number }[]>([]);

    // Step 1: Species
    const [selectedSpeciesId, setSelectedSpeciesId] = useState<string | null>(null);
    const [rolledSpeciesId, setRolledSpeciesId] = useState<string | null>(null);
    const [speciesRollAccepted, setSpeciesRollAccepted] = useState<boolean | null>(null);

    // Step 2: Career
    const [rolledCareers, setRolledCareers] = useState<Career[]>([]);
    const [selectedCareerId, setSelectedCareerId] = useState<string | null>(null);
    const [careerSelectionMode, setCareerSelectionMode] = useState<'random1' | 'random3' | 'manual' | null>(null);

    // Step 3: Attributes
    const [rolledAttributes, setRolledAttributes] = useState<number[]>([]);
    const [attributeMode, setAttributeMode] = useState<'roll' | 'assign' | 'pointbuy' | null>(null);
    const [assignedAttributes, setAssignedAttributes] = useState<Record<string, number>>({});
    const [pointBuyValues, setPointBuyValues] = useState<Record<string, number>>({});
    const [draggedAttribute, setDraggedAttribute] = useState<number | null>(null);
    const [usedRollIndices, setUsedRollIndices] = useState<Set<number>>(new Set());

    // Step 4: Fate/Resilience
    const [fateResilienceAllocated, setFateResilienceAllocated] = useState<{ fate: number, resilience: number }>({ fate: 0, resilience: 0 });

    // Step 5: Species Skills & Talents
    const [selectedSpeciesSkills5, setSelectedSpeciesSkills5] = useState<string[]>([]); // 3 skills with 5 advances
    const [selectedSpeciesSkills3, setSelectedSpeciesSkills3] = useState<string[]>([]); // 3 skills with 3 advances
    const [selectedSpeciesTalentChoices, setSelectedSpeciesTalentChoices] = useState<Record<number, string>>({}); // index -> chosen talent id
    const [rolledRandomTalents, setRolledRandomTalents] = useState<string[]>([]);

    // Step 6: Career Skills & Talents
    const [careerSkillAdvances, setCareerSkillAdvances] = useState<Record<string, number>>({});
    const [selectedCareerTalent, setSelectedCareerTalent] = useState<string | null>(null);

    // Character name
    const [characterName, setCharacterName] = useState<string>('');

    // Helper to get selected species data
    const selectedSpecies = useMemo(() => {
        return (speciesData as SpeciesDataItem[]).find(s => s.id === selectedSpeciesId) || null;
    }, [selectedSpeciesId]);

    // Helper to get selected career data
    const selectedCareer = useMemo(() => {
        return gameData.careers.find(c => c.id === selectedCareerId) || null;
    }, [selectedCareerId, gameData.careers]);

    // Get available species skills (filter out grouped skills and get actual skill definitions)
    const availableSpeciesSkills = useMemo(() => {
        if (!selectedSpecies) return [];
        return selectedSpecies.skills.map(skillId => {
            if (isSkillGrouped(skillId)) {
                const grouped = getGroupedSkill(skillId, gameData.skills);
                if (!grouped) return null;
                return { ...grouped, originalId: skillId };
            }
            const skillDef = gameData.skills.find(s => s.id === skillId);
            if (skillDef) {
                return { ...skillDef, originalId: skillId };
            }
            return null;
        }).filter(Boolean) as (SkillCharDefinition & { originalId: string })[];
    }, [selectedSpecies, gameData.skills]);

    // Get species talents organized by type:
    // - automaticTalents: single-item arrays (always given)
    // - talentChoices: multi-item arrays (player must choose one)
    const speciesTalentData = useMemo(() => {
        if (!selectedSpecies) return { automaticTalents: [], talentChoices: [], randomCount: 0 };
        
        const automaticTalents: Talent[] = [];
        const talentChoices: { index: number; options: Talent[] }[] = [];
        let randomCount = 0;
        
        selectedSpecies.talents.forEach((talentGroup, index) => {
            // Check if this is a random talent slot
            if (talentGroup.length === 1 && talentGroup[0] === 'random') {
                randomCount++;
                return;
            }
            
            // Resolve talent IDs to actual talent objects
            const resolvedTalents = talentGroup.map(talentId => {
                const talent = gameData.talents.find(t => t.id === talentId || t.id.startsWith(talentId));
                return talent || null;
            }).filter(Boolean) as Talent[];
            
            if (resolvedTalents.length === 0) return;
            
            if (talentGroup.length === 1) {
                // Single talent - automatic
                automaticTalents.push(resolvedTalents[0]);
            } else {
                // Multiple talents - player must choose
                talentChoices.push({ index, options: resolvedTalents });
            }
        });
        
        return { automaticTalents, talentChoices, randomCount };
    }, [selectedSpecies, gameData.talents]);

    // Random talent count is now part of speciesTalentData
    const randomTalentCount = speciesTalentData.randomCount;

    // Get career level 1 skills
    const careerSkills = useMemo(() => {
        if (!selectedCareer) return [];
        const level1 = selectedCareer.career_level[0];
        return level1.skills_ids.map(skillId => {
            if (isSkillGrouped(skillId)) {
                const grouped = getGroupedSkill(skillId, gameData.skills);
                if (!grouped) return null;
                return { ...grouped, originalId: skillId };
            }
            const skillDef = gameData.skills.find(s => s.id === skillId);
            if (skillDef) {
                return { ...skillDef, originalId: skillId };
            }
            return null;
        }).filter(Boolean) as (SkillCharDefinition & { originalId: string })[];
    }, [selectedCareer, gameData.skills]);

    // Get career level 1 talents
    const careerTalents = useMemo(() => {
        if (!selectedCareer) return [];
        const level1 = selectedCareer.career_level[0];
        return level1.talent_ids.map(talentId => {
            const talent = gameData.talents.find(t => t.id === talentId || t.id.startsWith(talentId));
            return talent || null;
        }).filter(Boolean) as Talent[];
    }, [selectedCareer, gameData.talents]);

    // Calculate total career skill advances spent
    const totalCareerAdvances = useMemo(() => {
        return Object.values(careerSkillAdvances).reduce((sum, val) => sum + val, 0);
    }, [careerSkillAdvances]);

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

    // Roll 2d10
    const roll2d10 = () => {
        return Math.floor(Math.random() * 10) + 1 + Math.floor(Math.random() * 10) + 1;
    };

    // --- Step 1: Species Logic ---
    const rollSpecies = () => {
        const roll = rolld100();
        let speciesId = 'human';
        if (roll <= 90) speciesId = 'human';
        else if (roll <= 94) speciesId = 'halfling';
        else if (roll <= 98) speciesId = 'dwarf';
        else if (roll <= 99) speciesId = 'elf'; // High Elf
        else speciesId = 'wood_elf';

        setRolledSpeciesId(speciesId);
        setSpeciesRollAccepted(null); // Show accept/reject options
    };

    const acceptRolledSpecies = () => {
        if (rolledSpeciesId) {
            setSelectedSpeciesId(rolledSpeciesId);
            setSpeciesRollAccepted(true);
            addXp(20, 'Accepted Random Species');
            setCurrentStep('career');
        }
    };

    const rejectRolledSpecies = () => {
        setSpeciesRollAccepted(false);
        // Allow manual selection after rejection (no XP bonus)
    };

    const selectSpecies = (id: string) => {
        setSelectedSpeciesId(id);
        setCurrentStep('career');
    };

    // --- Step 2: Career Logic ---
    const getAvailableCareers = () => {
        const species = (speciesData as SpeciesDataItem[]).find(s => s.id === selectedSpeciesId);
        if (!species) return [];
        return gameData.careers.filter(c =>
            c.races.some(r => r.toLowerCase() === species.name.toLowerCase() || r.toLowerCase() === species.id.toLowerCase())
        );
    };

    const rollCareer = (count: number) => {
        const availableCareers = getAvailableCareers();
        if (availableCareers.length === 0) return;

        const rolled: Career[] = [];
        const usedIndices = new Set<number>();

        for (let i = 0; i < count && rolled.length < availableCareers.length; i++) {
            let idx: number;
            do {
                idx = Math.floor(Math.random() * availableCareers.length);
            } while (usedIndices.has(idx) && usedIndices.size < availableCareers.length);
            usedIndices.add(idx);
            rolled.push(availableCareers[idx]);
        }

        setRolledCareers(rolled);
        setCareerSelectionMode(count === 1 ? 'random1' : 'random3');

        if (count === 1) {
            setSelectedCareerId(rolled[0].id);
            addXp(50, 'Random Career');
            setCurrentStep('attributes');
        }
    };

    const confirmCareer = (careerId: string) => {
        setSelectedCareerId(careerId);
        if (careerSelectionMode === 'random3') {
            addXp(25, 'Chosen from 3 Random Careers');
        }
        setCurrentStep('attributes');
    };

    const selectManualCareer = () => {
        setCareerSelectionMode('manual');
        setRolledCareers(getAvailableCareers());
    };

    // --- Step 3: Attributes Logic ---
    const rollAllAttributesInOrder = () => {
        const rolls = CHARACTERISTIC_KEYS.map(() => roll2d10());
        setRolledAttributes(rolls);
        setAttributeMode('roll');

        const species = (speciesData as SpeciesDataItem[]).find(s => s.id === selectedSpeciesId);
        if (!species) return;

        const newStats: Record<string, number> = {};
        CHARACTERISTIC_KEYS.forEach((stat, index) => {
            newStats[stat] = species.base_stats[stat] + rolls[index];
        });
        setAssignedAttributes(newStats);
        addXp(50, 'Random Attributes (In Order)');
    };

    const rollAndAssignAttributes = () => {
        const rolls = CHARACTERISTIC_KEYS.map(() => roll2d10());
        setRolledAttributes(rolls);
        setAttributeMode('assign');
        setAssignedAttributes({});
        setUsedRollIndices(new Set());
        addXp(25, 'Random Attributes (Assigned)');
    };

    const assignRollToAttribute = (attr: string, rollIndex: number) => {
        const species = (speciesData as SpeciesDataItem[]).find(s => s.id === selectedSpeciesId);
        if (!species) return;

        // Remove any previous assignment for this attribute
        const prevIndex = Object.entries(assignedAttributes).find(([key]) => key === attr);
        const newUsed = new Set(usedRollIndices);

        // Find if this roll was already assigned to another stat
        const prevAttr = Object.entries(assignedAttributes).find(([, val]) => val === species.base_stats[attr] + rolledAttributes[rollIndex]);

        setAssignedAttributes(prev => ({
            ...prev,
            [attr]: species.base_stats[attr] + rolledAttributes[rollIndex]
        }));

        newUsed.add(rollIndex);
        setUsedRollIndices(newUsed);
    };

    const initializePointBuy = () => {
        setAttributeMode('pointbuy');
        const initial: Record<string, number> = {};
        CHARACTERISTIC_KEYS.forEach(stat => {
            initial[stat] = 10; // Start with 10 for each (min 4, max 18 in final)
        });
        setPointBuyValues(initial);
    };

    const updatePointBuy = (attr: string, delta: number) => {
        const newValue = (pointBuyValues[attr] || 10) + delta;
        if (newValue < 4 || newValue > 18) return;

        const totalUsed = Object.entries(pointBuyValues).reduce((sum, [key, val]) => {
            if (key === attr) return sum + newValue;
            return sum + val;
        }, 0);

        if (totalUsed > 100) return;

        setPointBuyValues(prev => ({
            ...prev,
            [attr]: newValue
        }));
    };

    const confirmPointBuy = () => {
        const species = (speciesData as SpeciesDataItem[]).find(s => s.id === selectedSpeciesId);
        if (!species) return;

        const finalStats: Record<string, number> = {};
        CHARACTERISTIC_KEYS.forEach(stat => {
            finalStats[stat] = species.base_stats[stat] + (pointBuyValues[stat] || 10);
        });
        setAssignedAttributes(finalStats);
    };

    const confirmAttributes = () => {
        if (attributeMode === 'pointbuy') {
            confirmPointBuy();
        }
        setCurrentStep('fateResilience');
    };

    // --- Step 4: Fate/Resilience Logic ---
    const getExtraPoints = () => {
        const species = (speciesData as SpeciesDataItem[]).find(s => s.id === selectedSpeciesId);
        return species?.extra_points || 0;
    };

    const allocateFate = (delta: number) => {
        const species = (speciesData as SpeciesDataItem[]).find(s => s.id === selectedSpeciesId);
        if (!species) return;

        const newFate = fateResilienceAllocated.fate + delta;
        const totalUsed = newFate + fateResilienceAllocated.resilience;

        if (newFate < 0 || totalUsed > species.extra_points) return;

        setFateResilienceAllocated(prev => ({ ...prev, fate: newFate }));
    };

    const allocateResilience = (delta: number) => {
        const species = (speciesData as SpeciesDataItem[]).find(s => s.id === selectedSpeciesId);
        if (!species) return;

        const newResilience = fateResilienceAllocated.resilience + delta;
        const totalUsed = fateResilienceAllocated.fate + newResilience;

        if (newResilience < 0 || totalUsed > species.extra_points) return;

        setFateResilienceAllocated(prev => ({ ...prev, resilience: newResilience }));
    };

    const confirmFateResilience = () => {
        setCurrentStep('speciesSkillsTalents');
        rollRandomTalents();
    };

    // --- Step 5: Species Skills & Talents Logic ---
    const toggleSpeciesSkill5 = (skillId: string) => {
        if (selectedSpeciesSkills5.includes(skillId)) {
            setSelectedSpeciesSkills5(prev => prev.filter(s => s !== skillId));
        } else if (selectedSpeciesSkills5.length < 3) {
            // Can't select if already in skills3
            if (!selectedSpeciesSkills3.includes(skillId)) {
                setSelectedSpeciesSkills5(prev => [...prev, skillId]);
            }
        }
    };

    const toggleSpeciesSkill3 = (skillId: string) => {
        if (selectedSpeciesSkills3.includes(skillId)) {
            setSelectedSpeciesSkills3(prev => prev.filter(s => s !== skillId));
        } else if (selectedSpeciesSkills3.length < 3) {
            // Can't select if already in skills5
            if (!selectedSpeciesSkills5.includes(skillId)) {
                setSelectedSpeciesSkills3(prev => [...prev, skillId]);
            }
        }
    };

    const rollRandomTalents = () => {
        const count = randomTalentCount;
        if (count === 0) return;

        // Roll random talents from the full talent list that have racial entries
        const racialTalents = gameData.talents.filter(t =>
            t.racial && t.racial.length > 0 &&
            (t.racial.includes('Random Racial Talent') || t.racial.some(r => r.toLowerCase().includes('random')))
        );

        const rolled: string[] = [];
        const usedIndices = new Set<number>();

        for (let i = 0; i < count && rolled.length < racialTalents.length; i++) {
            let idx: number;
            let attempts = 0;
            do {
                idx = Math.floor(Math.random() * racialTalents.length);
                attempts++;
            } while (usedIndices.has(idx) && attempts < 100);

            if (!usedIndices.has(idx)) {
                usedIndices.add(idx);
                rolled.push(racialTalents[idx].id);
            }
        }

        setRolledRandomTalents(rolled);
    };

    const confirmSpeciesSkillsTalents = () => {
        if (selectedSpeciesSkills5.length !== 3 || selectedSpeciesSkills3.length !== 3) {
            return; // Must select all required skills
        }
        // Check that all talent choices have been made
        const allChoicesMade = speciesTalentData.talentChoices.every(
            choice => selectedSpeciesTalentChoices[choice.index] !== undefined
        );
        if (!allChoicesMade) {
            return; // Must make all talent choices
        }
        setCurrentStep('careerSkillsTalents');
    };

    // --- Step 6: Career Skills & Talents Logic ---
    const updateCareerSkillAdvance = (skillId: string, delta: number) => {
        const currentAdvance = careerSkillAdvances[skillId] || 0;
        const newAdvance = currentAdvance + delta;

        if (newAdvance < 0 || newAdvance > 10) return;

        const newTotal = totalCareerAdvances - currentAdvance + newAdvance;
        if (newTotal > 40) return;

        setCareerSkillAdvances(prev => ({
            ...prev,
            [skillId]: newAdvance
        }));
    };

    const confirmCareerSkillsTalents = () => {
        if (!selectedCareerTalent) return;
        setCurrentStep('summary');
    };

    // --- Finish: Build final character ---
    const finish = () => {
        const species = (speciesData as SpeciesDataItem[]).find(s => s.id === selectedSpeciesId);
        const career = gameData.careers.find(c => c.id === selectedCareerId);
        if (!species || !career) return;

        const finalChar = { ...character };
        finalChar.name = characterName || "New Character";
        finalChar.currentCareerId = career.id;
        finalChar.currentCareerLevelId = career.career_level[0].id;

        // Apply characteristics
        CHARACTERISTIC_KEYS.forEach(key => {
            if (assignedAttributes[key] !== undefined) {
                (finalChar.characteristics as Record<string, { initial: number; advances: number; talents: number; modifier: number }>)[key].initial = assignedAttributes[key];
            }
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

        // Calculate wounds
        if (species.id === 'halfling') {
            finalChar.status.wounds.max = calculateCharacteristicBonus(finalChar.characteristics.wp) + calculateCharacteristicBonus(finalChar.characteristics.t) * 2;
        } else {
            finalChar.status.wounds.max = calculateEffectiveMaxWounds(finalChar, gameData.talents);
        }
        finalChar.status.wounds.current = finalChar.status.wounds.max;

        // Apply species skills
        const updateSkillAdvances = (skillId: string, advances: number) => {
            const existingSkill = finalChar.skills.find(s => s.id === skillId || s.id === skillId.split('_')[0]);
            if (existingSkill) {
                existingSkill.advances += advances;
            } else {
                if (isSkillGrouped(skillId)) {
                    const grouped = getGroupedSkill(skillId, gameData.skills);
                    if (grouped) {
                        finalChar.skills.push({
                            id: skillId,
                            name: grouped.name,
                            characteristic: grouped.characteristic,
                            advances: advances,
                            talents: 0,
                            modifier: 0
                        });
                    }
                    return;
                }
                const skillDef = gameData.skills.find(s => s.id === skillId);
                if (skillDef) {
                    finalChar.skills.push({
                        id: skillId,
                        name: skillDef.name,
                        characteristic: skillDef.characteristic,
                        advances: advances,
                        talents: 0,
                        modifier: 0
                    });
                }
            }
        };

        // Add species skill advances (3 skills with 5 advances, 3 skills with 3 advances)
        selectedSpeciesSkills5.forEach(skillId => updateSkillAdvances(skillId, 5));
        selectedSpeciesSkills3.forEach(skillId => updateSkillAdvances(skillId, 3));

        // Add career skill advances (40 total, max 10 each)
        Object.entries(careerSkillAdvances).forEach(([skillId, advances]) => {
            if (advances > 0) {
                updateSkillAdvances(skillId, advances);
            }
        });

        // Apply talents
        const addTalent = (talentId: string) => {
            if (talentId && !finalChar.talents[talentId]) {
                finalChar.talents[talentId] = 1;
            } else if (talentId) {
                finalChar.talents[talentId]++;
            }
        };

        // Automatic species talents
        speciesTalentData.automaticTalents.forEach(talent => addTalent(talent.id));
        
        // Chosen species talents
        Object.values(selectedSpeciesTalentChoices).forEach(talentId => addTalent(talentId));

        // Random species talents
        rolledRandomTalents.forEach(talentId => addTalent(talentId));

        // Career talent
        if (selectedCareerTalent) {
            addTalent(selectedCareerTalent);
        }

        // Set unlocked skills/talents from career level 1
        finalChar.unlockedCharacteristicIds = career.career_level[0].characteristic_advances || [];
        finalChar.unlockedSkillIds = career.career_level[0].skills_ids || [];
        finalChar.unlockedTalentIds = career.career_level[0].talent_ids || [];

        finalChar.skills = [...finalChar.skills,
        ...career.career_level[0].skills_ids.filter(s => !finalChar.skills.some(fs => fs.id === s)).map(skillId => {
            if (isSkillGrouped(skillId)) {
                const grouped = getGroupedSkill(skillId, gameData.skills);
                if (grouped) {
                    return {
                        id: skillId,
                        name: grouped.name,
                        characteristic: grouped.characteristic,
                        advances: 0,
                        talents: 0,
                        modifier: 0
                    };
                }
                return null;
            }
            const skillDef = gameData.skills.find(s => s.id === skillId);
            if (skillDef) {
                return {
                    id: skillId,
                    name: skillDef.name,
                    characteristic: skillDef.characteristic,
                    advances: 0,
                    talents: 0,
                    modifier: 0
                };
            }
            return null;
        }).filter(skill => skill !== null) as Skill[]
        ];

        onComplete(finalChar);
    };

    // Check if attributes step is complete
    const canConfirmAttributes = useMemo(() => {
        if (attributeMode === 'roll') {
            return Object.keys(assignedAttributes).length === 10;
        }
        if (attributeMode === 'assign') {
            return Object.keys(assignedAttributes).length === 10 && usedRollIndices.size === 10;
        }
        if (attributeMode === 'pointbuy') {
            const total = Object.values(pointBuyValues).reduce((sum, val) => sum + val, 0);
            return total === 100;
        }
        return false;
    }, [attributeMode, assignedAttributes, usedRollIndices, pointBuyValues]);

    // Point buy remaining
    const pointBuyRemaining = useMemo(() => {
        return 100 - Object.values(pointBuyValues).reduce((sum, val) => sum + val, 0);
    }, [pointBuyValues]);

    return (
        <div className={styles.overlay}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h2>Character Creation</h2>
                    <div className={styles.steps}>
                        <span className={`${styles.step} ${currentStep === 'species' ? styles.active : ''}`}>Species</span>
                        <span className={`${styles.step} ${currentStep === 'career' ? styles.active : ''}`}>Career</span>
                        <span className={`${styles.step} ${currentStep === 'attributes' ? styles.active : ''}`}>Attributes</span>
                        <span className={`${styles.step} ${currentStep === 'fateResilience' ? styles.active : ''}`}>Fate/Resilience</span>
                        <span className={`${styles.step} ${currentStep === 'speciesSkillsTalents' ? styles.active : ''}`}>Species Skills</span>
                        <span className={`${styles.step} ${currentStep === 'careerSkillsTalents' ? styles.active : ''}`}>Career Skills</span>
                        <span className={`${styles.step} ${currentStep === 'summary' ? styles.active : ''}`}>Summary</span>
                    </div>
                    <button onClick={onClose} className={styles.button}>✖</button>
                </div>

                <div className={styles.content}>
                    {/* Step 1: Species */}
                    {currentStep === 'species' && (
                        <div>
                            <h3>Choose Species</h3>
                            {rolledSpeciesId && speciesRollAccepted === null ? (
                                <div>
                                    <p>You rolled: <strong>{(speciesData as SpeciesDataItem[]).find(s => s.id === rolledSpeciesId)?.name}</strong></p>
                                    <div className={styles.grid}>
                                        <div className={styles.optionCard} onClick={acceptRolledSpecies}>
                                            <h4>✓ Accept</h4>
                                            <p>Gain +20 XP</p>
                                        </div>
                                        <div className={styles.optionCard} onClick={rejectRolledSpecies}>
                                            <h4>✗ Reject</h4>
                                            <p>Choose manually (0 XP)</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.grid}>
                                    {!rolledSpeciesId && (
                                        <div className={styles.optionCard} onClick={rollSpecies}>
                                            <h4>🎲 Roll Random</h4>
                                            <p>Accept for +20 XP</p>
                                        </div>
                                    )}
                                    {(speciesData as SpeciesDataItem[]).map(s => (
                                        <div key={s.id} className={styles.optionCard} onClick={() => selectSpecies(s.id)}>
                                            <h4>{s.name}</h4>
                                            <p>Fate: {s.fate} | Resilience: {s.resilience} | Extra: {s.extra_points}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Career */}
                    {currentStep === 'career' && (
                        <div>
                            <h3>Choose Career</h3>
                            <p>Species: <strong>{selectedSpecies?.name}</strong></p>
                            {careerSelectionMode === null ? (
                                <div className={styles.grid}>
                                    <div className={styles.optionCard} onClick={() => rollCareer(1)}>
                                        <h4>🎲 Roll Random (1)</h4>
                                        <p>Gain +50 XP</p>
                                    </div>
                                    <div className={styles.optionCard} onClick={() => rollCareer(3)}>
                                        <h4>🎲 Roll 3, Choose 1</h4>
                                        <p>Gain +25 XP</p>
                                    </div>
                                    <div className={styles.optionCard} onClick={selectManualCareer}>
                                        <h4>Select Manually</h4>
                                        <p>0 XP</p>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <p>{careerSelectionMode === 'random3' ? 'Select one of the 3 rolled careers:' : 'Select a career:'}</p>
                                    <div className={styles.grid}>
                                        {rolledCareers.map(c => (
                                            <div
                                                key={c.id}
                                                className={`${styles.optionCard} ${selectedCareerId === c.id ? styles.selected : ''}`}
                                                onClick={() => confirmCareer(c.id)}
                                            >
                                                <h4>{c.name}</h4>
                                                <p>{c.class}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 3: Attributes */}
                    {currentStep === 'attributes' && (
                        <div>
                            <h3>Attributes</h3>
                            {!attributeMode ? (
                                <div className={styles.grid}>
                                    <div className={styles.optionCard} onClick={rollAllAttributesInOrder}>
                                        <h4>🎲 Roll All (In Order)</h4>
                                        <p>2d10 + base for each stat. Gain +50 XP</p>
                                    </div>
                                    <div className={styles.optionCard} onClick={rollAndAssignAttributes}>
                                        <h4>🎲 Roll & Assign</h4>
                                        <p>Roll 10×2d10, assign to stats. Gain +25 XP</p>
                                    </div>
                                    <div className={styles.optionCard} onClick={initializePointBuy}>
                                        <h4>Point Buy</h4>
                                        <p>Distribute 100 points (min 4, max 18). 0 XP</p>
                                    </div>
                                </div>
                            ) : attributeMode === 'roll' ? (
                                <div>
                                    <h4>Rolled Attributes (In Order)</h4>
                                    <div className={styles.attributeGrid}>
                                        <span>Char</span><span>Base</span><span>Roll</span><span>Total</span>
                                        {CHARACTERISTIC_KEYS.map((attr, idx) => (
                                            <React.Fragment key={attr}>
                                                <label>{attr.toUpperCase()}</label>
                                                <label>{selectedSpecies?.base_stats[attr]}</label>
                                                <label>{rolledAttributes[idx]}</label>
                                                <label><strong>{assignedAttributes[attr]}</strong></label>
                                            </React.Fragment>
                                        ))}
                                    </div>
                                    <button
                                        onClick={confirmAttributes}
                                        className={`${styles.button} ${styles.primary}`}
                                        disabled={!canConfirmAttributes}
                                    >
                                        Confirm Attributes
                                    </button>
                                </div>
                            ) : attributeMode === 'assign' ? (
                                <div>
                                    <h4>Assign Rolled Values to Attributes</h4>
                                    <p>Available rolls: {rolledAttributes.map((r, i) => (
                                        <span
                                            key={i}
                                            style={{
                                                margin: '0 5px',
                                                padding: '5px 10px',
                                                background: usedRollIndices.has(i) ? '#333' : '#d4af37',
                                                color: usedRollIndices.has(i) ? '#666' : '#1c1c1c',
                                                borderRadius: '4px',
                                                cursor: usedRollIndices.has(i) ? 'default' : 'pointer'
                                            }}
                                            onClick={() => !usedRollIndices.has(i) && setDraggedAttribute(i)}
                                        >
                                            {r}
                                        </span>
                                    ))}</p>
                                    {draggedAttribute !== null && (
                                        <p>Click an attribute to assign value: <strong>{rolledAttributes[draggedAttribute]}</strong></p>
                                    )}
                                    <div className={styles.attributeGrid}>
                                        <span>Char</span><span>Base</span><span>Roll</span><span>Total</span>
                                        {CHARACTERISTIC_KEYS.map((attr) => {
                                            const baseVal = selectedSpecies?.base_stats[attr] || 0;
                                            const assigned = assignedAttributes[attr];
                                            const rollVal = assigned ? assigned - baseVal : null;
                                            return (
                                                <React.Fragment key={attr}>
                                                    <label
                                                        style={{ cursor: draggedAttribute !== null ? 'pointer' : 'default' }}
                                                        onClick={() => {
                                                            if (draggedAttribute !== null) {
                                                                assignRollToAttribute(attr, draggedAttribute);
                                                                setDraggedAttribute(null);
                                                            }
                                                        }}
                                                    >
                                                        {attr.toUpperCase()}
                                                    </label>
                                                    <label>{baseVal}</label>
                                                    <label>{rollVal ?? '-'}</label>
                                                    <label><strong>{assigned ?? '-'}</strong></label>
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                    <button
                                        onClick={confirmAttributes}
                                        className={`${styles.button} ${styles.primary}`}
                                        disabled={!canConfirmAttributes}
                                    >
                                        Confirm Attributes
                                    </button>
                                </div>
                            ) : (
                                <div>
                                    <h4>Point Buy (Remaining: {pointBuyRemaining})</h4>
                                    <p>Allocate 100 points total. Min: 4, Max: 18 per attribute.</p>
                                    <div className={styles.attributeGrid}>
                                        <span>Char</span><span>Base</span><span>Points</span><span>Total</span><span></span>
                                        {CHARACTERISTIC_KEYS.map((attr) => {
                                            const baseVal = selectedSpecies?.base_stats[attr] || 0;
                                            const points = pointBuyValues[attr] || 10;
                                            return (
                                                <React.Fragment key={attr}>
                                                    <label>{attr.toUpperCase()}</label>
                                                    <label>{baseVal}</label>
                                                    <label>{points}</label>
                                                    <label><strong>{baseVal + points}</strong></label>
                                                    <div>
                                                        <button
                                                            onClick={() => updatePointBuy(attr, -1)}
                                                            disabled={points <= 4}
                                                            className={styles.button}
                                                        >-</button>
                                                        <button
                                                            onClick={() => updatePointBuy(attr, 1)}
                                                            disabled={points >= 18 || pointBuyRemaining <= 0}
                                                            className={styles.button}
                                                        >+</button>
                                                    </div>
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                    <button
                                        onClick={confirmAttributes}
                                        className={`${styles.button} ${styles.primary}`}
                                        disabled={pointBuyRemaining !== 0}
                                    >
                                        Confirm Attributes
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 4: Fate & Resilience */}
                    {currentStep === 'fateResilience' && selectedSpecies && (
                        <div>
                            <h3>Allocate Fate & Resilience</h3>
                            <p>Base Fate: {selectedSpecies.fate} | Base Resilience: {selectedSpecies.resilience}</p>
                            <p>Extra Points to Allocate: {selectedSpecies.extra_points}</p>
                            <p>Points Used: {fateResilienceAllocated.fate + fateResilienceAllocated.resilience} / {selectedSpecies.extra_points}</p>

                            <div style={{ display: 'flex', gap: '40px', marginTop: '20px' }}>
                                <div>
                                    <h4>Fate: {selectedSpecies.fate + fateResilienceAllocated.fate}</h4>
                                    <p>Extra: {fateResilienceAllocated.fate}</p>
                                    <button onClick={() => allocateFate(-1)} disabled={fateResilienceAllocated.fate <= 0} className={styles.button}>-</button>
                                    <button onClick={() => allocateFate(1)} disabled={fateResilienceAllocated.fate + fateResilienceAllocated.resilience >= selectedSpecies.extra_points} className={styles.button}>+</button>
                                </div>
                                <div>
                                    <h4>Resilience: {selectedSpecies.resilience + fateResilienceAllocated.resilience}</h4>
                                    <p>Extra: {fateResilienceAllocated.resilience}</p>
                                    <button onClick={() => allocateResilience(-1)} disabled={fateResilienceAllocated.resilience <= 0} className={styles.button}>-</button>
                                    <button onClick={() => allocateResilience(1)} disabled={fateResilienceAllocated.fate + fateResilienceAllocated.resilience >= selectedSpecies.extra_points} className={styles.button}>+</button>
                                </div>
                            </div>

                            <button
                                onClick={confirmFateResilience}
                                className={`${styles.button} ${styles.primary}`}
                                style={{ marginTop: '20px' }}
                            >
                                Continue
                            </button>
                        </div>
                    )}

                    {/* Step 5: Species Skills & Talents */}
                    {currentStep === 'speciesSkillsTalents' && selectedSpecies && (
                        <div>
                            <h3>Species Skills & Talents</h3>

                            <h4>Select 3 Skills for 5 Advances ({selectedSpeciesSkills5.length}/3)</h4>
                            <div className={styles.grid}>
                                {availableSpeciesSkills.map(skill => {
                                    const isSelected5 = selectedSpeciesSkills5.includes(skill.originalId);
                                    const isSelected3 = selectedSpeciesSkills3.includes(skill.originalId);
                                    return (
                                        <div
                                            key={skill.originalId}
                                            className={`${styles.optionCard} ${isSelected5 ? styles.selected : ''} ${isSelected3 ? styles.disabled : ''}`}
                                            onClick={() => !isSelected3 && toggleSpeciesSkill5(skill.originalId)}
                                            style={{ opacity: isSelected3 ? 0.5 : 1 }}
                                        >
                                            <h4>{skill.name}</h4>
                                            <p>{skill.characteristic.toUpperCase()}</p>
                                            {isSelected5 && <span className={styles.xpBadge}>+5 Advances</span>}
                                        </div>
                                    );
                                })}
                            </div>

                            <h4 style={{ marginTop: '20px' }}>Select 3 Skills for 3 Advances ({selectedSpeciesSkills3.length}/3)</h4>
                            <div className={styles.grid}>
                                {availableSpeciesSkills.map(skill => {
                                    const isSelected5 = selectedSpeciesSkills5.includes(skill.originalId);
                                    const isSelected3 = selectedSpeciesSkills3.includes(skill.originalId);
                                    return (
                                        <div
                                            key={skill.originalId}
                                            className={`${styles.optionCard} ${isSelected3 ? styles.selected : ''} ${isSelected5 ? styles.disabled : ''}`}
                                            onClick={() => !isSelected5 && toggleSpeciesSkill3(skill.originalId)}
                                            style={{ opacity: isSelected5 ? 0.5 : 1 }}
                                        >
                                            <h4>{skill.name}</h4>
                                            <p>{skill.characteristic.toUpperCase()}</p>
                                            {isSelected3 && <span className={styles.xpBadge}>+3 Advances</span>}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Automatic Talents */}
                            {speciesTalentData.automaticTalents.length > 0 && (
                                <>
                                    <h4 style={{ marginTop: '20px' }}>Automatic Species Talents</h4>
                                    <div className={styles.grid}>
                                        {speciesTalentData.automaticTalents.map(talent => (
                                            <div
                                                key={talent.id}
                                                className={styles.optionCard}
                                                style={{ background: '#2d5016', cursor: 'default' }}
                                            >
                                                <h4>{talent.name}</h4>
                                                <p style={{ fontSize: '0.8rem' }}>{talent.description.substring(0, 100)}...</p>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Talent Choices */}
                            {speciesTalentData.talentChoices.map((choice, idx) => (
                                <div key={choice.index}>
                                    <h4 style={{ marginTop: '20px' }}>Choose 1 Talent (Choice {idx + 1})</h4>
                                    <div className={styles.grid}>
                                        {choice.options.map(talent => (
                                            <div
                                                key={talent.id}
                                                className={`${styles.optionCard} ${selectedSpeciesTalentChoices[choice.index] === talent.id ? styles.selected : ''}`}
                                                onClick={() => setSelectedSpeciesTalentChoices(prev => ({ ...prev, [choice.index]: talent.id }))}
                                            >
                                                <h4>{talent.name}</h4>
                                                <p style={{ fontSize: '0.8rem' }}>{talent.description.substring(0, 100)}...</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {rolledRandomTalents.length > 0 && (
                                <>
                                    <h4 style={{ marginTop: '20px' }}>Rolled Random Talents</h4>
                                    <div className={styles.grid}>
                                        {rolledRandomTalents.map(talentId => {
                                            const talent = gameData.talents.find(t => t.id === talentId);
                                            return talent ? (
                                                <div key={talentId} className={styles.optionCard} style={{ background: '#2d5016' }}>
                                                    <h4>{talent.name}</h4>
                                                    <p style={{ fontSize: '0.8rem' }}>{talent.description.substring(0, 100)}...</p>
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                </>
                            )}

                            <button
                                onClick={confirmSpeciesSkillsTalents}
                                className={`${styles.button} ${styles.primary}`}
                                style={{ marginTop: '20px' }}
                                disabled={
                                    selectedSpeciesSkills5.length !== 3 || 
                                    selectedSpeciesSkills3.length !== 3 || 
                                    !speciesTalentData.talentChoices.every(choice => selectedSpeciesTalentChoices[choice.index] !== undefined)
                                }
                            >
                                Continue
                            </button>
                        </div>
                    )}

                    {/* Step 6: Career Skills & Talents */}
                    {currentStep === 'careerSkillsTalents' && selectedCareer && (
                        <div>
                            <h3>Career Skills & Talents - {selectedCareer.name}</h3>

                            <h4>Distribute 40 Skill Advances (max 10 per skill)</h4>
                            <p>Advances Used: {totalCareerAdvances} / 40</p>

                            <div className={styles.grid}>
                                {careerSkills.map(skill => {
                                    const advances = careerSkillAdvances[skill.originalId] || 0;
                                    return (
                                        <div key={skill.originalId} className={styles.optionCard}>
                                            <h4>{skill.name}</h4>
                                            <p>{skill.characteristic.toUpperCase()} | Advances: {advances}</p>
                                            <div>
                                                <button
                                                    onClick={() => updateCareerSkillAdvance(skill.originalId, -1)}
                                                    disabled={advances <= 0}
                                                    className={styles.button}
                                                >-</button>
                                                <button
                                                    onClick={() => updateCareerSkillAdvance(skill.originalId, 1)}
                                                    disabled={advances >= 10 || totalCareerAdvances >= 40}
                                                    className={styles.button}
                                                >+</button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <h4 style={{ marginTop: '20px' }}>Select 1 Career Talent</h4>
                            <div className={styles.grid}>
                                {careerTalents.map(talent => (
                                    <div
                                        key={talent.id}
                                        className={`${styles.optionCard} ${selectedCareerTalent === talent.id ? styles.selected : ''}`}
                                        onClick={() => setSelectedCareerTalent(talent.id)}
                                    >
                                        <h4>{talent.name}</h4>
                                        <p style={{ fontSize: '0.8rem' }}>{talent.description}</p>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={confirmCareerSkillsTalents}
                                className={`${styles.button} ${styles.primary}`}
                                style={{ marginTop: '20px' }}
                                disabled={!selectedCareerTalent}
                            >
                                Continue to Summary
                            </button>
                        </div>
                    )}

                    {/* Step 7: Summary */}
                    {currentStep === 'summary' && selectedSpecies && selectedCareer && (
                        <div>
                            <h3>Character Summary</h3>

                            <div style={{ marginBottom: '20px' }}>
                                <label>Character Name: </label>
                                <input
                                    type="text"
                                    value={characterName}
                                    onChange={(e) => setCharacterName(e.target.value)}
                                    placeholder="Enter character name"
                                    style={{ padding: '8px', fontSize: '1rem', background: '#333', color: '#eee', border: '1px solid #555' }}
                                />
                            </div>

                            <div className={styles.grid}>
                                <div className={styles.optionCard}>
                                    <h4>Species</h4>
                                    <p>{selectedSpecies.name}</p>
                                </div>
                                <div className={styles.optionCard}>
                                    <h4>Career</h4>
                                    <p>{selectedCareer.name} ({selectedCareer.class})</p>
                                </div>
                                <div className={styles.optionCard}>
                                    <h4>Fate / Fortune</h4>
                                    <p>{selectedSpecies.fate + fateResilienceAllocated.fate}</p>
                                </div>
                                <div className={styles.optionCard}>
                                    <h4>Resilience / Resolve</h4>
                                    <p>{selectedSpecies.resilience + fateResilienceAllocated.resilience}</p>
                                </div>
                            </div>

                            <h4 style={{ marginTop: '20px' }}>Characteristics</h4>
                            <div className={styles.attributeGridSummary}>
                                <span>Char</span><span>Value</span>
                                {CHARACTERISTIC_KEYS.map(attr => (
                                    <React.Fragment key={attr}>
                                        <label>{attr.toUpperCase()}</label>
                                        <label><strong>{assignedAttributes[attr]}</strong></label>
                                    </React.Fragment>
                                ))}
                            </div>

                            <h4 style={{ marginTop: '20px' }}>Skills</h4>
                            <div className={styles.grid}>
                                {selectedSpeciesSkills5.map(skillId => {
                                    const skill = gameData.skills.find(s => s.id === skillId || s.id === skillId.split('_')[0]);
                                    return (
                                        <div key={skillId} className={styles.optionCard}>
                                            <p>{skill?.name || skillId}: <strong>+5</strong></p>
                                        </div>
                                    );
                                })}
                                {selectedSpeciesSkills3.map(skillId => {
                                    const skill = gameData.skills.find(s => s.id === skillId || s.id === skillId.split('_')[0]);
                                    return (
                                        <div key={skillId} className={styles.optionCard}>
                                            <p>{skill?.name || skillId}: <strong>+3</strong></p>
                                        </div>
                                    );
                                })}
                                {Object.entries(careerSkillAdvances).filter(([, v]) => v > 0).map(([skillId, advances]) => {
                                    const skill = gameData.skills.find(s => s.id === skillId || s.id === skillId.split('_')[0]);
                                    return (
                                        <div key={skillId} className={styles.optionCard}>
                                            <p>{skill?.name || skillId}: <strong>+{advances}</strong></p>
                                        </div>
                                    );
                                })}
                            </div>

                            <h4 style={{ marginTop: '20px' }}>Talents</h4>
                            <div className={styles.grid}>
                                {/* Automatic species talents */}
                                {speciesTalentData.automaticTalents.map(talent => (
                                    <div key={talent.id} className={styles.optionCard}>
                                        <p>{talent.name} (Species)</p>
                                    </div>
                                ))}
                                {/* Chosen species talents */}
                                {Object.values(selectedSpeciesTalentChoices).map(talentId => (
                                    <div key={talentId} className={styles.optionCard}>
                                        <p>{gameData.talents.find(t => t.id === talentId)?.name} (Species)</p>
                                    </div>
                                ))}
                                {/* Random talents */}
                                {rolledRandomTalents.map(talentId => (
                                    <div key={talentId} className={styles.optionCard}>
                                        <p>{gameData.talents.find(t => t.id === talentId)?.name} (Random)</p>
                                    </div>
                                ))}
                                {/* Career talent */}
                                {selectedCareerTalent && (
                                    <div className={styles.optionCard}>
                                        <p>{gameData.talents.find(t => t.id === selectedCareerTalent)?.name} (Career)</p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={finish}
                                className={`${styles.button} ${styles.primary}`}
                                style={{ marginTop: '20px' }}
                            >
                                Create Character
                            </button>
                        </div>
                    )}
                </div>

                <div className={styles.footer}>
                    <span>Total XP Bonus: {xpLog.reduce((a, b) => a + b.amount, 0)}</span>
                    {selectedSpeciesId && <span>Species: {(speciesData as SpeciesDataItem[]).find(s => s.id === selectedSpeciesId)?.name}</span>}
                    {selectedCareerId && <span>Career: {gameData.careers.find(c => c.id === selectedCareerId)?.name}</span>}
                </div>
            </div>
        </div>
    );
};

export default CharacterCreationWizard;
