import { describe, expect, it } from 'vitest';
import type { Character, Characteristic } from '../src/types/wfrp.types';
import { createCombatantFromCharacter, createCombatState, resolveMeleeAttack } from '../src/combat/engine';
import { createSeededRng } from '../src/combat/rng';
import { engage } from '../src/combat/spatial';
import {
    grantAdvantage,
    opposingSide,
    reallocateEndOfRound,
    seedInitialAdvantage,
    spendAdvantage,
} from '../src/combat/advantage';

describe('group advantage', () => {
    it('grants opposed combat wins to the winner side pool', () => {
        const state = createState([
            combatant('ally', 'Ally', { side: 'ally', weaponSkill: 55 }),
            combatant('adversary', 'Adversary', { side: 'adversary', weaponSkill: 35 }),
        ]);

        const result = resolveMeleeAttack(state, {
            attackerId: 'ally',
            defenderId: 'adversary',
            attacker: { skillId: 'melee_basic', targetNumber: 55, rollResult: 20, weaponDamage: 7 },
            defender: { skillId: 'melee_basic', targetNumber: 35, rollResult: 80 },
        });

        expect(result.events.find(event => event.type === 'AdvantageChanged')).toMatchObject({
            type: 'AdvantageChanged',
            i18nKey: 'combat.advantage.changed',
            data: { side: 'ally', delta: 1, poolBefore: 0, poolAfter: 1, reason: 'opposedTestWin' },
        });
        expect(result.state.advantagePools).toEqual({ ally: 1, adversary: 0 });
        expect(opposingSide('ally')).toBe('adversary');
    });

    it('rejects overspending without changing pools', () => {
        const state = createState([combatant('ally', 'Ally', { side: 'ally' })], { ally: 1, adversary: 0 });

        const result = spendAdvantage(state, 'ally', 'additionalEffort', { amount: 2, pendingTestId: 'test-1' });

        expect(result.events[0]).toMatchObject({
            type: 'AdvantageSpendRejectedEvent',
            i18nKey: 'combat.advantage.spendRejected.insufficientAdvantage',
            data: { side: 'ally', action: 'additionalEffort', cost: 2, available: 1, reason: 'insufficientAdvantage' },
        });
        expect(result.state.advantagePools).toEqual(state.advantagePools);
    });

    it('scales Additional Effort from total Advantage spent', () => {
        const state = createState([combatant('ally', 'Ally', { side: 'ally' })], { ally: 3, adversary: 0 });

        const result = spendAdvantage(state, 'ally', 'additionalEffort', { amount: 3, pendingTestId: 'attack-1', actorId: 'ally' });

        expect(result.events.map(event => event.type)).toEqual(['AdvantageSpentEvent', 'AdvantageModifierPreparedEvent']);
        expect(result.events[1]).toMatchObject({
            type: 'AdvantageModifierPreparedEvent',
            i18nKey: 'combat.advantage.additionalEffort',
            data: { amount: 3, modifier: 20, pendingTestId: 'attack-1', generatesAdvantage: false },
        });
        expect(result.state.advantagePools.ally).toBe(0);
    });

    it('resolves Batter and Trick without passive Advantage generation', () => {
        const batterState = createState([
            combatant('ally', 'Ally', { side: 'ally', strength: 50, agility: 45 }),
            combatant('adversary', 'Adversary', { side: 'adversary', strength: 30, agility: 30 }),
        ], { ally: 2, adversary: 0 });

        const battered = spendAdvantage(batterState, 'ally', 'batter', {
            actorId: 'ally',
            targetId: 'adversary',
            actorRoll: 20,
            targetRoll: 70,
        });

        expect(battered.events.map(event => event.type)).toEqual([
            'AdvantageSpentEvent',
            'ConditionApplied',
            'AdvantageActionResolvedEvent',
            'AdvantageChanged',
        ]);
        expect(battered.events[2]).toMatchObject({ data: { action: 'batter', outcome: 'win', generatesAdvantage: false } });
        expect(battered.state.combatants.adversary.conditions).toContain('condition_prone');
        expect(battered.state.advantagePools.ally).toBe(2);

        const tricked = spendAdvantage(battered.state, 'ally', 'trick', {
            actorId: 'ally',
            targetId: 'adversary',
            actorRoll: 15,
            targetRoll: 80,
            conditionId: 'condition_blinded',
        });

        expect(tricked.events.find(event => event.type === 'AdvantageActionResolvedEvent')).toMatchObject({
            data: { action: 'trick', outcome: 'win', generatesAdvantage: false },
        });
        expect(tricked.state.combatants.adversary.conditions).toContain('condition_blinded');
        expect(tricked.state.advantagePools.ally).toBe(2);
    });

    it('awards the opposing pool when Batter or Trick loses', () => {
        const state = createState([
            combatant('ally', 'Ally', { side: 'ally', strength: 30 }),
            combatant('adversary', 'Adversary', { side: 'adversary', strength: 50 }),
        ], { ally: 1, adversary: 0 });

        const result = spendAdvantage(state, 'ally', 'batter', {
            actorId: 'ally',
            targetId: 'adversary',
            actorRoll: 90,
            targetRoll: 10,
        });

        expect(result.events.find(event => event.type === 'AdvantageActionResolvedEvent')).toMatchObject({
            data: { action: 'batter', outcome: 'loss', generatesAdvantage: false },
        });
        expect(result.state.advantagePools).toEqual({ ally: 0, adversary: 1 });
    });

    it('spends Flee from Harm and Additional Action with validation', () => {
        let state = createState([
            combatant('ally', 'Ally', { side: 'ally' }),
            combatant('adversary', 'Adversary', { side: 'adversary' }),
        ], { ally: 6, adversary: 0 });
        state = engage(state, 'ally', 'adversary').state;

        const fled = spendAdvantage(state, 'ally', 'fleeFromHarm', { actorId: 'ally' });
        expect(fled.state.combatants.ally.engagementIds).toEqual([]);
        expect(fled.state.combatants.adversary.engagementIds).toEqual([]);
        expect(fled.events.find(event => event.type === 'DisengagedEvent')).toMatchObject({ data: { actionSpent: false } });
        expect(fled.state.advantagePools.ally).toBe(4);

        const acted = spendAdvantage(fled.state, 'ally', 'additionalAction', { actorId: 'ally' });
        expect(acted.state.combatants.ally.budget.actions).toBe(2);
        expect(acted.state.turnFlags.additionalActionCombatantIds).toEqual(['ally']);
        expect(acted.state.advantagePools.ally).toBe(0);

        const rejected = spendAdvantage(acted.state, 'ally', 'additionalAction', { actorId: 'ally' });
        expect(rejected.events[0]).toMatchObject({ type: 'AdvantageSpendRejectedEvent', data: { reason: 'insufficientAdvantage' } });
    });

    it('seeds initial Advantage from highest category modifiers including Manticore-style outnumbering', () => {
        let state = createState([
            combatant('salundra', 'Salundra', { side: 'ally' }),
            combatant('gunnar', 'Gunnar', { side: 'ally' }),
            combatant('else', 'Elsa', { side: 'ally' }),
            combatant('manticore', 'Manticore', { side: 'adversary' }),
        ]);
        state = engage(state, 'salundra', 'manticore').state;
        state = engage(state, 'gunnar', 'manticore').state;
        state = engage(state, 'else', 'manticore').state;

        const pools = seedInitialAdvantage({
            state,
            manoeuvrability: { side: 'adversary', value: 2 },
            surprise: { side: 'adversary', value: 1 },
            terrain: { side: 'adversary', value: 1 },
            threat: { side: 'adversary', value: 1 },
        });

        expect(pools).toEqual({ ally: 2, adversary: 5 });
    });

    it('reallocates end-of-round Advantage by living dominance and tie overrides', () => {
        const dominant = createState([
            combatant('a1', 'Ally 1', { side: 'ally' }),
            combatant('a2', 'Ally 2', { side: 'ally' }),
            combatant('e1', 'Enemy 1', { side: 'adversary' }),
        ], { ally: 0, adversary: 2 });

        expect(reallocateEndOfRound(dominant).state.advantagePools).toEqual({ ally: 1, adversary: 1 });
        expect(reallocateEndOfRound({ ...dominant, advantagePools: { ally: 0, adversary: 0 } }).state.advantagePools).toEqual({ ally: 1, adversary: 0 });

        const tie = createState([
            combatant('a1', 'Ally 1', { side: 'ally' }),
            combatant('e1', 'Enemy 1', { side: 'adversary' }),
        ], { ally: 1, adversary: 1 });
        expect(reallocateEndOfRound(tie).state.advantagePools).toEqual({ ally: 1, adversary: 1 });

        const tieOverride = { ...tie, tacticalDominantSide: 'adversary' as const };
        expect(reallocateEndOfRound(tieOverride).state.advantagePools).toEqual({ ally: 0, adversary: 2 });
    });

    it('preserves deterministic Advantage flow with the same seed', () => {
        const run = () => {
            const state = createState([
                combatant('ally', 'Ally', { side: 'ally', strength: 45 }),
                combatant('adversary', 'Adversary', { side: 'adversary', strength: 45 }),
            ], { ally: 1, adversary: 0 });
            return spendAdvantage(state, 'ally', 'batter', { actorId: 'ally', targetId: 'adversary' }, createSeededRng('advantage-flow'));
        };

        expect(run()).toEqual(run());
    });
});

function createState(combatants: ReturnType<typeof createCombatantFromCharacter>[], advantagePools = { ally: 0, adversary: 0 }) {
    return createCombatState(combatants, { advantagePools });
}

function combatant(id: string, name: string, options: CharacterOptions & { side: 'ally' | 'adversary' }) {
    return createCombatantFromCharacter(makeCharacter(id, name, options), { side: options.side });
}

interface CharacterOptions {
    side?: 'ally' | 'adversary';
    weaponSkill?: number;
    strength?: number;
    agility?: number;
}

function makeCharacter(id: string, name: string, options: CharacterOptions = {}): Character {
    return {
        id,
        name,
        species: 'Human',
        class: 'Warrior',
        currentCareerId: 'warrior',
        currentCareerLevelId: 'warrior-1',
        userId: null,
        tags: [],
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
        movement: 4,
        characteristics: {
            ws: characteristic(options.weaponSkill ?? 40),
            bs: characteristic(30),
            s: characteristic(options.strength ?? 40),
            t: characteristic(30),
            i: characteristic(30),
            ag: characteristic(options.agility ?? 40),
            dex: characteristic(30),
            int: characteristic(30),
            wp: characteristic(30),
            fel: characteristic(30),
        },
        skills: [],
        status: {
            wounds: { current: 12, max: 12 },
            fate: { current: 0, max: 0 },
            fortune: { current: 0, max: 0 },
            resilience: { current: 0, max: 0 },
            resolve: { current: 0, max: 0 },
            corruption: { current: 0, max: 0 },
        },
        conditions: [],
        talents: {},
        inventory: { weapons: {}, armor: {}, items: {} },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
    };
}

function characteristic(value: number): Characteristic {
    return { initial: value, advances: 0, talents: 0, modifier: 0 };
}
