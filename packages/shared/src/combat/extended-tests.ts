import type { ExtendedTestProgress } from './types';

export interface ExtendedTestInput {
    progress: ExtendedTestProgress | null;
    targetSL: number;
    successLevel: number;
    reset?: boolean;
}

export interface ExtendedTestResult {
    progress: ExtendedTestProgress | null;
    accumulatedSL: number;
    completed: boolean;
}

export function resolveExtendedTest(input: ExtendedTestInput): ExtendedTestResult {
    const starting = input.reset ? 0 : input.progress?.accumulatedSL ?? 0;
    const accumulatedSL = Math.max(0, starting + Math.max(0, Math.round(input.successLevel)));
    const completed = accumulatedSL >= input.targetSL;
    return {
        accumulatedSL,
        completed,
        progress: completed ? null : { accumulatedSL, targetSL: input.targetSL },
    };
}

export function resetExtendedTest(targetSL: number): ExtendedTestProgress {
    return { accumulatedSL: 0, targetSL };
}
