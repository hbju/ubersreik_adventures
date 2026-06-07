import { describe, expect, it } from 'vitest';
import type { Character, Weapon } from '../../src/types/wfrp.types';
import {
    deriveFightSeed,
    runBatch,
    type BatchFightRunner,
    type BatchProgress,
    type EncounterConfig,
    type FightOutcome,
} from '../../src/combat';

const sword: Weapon = {
    id: 'sword',
    name: 'Sword',
    group: 'basic',
    price: '1 GC',
    enc: 1,
    reach: 'Average',
    damage: '+SB+4',
    qualities: [],
    availability: 'Common',
};

describe('Epic 6b batch runner', () => {
    it('derives deterministic, distinct seeds directly from index', () => {
        const first = Array.from({ length: 100 }, (_, index) => deriveFightSeed('master', index));
        const second = Array.from({ length: 100 }, (_, index) => deriveFightSeed('master', index));

        expect(first).toEqual(second);
        expect(new Set(first)).toHaveLength(first.length);
        expect(deriveFightSeed('master', 37)).toBe(first[37]);
        expect(() => deriveFightSeed('master', -1)).toThrow(RangeError);
    });

    it('repeats identical outcomes for the same config, seed, and range', async () => {
        const config = encounter();

        const first = await runBatch(config, 'repeat', [0, 5], { progressIntervalMs: 0 });
        const second = await runBatch(config, 'repeat', [0, 5], { progressIntervalMs: 0 });

        expect(first).toEqual(second);
        expect(first.outcomes).toHaveLength(5);
        expect(first.completedCount).toBe(5);
    });

    it('stops cleanly and returns a partial result when cancelled', async () => {
        let fightsRun = 0;
        const result = await runBatch(encounter(), 'cancel', [0, 10], {
            fightRunner: (_config, seed) => {
                fightsRun += 1;
                return fakeOutcome(seed, 'ally');
            },
            isCancelled: () => fightsRun >= 3,
            yieldEvery: 1,
            progressIntervalMs: 0,
        });

        expect(result.cancelled).toBe(true);
        expect(result.completedCount).toBe(3);
        expect(result.outcomes.map(entry => entry.index)).toEqual([0, 1, 2]);
    });

    it('captures a throwing fight and continues with replayable index and seed', async () => {
        const throwingRunner: BatchFightRunner = (_config, seed) => {
            const index = Number(String(seed).split(':').at(-2));
            if (index === 2) throw new Error('deliberate failure');
            return fakeOutcome(seed, index % 2 === 0 ? 'ally' : 'adversary');
        };

        const result = await runBatch(encounter(), 'failure', [0, 5], {
            fightRunner: throwingRunner,
            progressIntervalMs: 0,
        });

        expect(result.completedCount).toBe(5);
        expect(result.outcomes).toHaveLength(4);
        expect(result.failures).toEqual([{
            index: 2,
            seed: deriveFightSeed('failure', 2),
            error: 'deliberate failure',
        }]);
        expect(result.outcomes.map(entry => entry.index)).toEqual([0, 1, 3, 4]);
    });

    it('reports a running win rate matching the final successful tally', async () => {
        const progress: BatchProgress[] = [];
        const result = await runBatch(encounter(), 'rates', [0, 4], {
            fightRunner: (_config, seed) => {
                const index = Number(String(seed).split(':').at(-2));
                return fakeOutcome(seed, index < 2 ? 'ally' : index === 2 ? 'adversary' : 'draw');
            },
            onProgress: update => progress.push(update),
            progressEvery: 1,
            progressIntervalMs: 0,
        });

        expect(progress.at(-1)).toMatchObject({
            completedCount: 4,
            successfulCount: 4,
            failureCount: 0,
            winRates: { ally: 0.5, adversary: 0.25, draw: 0.25 },
        });
        expect(result.outcomes.filter(entry => entry.outcome.winner === 'ally')).toHaveLength(2);
    });

    it('produces identical results when a range is split into worker-pool shards', async () => {
        const runner: BatchFightRunner = (_config, seed) => {
            const index = Number(String(seed).split(':').at(-2));
            return fakeOutcome(seed, index % 3 === 0 ? 'ally' : index % 3 === 1 ? 'adversary' : 'draw');
        };
        const config = encounter();
        const whole = await runBatch(config, 'shards', [0, 12], { fightRunner: runner });
        const left = await runBatch(config, 'shards', [0, 5], { fightRunner: runner });
        const right = await runBatch(config, 'shards', [5, 12], { fightRunner: runner });

        expect([...left.outcomes, ...right.outcomes]).toEqual(whole.outcomes);
        expect([...left.failures, ...right.failures]).toEqual(whole.failures);
        expect(left.completedCount + right.completedCount).toBe(whole.completedCount);
    });
});

function fakeOutcome(seed: number | string, winner: FightOutcome['winner']): FightOutcome {
    return {
        seed,
        winner,
        rounds: 1,
        terminalReason: winner === 'draw' ? 'maxRounds' : 'sideDown',
        combatants: {},
        sideResources: {
            ally: { fateSpent: 0, fortuneSpent: 0, advantageGenerated: 0, advantageSpent: 0 },
            adversary: { fateSpent: 0, fortuneSpent: 0, advantageGenerated: 0, advantageSpent: 0 },
        },
    };
}

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
