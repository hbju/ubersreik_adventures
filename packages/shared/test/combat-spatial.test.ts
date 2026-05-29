import { describe, expect, it } from 'vitest';
import type { Character, Characteristic, Weapon } from '../src/types/wfrp.types';
import { createCombatantFromCharacter, createCombatState } from '../src/combat/engine';
import { createSeededRng } from '../src/combat/rng';
import {
    applyMove,
    bandFor,
    canReach,
    disengage,
    distanceBetween,
    engage,
    getWalkRun,
    isInfighting,
    movementAllowanceFromMovement,
    movementToReach,
    outnumberingFor,
    reachOf,
    reachOrder,
} from '../src/combat/spatial';

const axe: Weapon = {
    id: 'weapon_basic_axe',
    name: 'Axe',
    group: 'basic',
    price: '10 S',
    enc: 1,
    reach: 'Average',
    damage: '+SB+4',
    qualities: [],
    availability: 'Common',
};

const spear: Weapon = {
    id: 'weapon_polearm_spear',
    name: 'Spear',
    group: 'polearm',
    price: '1 GC',
    enc: 2,
    reach: 'Very Long',
    damage: '+SB+4',
    qualities: [],
    availability: 'Common',
};

const dagger: Weapon = {
    id: 'weapon_basic_dagger',
    name: 'Dagger',
    group: 'basic',
    price: '16 S',
    enc: 0,
    reach: 'Very Short',
    damage: '+SB+2',
    qualities: [],
    availability: 'Common',
};

describe('combat spatial model', () => {
    it('derives walk and run movement from Movement values', () => {
        expect([3, 4, 5, 6].map(movementAllowanceFromMovement)).toEqual([
            { walk: 6, run: 12 },
            { walk: 8, run: 16 },
            { walk: 10, run: 20 },
            { walk: 12, run: 24 },
        ]);

        const combatant = createCombatantFromCharacter(makeCharacter('runner', 'Runner', { movement: 4 }));
        expect(getWalkRun(combatant)).toEqual({ walk: 8, run: 16 });
        expect(combatant.movementBudget).toEqual({ walk: 8, run: 16, remaining: 16 });
    });

    it('maps distance bands at threshold boundaries', () => {
        expect(bandFor(0)).toBe('Engaged');
        expect(bandFor(1.5)).toBe('Engaged');
        expect(bandFor(1.51)).toBe('Short');
        expect(bandFor(6)).toBe('Short');
        expect(bandFor(6.01)).toBe('Medium');
        expect(bandFor(20)).toBe('Medium');
        expect(bandFor(20.01)).toBe('Long');
    });

    it('answers can-reach with walk versus run budgets', () => {
        const mover = createCombatantFromCharacter(makeCharacter('mover', 'Mover', { movement: 4 }), { position: 0 });
        const walkableTarget = createCombatantFromCharacter(makeCharacter('near', 'Near'), { position: 9.5 });
        const runOnlyTarget = createCombatantFromCharacter(makeCharacter('far', 'Far'), { position: 10 });
        const noActionMover = { ...mover, budget: { ...mover.budget, actions: 0 } };

        expect(distanceBetween(mover, runOnlyTarget)).toBe(10);
        expect(movementToReach(mover, walkableTarget)).toBe(8);
        expect(canReach(mover, walkableTarget)).toBe(true);
        expect(canReach(mover, runOnlyTarget)).toBe(false);
        expect(canReach(mover, runOnlyTarget, { running: true })).toBe(true);
        expect(canReach(noActionMover, runOnlyTarget, { running: true })).toBe(false);
    });

    it('applies walk, run, and charge movement budgets with action spending', () => {
        const walkState = createState([
            combatant('walker', 'Walker', { movement: 4, position: 0 }),
        ]);
        const walked = applyMove(walkState, 'walker', 6, 'walk');

        expect(walked.events[0]).toMatchObject({
            type: 'MovedEvent',
            i18nKey: 'combat.movement.moved',
            data: { from: 0, to: 6, distance: 6, actionSpent: false, remainingMovement: 10 },
        });
        expect(walked.state.combatants.walker.position).toBe(6);
        expect(walked.state.combatants.walker.budget).toMatchObject({ actions: 1, moves: 0 });

        const runState = createState([
            combatant('runner', 'Runner', { movement: 4, position: 0 }),
        ]);
        const ran = applyMove(runState, 'runner', 12, 'run');
        expect(ran.events[0]).toMatchObject({ data: { actionSpent: true, remainingMovement: 4 } });
        expect(ran.state.combatants.runner.budget).toMatchObject({ actions: 0, moves: 0 });

        const chargeState = createState([
            combatant('charger', 'Charger', { movement: 4, position: 0 }),
            combatant('target', 'Target', { position: 10, side: 'adversary' }),
        ]);
        const charged = applyMove(chargeState, 'charger', { combatantId: 'target' }, 'charge');
        expect(charged.events[0]).toMatchObject({
            type: 'MovedEvent',
            data: { to: 8.5, distance: 8.5, actionSpent: true, remainingMovement: 7.5 },
        });
        expect(charged.state.combatants.charger.budget).toMatchObject({ actions: 0, moves: 0 });
    });

    it('keeps engagement symmetric and counts outnumbering in 1-to-N and N-to-N groups', () => {
        const initial = createState([
            combatant('p1', 'Player 1', { side: 'ally', position: 0 }),
            combatant('p2', 'Player 2', { side: 'ally', position: 0.5 }),
            combatant('e1', 'Enemy 1', { side: 'adversary', position: 1 }),
            combatant('e2', 'Enemy 2', { side: 'adversary', position: 1.2 }),
        ]);

        let current = engage(initial, 'p1', 'e1').state;
        current = engage(current, 'p1', 'e2').state;

        expect(current.combatants.p1.engagementIds.sort()).toEqual(['e1', 'e2']);
        expect(current.combatants.e1.engagementIds).toContain('p1');
        expect(current.combatants.e2.engagementIds).toContain('p1');
        expect(outnumberingFor('p1', current)).toBe(2);
        expect(outnumberingFor('e1', current)).toBe(1);

        current = engage(current, 'p2', 'e1').state;
        current = engage(current, 'p2', 'e2').state;

        expect(outnumberingFor('p1', current)).toBe(2);
        expect(outnumberingFor('p2', current)).toBe(2);
        expect(outnumberingFor('e1', current)).toBe(2);
        expect(outnumberingFor('e2', current)).toBe(2);

        const disengaged = disengage(current, 'p1');
        expect(disengaged.events[0]).toMatchObject({
            type: 'DisengagedEvent',
            i18nKey: 'combat.engagement.disengaged',
            data: { combatantId: 'p1', disengagedFromIds: ['e1', 'e2'], actionSpent: true },
        });
        expect(disengaged.state.combatants.p1.engagementIds).toEqual([]);
        expect(disengaged.state.combatants.e1.engagementIds).not.toContain('p1');
        expect(disengaged.state.combatants.e2.engagementIds).not.toContain('p1');
        expect(disengaged.state.combatants.p1.budget.actions).toBe(0);
    });

    it('exposes reach order and in-fighting flags without applying rules effects', () => {
        const spearFighter = combatant('spear', 'Spear Fighter', {
            position: 0,
            weapons: { [spear.id]: 1 },
            equippedWeapons: { [spear.id]: true },
        });
        const daggerFighter = combatant('dagger', 'Dagger Fighter', {
            side: 'adversary',
            position: 1,
            weapons: { [dagger.id]: 1 },
            equippedWeapons: { [dagger.id]: true },
        });
        const axeFighter = combatant('axe', 'Axe Fighter', {
            side: 'adversary',
            position: 10,
            weapons: { [axe.id]: 1 },
            equippedWeapons: { [axe.id]: true },
        });
        const state = createState([spearFighter, daggerFighter, axeFighter], [spear, dagger, axe]);

        expect(reachOf(spearFighter, state.weapons)).toMatchObject({ reach: 'Very Long', rank: 6, weaponId: spear.id });
        expect(reachOrder(state, 'spear', 'dagger')).toMatchObject({
            order: ['spear', 'dagger'],
            firstCombatantId: 'spear',
            tied: false,
        });
        expect(isInfighting(state, 'spear', 'dagger')).toBe(true);
        expect(isInfighting(state, 'spear', 'axe')).toBe(false);
    });

    it('preserves deterministic spatial outcomes for identical seeds', () => {
        const runScenario = () => {
            const initial = createState([
                combatant('p1', 'Player 1', { side: 'ally', position: 0 }),
                combatant('e1', 'Enemy 1', { side: 'adversary', position: 10 }),
            ]);
            const moved = applyMove(initial, 'p1', { combatantId: 'e1' }, 'charge', createSeededRng('spatial-seed'));
            return engage(moved.state, 'p1', 'e1');
        };

        const first = runScenario();
        const second = runScenario();

        expect(second).toEqual(first);
        expect(first.state.combatants.p1.position).toBe(8.5);
        expect(first.state.combatants.p1.engagementIds).toEqual(['e1']);
        expect(first.state.combatants.e1.engagementIds).toEqual(['p1']);
    });
});

function createState(combatants: ReturnType<typeof createCombatantFromCharacter>[], weapons: Weapon[] = []) {
    return createCombatState(combatants, { weapons });
}

function combatant(id: string, name: string, options: CharacterOptions & { position?: number; side?: 'ally' | 'adversary' } = {}) {
    return createCombatantFromCharacter(makeCharacter(id, name, options), {
        position: options.position ?? 0,
        side: options.side ?? 'ally',
    });
}

interface CharacterOptions {
    movement?: number;
    weapons?: Record<string, number>;
    equippedWeapons?: Record<string, boolean>;
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
        movement: options.movement ?? 4,
        characteristics: {
            ws: characteristic(40),
            bs: characteristic(30),
            s: characteristic(40),
            t: characteristic(30),
            i: characteristic(30),
            ag: characteristic(30),
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
        inventory: {
            weapons: options.weapons ?? {},
            armor: {},
            items: {},
            equippedWeapons: options.equippedWeapons ?? {},
        },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
    };
}

function characteristic(value: number): Characteristic {
    return { initial: value, advances: 0, talents: 0, modifier: 0 };
}
