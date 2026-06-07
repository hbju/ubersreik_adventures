import type {
    BatchProgress,
    BatchResult,
    EncounterConfig,
    FightSeed,
    MetricReport,
} from '@wfrp/shared';

export interface BatchWorkerStartMessage {
    type: 'start';
    requestId: string;
    config: EncounterConfig;
    masterSeed: FightSeed;
    iterations: number;
}

export interface BatchWorkerCancelMessage {
    type: 'cancel';
    requestId: string;
}

export type BatchWorkerRequest = BatchWorkerStartMessage | BatchWorkerCancelMessage;

export interface BatchWorkerProgressMessage {
    type: 'progress';
    requestId: string;
    progress: BatchProgress;
}

export interface BatchWorkerCompleteMessage {
    type: 'complete';
    requestId: string;
    payload: BatchWorkerResult;
}

export interface BatchWorkerResult {
    result: BatchResult;
    report: MetricReport;
}

export interface BatchWorkerErrorMessage {
    type: 'error';
    requestId: string;
    error: string;
}

export type BatchWorkerResponse =
    | BatchWorkerProgressMessage
    | BatchWorkerCompleteMessage
    | BatchWorkerErrorMessage;
