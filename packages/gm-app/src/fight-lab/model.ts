import {
    createCombatantFromCharacter,
    resolveWeaponUse,
    validateEncounterConfig,
    type Character,
    type CharacterTemplate,
    type EncounterCombatantConfig,
    type EncounterConfig,
    type HeuristicProfileId,
    type SideId,
    type SkillCharDefinition,
    type Weapon,
} from '@wfrp/shared';
import type {
    FightLabCachedReport,
    FightLabLayout,
    FightLabProfileSelection,
    FightLabScenario,
} from './types';

export interface ProficiencyWarning {
    weaponId: string;
    weaponName: string;
    severity: 'warning' | 'error';
    i18nKey: 'fightLab.warning.unskilledWeapon' | 'fightLab.warning.unusableWeapon';
}

export interface EncounterValidationView {
    valid: boolean;
    errors: Array<{ key: string; detail?: string }>;
}

export function createEmptyScenario(name = 'Untitled Encounter'): FightLabScenario {
    const now = new Date().toISOString();
    return {
        id: createId(),
        name,
        config: {
            sides: { ally: [], adversary: [] },
            initialAdvantage: {},
            toggles: {
                suddenDeath: false,
                shootingIntoMelee: false,
                maxRounds: 50,
            },
        },
        batch: {
            iterations: 1000,
            masterSeed: randomSeed(),
            seedLocked: false,
        },
        layout: {
            sidePositions: { ally: 0, adversary: 10 },
            offsets: {},
        },
        createdAt: now,
        updatedAt: now,
    };
}

export function cloneScenario(source: FightLabScenario, name = `${source.name} Copy`): FightLabScenario {
    const now = new Date().toISOString();
    return {
        ...deepClone(source),
        id: createId(),
        name,
        cachedReport: undefined,
        createdAt: now,
        updatedAt: now,
    };
}

export function addCharacterToScenario(
    scenario: FightLabScenario,
    source: Character,
    side: SideId
): FightLabScenario {
    const character = deepClone(source);
    const combatantId = uniqueCombatantId(scenario.config, character.id || character.name);
    character.id = `${combatantId}:sandbox`;
    character.userId = null;
    const primaryWeaponId = firstEquipped(character.inventory.equippedWeapons)
        ?? Object.keys(character.inventory.weapons)[0];
    const secondaryWeaponId = Object.keys(character.inventory.weapons)
        .find(id => id !== primaryWeaponId);
    const offset = scenario.config.sides[side].length * 2;
    const member: EncounterCombatantConfig = {
        id: combatantId,
        character,
        position: scenario.layout.sidePositions[side] + offset,
        cover: 'none',
        primaryWeaponId,
        secondaryWeaponId,
    };

    return {
        ...scenario,
        config: {
            ...scenario.config,
            sides: {
                ...scenario.config.sides,
                [side]: [...scenario.config.sides[side], member],
            },
        },
        layout: {
            ...scenario.layout,
            offsets: { ...scenario.layout.offsets, [combatantId]: offset },
        },
        updatedAt: new Date().toISOString(),
    };
}

export function materializeTemplate(
    template: CharacterTemplate,
    skills: SkillCharDefinition[],
    existingNames: string[]
): Character {
    const characteristics = Object.fromEntries(Object.entries(template.characteristics).map(([key, value]) => [
        key,
        { initial: value.base, advances: 0, talents: 0, modifier: 0 },
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
        const existing = characterSkills.find(skill => skill.id === templateSkill.id);
        if (existing) existing.advances = templateSkill.advances;
        else characterSkills.push({
            id: definition.id,
            name: definition.name,
            characteristic: definition.characteristic,
            advances: templateSkill.advances,
            talents: 0,
            modifier: 0,
        });
    }
    const baseWounds = template.baseWounds
        ?? Math.floor(characteristics.s.initial / 10)
        + Math.floor(characteristics.t.initial / 10) * 2
        + Math.floor(characteristics.wp.initial / 10);
    const name = uniqueName(template.name, existingNames);
    return {
        id: `${template.id}:sandbox-source`,
        name,
        species: template.species,
        class: '',
        currentCareerId: template.careerId ?? '',
        currentCareerLevelId: template.careerLevelId ?? '',
        userId: null,
        tags: [...(template.tags ?? [])],
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
            partyLongTermAmbition: '',
        },
        movement: template.movement,
        characteristics,
        skills: characterSkills,
        status: {
            wounds: { current: baseWounds, max: baseWounds },
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
            equippedWeapons: Object.fromEntries(template.trappings.weapons.map((id, index) => [id, index === 0])),
            equippedArmor: Object.fromEntries(template.trappings.armor.map(id => [id, true])),
            equippedItems: {},
        },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
        isMinion: template.isMinion,
        templateId: template.id,
    };
}

export function updateCombatant(
    scenario: FightLabScenario,
    side: SideId,
    combatantId: string,
    update: Partial<EncounterCombatantConfig>
): FightLabScenario {
    return touchScenario({
        ...scenario,
        config: {
            ...scenario.config,
            sides: {
                ...scenario.config.sides,
                [side]: scenario.config.sides[side].map(member =>
                    member.id === combatantId ? { ...member, ...deepClone(update) } : member
                ),
            },
        },
    });
}

export function removeCombatant(
    scenario: FightLabScenario,
    side: SideId,
    combatantId: string
): FightLabScenario {
    const offsets = { ...scenario.layout.offsets };
    delete offsets[combatantId];
    return touchScenario({
        ...scenario,
        config: {
            ...scenario.config,
            sides: {
                ...scenario.config.sides,
                [side]: scenario.config.sides[side].filter(member => member.id !== combatantId),
            },
        },
        layout: { ...scenario.layout, offsets },
    });
}

export function updateSidePosition(
    scenario: FightLabScenario,
    side: SideId,
    sidePosition: number
): FightLabScenario {
    const layout: FightLabLayout = {
        ...scenario.layout,
        sidePositions: { ...scenario.layout.sidePositions, [side]: sidePosition },
    };
    return touchScenario({
        ...scenario,
        layout,
        config: {
            ...scenario.config,
            sides: {
                ...scenario.config.sides,
                [side]: scenario.config.sides[side].map(member => ({
                    ...member,
                    position: sidePosition + (layout.offsets[member.id] ?? 0),
                })),
            },
        },
    });
}

export function updateCombatantOffset(
    scenario: FightLabScenario,
    side: SideId,
    combatantId: string,
    offset: number
): FightLabScenario {
    const offsets = { ...scenario.layout.offsets, [combatantId]: offset };
    return touchScenario({
        ...scenario,
        layout: { ...scenario.layout, offsets },
        config: {
            ...scenario.config,
            sides: {
                ...scenario.config.sides,
                [side]: scenario.config.sides[side].map(member => member.id === combatantId
                    ? { ...member, position: scenario.layout.sidePositions[side] + offset }
                    : member),
            },
        },
    });
}

export function profileValue(profile: FightLabProfileSelection): HeuristicProfileId | undefined {
    return profile === 'auto' ? undefined : profile;
}

export function proficiencyWarnings(
    member: EncounterCombatantConfig,
    side: SideId,
    weapons: Weapon[]
): ProficiencyWarning[] {
    if (!isCharacter(member.character)) return [];
    const combatant = createCombatantFromCharacter(member.character, { id: member.id, side });
    const weaponIds = [
        member.primaryWeaponId,
        member.secondaryWeaponId,
        ...Object.entries(member.character.inventory.equippedWeapons ?? {})
            .filter(([, equipped]) => equipped)
            .map(([id]) => id),
    ].filter((id, index, all): id is string => !!id && all.indexOf(id) === index);

    return weaponIds.flatMap<ProficiencyWarning>(weaponId => {
        const weapon = weapons.find(candidate => candidate.id === weaponId);
        if (!weapon) return [];
        const use = resolveWeaponUse(combatant, weapon);
        if (!use.usable) {
            return [{
                weaponId,
                weaponName: weapon.name,
                severity: 'error' as const,
                i18nKey: 'fightLab.warning.unusableWeapon' as const,
            }];
        }
        if (!use.qualitiesActive) {
            return [{
                weaponId,
                weaponName: weapon.name,
                severity: 'warning' as const,
                i18nKey: 'fightLab.warning.unskilledWeapon' as const,
            }];
        }
        return [];
    });
}

export function validationView(config: EncounterConfig): EncounterValidationView {
    const result = validateEncounterConfig(config);
    return {
        valid: result.valid,
        errors: result.errors.map((error: string) => {
            const separator = error.indexOf(':');
            return separator < 0
                ? { key: error }
                : { key: error.slice(0, separator), detail: error.slice(separator + 1) };
        }),
    };
}

export function cacheScenarioReport(
    scenario: FightLabScenario,
    cachedReport: Omit<FightLabCachedReport, 'configFingerprint'> & { configFingerprint?: string }
): FightLabScenario {
    return {
        ...scenario,
        cachedReport: deepClone({
            ...cachedReport,
            configFingerprint: cachedReport.configFingerprint ?? configFingerprint(scenario.config),
        }),
        updatedAt: new Date().toISOString(),
    };
}

export function configFingerprint(config: EncounterConfig): string {
    const serialized = stableSerialize(config);
    let hashA = 0x811c9dc5;
    let hashB = 0x9e3779b9;
    for (let index = 0; index < serialized.length; index += 1) {
        const code = serialized.charCodeAt(index);
        hashA = Math.imul(hashA ^ code, 0x01000193);
        hashB = Math.imul(hashB ^ code, 0x85ebca6b);
        hashB ^= hashB >>> 13;
    }
    return `cfg-v1-${(hashA >>> 0).toString(16).padStart(8, '0')}${(hashB >>> 0).toString(16).padStart(8, '0')}`;
}

export function isCachedReportStale(scenario: FightLabScenario): boolean {
    return !!scenario.cachedReport
        && scenario.cachedReport.configFingerprint !== configFingerprint(scenario.config);
}

export function randomSeed(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function deepClone<T>(value: T): T {
    return typeof structuredClone === 'function'
        ? structuredClone(value)
        : JSON.parse(JSON.stringify(value));
}

function touchScenario(scenario: FightLabScenario): FightLabScenario {
    return {
        ...scenario,
        updatedAt: new Date().toISOString(),
    };
}

function stableSerialize(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
    return `{${Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
        .join(',')}}`;
}

function uniqueCombatantId(config: EncounterConfig, preferred: string): string {
    const base = preferred.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'combatant';
    const ids = new Set([...config.sides.ally, ...config.sides.adversary].map(member => member.id));
    if (!ids.has(base)) return base;
    let suffix = 2;
    while (ids.has(`${base}-${suffix}`)) suffix += 1;
    return `${base}-${suffix}`;
}

function uniqueName(base: string, existingNames: string[]): string {
    if (!existingNames.includes(base)) return base;
    let suffix = 2;
    while (existingNames.includes(`${base} ${suffix}`)) suffix += 1;
    return `${base} ${suffix}`;
}

function firstEquipped(equipped?: Record<string, boolean>): string | undefined {
    return Object.entries(equipped ?? {}).find(([, value]) => value)?.[0];
}

function createId(): string {
    return randomSeed();
}

function isCharacter(value: Character | CharacterTemplate): value is Character {
    return 'inventory' in value;
}
