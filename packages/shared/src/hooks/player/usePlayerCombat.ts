import { useCallback, useEffect, useState } from 'react';
import type { Advantages, Combatant } from '../../types/wfrp.types';
import type { ServiceContext } from '../../services/serviceContext';
import { getCombatState } from '../../services/combatService';
import { onCombatChange } from '../../lib/realtime';
export interface OpposedTestRequestState {
  testId: string;
  role: 'attacker' | 'defender';
  skillName: string;
  targetNumber: number;
  modifier: number;
}

export interface ConditionTestRequestState {
  testId: string;
  conditionId: string;
  conditionName: string;
  testType: string;
  targetNumber: number;
  modifier: number;
  conditionCount: number;
  description: string;
}

export function usePlayerCombat(serviceContext: ServiceContext | null) {
  const [combatants, setCombatants] = useState<Combatant[]>([]);
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);
  const [currentAdvantage, setCurrentAdvantage] = useState<Advantages>({
    playerAdvantage: 0,
    enemyAdvantage: 0,
  });
  const [opposedTestRequest, setOpposedTestRequest] = useState<OpposedTestRequestState | null>(null);
  const [conditionTestRequest, setConditionTestRequest] = useState<ConditionTestRequestState | null>(null);

  const refreshCombat = useCallback(async () => {
    if (!serviceContext) return;
    const res = await getCombatState(serviceContext.client, serviceContext.campaignId);
    if (res.error || !res.data) return;
    const row = res.data;
    const rawCombatants = row.combatants;
    const parsed = Array.isArray(rawCombatants) ? (rawCombatants as unknown as Combatant[]) : [];
    setCombatants(parsed);
    const turnIdx = row.current_turn_index ?? 0;
    const current = parsed[turnIdx] ?? null;
    setCurrentTurnId(current?.id ?? null);
    setCurrentAdvantage({
      playerAdvantage: row.player_advantage ?? 0,
      enemyAdvantage: row.enemy_advantage ?? 0,
    });
  }, [serviceContext]);

  useEffect(() => {
    void refreshCombat();
  }, [refreshCombat]);

  useEffect(() => {
    if (!serviceContext) return undefined;
    return onCombatChange(
      {
        supabase: serviceContext.client,
        campaignId: serviceContext.campaignId,
      },
      () => {
        void refreshCombat();
      }
    );
  }, [serviceContext, refreshCombat]);

  return {
    combatants,
    currentTurnId,
    currentAdvantage,
    opposedTestRequest,
    setOpposedTestRequest,
    conditionTestRequest,
    setConditionTestRequest,
    refreshCombat,
  };
}
