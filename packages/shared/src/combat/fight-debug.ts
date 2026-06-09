import { runFight, type EncounterConfig, type FightOutcome, type FightSeed } from './fight-runner';

export const FIGHT_ENGINE_VERSION = '1.0.1';

export interface FightDebugExpectedError {
    error: string;
}

export type FightDebugExpectedOutcome = FightOutcome | FightDebugExpectedError;

export interface FightDebugFixture {
    config: EncounterConfig;
    seed: FightSeed;
    index?: number;
    expectedOutcome: FightDebugExpectedOutcome;
    engineVersion: string;
}

export interface FightDebugFixtureInput {
    config: EncounterConfig;
    seed: FightSeed;
    index?: number;
    expectedOutcome: FightDebugExpectedOutcome;
}

export function createFightDebugFixture(input: FightDebugFixtureInput): FightDebugFixture {
    return cloneFixture({
        ...input,
        engineVersion: FIGHT_ENGINE_VERSION,
    });
}

export function parseFightDebugFixture(json: string): FightDebugFixture {
    const fixture = JSON.parse(json) as Partial<FightDebugFixture>;
    if (!fixture || typeof fixture !== 'object') throw new Error('Fight debug fixture must be an object.');
    if (!fixture.config || typeof fixture.config !== 'object') throw new Error('Fight debug fixture is missing config.');
    if (typeof fixture.seed !== 'string' && typeof fixture.seed !== 'number') {
        throw new Error('Fight debug fixture has an invalid seed.');
    }
    if (!fixture.expectedOutcome || typeof fixture.expectedOutcome !== 'object') {
        throw new Error('Fight debug fixture is missing expectedOutcome.');
    }
    if (typeof fixture.engineVersion !== 'string') {
        throw new Error('Fight debug fixture is missing engineVersion.');
    }
    return fixture as FightDebugFixture;
}

export function runFightDebugFixture(fixture: FightDebugFixture): FightOutcome | FightDebugExpectedError {
    if (isExpectedError(fixture.expectedOutcome)) {
        try {
            runFight(fixture.config, fixture.seed);
        } catch (cause) {
            const actual = { error: errorMessage(cause) };
            assertSameOutcome(actual, fixture.expectedOutcome);
            return actual;
        }
        throw new Error(`Fight debug drift: expected error "${fixture.expectedOutcome.error}", but the fight completed.`);
    }

    let actual: FightOutcome;
    try {
        actual = runFight(fixture.config, fixture.seed);
    } catch (cause) {
        throw new Error(`Fight debug drift: expected a completed fight, but runFight threw: ${errorMessage(cause)}`);
    }
    assertSameOutcome(actual, fixture.expectedOutcome);
    return actual;
}

export function isExpectedError(outcome: FightDebugExpectedOutcome): outcome is FightDebugExpectedError {
    return 'error' in outcome;
}

function assertSameOutcome(
    actual: FightOutcome | FightDebugExpectedError,
    expected: FightDebugExpectedOutcome
): void {
    if (stableJson(actual) === stableJson(expected)) return;
    throw new Error([
        'Fight debug drift: runFight result does not match expectedOutcome.',
        `Expected: ${JSON.stringify(expected, null, 2)}`,
        `Actual: ${JSON.stringify(actual, null, 2)}`,
    ].join('\n'));
}

function stableJson(value: unknown): string {
    return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(sortKeys);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
        Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, entry]) => [key, sortKeys(entry)])
    );
}

function cloneFixture(fixture: FightDebugFixture): FightDebugFixture {
    return JSON.parse(JSON.stringify(fixture)) as FightDebugFixture;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}
