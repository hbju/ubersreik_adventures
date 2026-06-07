import armorData from '../data/armor_en.json';
import skillData from '../data/skills_en.json';
import talentData from '../data/talents_en.json';
import weaponData from '../data/weapons_en.json';
import type {
    Armor,
    Character,
    CharacterTemplate,
    SkillCharDefinition,
    Talent,
    Weapon,
} from '../types/wfrp.types';
import type { AdvantageSeedModifier, InitialAdvantageConfig } from './advantage';
import { createCombatState, createCombatantFromCharacter } from './engine';
import {
    heuristicProfiles,
    HeuristicController,
    type HeuristicProfile,
    type HeuristicProfileId,
} from './heuristic-controller';
import { qualityRating } from './qualities';
import { createSeededRng, type Rng } from './rng';
import {
    runCombatToCompletion,
    type CombatantController,
    type TurnEngineOptions,
    type TurnEngineState,
} from './turn-engine';
import type {
    CombatEvent,
    CombatState,
    Combatant,
    CoverLevel,
    SideId,
    WeaponAmmoState,
} from './types';

export type FightSeed = number | string;

export interface EncounterCombatantConfig {
    id: string;
    character: Character | CharacterTemplate;
    profile?: HeuristicProfileId | HeuristicProfile;
    position?: number;
    cover?: CoverLevel | boolean;
    primaryWeaponId?: string;
    secondaryWeaponId?: string;
    ammunition?: Record<string, number>;
    surprised?: boolean;
}

export interface EncounterInitialAdvantage {
    manoeuvrability?: AdvantageSeedModifier | AdvantageSeedModifier[];
    surprise?: AdvantageSeedModifier | AdvantageSeedModifier[];
    terrain?: AdvantageSeedModifier | AdvantageSeedModifier[];
    threat?: AdvantageSeedModifier | AdvantageSeedModifier[];
}

export interface EncounterToggles {
    suddenDeath?: boolean;
    shootingIntoMelee?: boolean;
    finiteAmmo?: boolean;
    maxRounds?: number;
    tacticalDominantSide?: SideId;
}

export interface EncounterCatalogue {
    weapons?: Weapon[];
    armor?: Armor[];
    talents?: Talent[];
    skills?: SkillCharDefinition[];
}

export interface EncounterConfig {
    sides: Record<SideId, EncounterCombatantConfig[]>;
    initialAdvantage?: EncounterInitialAdvantage;
    toggles?: EncounterToggles;
    catalogue?: EncounterCatalogue;
}

export interface EncounterConfigValidationResult {
    valid: boolean;
    errors: string[];
}

export class EncounterConfigValidationError extends Error {
    constructor(readonly errors: string[]) {
        super(errors.join('; '));
        this.name = 'EncounterConfigValidationError';
    }
}

export interface FightCombatantOutcome {
    id: string;
    name: string;
    side: SideId;
    survived: boolean;
    finalWounds: number;
    died: boolean;
    critsDealt: number;
    critsTaken: number;
    conditionsInflicted: number;
    fateSpent: number;
    fortuneSpent: number;
    advantageGenerated: number;
}

export interface FightSideResourceTotals {
    fateSpent: number;
    fortuneSpent: number;
    advantageGenerated: number;
    advantageSpent: number;
}

export interface FightOutcome {
    seed: FightSeed;
    winner: SideId | 'draw';
    rounds: number;
    terminalReason: 'sideDown' | 'maxRounds';
    combatants: Record<string, FightCombatantOutcome>;
    sideResources: Record<SideId, FightSideResourceTotals>;
}

export interface FightReplay {
    seed: FightSeed;
    outcome: FightOutcome;
    events: CombatEvent[];
}

export interface FightControllerFactoryContext {
    config: EncounterConfig;
    combatantConfig: EncounterCombatantConfig;
    combatant: Combatant;
    profile: HeuristicProfile;
}

export type FightControllerFactory = (context: FightControllerFactoryContext) => CombatantController;

export interface FightRunnerOptions {
    controllerFactory?: FightControllerFactory;
    controllers?: Record<string, CombatantController> | CombatantController;
}

interface PreparedEncounter {
    state: CombatState;
    controllers: Record<string, CombatantController> | CombatantController;
    turnOptions: TurnEngineOptions;
}

export function validateEncounterConfig(config: EncounterConfig): EncounterConfigValidationResult {
    const errors: string[] = [];
    if (!config || !config.sides) {
        return { valid: false, errors: ['combat.encounter.validation.missingSides'] };
    }

    const catalogue = resolvedCatalogue(config);
    const weaponIds = new Set(catalogue.weapons.map(weapon => weapon.id));
    const skillIds = new Set(catalogue.skills.map(skill => skill.id));
    const seenIds = new Set<string>();

    for (const side of ['ally', 'adversary'] as const) {
        const members = config.sides[side];
        if (!Array.isArray(members) || members.length === 0) {
            errors.push(`combat.encounter.validation.emptySide:${side}`);
            continue;
        }

        for (const member of members) {
            if (!member.id?.trim()) errors.push(`combat.encounter.validation.missingCombatantId:${side}`);
            if (seenIds.has(member.id)) errors.push(`combat.encounter.validation.duplicateCombatantId:${member.id}`);
            seenIds.add(member.id);
            if (!member.character) {
                errors.push(`combat.encounter.validation.missingCharacter:${member.id}`);
                continue;
            }
            if (member.position !== undefined && !Number.isFinite(member.position)) {
                errors.push(`combat.encounter.validation.invalidPosition:${member.id}`);
            }
            if (member.profile && !profileFor(member.profile)) {
                errors.push(`combat.encounter.validation.unknownProfile:${member.id}`);
            }

            const ownedWeapons = isCharacterTemplate(member.character)
                ? member.character.trappings.weapons
                : Object.keys(member.character.inventory?.weapons ?? {});
            for (const weaponId of ownedWeapons) {
                if (!weaponIds.has(weaponId)) errors.push(`combat.encounter.validation.unknownWeapon:${member.id}:${weaponId}`);
            }
            for (const weaponId of [member.primaryWeaponId, member.secondaryWeaponId].filter((id): id is string => !!id)) {
                if (!ownedWeapons.includes(weaponId)) errors.push(`combat.encounter.validation.weaponNotOwned:${member.id}:${weaponId}`);
            }

            if (isCharacterTemplate(member.character)) {
                for (const skill of member.character.skills) {
                    if (!skillIds.has(skill.id)) errors.push(`combat.encounter.validation.unknownSkill:${member.id}:${skill.id}`);
                }
                if (member.character.movement <= 0) errors.push(`combat.encounter.validation.invalidMovement:${member.id}`);
            } else {
                if (member.character.status.wounds.max <= 0) errors.push(`combat.encounter.validation.invalidWounds:${member.id}`);
                if (member.character.movement <= 0) errors.push(`combat.encounter.validation.invalidMovement:${member.id}`);
            }
        }
    }

    const maxRounds = config.toggles?.maxRounds;
    if (maxRounds !== undefined && (!Number.isInteger(maxRounds) || maxRounds <= 0)) {
        errors.push('combat.encounter.validation.invalidMaxRounds');
    }
    for (const [category, value] of Object.entries(config.initialAdvantage ?? {})) {
        for (const modifier of Array.isArray(value) ? value : [value]) {
            if (!modifier || !['ally', 'adversary'].includes(modifier.side) || !Number.isFinite(modifier.value) || modifier.value < 0) {
                errors.push(`combat.encounter.validation.invalidAdvantage:${category}`);
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

export function runFight(config: EncounterConfig, seed: FightSeed, options: FightRunnerOptions = {}): FightOutcome {
    return runPreparedFight(config, seed, options).outcome;
}

export function replayFight(config: EncounterConfig, seed: FightSeed, options: FightRunnerOptions = {}): FightReplay {
    const result = runPreparedFight(config, seed, options);
    return {
        seed,
        outcome: result.outcome,
        events: [...result.engine.events],
    };
}

function runPreparedFight(
    config: EncounterConfig,
    seed: FightSeed,
    options: FightRunnerOptions
): { engine: TurnEngineState; outcome: FightOutcome } {
    const validation = validateEncounterConfig(config);
    if (!validation.valid) throw new EncounterConfigValidationError(validation.errors);

    const prepared = prepareEncounter(config, seed, options);
    const engine = runCombatToCompletion(prepared.state, prepared.controllers, prepared.turnOptions);
    return { engine, outcome: summarizeFight(engine, seed) };
}

function prepareEncounter(config: EncounterConfig, seed: FightSeed, options: FightRunnerOptions): PreparedEncounter {
    const catalogue = resolvedCatalogue(config);
    const templateRng = createSeededRng(`${String(seed)}:encounter`);
    const combatantConfigs = (['ally', 'adversary'] as const).flatMap(side =>
        config.sides[side].map(member => ({ side, member }))
    );
    const usedNames: string[] = [];
    const combatants = combatantConfigs.map(({ side, member }) => {
        const character = materializeCharacter(member, catalogue.skills, templateRng, usedNames);
        usedNames.push(character.name);
        const primaryWeaponId = member.primaryWeaponId
            ?? firstEquippedWeaponId(character)
            ?? Object.keys(character.inventory.weapons)[0];
        const secondaryWeaponId = member.secondaryWeaponId
            ?? Object.keys(character.inventory.weapons).find(id => id !== primaryWeaponId);
        return createCombatantFromCharacter(character, {
            id: member.id,
            side,
            position: member.position ?? defaultPosition(side, combatantsOnSideIndex(config.sides[side], member)),
            cover: normalizeCover(member.cover),
            weaponLoadout: { primaryWeaponId, secondaryWeaponId },
            weaponAmmo: initialWeaponAmmo(character, catalogue.weapons),
            ammunition: member.ammunition,
        });
    });

    const state = createCombatState(combatants, {
        weapons: catalogue.weapons,
        armor: catalogue.armor,
        talents: catalogue.talents,
        tacticalDominantSide: config.toggles?.tacticalDominantSide,
        ammoPolicy: { finiteAmmo: config.toggles?.finiteAmmo ?? false },
        rules: {
            suddenDeath: config.toggles?.suddenDeath ?? false,
            shootingIntoMelee: config.toggles?.shootingIntoMelee ?? false,
        },
    });
    const controllers = options.controllers ?? Object.fromEntries(combatantConfigs.map(({ member }) => {
        const combatant = state.combatants[member.id];
        const profile = profileFor(member.profile) ?? autoPickProfile(combatant, state);
        const controller = options.controllerFactory
            ? options.controllerFactory({ config, combatantConfig: member, combatant, profile })
            : new HeuristicController({ profile });
        return [member.id, controller];
    }));

    const surprisedIds = combatantConfigs.filter(({ member }) => member.surprised).map(({ member }) => member.id);
    return {
        state,
        controllers,
        turnOptions: {
            seed: `${String(seed)}:fight`,
            maxRounds: config.toggles?.maxRounds ?? 50,
            surprisedIds,
            initialAdvantage: config.initialAdvantage as Omit<InitialAdvantageConfig, 'state' | 'outnumbering'>,
        },
    };
}

function summarizeFight(engine: TurnEngineState, seed: FightSeed): FightOutcome {
    const combatants: Record<string, FightCombatantOutcome> = Object.fromEntries(Object.values(engine.state.combatants).map(combatant => [
        combatant.id,
        {
            id: combatant.id,
            name: combatant.name,
            side: combatant.side,
            survived: !(combatant as Combatant & { dead?: boolean }).dead,
            finalWounds: combatant.currentWounds,
            died: !!(combatant as Combatant & { dead?: boolean }).dead,
            critsDealt: 0,
            critsTaken: 0,
            conditionsInflicted: 0,
            fateSpent: 0,
            fortuneSpent: 0,
            advantageGenerated: 0,
        },
    ]));
    const sideResources = {
        ally: emptySideTotals(),
        adversary: emptySideTotals(),
    };
    const latestSourceByTarget = new Map<string, string>();

    for (const event of engine.events) {
        if (event.type === 'AttackResolved') latestSourceByTarget.set(event.data.defenderId, event.data.attackerId);
        if (event.type === 'DamageDealt') latestSourceByTarget.set(event.data.defenderId, event.data.attackerId);

        if (event.type === 'CriticalWoundResolved') {
            const target = combatants[event.data.combatantId];
            if (target) target.critsTaken += 1;
            const sourceId = latestSourceByTarget.get(event.data.combatantId);
            if (sourceId && combatants[sourceId]) combatants[sourceId].critsDealt += 1;
        } else if (event.type === 'ConditionApplied') {
            const sourceId = latestSourceByTarget.get(event.data.targetId);
            if (sourceId && combatants[sourceId]) combatants[sourceId].conditionsInflicted += Math.max(1, event.data.stacks);
        } else if (event.type === 'ResourceSpent') {
            const outcome = combatants[event.data.combatantId];
            if (!outcome) continue;
            if (event.data.resource === 'fate') {
                outcome.fateSpent += event.data.amount;
                sideResources[outcome.side].fateSpent += event.data.amount;
            } else if (event.data.resource === 'fortune') {
                outcome.fortuneSpent += event.data.amount;
                sideResources[outcome.side].fortuneSpent += event.data.amount;
            }
        } else if (event.type === 'AdvantageChanged' && event.data.delta > 0) {
            const sourceId = event.data.sourceCombatantId;
            if (sourceId && combatants[sourceId]) {
                combatants[sourceId].advantageGenerated += event.data.delta;
                sideResources[combatants[sourceId].side].advantageGenerated += event.data.delta;
            }
        } else if (event.type === 'AdvantageSpentEvent') {
            sideResources[event.data.side].advantageSpent += event.data.amount;
        } else if (event.type === 'CombatantDied') {
            const outcome = combatants[event.data.combatantId];
            if (outcome) {
                outcome.died = true;
                outcome.survived = false;
            }
        }
    }

    return {
        seed,
        winner: engine.outcome ?? 'draw',
        rounds: engine.round,
        terminalReason: engine.terminalReason ?? 'maxRounds',
        combatants,
        sideResources,
    };
}

function resolvedCatalogue(config: EncounterConfig): Required<EncounterCatalogue> {
    return {
        weapons: config.catalogue?.weapons ?? weaponData as Weapon[],
        armor: config.catalogue?.armor ?? armorData as Armor[],
        talents: config.catalogue?.talents ?? talentData as Talent[],
        skills: config.catalogue?.skills ?? skillData as SkillCharDefinition[],
    };
}

function materializeCharacter(
    member: EncounterCombatantConfig,
    skills: SkillCharDefinition[],
    rng: Rng,
    usedNames: string[]
): Character {
    if (!isCharacterTemplate(member.character)) {
        return structuredCloneSafe(member.character);
    }

    const template = member.character;
    const characteristics = Object.fromEntries(Object.entries(template.characteristics).map(([key, value]) => [
        key,
        { initial: rollVariance(value.base, value.variance, rng), advances: 0, talents: 0, modifier: 0 },
    ])) as Character['characteristics'];
    const basicSkills = skills.filter(skill => skill.type === 'skill' && skill.classification === 'basic').map(skill => ({
        id: skill.id,
        name: skill.name,
        characteristic: skill.characteristic,
        advances: 0,
        talents: 0,
        modifier: 0,
    }));
    const characterSkills = [...basicSkills];
    for (const templateSkill of template.skills) {
        const definition = skills.find(skill => skill.id === templateSkill.id);
        if (!definition) continue;
        const advances = rollVariance(templateSkill.advances, templateSkill.advancesVariance ?? 0, rng, 0);
        const existing = characterSkills.find(skill => skill.id === templateSkill.id);
        if (existing) existing.advances = advances;
        else characterSkills.push({
            id: definition.id,
            name: definition.name,
            characteristic: definition.characteristic,
            advances,
            talents: 0,
            modifier: 0,
        });
    }
    const calculatedWounds = Math.floor(characteristics.s.initial / 10)
        + Math.floor(characteristics.t.initial / 10) * 2
        + Math.floor(characteristics.wp.initial / 10);
    const wounds = rollVariance(template.baseWounds ?? calculatedWounds, template.woundsVariance ?? 0, rng, 1);
    const name = uniqueTemplateName(template, member.id, rng, usedNames);
    const equippedWeapons = Object.fromEntries(template.trappings.weapons.map((id, index) => [id, index === 0]));
    const equippedArmor = Object.fromEntries(template.trappings.armor.map(id => [id, true]));

    return {
        id: `${member.id}:character`,
        name,
        species: template.species,
        class: '',
        currentCareerId: template.careerId ?? '',
        currentCareerLevelId: template.careerLevelId ?? '',
        userId: null,
        tags: template.tags ?? [],
        locationId: null,
        xp: { current: 0, spent: 0 },
        careerHistory: [],
        unlockedCharacteristicIds: [],
        unlockedSkillIds: [],
        unlockedTalentIds: [],
        details: {
            age: '', height: '', hair: '', eyes: '', partyName: '',
            shortTermAmbition: '', longTermAmbition: '', partyShortTermAmbition: '', partyLongTermAmbition: '',
        },
        movement: template.movement,
        characteristics,
        skills: characterSkills,
        status: {
            wounds: { current: wounds, max: wounds },
            fate: { current: 0, max: 0 },
            fortune: { current: 0, max: 0 },
            resilience: { current: 0, max: 0 },
            resolve: { current: 0, max: 0 },
            corruption: { current: 0, max: 10 },
        },
        conditions: [],
        talents: Object.fromEntries(template.talents.map(id => [id, 1])),
        inventory: {
            weapons: Object.fromEntries(template.trappings.weapons.map(id => [id, 1])),
            armor: Object.fromEntries(template.trappings.armor.map(id => [id, 1])),
            items: Object.fromEntries(template.trappings.items.map(id => [id, 1])),
            equippedWeapons,
            equippedArmor,
        },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
        isMinion: template.isMinion,
        templateId: template.id,
    };
}

function profileFor(profile: EncounterCombatantConfig['profile']): HeuristicProfile | undefined {
    if (!profile) return undefined;
    if (typeof profile === 'object') return profile.id && Number.isFinite(profile.aggression) ? profile : undefined;
    return heuristicProfiles[profile];
}

function autoPickProfile(combatant: Combatant, state: CombatState): HeuristicProfile {
    const weaponId = combatant.weaponLoadout?.primaryWeaponId;
    const weapon = state.weapons.find(candidate => candidate.id === weaponId);
    const group = weapon?.group.toLowerCase() ?? '';
    if (['bow', 'crossbow', 'blackpowder', 'engineering', 'explosives'].some(value => group.includes(value))) return heuristicProfiles.marksman;
    if (group.includes('throw') || group.includes('pistol') || combatant.character.movement >= 5) return heuristicProfiles.skirmisher;
    if ((combatant.character.talents?.['furious-assault'] ?? 0) > 0 || (combatant.character.talents?.frenzy ?? 0) > 0) return heuristicProfiles.berserker;
    if (weapon?.qualities.some(quality => /fast|defensive|shield/i.test(quality)) || group.includes('fencing')) return heuristicProfiles.duellist;
    return heuristicProfiles.brute;
}

function initialWeaponAmmo(character: Character, weapons: Weapon[]): Record<string, WeaponAmmoState> | undefined {
    const states = Object.keys(character.inventory.weapons).flatMap(weaponId => {
        const weapon = weapons.find(candidate => candidate.id === weaponId);
        if (!weapon) return [];
        const reload = qualityRating(weapon, 'reload');
        const repeater = qualityRating(weapon, 'repeater');
        if (!reload && !repeater) return [];
        return [[weaponId, {
            loaded: true,
            shotsRemaining: repeater,
            reloadProgress: null,
        } satisfies WeaponAmmoState] as const];
    });
    return states.length > 0 ? Object.fromEntries(states) : undefined;
}

function uniqueTemplateName(template: CharacterTemplate, id: string, rng: Rng, usedNames: string[]): string {
    const names = template.nameList?.length ? template.nameList : [template.name];
    const base = names[Math.floor(rng.next() * names.length)] ?? template.name;
    if (!usedNames.includes(base)) return base;
    return `${base} ${id}`;
}

function rollVariance(base: number, variance: number, rng: Rng, minimum = 1): number {
    if (variance <= 0) return Math.max(minimum, base);
    const offset = Math.floor(rng.next() * (variance * 2 + 1)) - variance;
    return Math.max(minimum, base + offset);
}

function firstEquippedWeaponId(character: Character): string | undefined {
    return Object.entries(character.inventory.equippedWeapons ?? {}).find(([, equipped]) => equipped)?.[0];
}

function normalizeCover(cover: EncounterCombatantConfig['cover']): CoverLevel | undefined {
    if (cover === true) return 'medium';
    if (!cover) return undefined;
    return cover;
}

function defaultPosition(side: SideId, index: number): number {
    return side === 'ally' ? index : 10 + index;
}

function combatantsOnSideIndex(side: EncounterCombatantConfig[], member: EncounterCombatantConfig): number {
    return Math.max(0, side.indexOf(member));
}

function emptySideTotals(): FightSideResourceTotals {
    return { fateSpent: 0, fortuneSpent: 0, advantageGenerated: 0, advantageSpent: 0 };
}

function isCharacterTemplate(value: Character | CharacterTemplate): value is CharacterTemplate {
    return 'trappings' in value && 'category' in value;
}

function structuredCloneSafe<T>(value: T): T {
    return typeof structuredClone === 'function'
        ? structuredClone(value)
        : JSON.parse(JSON.stringify(value));
}
