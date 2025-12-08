import { useTranslation } from 'react-i18next';
import skillsEn from '../data/skills_en.json';
import skillsFr from '../data/skills_fr.json';
import talentsEn from '../data/talents_en.json';
import talentsFr from '../data/talents_fr.json';
import careersEn from '../data/careers_en.json';
import careersFr from '../data/careers_fr.json';
import itemsEn from '../data/items_en.json';
import itemsFr from '../data/items_fr.json';
import weaponsEn from '../data/weapons_en.json';
import weaponsFr from '../data/weapons_fr.json';
import armorEn from '../data/armor_en.json';
import armorFr from '../data/armor_fr.json';
import conditionsEn from '../data/conditions_en.json';
import conditionsFr from '../data/conditions_fr.json';
import gameDataEn from '../data/ubersreik_en.json';
import gameDataFr from '../data/ubersreik_fr.json';
import qualitiesEn from '../data/flaws_qualities_en.json';
import qualitiesFr from '../data/flaws_qualities_fr.json';
import shopsEn from '../data/shops_en.json';
import shopsFr from '../data/shops_fr.json';
import { SkillCharDefinition, Talent, Career, Item, Weapon, Armor, Condition, GameData, ItemQualityDefinition, ShopDefinition } from '../types/wfrp.types';

export const useGameData = () => {
    const { i18n } = useTranslation();
    const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en';

    const data = {
        en: {
            skills: skillsEn as SkillCharDefinition[],
            talents: talentsEn as Talent[],
            careers: careersEn as Career[],
            items: itemsEn as Item[],
            weapons: weaponsEn as Weapon[],
            armor: armorEn as Armor[],
            conditions: conditionsEn as Condition[],
            gameData: gameDataEn as GameData,
            qualities: qualitiesEn as ItemQualityDefinition[],
            shops: shopsEn as ShopDefinition[],
        },
        fr: {
            skills: skillsFr as SkillCharDefinition[],
            talents: talentsFr as Talent[],
            careers: careersFr as Career[],
            items: itemsFr as Item[],
            weapons: weaponsFr as Weapon[],
            armor: armorFr as Armor[],
            conditions: conditionsFr as Condition[],
            gameData: gameDataFr as GameData,
            qualities: qualitiesFr as ItemQualityDefinition[],
            shops: shopsFr as ShopDefinition[],
        },
    };

    return data[lang];
};
