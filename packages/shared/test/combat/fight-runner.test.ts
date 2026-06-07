import { describe, expect, it } from 'vitest';
import type { Character, CharacterTemplate, Weapon } from '../../src/types/wfrp.types';
import {
    EncounterConfigValidationError,
    replayFight,
    runFight,
    validateEncounterConfig,
    type CombatantController,
    type DecisionContext,
    type EncounterConfig,
    type FightControllerFactory,
} from '../../src/combat';

const sword = weapon('sword', 'basic', '+SB+4', []);
const bow = weapon('bow', 'bow', '+8', []);

describe('Epic 6a fight runner', () => {
    it('returns the same compact outcome for the same config and seed', () => {
        const config = duelConfig();

        const first = runFight(config, 'repeatable-fight');
        const second = runFight(config, 'repeatable-fight');

        expect(first).toEqual(second);
        expect(first.winner).toMatch(/ally|adversary|draw/);
        expect(first.rounds).toBeGreaterThan(0);
    });

    it('regenerates an identical complete replay and matching outcome', () => {
        const config = duelConfig();

        const outcome = runFight(config, 'replay-seed');
        const first = replayFight(config, 'replay-seed');
        const second = replayFight(config, 'replay-seed');

        expect(first.outcome).toEqual(outcome);
        expect(first).toEqual(second);
        expect(first.events[0]?.type).toBe('CombatStarted');
        expect(first.events.some(event => event.type === 'RoundStarted')).toBe(true);
        expect(first.events.at(-1)?.type).toBe('CombatEnded');
    });

    it('reduces a hand-checked scripted fight into compact combatant metrics', () => {
        const config = duelConfig({ enemyWounds: 3, positions: [0, 1] });
        const outcome = runFight(config, 'scripted-summary', {
            controllerFactory: fixedAttackFactory,
        });

        expect(outcome.winner).toBe('ally');
        expect(outcome.rounds).toBe(1);
        expect(outcome.combatants.enemy.finalWounds).toBe(0);
        expect(outcome.combatants.ally.finalWounds).toBe(12);
        expect(outcome.combatants.ally.advantageGenerated).toBeGreaterThanOrEqual(1);
        expect(outcome.sideResources.ally.advantageGenerated).toBe(outcome.combatants.ally.advantageGenerated);
        expect(outcome.combatants.ally.critsDealt).toBe(1);
        expect(outcome.combatants.enemy.critsTaken).toBe(1);
    });

    it('supports controller injection without changing the runner primitive', () => {
        const created: string[] = [];
        const factory: FightControllerFactory = context => {
            created.push(`${context.combatant.id}:${context.profile.id}`);
            return fixedController;
        };

        const outcome = runFight(duelConfig({ enemyWounds: 3, positions: [0, 1] }), 42, {
            controllerFactory: factory,
        });

        expect(created).toEqual(expect.arrayContaining(['ally:brute', 'enemy:brute']));
        expect(outcome.winner).toBe('ally');
    });

    it('validates sides, profiles, builds, and encounter toggles with clear errors', () => {
        const invalid: EncounterConfig = {
            sides: {
                ally: [{
                    id: 'broken',
                    character: character('broken', ['missing-weapon']),
                    profile: 'not-a-profile' as any,
                }],
                adversary: [],
            },
            catalogue: { weapons: [sword], armor: [], talents: [] },
            toggles: { maxRounds: 0 },
        };

        const validation = validateEncounterConfig(invalid);

        expect(validation.valid).toBe(false);
        expect(validation.errors).toEqual(expect.arrayContaining([
            'combat.encounter.validation.emptySide:adversary',
            'combat.encounter.validation.unknownProfile:broken',
            'combat.encounter.validation.unknownWeapon:broken:missing-weapon',
            'combat.encounter.validation.invalidMaxRounds',
        ]));
        expect(() => runFight(invalid, 'invalid')).toThrow(EncounterConfigValidationError);
    });

    it('materializes CharacterTemplates deterministically from the fight seed', () => {
        const template: CharacterTemplate = {
            id: 'template-fighter',
            name: 'Template Fighter',
            category: 'Human',
            species: 'Human',
            movement: 4,
            characteristics: {
                ws: { base: 45, variance: 5 },
                bs: { base: 30, variance: 5 },
                s: { base: 35, variance: 5 },
                t: { base: 35, variance: 5 },
                i: { base: 30, variance: 5 },
                ag: { base: 30, variance: 5 },
                dex: { base: 30, variance: 5 },
                int: { base: 30, variance: 5 },
                wp: { base: 30, variance: 5 },
                fel: { base: 30, variance: 5 },
            },
            skills: [{ id: 'melee', advances: 5, advancesVariance: 2 }],
            talents: [],
            trappings: { weapons: ['sword'], armor: [], items: [] },
            woundsVariance: 2,
            isMinion: true,
        };
        const config: EncounterConfig = {
            sides: {
                ally: [{ id: 'template-ally', character: template, position: 0 }],
                adversary: [{ id: 'enemy', character: character('enemy', ['sword']), position: 1 }],
            },
            catalogue: { weapons: [sword], armor: [], talents: [] },
            toggles: { maxRounds: 2 },
        };

        expect(replayFight(config, 'template-seed')).toEqual(replayFight(config, 'template-seed'));
    });

    it.each([
        ['1v1', duelConfig()],
        ['3v2', groupConfig()],
        ['ranged-vs-melee', rangedConfig()],
    ])('runs representative %s encounters to a valid terminal outcome', (_name, config) => {
        const outcome = runFight(config, `representative:${_name}`);

        expect(outcome.winner).toMatch(/ally|adversary|draw/);
        expect(outcome.terminalReason).toMatch(/sideDown|maxRounds/);
        expect(outcome.rounds).toBeLessThanOrEqual(config.toggles?.maxRounds ?? 50);
        expect(Object.keys(outcome.combatants)).toHaveLength(
            config.sides.ally.length + config.sides.adversary.length
        );
    });
});

const fixedController: CombatantController = {
    choose(context: DecisionContext) {
        if (context.level === 'resolution') {
            return context.legalDecisions.find(decision => decision.kind === 'wait');
        }
        if (context.actor.side === 'ally') {
            const attack = context.legalDecisions.find(decision => decision.kind === 'meleeAttack');
            if (attack?.targetId) {
                return {
                    ...attack,
                    action: {
                        attackerId: context.actor.id,
                        defenderId: attack.targetId,
                        attacker: {
                            skillId: 'melee_basic',
                            targetNumber: 75,
                            rollResult: 12,
                            weaponId: 'sword',
                        },
                        defender: {
                            skillId: 'melee_basic',
                            targetNumber: 35,
                            rollResult: 95,
                            weaponId: 'sword',
                        },
                    },
                };
            }
        }
        return context.legalDecisions.find(decision => decision.kind === 'endTurn')
            ?? context.legalDecisions[0];
    },
};

const fixedAttackFactory: FightControllerFactory = () => fixedController;

function duelConfig(options: { enemyWounds?: number; positions?: [number, number] } = {}): EncounterConfig {
    return {
        sides: {
            ally: [{
                id: 'ally',
                character: character('ally-character', ['sword']),
                profile: 'brute',
                position: options.positions?.[0] ?? 0,
            }],
            adversary: [{
                id: 'enemy',
                character: character('enemy-character', ['sword'], options.enemyWounds ?? 8),
                profile: 'brute',
                position: options.positions?.[1] ?? 2,
            }],
        },
        initialAdvantage: {
            terrain: { side: 'ally', value: 1 },
        },
        catalogue: { weapons: [sword], armor: [], talents: [] },
        toggles: { maxRounds: 6 },
    };
}

function groupConfig(): EncounterConfig {
    return {
        sides: {
            ally: [0, 1, 2].map(index => ({
                id: `ally-${index}`,
                character: character(`ally-character-${index}`, ['sword'], 8),
                position: index,
            })),
            adversary: [0, 1].map(index => ({
                id: `enemy-${index}`,
                character: character(`enemy-character-${index}`, ['sword'], 8),
                position: 4 + index,
            })),
        },
        catalogue: { weapons: [sword], armor: [], talents: [] },
        toggles: { maxRounds: 5, tacticalDominantSide: 'ally' },
    };
}

function rangedConfig(): EncounterConfig {
    return {
        sides: {
            ally: [{
                id: 'archer',
                character: character('archer-character', ['bow']),
                position: 0,
                cover: 'soft',
            }],
            adversary: [{
                id: 'fighter',
                character: character('fighter-character', ['sword']),
                position: 8,
            }],
        },
        catalogue: { weapons: [sword, bow], armor: [], talents: [] },
        toggles: { maxRounds: 6, shootingIntoMelee: true },
    };
}

function character(id: string, weapons: string[], wounds = 12): Character {
    const characteristic = (initial: number) => ({ initial, advances: 0, talents: 0, modifier: 0 });
    return {
        id,
        name: id,
        species: 'Human',
        class: 'Warrior',
        currentCareerId: '',
        currentCareerLevelId: '',
        userId: null,
        tags: [],
        locationId: null,
        xp: { spent: 0, current: 0 },
        careerHistory: [],
        unlockedCharacteristicIds: [],
        unlockedSkillIds: [],
        unlockedTalentIds: [],
        details: {
            age: '', height: '', hair: '', eyes: '', partyName: '',
            shortTermAmbition: '', longTermAmbition: '', partyShortTermAmbition: '', partyLongTermAmbition: '',
        },
        movement: 4,
        characteristics: {
            ws: characteristic(50),
            bs: characteristic(50),
            s: characteristic(30),
            t: characteristic(30),
            i: characteristic(35),
            ag: characteristic(35),
            dex: characteristic(30),
            int: characteristic(30),
            wp: characteristic(30),
            fel: characteristic(30),
        },
        skills: [
            { id: 'melee_basic', name: 'Melee (Basic)', characteristic: 'ws', advances: 5, talents: 0, modifier: 0 },
            { id: 'ranged_bow', name: 'Ranged (Bow)', characteristic: 'bs', advances: 5, talents: 0, modifier: 0 },
            { id: 'dodge', name: 'Dodge', characteristic: 'ag', advances: 5, talents: 0, modifier: 0 },
        ],
        status: {
            wounds: { current: wounds, max: wounds },
            fate: { current: 0, max: 0 },
            fortune: { current: 0, max: 0 },
            resilience: { current: 0, max: 0 },
            resolve: { current: 0, max: 0 },
            corruption: { current: 0, max: 0 },
        },
        conditions: [],
        talents: {},
        inventory: {
            weapons: Object.fromEntries(weapons.map(id => [id, 1])),
            armor: {},
            items: {},
            equippedWeapons: Object.fromEntries(weapons.map((id, index) => [id, index === 0])),
            equippedArmor: {},
        },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
    };
}

function weapon(id: string, group: string, damage: string, qualities: string[]): Weapon {
    return {
        id,
        name: id,
        group,
        price: '1 GC',
        enc: 1,
        reach: group === 'bow' ? '50' : 'Average',
        damage,
        qualities,
        availability: 'Common',
    };
}
