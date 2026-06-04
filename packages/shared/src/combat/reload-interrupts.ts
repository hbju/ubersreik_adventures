import type { CombatEngineResult, CombatEvent, CombatState, Combatant, WeaponAmmoState } from './types';

type EventLike = { type: string; data?: Record<string, unknown>; i18nKey?: string };

export function applyReloadInterruptGuard(result: CombatEngineResult): CombatEngineResult {
    const interrupted = interruptedCombatantIds(result.events);
    if (interrupted.size === 0) return result;

    let state = result.state;
    const events = [...result.events];
    const resetKeys = new Set<string>();

    for (const combatantId of interrupted) {
        const combatant = state.combatants[combatantId];
        if (!combatant) continue;

        for (const [weaponId, ammo] of Object.entries(combatant.weaponAmmo || {})) {
            if (!ammo.reloadProgress) continue;
            const key = `${combatantId}:${weaponId}`;
            if (resetKeys.has(key)) continue;

            const interruptedReload = interruptReload(state, combatantId, weaponId);
            state = interruptedReload.state;
            events.push(...interruptedReload.events);
            resetKeys.add(key);
        }
    }

    return { state, events };
}

export function applyReloadInterruptGuardToCombatant<TCombatant extends object>(
    combatant: TCombatant,
    events: EventLike[]
): { combatant: TCombatant; events: EventLike[] } {
    if (!events.some(isSubjectConditionInterrupt)) return { combatant, events };

    let weaponAmmo = (combatant as { weaponAmmo?: Combatant['weaponAmmo'] }).weaponAmmo;
    const interruptEvents: EventLike[] = [];
    for (const [weaponId, ammo] of Object.entries(weaponAmmo || {})) {
        if (!ammo.reloadProgress) continue;
        const interrupted = interruptedAmmoState(ammo);
        weaponAmmo = { ...(weaponAmmo || {}), [weaponId]: interrupted };
        interruptEvents.push(ammoStateEvent(String((combatant as { id?: string }).id ?? ''), weaponId, interrupted, 'interrupted'));
    }

    if (interruptEvents.length === 0) return { combatant, events };
    return {
        combatant: { ...combatant, weaponAmmo } as TCombatant,
        events: [...events, ...interruptEvents],
    };
}

function interruptedCombatantIds(events: CombatEvent[]): Set<string> {
    const ids = new Set<string>();

    for (const event of events) {
        if (isReloadContinuation(event)) continue;

        if (event.type === 'AttackResolved' && event.data.collapsed === 'none' && event.data.defenderRoll.rollResult !== 0) {
            ids.add(event.data.defenderId);
        } else if (event.type === 'DamageDealt') {
            ids.add(event.data.defenderId);
        } else if (event.type === 'MovedEvent') {
            ids.add(event.data.combatantId);
        } else if (event.type === 'CombatActionResolved' && event.data.kind !== 'reload') {
            ids.add(event.data.actorId);
        } else if (event.type === 'ConditionApplied') {
            ids.add(event.data.targetId);
        } else if (event.type === 'QualityEffectApplied' && event.data.effect === 'push' && event.data.targetId) {
            ids.add(event.data.targetId);
        } else if (event.type === 'TalentEffectApplied' && event.data.effect === 'push' && event.data.targetId) {
            ids.add(event.data.targetId);
        } else if (event.type === 'AmmoStateChanged' && event.data.reason === 'interrupted') {
            const combatantId = event.data.combatantId;
            if (typeof combatantId === 'string') ids.delete(combatantId);
        }
    }

    return ids;
}

function isReloadContinuation(event: EventLike): boolean {
    if (event.type === 'ReloadTestResolved') return true;
    if (event.type !== 'AmmoStateChanged') return false;
    const reason = event.data?.reason;
    return reason === 'reloadStarted' || reason === 'reloadProgress' || reason === 'reloaded';
}

function isSubjectConditionInterrupt(event: EventLike): boolean {
    if (isReloadContinuation(event)) return false;
    return event.type === 'ConditionDamage' || event.type === 'ConditionApplied';
}

function interruptReload(state: CombatState, combatantId: string, weaponId: string): CombatEngineResult {
    const combatant = state.combatants[combatantId];
    const ammo = combatant?.weaponAmmo?.[weaponId];
    if (!combatant || !ammo?.reloadProgress) return { state, events: [] };

    const interrupted = interruptedAmmoState(ammo);
    const updated = {
        ...combatant,
        weaponAmmo: { ...(combatant.weaponAmmo || {}), [weaponId]: interrupted },
    };
    return {
        state: {
            ...state,
            combatants: {
                ...state.combatants,
                [combatantId]: updated,
            },
        },
        events: [ammoStateEvent(combatantId, weaponId, interrupted, 'interrupted') as CombatEvent],
    };
}

function interruptedAmmoState(ammo: WeaponAmmoState): WeaponAmmoState {
    return {
        loaded: false,
        shotsRemaining: ammo.shotsRemaining,
        reloadProgress: { accumulatedSL: 0, targetSL: ammo.reloadProgress?.targetSL ?? 1 },
    };
}

function ammoStateEvent(
    combatantId: string,
    weaponId: string,
    ammo: WeaponAmmoState,
    reason: 'interrupted'
): EventLike {
    return {
        type: 'AmmoStateChanged',
        i18nKey: `combat.ammo.${reason}`,
        data: {
            combatantId,
            weaponId,
            loaded: ammo.loaded,
            shotsRemaining: ammo.shotsRemaining,
            reloadProgress: ammo.reloadProgress,
            reason,
        },
    };
}
