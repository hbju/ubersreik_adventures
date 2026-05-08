import { useCallback, useEffect, useState } from 'react';
import type { Combatant, Advantages } from '@wfrp/shared';
import { getCombatState, updateCombatState, clearCombatState } from '@wfrp/shared';
import { useAppContext } from '../context/AppContext';

export interface CombatState {
  combatants: Combatant[];
  currentTurnId: string | null;
  roundNumber: number;
  advantage: Advantages;
}

const DEFAULT_STATE: CombatState = {
  combatants: [],
  currentTurnId: null,
  roundNumber: 1,
  advantage: { playerAdvantage: 0, enemyAdvantage: 0 },
};

function toTurnIndex(combatants: Combatant[], turnId: string | null): number {
  if (!turnId) return 0;
  const idx = combatants.findIndex((c) => c.id === turnId);
  return idx >= 0 ? idx : 0;
}

export function useCombat() {
  const { serviceContext } = useAppContext();
  const [combatState, setCombatState] = useState<CombatState>(DEFAULT_STATE);
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persistState = useCallback(async (next: CombatState, active: boolean) => {
    if (!serviceContext) return;
    await updateCombatState(serviceContext.client, serviceContext.campaignId, {
      combatants: next.combatants as unknown as any,
      current_turn_index: toTurnIndex(next.combatants, next.currentTurnId),
      round_number: next.roundNumber,
      is_active: active,
      player_advantage: next.advantage.playerAdvantage,
      enemy_advantage: next.advantage.enemyAdvantage,
    });
  }, [serviceContext]);

  const fetchCombatState = useCallback(async () => {
    if (!serviceContext) return;
    setIsLoading(true);
    setError(null);
    const result = await getCombatState(serviceContext.client, serviceContext.campaignId);
    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
      return;
    }

    const row = result.data;
    const combatants = ((row.combatants as unknown) ?? []) as Combatant[];
    const turnIndex = Math.max(0, Math.min(row.current_turn_index ?? 0, Math.max(combatants.length - 1, 0)));
    setCombatState({
      combatants,
      currentTurnId: combatants[turnIndex]?.id ?? null,
      roundNumber: row.round_number ?? 1,
      advantage: {
        playerAdvantage: row.player_advantage ?? 0,
        enemyAdvantage: row.enemy_advantage ?? 0,
      },
    });
    setIsActive(Boolean(row.is_active));
    setIsLoading(false);
  }, [serviceContext]);

  useEffect(() => {
    fetchCombatState();
  }, [fetchCombatState]);

  const updateState = useCallback(async (updater: (prev: CombatState) => CombatState, active?: boolean) => {
    const next = updater(combatState);
    const nextActive = active ?? isActive;
    setCombatState(next);
    setIsActive(nextActive);
    await persistState(next, nextActive);
  }, [combatState, isActive, persistState]);

  const startCombat = useCallback(async (_characterIds: string[]) => {
    await updateState((prev) => ({
      ...prev,
      currentTurnId: prev.currentTurnId ?? prev.combatants[0]?.id ?? null,
    }), true);
  }, [updateState]);

  const endCombat = useCallback(async () => {
    if (serviceContext) {
      await clearCombatState(serviceContext.client, serviceContext.campaignId);
    }
    setCombatState(DEFAULT_STATE);
    setIsActive(false);
  }, [serviceContext]);

  const nextTurn = useCallback(async () => {
    await updateState((prev) => {
      if (!prev.combatants.length) return prev;
      const currentIdx = toTurnIndex(prev.combatants, prev.currentTurnId);
      const nextIdx = (currentIdx + 1) % prev.combatants.length;
      const wrapsRound = nextIdx === 0 && prev.combatants.length > 1;
      return {
        ...prev,
        currentTurnId: prev.combatants[nextIdx]?.id ?? null,
        roundNumber: wrapsRound ? prev.roundNumber + 1 : prev.roundNumber,
      };
    });
  }, [updateState]);

  const updateAdvantage = useCallback(async (advantage: Advantages) => {
    await updateState((prev) => ({ ...prev, advantage }));
  }, [updateState]);

  const reorderInitiative = useCallback(async (combatants: Combatant[]) => {
    await updateState((prev) => ({
      ...prev,
      combatants,
      currentTurnId: combatants.some((c) => c.id === prev.currentTurnId)
        ? prev.currentTurnId
        : combatants[0]?.id ?? null,
    }));
  }, [updateState]);

  const updateCombatant = useCallback(async (combatant: Combatant) => {
    await updateState((prev) => ({
      ...prev,
      combatants: prev.combatants.map((c) => (c.id === combatant.id ? combatant : c)),
    }));
  }, [updateState]);

  const addCombatant = useCallback(async (combatant: Combatant) => {
    await updateState((prev) => ({
      ...prev,
      combatants: [...prev.combatants, combatant],
      currentTurnId: prev.currentTurnId ?? combatant.id,
    }), true);
  }, [updateState]);

  const setCurrentTurnId = useCallback(async (currentTurnId: string | null) => {
    await updateState((prev) => ({ ...prev, currentTurnId }));
  }, [updateState]);

  const incrementRound = useCallback(async () => {
    await updateState((prev) => ({ ...prev, roundNumber: prev.roundNumber + 1 }));
  }, [updateState]);

  return {
    combatState,
    isActive,
    isLoading,
    error,
    fetchCombatState,
    startCombat,
    endCombat,
    nextTurn,
    updateAdvantage,
    reorderInitiative,
    updateCombatant,
    addCombatant,
    setCurrentTurnId,
    incrementRound,
  };
}
