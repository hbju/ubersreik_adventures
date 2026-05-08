import React, { useState, useCallback, useEffect } from 'react';
import {
  GameDate,
  TimelineEvent,
  CalendarState,
  addDays,
  getSeason,
  generateWeather,
  createDefaultCalendarState,
  datesEqual,
  compareDates
} from '@wfrp/shared';
import { CalendarGrid } from './CalendarGrid';
import { TimelineSidebar } from './TimelineSidebar';
import { EventModal } from './EventModal';
import { SetDateModal } from './SetDateModal';
import styles from './TimelineManager.module.css';
import { useCalendarContext } from '../../context/CalendarContext';

interface TimelineManagerProps {
  onClose: () => void;
}

export const TimelineManager: React.FC<TimelineManagerProps> = ({
  onClose
}) => {
  const { calendarState, setCalendarState: saveCalendarState, isLoading, error } = useCalendarContext();
  // Initialize state from props or defaults
  const [state, setState] = useState<CalendarState>(() => 
    calendarState || createDefaultCalendarState()
  );

  // View state (separate from current date)
  const [viewMonth, setViewMonth] = useState(state.currentDate.monthIndex);
  const [viewYear, setViewYear] = useState(state.currentDate.year);
  
  // UI state
  const [selectedDate, setSelectedDate] = useState<GameDate | null>(null);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showSetDateModal, setShowSetDateModal] = useState(false);
  const [enabledTags, setEnabledTags] = useState<string[]>([]);

  // Sync state changes from context
  useEffect(() => {
    if (calendarState) {
      setState(calendarState);
    }
  }, [calendarState]);

  // Sync state changes to context
  useEffect(() => {
    saveCalendarState(state);
  }, [state, saveCalendarState]);

  // Check for events on the current date and notify
  useEffect(() => {
    const todayEvents = state.events.filter(e => datesEqual(e.date, state.currentDate));
    if (todayEvents.length > 0) {
      // Show notification for today's events
      const eventNames = todayEvents.map(e => e.title).join(', ');
      // Could use a toast notification here, for now just log
      console.log(`📅 Events today: ${eventNames}`);
    }
  }, [state.currentDate, state.events]);

  // ========================================
  // Date Management
  // ========================================

  const handleAdvanceDay = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentDate: addDays(prev.currentDate, 1),
      currentWeather: undefined // Clear weather when day changes
    }));
  }, []);

  const handleAdvanceWeek = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentDate: addDays(prev.currentDate, 8), // 8-day week
      currentWeather: undefined
    }));
  }, []);

  const handleSetDate = useCallback((date: GameDate) => {
    setState(prev => ({
      ...prev,
      currentDate: date,
      currentWeather: undefined
    }));
    setViewMonth(date.monthIndex);
    setViewYear(date.year);
    setShowSetDateModal(false);
  }, []);

  const handleGoToToday = useCallback(() => {
    setViewMonth(state.currentDate.monthIndex);
    setViewYear(state.currentDate.year);
  }, [state.currentDate]);

  // ========================================
  // Calendar Navigation
  // ========================================

  const handleMonthChange = useCallback((direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (viewMonth === 0) {
        setViewMonth(17);
        setViewYear(prev => prev - 1);
      } else {
        setViewMonth(prev => prev - 1);
      }
    } else {
      if (viewMonth === 17) {
        setViewMonth(0);
        setViewYear(prev => prev + 1);
      } else {
        setViewMonth(prev => prev + 1);
      }
    }
  }, [viewMonth]);

  // ========================================
  // Event Management
  // ========================================

  const handleDateClick = useCallback((date: GameDate) => {
    setSelectedDate(date);
    
    // Check if there's an event on this date
    const existingEvents = state.events.filter(e => datesEqual(e.date, date));
    
    if (existingEvents.length === 1) {
      // If exactly one event, open it for editing
      setEditingEvent(existingEvents[0]);
    } else {
      // Otherwise, create new event
      setEditingEvent(null);
    }
    
    setShowEventModal(true);
  }, [state.events]);

  const handleEventClick = useCallback((event: TimelineEvent) => {
    setSelectedDate(event.date);
    setEditingEvent(event);
    setShowEventModal(true);
    // Also navigate to the event's month
    setViewMonth(event.date.monthIndex);
    setViewYear(event.date.year);
  }, []);

  const handleSaveEvent = useCallback((event: TimelineEvent) => {
    setState(prev => {
      const existingIndex = prev.events.findIndex(e => e.id === event.id);
      
      let updatedEvents: TimelineEvent[];
      if (existingIndex >= 0) {
        // Update existing event
        updatedEvents = prev.events.map(e => e.id === event.id ? event : e);
      } else {
        // Add new event
        updatedEvents = [...prev.events, event];
      }
      
      // Sort events by date
      updatedEvents.sort((a, b) => compareDates(a.date, b.date));
      
      return {
        ...prev,
        events: updatedEvents
      };
    });
    
    setShowEventModal(false);
    setEditingEvent(null);
    setSelectedDate(null);
  }, []);

  const handleDeleteEvent = useCallback((eventId: string) => {
    setState(prev => ({
      ...prev,
      events: prev.events.filter(e => e.id !== eventId)
    }));
    
    setShowEventModal(false);
    setEditingEvent(null);
    setSelectedDate(null);
  }, []);

  // ========================================
  // Weather
  // ========================================

  const handleGenerateWeather = useCallback(() => {
    const season = getSeason(state.currentDate.monthIndex);
    const weather = generateWeather(season);
    setState(prev => ({
      ...prev,
      currentWeather: weather
    }));
  }, [state.currentDate.monthIndex]);

  // ========================================
  // Tag Filtering
  // ========================================

  const handleToggleTag = useCallback((tag: string) => {
    setEnabledTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  }, []);

  return (
    <div className={styles.timelineManager}>
      <div className={styles.header}>
        <h2>📅 Imperial Calendar</h2>
        <button className={styles.closeButton} onClick={onClose}>×</button>
      </div>

      <div className={styles.content}>
        {error && <div style={{ color: '#ff6b6b', padding: '8px 12px' }}>{error}</div>}
        {isLoading && <div style={{ color: '#aaa', padding: '8px 12px' }}>Loading calendar...</div>}
        <TimelineSidebar
          currentDate={state.currentDate}
          events={state.events}
          eventTags={state.eventTags}
          enabledTags={enabledTags}
          currentWeather={state.currentWeather || null}
          onAdvanceDay={handleAdvanceDay}
          onAdvanceWeek={handleAdvanceWeek}
          onSetDate={() => setShowSetDateModal(true)}
          onToggleTag={handleToggleTag}
          onGenerateWeather={handleGenerateWeather}
          onEventClick={handleEventClick}
          onGoToToday={handleGoToToday}
        />

        <CalendarGrid
          viewMonth={viewMonth}
          viewYear={viewYear}
          currentDate={state.currentDate}
          events={state.events}
          selectedDate={selectedDate}
          enabledTags={enabledTags}
          onDateClick={handleDateClick}
          onMonthChange={handleMonthChange}
        />
      </div>

      {/* Event Creation/Editing Modal */}
      {showEventModal && selectedDate && (
        <EventModal
          event={editingEvent}
          date={selectedDate}
          availableTags={state.eventTags}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
          onClose={() => {
            setShowEventModal(false);
            setEditingEvent(null);
            setSelectedDate(null);
          }}
        />
      )}

      {/* Set Date Modal */}
      {showSetDateModal && (
        <SetDateModal
          currentDate={state.currentDate}
          onSetDate={handleSetDate}
          onClose={() => setShowSetDateModal(false)}
        />
      )}
    </div>
  );
};

export default TimelineManager;
