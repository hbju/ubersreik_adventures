import type {
    BatchProgress,
    BatchResult,
    MetricReport,
    WorkerTask,
    WorkerTaskProgress,
} from '@wfrp/shared/combat';

export interface PoolWorkerExecuteMessage<TTask extends WorkerTask = WorkerTask> {
    type: 'execute';
    runId: string;
    task: TTask;
}

export interface PoolWorkerCancelMessage {
    type: 'cancel';
    runId: string;
    taskId?: string;
}

export type PoolWorkerRequest<TTask extends WorkerTask = WorkerTask> =
    | PoolWorkerExecuteMessage<TTask>
    | PoolWorkerCancelMessage;

export interface PoolWorkerProgressMessage<TProgress = unknown> {
    type: 'progress';
    runId: string;
    progress: WorkerTaskProgress<TProgress>;
}

export interface PoolWorkerCompleteMessage<TResult = unknown> {
    type: 'complete';
    runId: string;
    taskId: string;
    result: TResult;
}

export interface PoolWorkerErrorMessage {
    type: 'error';
    runId: string;
    taskId: string;
    error: string;
}

export type PoolWorkerResponse<TResult = unknown, TProgress = unknown> =
    | PoolWorkerProgressMessage<TProgress>
    | PoolWorkerCompleteMessage<TResult>
    | PoolWorkerErrorMessage;

export interface BatchWorkerResult {
    result: BatchResult;
    report: MetricReport;
}

export type BatchPoolProgress = BatchProgress;

// Compatibility aliases for callers that provide worker-like test doubles.
export type BatchWorkerRequest = PoolWorkerRequest;
export type BatchWorkerResponse = PoolWorkerResponse;
