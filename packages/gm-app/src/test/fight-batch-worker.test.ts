import { describe, expect, it } from 'vitest';
import type { Character, Weapon } from '@wfrp/shared';
import {
    deriveFightSeed,
    runBatch,
    type BatchFightRunner,
    type BatchProgress,
    type BatchRangeTask,
    type EncounterConfig,
    type FightOutcome,
    type WorkerTask,
} from '@wfrp/shared/combat';
import {
    BatchRunnerHandle,
    WorkerPool,
    installBatchWorkerHost,
    type BatchWorkerFactory,
    type BatchWorkerHostScope,
    type BatchWorkerLike,
    type PoolWorkerLike,
    type PoolWorkerRequest,
    type PoolWorkerResponse,
    type WorkerBatchRunner,
} from '../workers';

const sword: Weapon = {
    id: 'sword', name: 'Sword', group: 'basic', price: '1 GC', enc: 1,
    reach: 'Average', damage: '+SB+4', qualities: [], availability: 'Common',
};

describe('worker pool batch integration', () => {
    it('returns byte-identical results for one worker and many workers with reversed completion order', async () => {
        const config = encounter();
        const single = await runHandle(config, 'determinism', 12, linkedWorkerFactory(), 1, 3);
        const parallel = await runHandle(
            config,
            'determinism',
            12,
            linkedWorkerFactory(undefined, task => 20 - task.payload.range[0]),
            4,
            3
        );

        expect(JSON.stringify(parallel.result)).toBe(JSON.stringify(single.result));
        expect(JSON.stringify(parallel.report)).toBe(JSON.stringify(single.report));
    });

    it('aggregates progress across workers', async () => {
        const progressCounts: number[] = [];
        await runHandle(
            encounter(),
            'progress',
            8,
            linkedWorkerFactory(),
            3,
            2,
            progress => progressCounts.push(progress.completedCount)
        );

        expect(progressCounts[0]).toBe(0);
        expect(progressCounts.at(-1)).toBe(8);
        expect(progressCounts.every((count, index) =>
            index === 0 || count >= progressCounts[index - 1]
        )).toBe(true);
    });

    it('cancels every active worker and returns a clean partial result', async () => {
        const handle = new BatchRunnerHandle(linkedWorkerFactory(), {
            workerCount: 3,
            chunkSize: 10,
        });
        const completed = new Promise<Awaited<ReturnType<typeof runHandle>>>((resolve, reject) => {
            handle.onProgress(progress => {
                if (progress.completedCount >= 3) handle.cancel();
            });
            handle.onComplete(resolve);
            handle.onError(reject);
        });

        handle.start(encounter(), 'worker-cancel', 60);
        const payload = await completed;

        expect(payload.result.cancelled).toBe(true);
        expect(payload.result.completedCount).toBeGreaterThanOrEqual(3);
        expect(payload.result.completedCount).toBeLessThan(60);
        expect(payload.result.outcomes).toHaveLength(payload.result.completedCount);
        handle.dispose();
    });

    it('captures a fight failure inside one worker and continues the batch', async () => {
        const throwingRunner: BatchFightRunner = (_config, seed) => {
            const index = Number(String(seed).split(':').at(-2));
            if (index === 5) throw new Error('worker fight failed');
            return fakeOutcome(seed, index % 2 === 0 ? 'ally' : 'adversary');
        };
        const batchRunner: WorkerBatchRunner = (config, seed, range, options) =>
            runBatch(config, seed, range, { ...options, fightRunner: throwingRunner });
        const payload = await runHandle(
            encounter(),
            'failure',
            10,
            linkedWorkerFactory(batchRunner),
            3,
            2
        );

        expect(payload.result.completedCount).toBe(10);
        expect(payload.result.outcomes).toHaveLength(9);
        expect(payload.result.failures).toEqual([{
            index: 5,
            seed: deriveFightSeed('failure', 5),
            error: 'worker fight failed',
        }]);
    });

    it('reuses lazy workers across runs', async () => {
        let workersCreated = 0;
        const baseFactory = linkedWorkerFactory();
        const factory: BatchWorkerFactory = () => {
            workersCreated += 1;
            return baseFactory();
        };
        const handle = new BatchRunnerHandle(factory, { workerCount: 2, chunkSize: 1 });

        await startHandle(handle, encounter(), 'first', 4);
        await startHandle(handle, encounter(), 'second', 4);

        expect(workersCreated).toBe(2);
        handle.dispose();
    });
});

describe('generic worker task interface', () => {
    it('accepts a second rollout-shaped task type unchanged', async () => {
        type MockTask =
            | WorkerTask<'batch-mock', { value: number }>
            | WorkerTask<'mcts-rollouts', { state: string; rollouts: number }>;
        type MockResult = { taskId: string; value: string };
        const pool = new WorkerPool<MockTask, MockResult>(
            mockWorkerFactory(task => ({
                taskId: task.id,
                value: task.type === 'batch-mock'
                    ? String(task.payload.value)
                    : `${task.payload.state}:${task.payload.rollouts}:${String(task.seed)}`,
            })),
            2
        );

        const result = await pool.run([
            { id: 'batch', type: 'batch-mock', seed: 's1', totalCount: 1, payload: { value: 7 } },
            {
                id: 'mcts',
                type: 'mcts-rollouts',
                seed: 'deterministic-rollout-seed',
                totalCount: 4,
                payload: { state: 'S', rollouts: 4 },
            },
        ]);

        expect(result.results).toEqual(expect.arrayContaining([
            { taskId: 'batch', value: '7' },
            { taskId: 'mcts', value: 'S:4:deterministic-rollout-seed' },
        ]));
        pool.dispose();
    });

    it('dispatches queued work concurrently', async () => {
        type DelayTask = WorkerTask<'delay', { delayMs: number }>;
        const tasks: DelayTask[] = Array.from({ length: 4 }, (_, index) => ({
            id: String(index),
            type: 'delay',
            seed: `seed-${index}`,
            totalCount: 1,
            payload: { delayMs: 25 },
        }));
        const factory = mockWorkerFactory(async task => {
            await new Promise(resolve => setTimeout(resolve, task.payload.delayMs));
            return task.id;
        });
        const single = new WorkerPool<DelayTask, string>(factory, 1);
        const parallel = new WorkerPool<DelayTask, string>(factory, 4);

        const singleStart = performance.now();
        await single.run(tasks);
        const singleElapsed = performance.now() - singleStart;
        const parallelStart = performance.now();
        await parallel.run(tasks);
        const parallelElapsed = performance.now() - parallelStart;

        expect(parallelElapsed).toBeLessThan(singleElapsed * 0.7);
        single.dispose();
        parallel.dispose();
    });
});

type HandleResult = Parameters<Parameters<BatchRunnerHandle['onComplete']>[0]>[0];

function runHandle(
    config: EncounterConfig,
    seed: string,
    iterations: number,
    factory: BatchWorkerFactory,
    workerCount: number,
    chunkSize: number,
    onProgress?: (progress: BatchProgress) => void
): Promise<HandleResult> {
    const handle = new BatchRunnerHandle(factory, { workerCount, chunkSize });
    return new Promise((resolve, reject) => {
        if (onProgress) handle.onProgress(onProgress);
        handle.onComplete(payload => {
            resolve(payload);
            handle.dispose();
        });
        handle.onError(reject);
        handle.start(config, seed, iterations);
    });
}

function startHandle(
    handle: BatchRunnerHandle,
    config: EncounterConfig,
    seed: string,
    iterations: number
): Promise<void> {
    return new Promise((resolve, reject) => {
        const offComplete = handle.onComplete(() => {
            offComplete();
            offError();
            resolve();
        });
        const offError = handle.onError(error => {
            offComplete();
            offError();
            reject(error);
        });
        handle.start(config, seed, iterations);
    });
}

function linkedWorkerFactory(
    batchRunner?: WorkerBatchRunner,
    responseDelay: (task: BatchRangeTask) => number = () => 0
): BatchWorkerFactory {
    return () => {
        let terminated = false;
        let activeTask: BatchRangeTask | undefined;
        const scope: BatchWorkerHostScope = {
            onmessage: null,
            postMessage(message) {
                setTimeout(() => {
                    if (!terminated) client.onmessage?.({ data: message });
                }, activeTask ? responseDelay(activeTask) : 0);
            },
        };
        const disposeHost = installBatchWorkerHost(scope, batchRunner);
        const client: BatchWorkerLike = {
            onmessage: null,
            onerror: null,
            postMessage(message) {
                if (message.type === 'execute') activeTask = message.task;
                queueMicrotask(() => {
                    if (!terminated) scope.onmessage?.({ data: message });
                });
            },
            terminate() {
                terminated = true;
                disposeHost();
            },
        };
        return client;
    };
}

function mockWorkerFactory<TTask extends WorkerTask, TResult>(
    execute: (task: TTask) => TResult | Promise<TResult>
): () => PoolWorkerLike<TTask, TResult> {
    return () => {
        let terminated = false;
        const worker: PoolWorkerLike<TTask, TResult> = {
            onmessage: null,
            onerror: null,
            postMessage(message: PoolWorkerRequest<TTask>) {
                if (message.type !== 'execute') return;
                void Promise.resolve(execute(message.task)).then(result => {
                    const response: PoolWorkerResponse<TResult> = {
                        type: 'complete',
                        runId: message.runId,
                        taskId: message.task.id,
                        result,
                    };
                    if (!terminated) worker.onmessage?.({ data: response });
                });
            },
            terminate() {
                terminated = true;
            },
        };
        return worker;
    };
}

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
        id, name: id, species: 'Human', class: 'Warrior', currentCareerId: '',
        currentCareerLevelId: '', userId: null, tags: [], locationId: null,
        xp: { current: 0, spent: 0 }, careerHistory: [], unlockedCharacteristicIds: [],
        unlockedSkillIds: [], unlockedTalentIds: [],
        details: {
            age: '', height: '', hair: '', eyes: '', partyName: '',
            shortTermAmbition: '', longTermAmbition: '',
            partyShortTermAmbition: '', partyLongTermAmbition: '',
        },
        movement: 4,
        characteristics: {
            ws: characteristic(45), bs: characteristic(30), s: characteristic(30),
            t: characteristic(30), i: characteristic(30), ag: characteristic(30),
            dex: characteristic(30), int: characteristic(30), wp: characteristic(30),
            fel: characteristic(30),
        },
        skills: [{
            id: 'melee_basic', name: 'Melee (Basic)', characteristic: 'ws',
            advances: 5, talents: 0, modifier: 0,
        }],
        status: {
            wounds: { current: 6, max: 6 }, fate: { current: 0, max: 0 },
            fortune: { current: 0, max: 0 }, resilience: { current: 0, max: 0 },
            resolve: { current: 0, max: 0 }, corruption: { current: 0, max: 0 },
        },
        conditions: [], talents: {},
        inventory: {
            weapons: { sword: 1 }, armor: {}, items: {},
            equippedWeapons: { sword: true }, equippedArmor: {},
        },
        currency: { gc: 0, ss: 0, bp: 0 }, reputations: [],
    };
}
