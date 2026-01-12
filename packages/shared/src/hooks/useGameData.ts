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
// Map data imports
import ubersreikMapEn from '../data/maps/ubersreik_en.json';
import ubersreikMapFr from '../data/maps/ubersreik_fr.json';
import ruggersBoardingHouseEn from '../data/maps/ruggers_boarding_house_en.json';
import ruggersBoardingHouseFr from '../data/maps/ruggers_boarding_house_fr.json';
import hoodedManInnFr from '../data/maps/hooded-man-inn_fr.json';
import niederstadtHausFr from '../data/maps/niederstadt-haus_fr.json';
import qualitiesEn from '../data/flaws_qualities_en.json';
import qualitiesFr from '../data/flaws_qualities_fr.json';
import shopsEn from '../data/shops_en.json';
import shopsFr from '../data/shops_fr.json';
import templatesEn from '../data/templates_en.json';
import { SkillCharDefinition, Talent, Career, Item, Weapon, Armor, Condition, MapData, ItemQualityDefinition, ShopDefinition, CharacterTemplate } from '../types/wfrp.types';

const normalizeMapData: (data: MapData) => MapData = (data: MapData): MapData => ({
    ...data,
    imagePath: data.imagePath || data.mapImage || '',
});

const buildMapsRegistry = (maps: MapData[]): Record<string, MapData> => {
    return maps.reduce((acc, map) => {
        acc[map.id] = normalizeMapData(map);
        return acc;
    }, {} as Record<string, MapData>);
};

export const useGameData = () => {
    const { i18n } = useTranslation();
    const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en';

    const mapsEn: MapData[] = [
        ubersreikMapEn as MapData,
        ruggersBoardingHouseEn as MapData,
        hoodedManInnFr as MapData,
        niederstadtHausFr as MapData,
    ];

    const mapsFr: MapData[] = [
        ubersreikMapFr as MapData,
        ruggersBoardingHouseFr as MapData,
        hoodedManInnFr as MapData,
        niederstadtHausFr as MapData,
    ];

    const data = {
        en: {
            skills: skillsEn as SkillCharDefinition[],
            talents: talentsEn as Talent[],
            careers: careersEn as Career[],
            items: itemsEn as Item[],
            weapons: weaponsEn as Weapon[],
            armor: armorEn as Armor[],
            conditions: conditionsEn as Condition[],
            mapData: normalizeMapData(ubersreikMapEn as MapData), // Default map for backward compatibility
            maps: buildMapsRegistry(mapsEn), // All maps indexed by id
            mapsList: mapsEn.map(normalizeMapData), // All maps as array
            qualities: qualitiesEn as ItemQualityDefinition[],
            shops: shopsEn as ShopDefinition[],
            defaultTemplates: templatesEn as CharacterTemplate[],
        },
        fr: {
            skills: skillsFr as SkillCharDefinition[],
            talents: talentsFr as Talent[],
            careers: careersFr as Career[],
            items: itemsFr as Item[],
            weapons: weaponsFr as Weapon[],
            armor: armorFr as Armor[],
            conditions: conditionsFr as Condition[],
            mapData: normalizeMapData(ubersreikMapFr as MapData), // Default map for backward compatibility
            maps: buildMapsRegistry(mapsFr), // All maps indexed by id
            mapsList: mapsFr.map(normalizeMapData), // All maps as array
            qualities: qualitiesFr as ItemQualityDefinition[],
            shops: shopsFr as ShopDefinition[],
            defaultTemplates: templatesEn as CharacterTemplate[], // Use English templates for now
        },
    };

    return data[lang];
};
