import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JournalEntry } from '@wfrp/shared';
import {
  getAllEntries,
  getVisibleEntries,
  createEntry as svcCreateEntry,
  updateEntry as svcUpdateEntry,
  deleteEntry as svcDeleteEntry,
  shareEntry as svcShareEntry,
  type JournalEntryRow,
} from '@wfrp/shared';
import { useAppContext } from '../context/AppContext';

function rowToJournalEntry(row: JournalEntryRow): JournalEntry {
  const hasAll = row.is_public;
  const shared = row.shared_with ?? [];
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    imageData: row.image_data ?? undefined,
    sharedWith: hasAll ? ['all', ...shared] : shared,
  };
}

function entryToWrite(entry: JournalEntry) {
  const isPublic = entry.sharedWith.includes('all');
  const sharedWith = entry.sharedWith.filter((id) => id !== 'all');
  return {
    title: entry.title,
    content: entry.content,
    image_data: entry.imageData ?? null,
    is_public: isPublic,
    shared_with: sharedWith,
  };
}

export function useJournal() {
  const { serviceContext, user } = useAppContext();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!serviceContext) return;
    setIsLoading(true);
    setError(null);
    const result = await getAllEntries(serviceContext.client, serviceContext.campaignId);
    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
      return;
    }
    setEntries(result.data.map(rowToJournalEntry));
    setIsLoading(false);
  }, [serviceContext]);

  const fetchVisibleEntries = useCallback(async (userId?: string) => {
    if (!serviceContext) return [];
    const viewerId = userId ?? user?.id;
    if (!viewerId) return [];
    const result = await getVisibleEntries(serviceContext.client, serviceContext.campaignId, viewerId);
    if (result.error) {
      setError(result.error.message);
      return [];
    }
    return result.data.map(rowToJournalEntry);
  }, [serviceContext, user?.id]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const createEntry = useCallback(async (entry: JournalEntry) => {
    if (!serviceContext) return;
    const result = await svcCreateEntry(serviceContext.client, serviceContext.campaignId, entryToWrite(entry));
    if (!result.error && result.data) {
      setEntries((prev) => [...prev, rowToJournalEntry(result.data)]);
      setError(null);
    } else if (result?.error) {
      setError(result.error.message);
    }
    return result;
  }, [serviceContext]);

  const updateEntry = useCallback(async (entry: JournalEntry) => {
    if (!serviceContext) return;
    const result = await svcUpdateEntry(serviceContext.client, entry.id, entryToWrite(entry));
    if (!result.error && result.data) {
      const updated = rowToJournalEntry(result.data);
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setError(null);
    } else if (result?.error) {
      setError(result.error.message);
    }
    return result;
  }, [serviceContext]);

  const deleteEntry = useCallback(async (entryId: string) => {
    if (!serviceContext) return;
    const result = await svcDeleteEntry(serviceContext.client, entryId);
    if (!result.error) {
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      setError(null);
    } else if (result?.error) {
      setError(result.error.message);
    }
    return result;
  }, [serviceContext]);

  const shareEntry = useCallback(async (entryId: string, sharedWith: string[]) => {
    if (!serviceContext) return;
    const userIds = sharedWith.filter((id) => id !== 'all');
    const result = await svcShareEntry(serviceContext.client, entryId, userIds);
    if (!result.error && result.data) {
      const updated = rowToJournalEntry({
        ...result.data,
        is_public: sharedWith.includes('all'),
      });
      setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      setError(null);
    } else if (result?.error) {
      setError(result.error.message);
    }
    return result;
  }, [serviceContext]);

  const visibleEntries = useMemo(() => entries.filter((entry) => entry.sharedWith.includes('all') || entry.sharedWith.length > 0), [entries]);

  return {
    entries,
    visibleEntries,
    isLoading,
    error,
    fetchEntries,
    fetchVisibleEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    shareEntry,
  };
}
