import type {
    EncounterConfig,
    HeuristicProfileId,
    MetricReport,
    SideId,
} from '@wfrp/shared';

export interface FightLabBatchParams {
    iterations: number;
    masterSeed: string;
    seedLocked: boolean;
}

export interface FightLabLayout {
    sidePositions: Record<SideId, number>;
    offsets: Record<string, number>;
}

export interface FightLabScenario {
    id: string;
    name: string;
    config: EncounterConfig;
    batch: FightLabBatchParams;
    layout: FightLabLayout;
    cachedReport?: MetricReport;
    createdAt: string;
    updatedAt: string;
}

export interface FightLabStore {
    version: 1;
    scenarios: FightLabScenario[];
    selectedScenarioId?: string;
}

export type FightLabProfileSelection = HeuristicProfileId | 'auto';

export const EMPTY_FIGHT_LAB_STORE: FightLabStore = {
    version: 1,
    scenarios: [],
};
