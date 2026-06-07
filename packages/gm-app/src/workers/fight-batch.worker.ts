import { installBatchWorkerHost, type BatchWorkerHostScope } from './fight-batch.host';

declare const self: BatchWorkerHostScope;

installBatchWorkerHost(self);

