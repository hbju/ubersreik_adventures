import { describe, expect, it } from 'vitest';
import type { Character, Weapon } from '@wfrp/shared';
import type {
    BatchResult,
    EncounterConfig,
} from '@wfrp/shared';
import {
    BatchRunnerHandle,
    installBatchWorkerHost,
    type BatchWorkerHostScope,
    type BatchWorkerLike,
    type BatchWorkerRequest,
    type BatchWorkerResponse,
} from '../workers';

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

describe('fight batch worker integration', () => {
    it('streams progress and returns a BatchResult through the worker handle', async () => {
        const bridge = linkedWorker();
        const handle = new BatchRunnerHandle(() => bridge.client);
        const progressCounts: number[] = [];
        const completed = new Promise<BatchResult>((resolve, reject) => {
            handle.onProgress(progress => progressCounts.push(progress.completedCount));
            handle.onComplete(resolve);
            handle.onError(reject);
        });

        handle.start(encounter(), 'worker-seed', 3);
        const result = await completed;

        expect(progressCounts[0]).toBe(0);
        expect(progressCounts.at(-1)).toBe(3);
        expect(result.completedCount).toBe(3);
        expect(result.outcomes).toHaveLength(3);
        expect(result.failures).toEqual([]);
        expect(result.masterSeed).toBe('worker-seed');
    });

    it('delivers a clean partial result after cancellation', async () => {
        const bridge = linkedWorker();
        const handle = new BatchRunnerHandle(() => bridge.client);
        const completed = new Promise<BatchResult>((resolve, reject) => {
            handle.onProgress(progress => {
                if (progress.completedCount >= 2) handle.cancel();
            });
            handle.onComplete(resolve);
            handle.onError(reject);
        });

        handle.start(encounter(), 'worker-cancel', 20);
        const result = await completed;

        expect(result.cancelled).toBe(true);
        expect(result.completedCount).toBeGreaterThanOrEqual(2);
        expect(result.completedCount).toBeLessThan(20);
    });
});

function linkedWorker(): { client: BatchWorkerLike } {
    let terminated = false;
    const scope: BatchWorkerHostScope = {
        onmessage: null,
        postMessage(message: BatchWorkerResponse) {
            queueMicrotask(() => {
                if (!terminated) client.onmessage?.({ data: message });
            });
        },
    };
    const disposeHost = installBatchWorkerHost(scope);
    const client: BatchWorkerLike = {
        onmessage: null,
        onerror: null,
        postMessage(message: BatchWorkerRequest) {
            queueMicrotask(() => {
                if (!terminated) scope.onmessage?.({ data: message });
            });
        },
        terminate() {
            terminated = true;
            disposeHost();
        },
    };
    return { client };
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
