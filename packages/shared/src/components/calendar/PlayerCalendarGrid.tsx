import React from 'react';
import {
  GameDate,
  TimelineEvent,
  WEEKDAYS,
  MONTHS,
  getMonthWeeks,
  datesEqual,
  getEventsForDate
} from '../../data/calendar';
import styles from './PlayerCalendarGrid.module.css';

export interface PlayerNote {
  id: string;
  date: GameDate;
  text: string;
  createdAt: number;
}

interface PlayerCalendarGridProps {
  viewMonth: number;
  viewYear: number;
  currentDate: GameDate;
  events: TimelineEvent[];
  personalNotes?: PlayerNote[];
  selectedDate: GameDate | null;
  onDateClick: (date: GameDate) => void;
  onMonthChange: (direction: 'prev' | 'next') => void;
}

export const PlayerCalendarGrid: React.FC<PlayerCalendarGridProps> = ({
  viewMonth,
  viewYear,
  currentDate,
  events,
  personalNotes = [],
  selectedDate,
  onDateClick,
  onMonthChange
}) => {
  const weeks = getMonthWeeks(viewYear, viewMonth);
  const monthName = MONTHS[viewMonth].name;

  const getEventsForCell = (date: GameDate | null): TimelineEvent[] => {
    if (!date) return [];
    return getEventsForDate(events, date);
  };

  const getNotesForCell = (date: GameDate | null): PlayerNote[] => {
    if (!date) return [];
    return personalNotes.filter(n => datesEqual(n.date, date));
  };

  const isCurrentDay = (date: GameDate | null): boolean => {
    if (!date) return false;
    return datesEqual(date, currentDate);
  };

  const isSelectedDay = (date: GameDate | null): boolean => {
    if (!date || !selectedDate) return false;
    return datesEqual(date, selectedDate);
  };

  return (
    <div className={styles.calendarGrid}>
      <div className={styles.calendarHeader}>
        <button
          className={styles.navButton}
          onClick={() => onMonthChange('prev')}
          title="Previous Month"
        >
          ‹
        </button>
        <h3 className={styles.monthTitle}>
          {monthName} {viewYear}
        </h3>
        <button
          className={styles.navButton}
          onClick={() => onMonthChange('next')}
          title="Next Month"
        >
          ›
        </button>
      </div>

      <div className={styles.calendarWeekdays}>
        {WEEKDAYS.map((day) => (
          <div key={day} className={styles.weekdayCell}>
            {day.substring(0, 3)}
          </div>
        ))}
      </div>

      <div className={styles.calendarBody}>
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className={styles.calendarWeek}>
            {week.map((date, dayIndex) => {
              const cellEvents = getEventsForCell(date);
              const cellNotes = getNotesForCell(date);
              const isCurrent = isCurrentDay(date);
              const isSelected = isSelectedDay(date);
              const hasNotes = cellNotes.length > 0;

              return (
                <div
                  key={dayIndex}
                  className={`
                    ${styles.calendarCell}
                    ${date ? styles.activeCell : styles.emptyCell}
                    ${isCurrent ? styles.currentDay : ''}
                    ${isSelected ? styles.selectedDay : ''}
                    ${hasNotes ? styles.hasNote : ''}
                  `}
                  onClick={() => date && onDateClick(date)}
                  style={{ cursor: date ? 'pointer' : 'default' }}
                >
                  {date && (
                    <>
                      <span className={styles.dayNumber}>{date.day}</span>
                      {(cellEvents.length > 0 || cellNotes.length > 0) && (
                        <div className={styles.eventIndicators}>
                          {cellEvents.slice(0, 2).map((event) => (
                            <span
                              key={event.id}
                              className={styles.eventDot}
                              style={{ backgroundColor: event.color || '#d4af37' }}
                              title={event.title}
                            />
                          ))}
                          {cellNotes.length > 0 && (
                            <span
                              className={styles.noteDot}
                              title={cellNotes.map(n => n.text).join(', ')}
                            />
                          )}
                          {cellEvents.length > 2 && (
                            <span className={styles.moreEvents}>+{cellEvents.length - 2}</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className={styles.calendarLegend}>
        <div className={styles.legendItem}>
          <span className={styles.legendMarker}>📍</span>
          <span>Current Day</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendMarker}>🔹</span>
          <span>Public Event</span>
        </div>
        <div className={styles.legendItem}>
          <span className={styles.legendMarker}>📝</span>
          <span>Personal Note</span>
        </div>
      </div>
    </div>
  );
};

export default PlayerCalendarGrid;
