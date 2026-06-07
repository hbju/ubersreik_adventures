import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FightLabStore } from '../../src/fight-lab/types';

export function fightLabFilePath(userDataPath: string): string {
    return path.join(userDataPath, 'fight-lab.json');
}

export function loadFightLabStoreAt(filePath: string): FightLabStore {
    if (!fs.existsSync(filePath)) {
        return { version: 1, scenarios: [] };
    }
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Partial<FightLabStore>;
    return {
        version: 1,
        scenarios: Array.isArray(parsed.scenarios) ? parsed.scenarios : [],
        selectedScenarioId: parsed.selectedScenarioId,
    };
}

export function saveFightLabStoreAt(filePath: string, store: FightLabStore): FightLabStore {
    const snapshot: FightLabStore = JSON.parse(JSON.stringify({
        version: 1,
        scenarios: store.scenarios,
        selectedScenarioId: store.selectedScenarioId,
    }));
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
    return snapshot;
}
