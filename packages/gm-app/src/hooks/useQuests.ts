import { useCallback, useEffect, useState } from 'react';
import type { Json, Quest, QuestObjective, QuestStatus } from '@wfrp/shared';
import {
  getQuests as svcGetQuests,
  createQuest as svcCreateQuest,
  updateQuest as svcUpdateQuest,
  toggleObjective as svcToggleObjective,
  deleteQuest as svcDeleteQuest,
  type QuestRow,
} from '@wfrp/shared';
import { useAppContext } from '../context/AppContext';

type ObjectiveInput = {
  id?: string;
  text?: string;
  isCompleted?: boolean;
  completed?: boolean;
  locationId?: string;
};

function toObjective(input: ObjectiveInput): QuestObjective {
  return {
    id: input?.id ?? crypto.randomUUID(),
    text: input?.text ?? '',
    isCompleted: Boolean(input?.isCompleted ?? input?.completed),
    locationId: input?.locationId,
  };
}

function rowToQuest(row: QuestRow): Quest {
  const objectivesInput = Array.isArray(row.objectives) ? row.objectives : [];
  return {
    id: row.id,
    title: row.title,
    characterId: row.character_id ?? '',
    description: row.description ?? '',
    status: (row.status as QuestStatus) ?? 'active',
    objectives: objectivesInput.map(toObjective),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function objectivesToJson(objectives: QuestObjective[]): Json {
  return objectives.map((obj) => ({
    id: obj.id,
    text: obj.text,
    completed: obj.isCompleted,
    locationId: obj.locationId,
  })) as Json;
}

export function useQuests() {
  const { serviceContext } = useAppContext();
  const [quests, setQuests] = useState<Quest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQuests = useCallback(async (status?: QuestStatus) => {
    if (!serviceContext) return;
    setIsLoading(true);
    setError(null);
    const result = await svcGetQuests(serviceContext.client, serviceContext.campaignId, status);
    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
      return;
    }
    setQuests(result.data.map(rowToQuest));
    setIsLoading(false);
  }, [serviceContext]);

  useEffect(() => {
    fetchQuests();
  }, [fetchQuests]);

  const createQuest = useCallback(async (quest: Quest) => {
    if (!serviceContext) return;
    const result = await svcCreateQuest(serviceContext.client, serviceContext.campaignId, {
      title: quest.title,
      description: quest.description,
      character_id: quest.characterId || null,
      status: quest.status,
      objectives: objectivesToJson(quest.objectives),
    });
    if (!result.error && result.data) {
      setQuests((prev) => [...prev, rowToQuest(result.data)]);
      setError(null);
    } else if (result?.error) {
      setError(result.error.message);
    }
    return result;
  }, [serviceContext]);

  const updateQuest = useCallback(async (quest: Quest) => {
    if (!serviceContext) return;
    const result = await svcUpdateQuest(serviceContext.client, quest.id, {
      title: quest.title,
      description: quest.description,
      character_id: quest.characterId || null,
      status: quest.status,
      objectives: objectivesToJson(quest.objectives),
    });
    if (!result.error && result.data) {
      const updated = rowToQuest(result.data);
      setQuests((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
      setError(null);
    } else if (result?.error) {
      setError(result.error.message);
    }
    return result;
  }, [serviceContext]);

  const deleteQuest = useCallback(async (questId: string) => {
    if (!serviceContext) return;
    const result = await svcDeleteQuest(serviceContext.client, questId);
    if (!result.error) {
      setQuests((prev) => prev.filter((q) => q.id !== questId));
      setError(null);
    } else if (result?.error) {
      setError(result.error.message);
    }
    return result;
  }, [serviceContext]);

  const toggleObjective = useCallback(async (questId: string, objectiveId: string) => {
    if (!serviceContext) return;
    const quest = quests.find((q) => q.id === questId);
    if (!quest) return;
    const objectiveIndex = quest.objectives.findIndex((o) => o.id === objectiveId);
    if (objectiveIndex < 0) return;

    const result = await svcToggleObjective(serviceContext.client, questId, objectiveIndex);
    if (!result.error && result.data) {
      const updated = rowToQuest(result.data);
      setQuests((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
      setError(null);
    } else if (result?.error) {
      setError(result.error.message);
    }
    return result;
  }, [serviceContext, quests]);

  const changeStatus = useCallback(async (questId: string, status: QuestStatus) => {
    if (!serviceContext) return;
    const result = await svcUpdateQuest(serviceContext.client, questId, { status });
    if (!result.error && result.data) {
      const updated = rowToQuest(result.data);
      setQuests((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
      setError(null);
    } else if (result?.error) {
      setError(result.error.message);
    }
    return result;
  }, [serviceContext]);

  return {
    quests,
    isLoading,
    error,
    fetchQuests,
    createQuest,
    updateQuest,
    deleteQuest,
    toggleObjective,
    changeStatus,
  };
}
