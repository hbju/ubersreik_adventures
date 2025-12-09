import { Career, Character, Skill, CharacterTemplate, CharacteristicVariance } from '../types/wfrp.types';
import { rollDice } from './mechanics';
import { SkillCharDefinition } from '../types/wfrp.types';
import { getGroupedSkill, isSkillGrouped, useGameData } from '..';

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
        reputations : []
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
        reputations : []
    }
}