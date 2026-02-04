import React from 'react';
import {
  GameDate,
  TimelineEvent,
  WEEKDAYS,
  MONTHS,
  getMonthWeeks,
  datesEqual,
  getEventsForDate
} from '@wfrp/shared';
import styles from './TimelineManager.module.css';

interface CalendarGridProps {
  viewMonth: number;
  viewYear: number;
  currentDate: GameDate;
  events: TimelineEvent[];
  selectedDate: GameDate | null;
  enabledTags: string[];
  onDateClick: (date: GameDate) => void;
  onMonthChange: (direction: 'prev' | 'next') => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  viewMonth,
  viewYear,
  currentDate,
  events,
  selectedDate,
  enabledTags,
  onDateClick,
  onMonthChange
}) => {
  const weeks = getMonthWeeks(viewYear, viewMonth);
  const monthName = MONTHS[viewMonth].name;

  // Filter events by enabled tags
  const filteredEvents = events.filter(event =>
    enabledTags.length === 0 || event.tags.some(tag => enabledTags.includes(tag))
  );

  const getEventsForCell = (date: GameDate | null): TimelineEvent[] => {
    if (!date) return [];
    return getEventsForDate(filteredEvents, date);
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
        {WEEKDAYS.map((day, index) => (
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
              const isCurrent = isCurrentDay(date);
              const isSelected = isSelectedDay(date);

              return (
                <div
                  key={dayIndex}
                  className={`
                    ${styles.calendarCell}
                    ${date ? styles.activeCell : styles.emptyCell}
                    ${isCurrent ? styles.currentDay : ''}
                    ${isSelected ? styles.selectedDay : ''}
                  `}
                  onClick={() => date && onDateClick(date)}
                >
                  {date && (
                    <>
                      <span className={styles.dayNumber}>{date.day}</span>
                      {cellEvents.length > 0 && (
                        <div className={styles.eventIndicators}>
                          {cellEvents.slice(0, 3).map((event, idx) => (
                            <span
                              key={event.id}
                              className={styles.eventDot}
                              style={{ backgroundColor: event.color || '#d4af37' }}
                              title={event.title}
                            />
                          ))}
                          {cellEvents.length > 3 && (
                            <span className={styles.moreEvents}>+{cellEvents.length - 3}</span>
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
          <span className={`${styles.legendMarker} ${styles.currentDayMarker}`}>📍</span>
          <span>Current Day</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendMarker} ${styles.eventMarker}`}>🔹</span>
          <span>Event</span>
        </div>
      </div>
    </div>
  );
};

export default CalendarGrid;
