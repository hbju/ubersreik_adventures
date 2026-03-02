import React, { useState, useCallback, useEffect } from 'react';
import {
  GameDate,
  TimelineEvent,
  formatDate,
  getWeekdayName,
  getSeason,
  getMannsliebPhase,
  getMorrsliebPhase,
  getMoonPhaseDescription,
  isMorrsliebDangerous,
  getUpcomingEvents,
  daysBetween,
  datesEqual,
  DEFAULT_EVENT_TAGS,
  PlayerCalendarGrid,
  PlayerNote,
} from '@wfrp/shared';
import styles from './PlayerTimeline.module.css';

// ========================================
// Local Storage helpers for personal notes
// ========================================

const NOTES_STORAGE_KEY = 'wfrp-player-calendar-notes';

function loadPersonalNotes(): PlayerNote[] {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load personal notes:', e);
  }
  return [];
}

function savePersonalNotes(notes: PlayerNote[]) {
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.warn('Failed to save personal notes:', e);
  }
}

// ========================================

type Season = 'WINTER' | 'SPRING' | 'SUMMER' | 'AUTUMN';

function getSeasonEmoji(s: Season): string {
  switch (s) {
    case 'WINTER': return '❄️';
    case 'SPRING': return '🌸';
    case 'SUMMER': return '☀️';
    case 'AUTUMN': return '🍂';
  }
}

function getMoonEmoji(phase: number): string {
  if (phase >= 95) return '🌕';
  if (phase >= 75) return '🌔';
  if (phase >= 50) return '🌓';
  if (phase >= 25) return '🌒';
  return '🌑';
}

// ========================================

interface PlayerTimelineProps {
  currentDate: GameDate;
  events: TimelineEvent[];  // Already filtered: only isVisibleToPlayers events
  weather?: string;
  onClose: () => void;
}

export const PlayerTimeline: React.FC<PlayerTimelineProps> = ({
  currentDate,
  events,
  weather,
  onClose
}) => {
  // Calendar view state
  const [viewMonth, setViewMonth] = useState(currentDate.monthIndex);
  const [viewYear, setViewYear] = useState(currentDate.year);
  const [selectedDate, setSelectedDate] = useState<GameDate | null>(null);

  // Personal notes
  const [personalNotes, setPersonalNotes] = useState<PlayerNote[]>(() => loadPersonalNotes());
  const [noteText, setNoteText] = useState('');

  // Persist notes to localStorage whenever they change
  useEffect(() => {
    savePersonalNotes(personalNotes);
  }, [personalNotes]);

  // Derived data
  const weekday = getWeekdayName(currentDate);
  const formattedDate = formatDate(currentDate);
  const season = getSeason(currentDate.monthIndex) as Season;
  const mannsliebPhase = getMannsliebPhase(currentDate);
  const morrsliebPhase = getMorrsliebPhase(currentDate);
  const morrsliebDanger = isMorrsliebDangerous(currentDate);

  // Upcoming events (public)
  const upcomingEvents = getUpcomingEvents(events, currentDate, 10);

  // Notes for selected date
  const selectedDateNotes = selectedDate
    ? personalNotes.filter(n => datesEqual(n.date, selectedDate))
    : [];

  // ========================================
  // Calendar Navigation
  // ========================================

  const handleMonthChange = useCallback((direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (viewMonth === 0) {
        setViewMonth(17); // MONTHS array has 18 entries (0-17)
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

  const handleGoToToday = useCallback(() => {
    setViewMonth(currentDate.monthIndex);
    setViewYear(currentDate.year);
  }, [currentDate]);

  const handleDateClick = useCallback((date: GameDate) => {
    setSelectedDate(date);
    setNoteText('');
  }, []);

  // ========================================
  // Personal Notes
  // ========================================

  const handleSaveNote = () => {
    if (!selectedDate || !noteText.trim()) return;
    const note: PlayerNote = {
      id: crypto.randomUUID(),
      date: selectedDate,
      text: noteText.trim(),
      createdAt: Date.now(),
    };
    setPersonalNotes(prev => [...prev, note]);
    setNoteText('');
  };

  const handleRemoveNote = (noteId: string) => {
    setPersonalNotes(prev => prev.filter(n => n.id !== noteId));
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.playerTimeline}>
        <div className={styles.header}>
          <h2>📅 Imperial Calendar</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        <div className={styles.content}>
          {/* Sidebar: date, weather, moon, events */}
          <div className={styles.sidebar}>
            {/* Current Date */}
            <div className={styles.sidebarSection}>
              <h3 className={styles.sectionTitle}>Current Date</h3>
              <div className={styles.currentDateDisplay}>
                <div className={styles.dateWeekday}>{weekday}</div>
                <div className={styles.dateMain}>📅 {formattedDate}</div>
                <div className={styles.dateSeason}>
                  {getSeasonEmoji(season)} {season.charAt(0) + season.slice(1).toLowerCase()}
                </div>
              </div>
            </div>

            {/* Weather */}
            <div className={styles.sidebarSection}>
              <h3 className={styles.sectionTitle}>Weather</h3>
              <div className={styles.weatherDisplay}>
                {weather ? (
                  <span className={styles.weatherText}>🌤️ {weather}</span>
                ) : (
                  <span className={styles.noWeather}>No weather reported</span>
                )}
              </div>
            </div>

            {/* Moon Phases */}
            <div className={styles.sidebarSection}>
              <h3 className={styles.sectionTitle}>Moon Phases</h3>
              <div className={styles.moonDisplay}>
                <div className={styles.moonPhase}>
                  <span className={styles.moonIcon}>{getMoonEmoji(mannsliebPhase)}</span>
                  <span className={styles.moonName}>Mannslieb:</span>
                  <span className={styles.moonDesc}>{getMoonPhaseDescription(mannsliebPhase)} ({mannsliebPhase}%)</span>
                </div>
                <div className={`${styles.moonPhase} ${morrsliebDanger ? styles.moonDanger : ''}`}>
                  <span className={styles.moonIcon}>{getMoonEmoji(morrsliebPhase)}</span>
                  <span className={styles.moonName}>Morrslieb:</span>
                  <span className={styles.moonDesc}>
                    {getMoonPhaseDescription(morrsliebPhase)}
                    {morrsliebDanger && <span className={styles.dangerBadge}>⚠️ Danger!</span>}
                  </span>
                </div>
              </div>
            </div>

            {/* Upcoming Events */}
            <div className={`${styles.sidebarSection} ${styles.eventsSection}`}>
              <h3 className={styles.sectionTitle}>Upcoming Events</h3>
              <button className={styles.goToTodayButton} onClick={handleGoToToday}>
                Go to Today
              </button>
              <div className={styles.eventsList}>
                {upcomingEvents.length === 0 ? (
                  <div className={styles.noEvents}>No upcoming events</div>
                ) : (
                  upcomingEvents.map(event => {
                    const daysAway = daysBetween(currentDate, event.date);
                    const daysLabel = daysAway === 0 ? 'Today'
                      : daysAway === 1 ? 'Tomorrow'
                        : `${daysAway} days`;

                    return (
                      <div
                        key={event.id}
                        className={styles.eventItem}
                        style={{ borderLeftColor: event.color || '#d4af37' }}
                      >
                        <div className={styles.eventHeader}>
                          <span className={styles.eventDate}>
                            {event.date.day} {formatDate(event.date).split(',')[0].split(' ')[1]}
                          </span>
                          <span className={styles.eventDaysAway}>({daysLabel})</span>
                        </div>
                        <div className={styles.eventTitle}>{event.title}</div>
                        {event.tags.length > 0 && (
                          <div className={styles.eventTags}>
                            {event.tags.filter(t => t !== 'Hidden').map(tag => (
                              <span
                                key={tag}
                                className={styles.eventTag}
                                style={{ backgroundColor: DEFAULT_EVENT_TAGS[tag] || '#6c757d' }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <PlayerCalendarGrid
              viewMonth={viewMonth}
              viewYear={viewYear}
              currentDate={currentDate}
              events={events}
              personalNotes={personalNotes}
              selectedDate={selectedDate}
              onDateClick={handleDateClick}
              onMonthChange={handleMonthChange}
            />

            {/* Personal Notes Panel (shown when a date is selected) */}
            {selectedDate && (
              <div className={styles.noteSection}>
                {events.filter(e => datesEqual(e.date, selectedDate)).length === 0 ? (
                  <div className={styles.noEvents}>No events for this day.</div>
                ) : (
                  events.filter(e => datesEqual(e.date, selectedDate)).map(event => (
                    <div key={event.id} className={styles.eventDetail}>
                      <h5>{event.title}</h5>
                    </div>
                  ))
                )}

                <div className={styles.noteHeader}>
                  <h4>📝 Personal Notes</h4>
                </div>

                {/* Existing notes for this date */}
                {selectedDateNotes.length > 0 && (
                  <div className={styles.existingNotes}>
                    {selectedDateNotes.map(note => (
                      <div key={note.id} className={styles.existingNote}>
                        <span className={styles.noteText}>{note.text}</span>
                        <button
                          className={styles.removeNoteBtn}
                          onClick={() => handleRemoveNote(note.id)}
                          title="Remove note"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new note */}
                <textarea
                  className={styles.noteInput}
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Add a personal note for this day..."
                  rows={2}
                />
                <div className={styles.noteActions}>
                  <button
                    className={styles.saveNoteButton}
                    onClick={handleSaveNote}
                    disabled={!noteText.trim()}
                  >
                    💾 Save Note
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PlayerTimeline;
