import { describe, expect, it } from 'vitest';
import type { Character, Weapon } from '../../src/types/wfrp.types';
import {
    createFightDebugFixture,
    parseFightDebugFixture,
    runFight,
    runFightDebugFixture,
    type EncounterConfig,
} from '../../src/combat';

describe('fight debug export', () => {
    it('round-trips JSON and reproduces the exact runFight outcome', () => {
        const config = encounter();
        const seed = 'exported-fight';
        const expectedOutcome = runFight(config, seed);
        const exported = createFightDebugFixture({
            config,
            seed,
            index: 7,
            expectedOutcome,
        });

        const loaded = parseFightDebugFixture(JSON.stringify(exported));

        expect(loaded).toEqual(exported);
        expect(runFightDebugFixture(loaded)).toEqual(expectedOutcome);
        expect(loaded.config).not.toBe(config);
    });

    it('retains failing-seed index and error context', () => {
        const invalid = encounter();
        invalid.sides.adversary = [];
        const error = captureError(() => runFight(invalid, 'failing-seed'));
        const exported = createFightDebugFixture({
            config: invalid,
            seed: 'failing-seed',
            index: 12,
            expectedOutcome: { error },
        });

        const loaded = parseFightDebugFixture(JSON.stringify(exported));

        expect(loaded).toMatchObject({
            seed: 'failing-seed',
            index: 12,
            expectedOutcome: { error },
        });
        expect(runFightDebugFixture(loaded)).toEqual({ error });
    });

    it('surfaces deterministic outcome drift', () => {
        const config = encounter();
        const fixture = createFightDebugFixture({
            config,
            seed: 'drift',
            expectedOutcome: {
                ...runFight(config, 'drift'),
                rounds: 999,
            },
        });

        expect(() => runFightDebugFixture(fixture)).toThrow('Fight debug drift');
    });
});

const sword: Weapon = {
    id: 'sword',
    name: 'Sword',
    group: 'basic',
    encumbrance: 1,
    availability: 'Common',
    cost: { gc: 1, ss: 0, bp: 0 },
    reach: 'average',
    damage: '+SB+4',
    qualities: [],
    flaws: [],
};

function encounter(): EncounterConfig {
    return {
        sides: {
            ally: [{ id: 'ally', character: character('ally'), position: 0 }],
            adversary: [{ id: 'enemy', character: character('enemy'), position: 1 }],
        },
        catalogue: { weapons: [sword], armor: [], talents: [] },
        toggles: { maxRounds: 2 },
    };
}

function character(id: string): Character {
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
        xp: { current: 0, spent: 0 },
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
            ws: characteristic(45), bs: characteristic(30), s: characteristic(30), t: characteristic(30),
            i: characteristic(30), ag: characteristic(30), dex: characteristic(30), int: characteristic(30),
            wp: characteristic(30), fel: characteristic(30),
        },
        skills: [{ id: 'melee_basic', name: 'Melee (Basic)', characteristic: 'ws', advances: 5, talents: 0, modifier: 0 }],
        status: {
            wounds: { current: 6, max: 6 },
            fate: { current: 0, max: 0 },
            fortune: { current: 0, max: 0 },
            resilience: { current: 0, max: 0 },
            resolve: { current: 0, max: 0 },
            corruption: { current: 0, max: 0 },
        },
        conditions: [],
        talents: {},
        inventory: {
            weapons: { sword: 1 },
            armor: {},
            items: {},
            equippedWeapons: { sword: true },
            equippedArmor: {},
        },
        currency: { gc: 0, ss: 0, bp: 0 },
        reputations: [],
    };
}

function captureError(action: () => unknown): string {
    try {
        action();
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
    throw new Error('Expected action to throw.');
}
