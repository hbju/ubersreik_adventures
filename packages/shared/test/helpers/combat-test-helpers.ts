import { expect } from 'vitest';
import type { CombatEvent } from '../../src/combat/types';

export function assertEventsUseI18nKeys(events: CombatEvent[]): void {
    for (const event of events) {
        expect(event.i18nKey).toBeTruthy();
        expect(event.i18nKey).toMatch(/^combat\./);
        expect((event as CombatEvent & { message?: string }).message).toBeUndefined();
    }
}

export function snapshotEvents(events: CombatEvent[]): unknown[] {
    return events.map(event => ({ type: event.type, i18nKey: event.i18nKey, data: event.data }));
}
