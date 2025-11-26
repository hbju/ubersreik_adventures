import { Career, Character, Skill } from '../types/wfrp.types';
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

export function generateRandomNpc(careersData: Career[], skillsData: SkillCharDefinition[]): Character {
    const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
    const career = careersData[Math.floor(Math.random() * careersData.length)];
    const careerLevel = career.career_level[0];

    return {
        id: crypto.randomUUID(),
        userId: null,
        name: name,
        currentCareerId: career.id,
        currentCareerLevelId: careerLevel.id,
        careerHistory: [],
        unlockedCharacteristicIds: careerLevel.characteristic_advances || [],
        unlockedSkillIds: careerLevel.skills_ids || [],
        unlockedTalentIds: careerLevel.talent_ids || [],
        xp: { current: 0, spent: 0 },
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
        currency: { gc: 0, ss: rollDice(1, 6), bp: rollDice(1, 12) }
    };
};

export function createBlankCharacter(skillsData: SkillCharDefinition[]): Character {
    // This creates a character with default stats, perfect for a new PC
    const defaultStat = 30;
    return {
        id: crypto.randomUUID(),
        userId: null,
        name: "New Character",
        currentCareerId: "",
        currentCareerLevelId: "",
        careerHistory: [],
        unlockedCharacteristicIds: [],
        unlockedSkillIds: [],
        unlockedTalentIds: [],
        xp: { current: 0, spent: 0 },
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
        currency: { gc: 0, ss: 0, bp: 0 }
    }
}