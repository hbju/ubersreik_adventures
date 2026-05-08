import { useCallback, useEffect, useState } from 'react';
import type { CalendarState, GameDate, TimelineEvent } from '@wfrp/shared';
import {
  addDays,
  createDefaultCalendarState,
  generateWeather,
  getSeason,
  getCalendarState,
  updateCalendarState,
} from '@wfrp/shared';
import type { Json } from '@wfrp/shared';
import { useAppContext } from '../context/AppContext';

function isCalendarState(value: unknown): value is CalendarState {
  if (!value || typeof value !== 'object') return false;
  const maybe = value as Partial<CalendarState>;
  return !!maybe.currentDate && Array.isArray(maybe.events) && Array.isArray(maybe.eventTags);
}

export function useCalendar() {
  const { serviceContext } = useAppContext();
  const [calendarState, setCalendarState] = useState<CalendarState>(createDefaultCalendarState());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCalendar = useCallback(async () => {
    if (!serviceContext) return;
    setIsLoading(true);
    setError(null);
    const result = await getCalendarState(serviceContext.client, serviceContext.campaignId);
    if (result.error) {
      setError(result.error.message);
      setIsLoading(false);
      return;
    }
    const data = result.data;
    if (data && isCalendarState(data)) {
      setCalendarState(data);
    } else {
      setCalendarState(createDefaultCalendarState());
    }
    setIsLoading(false);
  }, [serviceContext]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const persistCalendar = useCallback(async (state: CalendarState) => {
    if (!serviceContext) return;
    const result = await updateCalendarState(
      serviceContext.client,
      serviceContext.campaignId,
      state as unknown as Json
    );
    if (result.error) {
      setError(result.error.message);
      return result;
    }
    setError(null);
    return result;
  }, [serviceContext]);

  const updateState = useCallback(async (next: CalendarState) => {
    const previous = calendarState;
    setCalendarState(next);
    const result = await persistCalendar(next);
    if (result?.error) {
      // Roll back optimistic update if persistence fails.
      setCalendarState(previous);
    }
  }, [calendarState, persistCalendar]);

  const advanceDay = useCallback(async () => {
    const next = {
      ...calendarState,
      currentDate: addDays(calendarState.currentDate, 1),
      currentWeather: undefined,
    };
    await updateState(next);
  }, [calendarState, updateState]);

  const setDate = useCallback(async (date: GameDate) => {
    await updateState({
      ...calendarState,
      currentDate: date,
      currentWeather: undefined,
    });
  }, [calendarState, updateState]);

  const setWeather = useCallback(async (weather: string) => {
    await updateState({
      ...calendarState,
      currentWeather: weather,
    });
  }, [calendarState, updateState]);

  const generateCurrentWeather = useCallback(async () => {
    const weather = generateWeather(getSeason(calendarState.currentDate.monthIndex));
    await setWeather(weather);
  }, [calendarState.currentDate.monthIndex, setWeather]);

  const saveEvent = useCallback(async (event: TimelineEvent) => {
    const existingIndex = calendarState.events.findIndex((e) => e.id === event.id);
    const events = existingIndex >= 0
      ? calendarState.events.map((e) => (e.id === event.id ? event : e))
      : [...calendarState.events, event];
    await updateState({ ...calendarState, events });
  }, [calendarState, updateState]);

  const deleteEvent = useCallback(async (eventId: string) => {
    await updateState({
      ...calendarState,
      events: calendarState.events.filter((e) => e.id !== eventId),
    });
  }, [calendarState, updateState]);

  return {
    calendarState,
    isLoading,
    error,
    fetchCalendar,
    setCalendarState: updateState,
    advanceDay,
    setDate,
    setWeather,
    generateCurrentWeather,
    saveEvent,
    deleteEvent,
  };
}
