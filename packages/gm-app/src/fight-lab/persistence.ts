import { deepClone } from './model';
import {
    EMPTY_FIGHT_LAB_STORE,
    type FightLabStore,
} from './types';

const FALLBACK_STORAGE_KEY = 'wfrp-fight-lab';

export async function loadFightLabStore(): Promise<FightLabStore> {
    if (window.ipcRenderer?.getFightLabStore) {
        return window.ipcRenderer.getFightLabStore();
    }
    const raw = window.localStorage.getItem(FALLBACK_STORAGE_KEY);
    return raw ? JSON.parse(raw) as FightLabStore : deepClone(EMPTY_FIGHT_LAB_STORE);
}

export async function saveFightLabStore(store: FightLabStore): Promise<void> {
    if (window.ipcRenderer?.saveFightLabStore) {
        await window.ipcRenderer.saveFightLabStore(store);
        return;
    }
    window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(store));
}
