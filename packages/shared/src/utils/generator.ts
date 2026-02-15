import { Career, Character, Skill, CharacterTemplate, CharacteristicVariance, Talent, CareerLevel } from '../types/wfrp.types';
import { rollDice } from './mechanics';
import { SkillCharDefinition } from '../types/wfrp.types';
import { getAvailableAdvancements, getGroupedSkill, isSkillGrouped, useGameData } from '..';
import speciesDataForGenerator from '../data/species.json';
import { get } from 'http';

function getBasicSkills(skillsData: SkillCharDefinition[]): Skill[] {
    return skillsData.filter(skill => skill.type === 'skill' && skill.classification === 'basic').map(skill => ({
        id: skill.id,
        name: skill.name,
        characteristic: skill.characteristic,
        advances: 0,
        talents: 0,
        modifier: 0
    }));
}

const firstNames = ["Albrecht", "Gunnar", "Elsa", "Katrin", "Hanz", "Sigrid", "Ludwig", "Mathilde", "Ulrich"];
const lastNames = ["Weber", "Hoffman", "Schmidt", "Fischer", "Schneider", "Bauer", "Klein", "Vogt"];

// Default name lists for different species/categories
const nameListsByCategory: Record<string, string[]> = {
    'Human': ["Hans", "Klaus", "Wilhelm", "Heinrich", "Sigmund", "Karl", "Otto", "Friedrich", "Gustav", "Bernhard", "Elsa", "Greta", "Helga", "Ingrid", "Brunhilde", "Frieda", "Gertrude", "Hilda", "Klara", "Liesel"],
    'Dwarf': ["Gorrin", "Thorgrim", "Bardin", "Durgrim", "Kazador", "Ungrim", "Morgrim", "Snorri", "Gotrek", "Brokk", "Helga", "Dagni", "Valda", "Sigrun", "Brynja", "Ragna", "Thora", "Gudrun", "Astrid", "Freya"],
    'Elf': ["Aelindril", "Caladrel", "Thalion", "Galion", "Aerindel", "Faenor", "Eltharion", "Larethin", "Alith", "Belannaer", "Ariel", "Athelwyn", "Selendra", "Naestra", "Caelith", "Elarielle", "Finduilas", "Galadriel", "Idril", "Lúthien"],
    'Halfling': ["Pip", "Milo", "Samwise", "Bandobras", "Tobold", "Falco", "Hamfast", "Holman", "Largo", "Posco", "Daisy", "Marigold", "Primula", "Rosie", "Elanor", "Ruby", "Pearl", "Peony", "Poppy", "Lily"],
    'Creature': ["Beast", "Monster", "Horror", "Fiend", "Terror", "Nightmare", "Abomination", "Spawn"],
    'Undead': ["Revenant", "Wight", "Wraith", "Specter", "Shade", "Ghoul", "Lich", "Zombie"],
    'Chaos': ["Zealot", "Marauder", "Cultist", "Acolyte", "Champion", "Chosen", "Warped One", "Mutant"],
    'Other': ["Unknown", "Stranger", "Wanderer", "Drifter", "Traveler", "Outsider"]
};

/**
 * Generate a value with variance: base ± random(0, variance)
 */
function rollWithVariance(charVariance: CharacteristicVariance): number {
    if (charVariance.variance === 0) return charVariance.base;
    const variance = Math.floor(Math.random() * (charVariance.variance * 2 + 1)) - charVariance.variance;
    return Math.max(1, charVariance.base + variance);
}

/**
 * Get a counter suffix for numbered NPCs (e.g., "#1", "#2", etc.)
 * @param templateName The template name
 * @param existingNames Array of existing character names to avoid duplicates
 */
function getNextNumberedName(templateName: string, existingNames: string[]): string {
    let counter = 1;
    let name = `${templateName} #${counter}`;
    while (existingNames.includes(name)) {
        counter++;
        name = `${templateName} #${counter}`;
    }
    return name;
}

/**
 * Generate a character from a template with randomized stats based on variance
 */
export function generateCharacterFromTemplate(
    template: CharacterTemplate,
    skillsData: SkillCharDefinition[],
    existingCharacterNames: string[] = [],
    useNumberedNames: boolean = false
): Character {
    // Generate name
    let name: string;
    if (useNumberedNames) {
        name = getNextNumberedName(template.name, existingCharacterNames);
    } else {
        const nameList = template.nameList || nameListsByCategory[template.category] || nameListsByCategory['Other'];
        const baseName = nameList[Math.floor(Math.random() * nameList.length)];
        // If the name already exists, add a number suffix
        if (existingCharacterNames.includes(baseName)) {
            name = getNextNumberedName(baseName, existingCharacterNames);
        } else {
            name = baseName;
        }
    }

    // Roll characteristics with variance
    const characteristics = {
        ws: { initial: rollWithVariance(template.characteristics.ws), advances: 0, talents: 0, modifier: 0 },
        bs: { initial: rollWithVariance(template.characteristics.bs), advances: 0, talents: 0, modifier: 0 },
        s: { initial: rollWithVariance(template.characteristics.s), advances: 0, talents: 0, modifier: 0 },
        t: { initial: rollWithVariance(template.characteristics.t), advances: 0, talents: 0, modifier: 0 },
        i: { initial: rollWithVariance(template.characteristics.i), advances: 0, talents: 0, modifier: 0 },
        ag: { initial: rollWithVariance(template.characteristics.ag), advances: 0, talents: 0, modifier: 0 },
        dex: { initial: rollWithVariance(template.characteristics.dex), advances: 0, talents: 0, modifier: 0 },
        int: { initial: rollWithVariance(template.characteristics.int), advances: 0, talents: 0, modifier: 0 },
        wp: { initial: rollWithVariance(template.characteristics.wp), advances: 0, talents: 0, modifier: 0 },
        fel: { initial: rollWithVariance(template.characteristics.fel), advances: 0, talents: 0, modifier: 0 },
    };

    // Calculate wounds if not specified
    const tBonus = Math.floor(characteristics.t.initial / 10);
    const wpBonus = Math.floor(characteristics.wp.initial / 10);
    const sBonus = Math.floor(characteristics.s.initial / 10);
    let baseWounds = template.baseWounds ?? (tBonus * 2 + wpBonus + sBonus);
    if (template.woundsVariance) {
        const woundVariance = Math.floor(Math.random() * (template.woundsVariance * 2 + 1)) - template.woundsVariance;
        baseWounds = Math.max(1, baseWounds + woundVariance);
    }

    // Build skills array - start with basic skills
    const skills: Skill[] = [...getBasicSkills(skillsData)];

    // Add template skills with variance
    for (const templateSkill of template.skills) {
        let advances = templateSkill.advances;
        if (templateSkill.advancesVariance) {
            const variance = Math.floor(Math.random() * (templateSkill.advancesVariance * 2 + 1)) - templateSkill.advancesVariance;
            advances = Math.max(0, advances + variance);
        }

        // Check if this skill already exists in basic skills
        const existingSkillIndex = skills.findIndex(s => s.id === templateSkill.id);
        if (existingSkillIndex >= 0) {
            skills[existingSkillIndex].advances = advances;
        } else {
            // Add as advanced skill
            if (isSkillGrouped(templateSkill.id)) {
                const groupedSkill = getGroupedSkill(templateSkill.id, skillsData);
                if (groupedSkill) {
                    groupedSkill.advances = advances;
                    skills.push(groupedSkill);
                }
            } else {
                const skillDef = skillsData.find(s => s.id === templateSkill.id);
                if (skillDef) {
                    skills.push({
                        id: skillDef.id,
                        name: skillDef.name,
                        characteristic: skillDef.characteristic,
                        advances: advances,
                        talents: 0,
                        modifier: 0
                    });
                }
            }
        }
    }

    // Build talents record
    const talents: Record<string, number> = {};
    for (const talentId of template.talents) {
        talents[talentId] = 1;
    }

    // Build inventory
    const inventory = {
        weapons: {} as Record<string, number>,
        armor: {} as Record<string, number>,
        items: {} as Record<string, number>
    };
    for (const weaponId of template.trappings.weapons) {
        inventory.weapons[weaponId] = 1;
    }
    for (const armorId of template.trappings.armor) {
        inventory.armor[armorId] = 1;
    }
    for (const itemId of template.trappings.items) {
        inventory.items[itemId] = 1;
    }

    return {
        id: crypto.randomUUID(),
        name,
        species: template.species,
        class: '',
        currentCareerId: template.careerId || '',
        currentCareerLevelId: template.careerLevelId || '',
        userId: null,
        tags: template.tags || [],
        locationId: null,
        xp: { current: 0, spent: 0 },
        careerHistory: [],
        unlockedCharacteristicIds: [],
        unlockedSkillIds: [],
        unlockedTalentIds: [],
        details: {
            age: '',
            height: '',
            hair: '',
            eyes: '',
            partyName: '',
            shortTermAmbition: '',
            longTermAmbition: '',
            partyShortTermAmbition: '',
            partyLongTermAmbition: ''
        },
        movement: template.movement,
        characteristics,
        skills,
        status: {
            wounds: { current: baseWounds, max: baseWounds },
            fate: { current: 0, max: 0 },
            fortune: { current: 0, max: 0 },
            resilience: { current: 0, max: 0 },
            resolve: { current: 0, max: 0 },
            corruption: { current: 0, max: 10 }
        },
        conditions: [],
        talents,
        inventory,
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
        isMinion: template.isMinion,
        templateId: template.id
    };
}

export function generateRandomNpc(careersData: Career[], skillsData: SkillCharDefinition[]): Character {
    const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
    const career = careersData[Math.floor(Math.random() * careersData.length)];
    const careerLevel = career.career_level[0];

    return {
        id: crypto.randomUUID(),
        userId: null,
        tags: [],
        locationId: null,
        name: name,
        species: "Human",
        class: career.class || "",
        currentCareerId: career.id,
        currentCareerLevelId: careerLevel.id,
        careerHistory: [],
        unlockedCharacteristicIds: careerLevel.characteristic_advances || [],
        unlockedSkillIds: careerLevel.skills_ids || [],
        unlockedTalentIds: careerLevel.talent_ids || [],
        xp: { current: 0, spent: 0 },
        details: {
            age: "",
            height: "",
            hair: "",
            eyes: "",
            partyName: "",
            shortTermAmbition: "",
            longTermAmbition: "",
            partyShortTermAmbition: "",
            partyLongTermAmbition: ""
        },
        movement: 4,
        characteristics: {
            ws: { initial: 20 + rollDice(2, 10), advances: 0, talents: 0, modifier: 0 },
            bs: { initial: 20 + rollDice(2, 10), advances: 0, talents: 0, modifier: 0 },
            s: { initial: 20 + rollDice(2, 10), advances: 0, talents: 0, modifier: 0 },
            t: { initial: 20 + rollDice(2, 10), advances: 0, talents: 0, modifier: 0 },
            i: { initial: 20 + rollDice(2, 10), advances: 0, talents: 0, modifier: 0 },
            ag: { initial: 20 + rollDice(2, 10), advances: 0, talents: 0, modifier: 0 },
            dex: { initial: 20 + rollDice(2, 10), advances: 0, talents: 0, modifier: 0 },
            int: { initial: 20 + rollDice(2, 10), advances: 0, talents: 0, modifier: 0 },
            wp: { initial: 20 + rollDice(2, 10), advances: 0, talents: 0, modifier: 0 },
            fel: { initial: 20 + rollDice(2, 10), advances: 0, talents: 0, modifier: 0 },
        },
        status: {
            wounds: { current: 12, max: 12 }, // Placeholder values
            fate: { current: 3, max: 3 },
            fortune: { current: 3, max: 3 },
            resilience: { current: 3, max: 3 },
            resolve: { current: 3, max: 3 },
            corruption: { current: 0, max: 10 },
        },
        conditions: [],
        skills: [...getBasicSkills(skillsData), ...careerLevel.skills_ids.filter(s => !getBasicSkills(skillsData).some(basicSkill => basicSkill.id === s)).map(skillId => {
            if (isSkillGrouped(skillId)) {
                const grouped = getGroupedSkill(skillId, skillsData);
                if (!grouped) return null;
                return grouped;
            }
            const skillDef = skillsData.find(s => s.id === skillId);
            if (skillDef) {
                return {
                    id: skillDef.id,
                    name: skillDef.name,
                    characteristic: skillDef.characteristic,
                    advances: 0,
                    talents: 0,
                    modifier: 0
                };
            }
            return null;
        }).filter(skill => skill !== null) as Skill[]],
        talents: {},
        inventory: {
            weapons: {},
            armor: {},
            items: {}
        },
        currency: { gc: 0, ss: rollDice(1, 6), bp: rollDice(1, 12) },
        reputations: []
    };
};

export function createBlankCharacter(skillsData: SkillCharDefinition[]): Character {
    // This creates a character with default stats, perfect for a new PC
    const defaultStat = 30;
    return {
        id: crypto.randomUUID(),
        userId: null,
        tags: [],
        locationId: null,
        name: "New Character",
        species: "Human",
        class: "",
        currentCareerId: "",
        currentCareerLevelId: "",
        careerHistory: [],
        unlockedCharacteristicIds: [],
        unlockedSkillIds: [],
        unlockedTalentIds: [],
        xp: { current: 0, spent: 0 },
        details: {
            age: "",
            height: "",
            hair: "",
            eyes: "",
            partyName: "",
            shortTermAmbition: "",
            longTermAmbition: "",
            partyShortTermAmbition: "",
            partyLongTermAmbition: ""
        },
        movement: 4,
        characteristics: {
            ws: { initial: defaultStat, advances: 0, talents: 0, modifier: 0 },
            bs: { initial: defaultStat, advances: 0, talents: 0, modifier: 0 },
            s: { initial: defaultStat, advances: 0, talents: 0, modifier: 0 },
            t: { initial: defaultStat, advances: 0, talents: 0, modifier: 0 },
            i: { initial: defaultStat, advances: 0, talents: 0, modifier: 0 },
            ag: { initial: defaultStat, advances: 0, talents: 0, modifier: 0 },
            dex: { initial: defaultStat, advances: 0, talents: 0, modifier: 0 },
            int: { initial: defaultStat, advances: 0, talents: 0, modifier: 0 },
            wp: { initial: defaultStat, advances: 0, talents: 0, modifier: 0 },
            fel: { initial: defaultStat, advances: 0, talents: 0, modifier: 0 },
        },
        status: {
            wounds: { current: 12, max: 12 },
            fate: { current: 3, max: 3 },
            fortune: { current: 3, max: 3 },
            resilience: { current: 3, max: 3 },
            resolve: { current: 3, max: 3 },
            corruption: { current: 0, max: 10 },
        },
        conditions: [],
        skills: [...getBasicSkills(skillsData)],
        talents: {},
        inventory: {
            weapons: {},
            armor: {},
            items: {}
        },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: []
    }
}

// ========================================
// Advanced NPC Generator - Career Path Simulator
// ========================================

/**
 * Result of applying a single career level simulation
 */
export interface CareerLevelSimulationResult {
    characteristicAdvances: Record<string, number>; // key -> advances added
    skillAdvances: Record<string, number>; // skill id -> advances added
    talentsAdded: string[]; // talent ids added
    careerName: string;
    levelName: string;
    level: number;
}

/**
 * An entry representing one step in the NPC's career history log
 */
export interface NPCCareerHistoryStep {
    careerId: string;
    careerName: string;
    careerLevelId: string;
    levelName: string;
    level: number;
    simulationResult: CareerLevelSimulationResult;
}

const CHAR_KEYS = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'] as const;

/**
 * Generate a base NPC with species-appropriate random characteristics.
 * This is Step 1 of the advanced NPC generator.
 */
export function generateBaseNPC(
    speciesId: string,
    name: string,
    skillsData: SkillCharDefinition[],
    talentsData: Talent[]
): Character {
    const species = (speciesDataForGenerator).find(s => s.id === speciesId);
    if (!species) {
        throw new Error(`Unknown species: ${speciesId}`);
    }

    const characteristics: Record<string, { initial: number; advances: number; talents: number; modifier: number }> = {};
    for (const key of CHAR_KEYS) {
        characteristics[key] = {
            initial: (species.base_stats[key] || 20) + rollDice(2, 10),
            advances: 0,
            talents: 0,
            modifier: 0
        };
    }

    // Calculate wounds: SB + 2*TB + WPB
    const sBonus = Math.floor(characteristics.s.initial / 10);
    const tBonus = Math.floor(characteristics.t.initial / 10);
    const wpBonus = Math.floor(characteristics.wp.initial / 10);
    const wounds = species.id === 'halfling' ? tBonus * 2 + wpBonus : sBonus + tBonus * 2 + wpBonus;

    // Add 5 advances to three randoms picks of species.skills, and 3 advances to three other random picks
    const skills = [...getBasicSkills(skillsData)];
    const speciesSkillIds = Array.from(species.skills);
    for (let i = 0; i < 6; i++) {
        const skillId = speciesSkillIds[Math.floor(Math.random() * speciesSkillIds.length)];
        speciesSkillIds.splice(speciesSkillIds.indexOf(skillId), 1);

        if (isSkillGrouped(skillId)) {
            const grouped = getGroupedSkill(skillId, skillsData);
            if (grouped) {
                const existing = skills.find(s => s.id === grouped.id);
                if (existing) {
                    existing.advances += i > 2 ? 5 : 3;
                }
                else {
                    grouped.advances = i > 2 ? 5 : 3;
                    skills.push(grouped);
                }
            }
        } else {
            const skillDef = skillsData.find(s => s.id === skillId);
            if (skillDef) {
                const existing = skills.find(s => s.id === skillDef.id);
                if (existing) {
                    existing.advances += i > 2 ? 5 : 3;
                } else {
                    skills.push({
                        id: skillDef.id,
                        name: skillDef.name,
                        characteristic: skillDef.characteristic,
                        advances: i > 2 ? 5 : 3,
                        talents: 0,
                        modifier: 0
                    });
                }
            }
        }
    }

    const initTalents = {} as Record<string, number>;
    for (const talents of species.talents) {
        if (talents.length === 1) {
            if (talents[0] === 'random') {
                const rolled = rollRandomTalent(species.id, talentsData, new Set(Object.keys(initTalents)));
                if (rolled) {
                    initTalents[rolled] = 1;
                }
            } else {
                initTalents[talents[0]] = 1;
            }
        } else {
            const chosen = talents[Math.floor(Math.random() * talents.length)];
            initTalents[chosen] = 1;
        }
    }

    return {
        id: crypto.randomUUID(),
        userId: null,
        tags: [],
        locationId: null,
        name,
        species: species.name,
        class: '',
        currentCareerId: '',
        currentCareerLevelId: '',
        careerHistory: [],
        unlockedCharacteristicIds: [],
        unlockedSkillIds: [],
        unlockedTalentIds: [],
        xp: { current: 0, spent: 0 },
        details: {
            age: '',
            height: '',
            hair: '',
            eyes: '',
            partyName: '',
            shortTermAmbition: '',
            longTermAmbition: '',
            partyShortTermAmbition: '',
            partyLongTermAmbition: ''
        },
        movement: species.movement,
        characteristics: characteristics as Character['characteristics'],
        skills: skills,
        status: {
            wounds: { current: wounds, max: wounds },
            fate: { current: species.fate, max: species.fate },
            fortune: { current: species.fate, max: species.fate },
            resilience: { current: species.resilience, max: species.resilience },
            resolve: { current: species.resilience, max: species.resilience },
            corruption: { current: 0, max: 10 }
        },
        conditions: [],
        talents: initTalents,
        inventory: {
            weapons: {},
            armor: {},
            items: {}
        },
        currency: { gc: 0, ss: rollDice(1, 6), bp: rollDice(1, 12) },
        reputations: [],
        lore: {
            gmNotes: '',
            background: [],
            biography: ''
        }
    };
}

const rollRandomTalent = (species: string, talents: Talent[], currTalents: Set<string>) => {
    // Roll random talents from the full talent list that have racial entries
    const racialTalents = talents.filter(t =>
        t.racial && t.racial.length > 0 &&
        (t.racial.includes('Random Racial Talent') || t.racial.some(r => r.toLowerCase().includes('random')) || t.racial.some(r => r.toLowerCase().includes(species.toLowerCase())))
    );

    let rolled: string = '';
    const usedIndices = currTalents;

    let idx: number;
    let attempts = 0;
    do {
        idx = Math.floor(Math.random() * racialTalents.length);
        attempts++;
    } while (usedIndices.has(racialTalents[idx].id) && attempts < 100);

    if (!usedIndices.has(racialTalents[idx].id)) {
        usedIndices.add(racialTalents[idx].id);
        rolled = (racialTalents[idx].id);
    }

    return rolled;
};

/**
 * Simulate applying a career level to a character.
 * Characteristic advances: (level - 1) * 5 + rand(1,5) for each characteristic in the career level.
 * Skill advances: (level - 1) * 5 + rand(1,5) for each of the 8 skills in the career level.
 * Talents: pick `talentCount` random talents from the level's talent list.
 *
 * Returns the updated character and a simulation result describing what changed.
 */
export function applyCareerLevel(
    character: Character,
    career: Career,
    careerLevel: CareerLevel,
    skillsData: SkillCharDefinition[],
    talentsData: Talent[],
    talentCount: number = 1
): { character: Character; result: CareerLevelSimulationResult } {
    const lvl = careerLevel.lvl;
    const updated = structuredClone(character);

    const charAdvances: Record<string, number> = {};
    const skillAdvancesMap: Record<string, number> = {};
    const talentsAdded: string[] = [];

    // --- Characteristic Advances ---
    const { characteristics: levelCharacteristics, skills: levelSkills, talents: levelTalentIds } = getAvailableAdvancements(career, careerLevel.lvl);
    updated.unlockedCharacteristicIds = Array.from(levelCharacteristics);
    updated.unlockedSkillIds = Array.from(levelSkills);
    updated.unlockedTalentIds = Array.from(levelTalentIds);

    for (const charKey of levelCharacteristics) {
        const key = charKey as keyof Character['characteristics'];
        if (updated.characteristics[key]) {
            const advanceAmount = (lvl - 1) * 5 + rollDice(1, careerLevel.lvl < 4 ? 5 : 10);
            updated.characteristics[key].advances = Math.max(updated.characteristics[key].advances, advanceAmount);
            charAdvances[charKey] = advanceAmount;
        }
    }

    // --- Skill Advances ---
    for (let i = 0; i < Math.min(8, levelSkills.length); i++) {
        const skillId = levelSkills[Math.floor(Math.random() * levelSkills.length)];
        levelSkills.splice(levelSkills.indexOf(skillId), 1);

        const advanceAmount = (lvl - 1) * 5 + rollDice(1, careerLevel.lvl < 4 ? 5 : 10);

        // Check if skill already exists on the character
        const existingSkillIdx = updated.skills.findIndex(s => s.id === skillId);
        if (existingSkillIdx >= 0) {
            updated.skills[existingSkillIdx].advances = Math.max(updated.skills[existingSkillIdx].advances, advanceAmount);
        } else {
            // Add the skill
            if (isSkillGrouped(skillId)) {
                const grouped = getGroupedSkill(skillId, skillsData);
                if (grouped) {
                    grouped.advances = advanceAmount;
                    updated.skills.push(grouped);
                }
            } else {
                const skillDef = skillsData.find(s => s.id === skillId);
                if (skillDef) {
                    updated.skills.push({
                        id: skillDef.id,
                        name: skillDef.name,
                        characteristic: skillDef.characteristic,
                        advances: advanceAmount,
                        talents: 0,
                        modifier: 0
                    });
                }
            }
        }
        skillAdvancesMap[skillId] = advanceAmount;
    }

    // --- Talents ---
    // Filter to talents the character doesn't already have (or can increase rank)
    const availableTalents = levelTalentIds.filter(tid => {
        const currentRank = updated.talents[tid] || 0;
        const talentDef = talentsData.find(t => t.id === tid);
        if (!talentDef) return false;
        // Check max ranks
        const maxRanks = typeof talentDef.max_ranks === 'number' ? talentDef.max_ranks : 99;
        return currentRank < maxRanks;
    });

    const count = Math.min(talentCount, availableTalents.length);
    const shuffled = [...availableTalents].sort(() => Math.random() - 0.5);
    for (let i = 0; i < count; i++) {
        const tid = shuffled[i];
        updated.talents[tid] = (updated.talents[tid] || 0) + 1;
        talentsAdded.push(tid);
    }

    // --- Update career fields ---
    updated.currentCareerId = career.id;
    updated.currentCareerLevelId = careerLevel.id;
    updated.class = career.class || updated.class;

    // Recalculate wounds
    const sBonus = Math.floor((updated.characteristics.s.initial + updated.characteristics.s.advances) / 10);
    const tBonus = Math.floor((updated.characteristics.t.initial + updated.characteristics.t.advances) / 10);
    const wpBonus = Math.floor((updated.characteristics.wp.initial + updated.characteristics.wp.advances) / 10);
    const newWounds = sBonus + tBonus * 2 + wpBonus;
    updated.status.wounds = { current: newWounds, max: newWounds };

    const result: CareerLevelSimulationResult = {
        characteristicAdvances: charAdvances,
        skillAdvances: skillAdvancesMap,
        talentsAdded,
        careerName: career.name,
        levelName: careerLevel.name,
        level: lvl
    };

    return { character: updated, result };
}

/**
 * Build a biography string from the history of career steps
 */
export function buildNPCBiography(steps: NPCCareerHistoryStep[]): string {
    if (steps.length === 0) return '';

    const lines: string[] = [];
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const prefix = i < steps.length - 1 ? 'Former' : 'Current';
        lines.push(`${prefix} ${step.careerName} - ${step.levelName} (Level ${step.level})`);
    }
    return lines.join('\n');
}