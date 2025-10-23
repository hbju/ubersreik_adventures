import { Character, Skill } from '../type/wfrp.types';
import { rollDice } from './mechanics';
import { SkillCharDefinition } from '../type/wfrp.types';
import allSkillsAndCharacteristics from '../data/skillsAndCharacteristics.json';

const firstNames = ["Albrecht", "Gunnar", "Elsa", "Katrin", "Hanz", "Sigrid", "Ludwig", "Mathilde", "Ulrich"];
const lastNames = ["Weber", "Hoffman", "Schmidt", "Fischer", "Schneider", "Bauer", "Klein", "Vogt"];

const basicSkills = (allSkillsAndCharacteristics as SkillCharDefinition[]).filter(skill => skill.type === 'skill').map(skill => ({
    id: skill.id,
    name: skill.name,
    characteristic: skill.characteristic,
    advances: 0,
    talents: 0,
    modifier: 0
}));

export const generateRandomNpc = (): Character => {
    const name = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;

    return {
        id: crypto.randomUUID(), 
        name: name,
        career: "",
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
        skills: [...basicSkills],
        talents: {},
        inventory: ["Ragged clothes", "1d10 brass pennies"],
    };
};

export const createBlankCharacter = (): Character => {
    // This creates a character with default stats, perfect for a new PC
    const defaultStat = 30;
    return {
        id: crypto.randomUUID(),
        name: "New Character",
        career: "",
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
        skills: [...basicSkills],
        talents: {},
        inventory: [],
    }
}