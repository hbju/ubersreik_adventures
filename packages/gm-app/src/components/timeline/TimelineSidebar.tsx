import React from 'react';
import {
  GameDate,
  TimelineEvent,
  Season,
  formatDate,
  getWeekdayName,
  getSeason,
  getMannsliebPhase,
  getMorrsliebPhase,
  getMoonPhaseDescription,
  isMorrsliebDangerous,
  generateWeather,
  getUpcomingEvents,
  daysBetween,
  DEFAULT_EVENT_TAGS
} from '@wfrp/shared';
import styles from './TimelineManager.module.css';

interface TimelineSidebarProps {
  currentDate: GameDate;
  events: TimelineEvent[];
  eventTags: string[];
  enabledTags: string[];
  currentWeather: string | null;
  onAdvanceDay: () => void;
  onAdvanceWeek: () => void;
  onSetDate: () => void;
  onToggleTag: (tag: string) => void;
  onGenerateWeather: () => void;
  onEventClick: (event: TimelineEvent) => void;
  onGoToToday: () => void;
}

export const TimelineSidebar: React.FC<TimelineSidebarProps> = ({
  currentDate,
  events,
  eventTags,
  enabledTags,
  currentWeather,
  onAdvanceDay,
  onAdvanceWeek,
  onSetDate,
  onToggleTag,
  onGenerateWeather,
  onEventClick,
  onGoToToday
}) => {
  const weekday = getWeekdayName(currentDate);
  const formattedDate = formatDate(currentDate);
  const season = getSeason(currentDate.monthIndex);
  
  // Moon phases
  const mannsliebPhase = getMannsliebPhase(currentDate);
  const morrsliebPhase = getMorrsliebPhase(currentDate);
  const mannsliebDesc = getMoonPhaseDescription(mannsliebPhase);
  const morrsliebDesc = getMoonPhaseDescription(morrsliebPhase);
  const morrsliebDanger = isMorrsliebDangerous(currentDate);

  // Upcoming events (filtered by enabled tags)
  const upcomingEvents = getUpcomingEvents(
    events,
    currentDate,
    10,
    enabledTags.length > 0 ? enabledTags : undefined
  );

  const getSeasonEmoji = (s: Season): string => {
    switch (s) {
      case 'WINTER': return '❄️';
      case 'SPRING': return '🌸';
      case 'SUMMER': return '☀️';
      case 'AUTUMN': return '🍂';
    }
  };

  const getMoonEmoji = (phase: number): string => {
    if (phase >= 95) return '🌕';
    if (phase >= 75) return '🌔';
    if (phase >= 50) return '🌓';
    if (phase >= 25) return '🌒';
    return '🌑';
  };

  return (
    <div className={styles.sidebar}>
      {/* Current Date Section */}
      <div className={styles.sidebarSection}>
        <h3 className={styles.sectionTitle}>Current Date</h3>
        <div className={styles.currentDateDisplay}>
          <div className={styles.dateWeekday}>{weekday}</div>
          <div className={styles.dateMain}>📅 {formattedDate}</div>
          <div className={styles.dateSeason}>
            {getSeasonEmoji(season)} {season.charAt(0) + season.slice(1).toLowerCase()}
          </div>
        </div>
        <div className={styles.timeControls}>
          <button className={styles.timeButton} onClick={onAdvanceDay} title="Advance 1 Day">
            +1 Day
          </button>
          <button className={styles.timeButton} onClick={onAdvanceWeek} title="Advance 1 Week (8 days)">
            +1 Week
          </button>
          <button className={styles.timeButtonSecondary} onClick={onSetDate} title="Set Specific Date">
            Set Date
          </button>
        </div>
      </div>

      {/* Weather Section */}
      <div className={styles.sidebarSection}>
        <h3 className={styles.sectionTitle}>Weather</h3>
        <div className={styles.weatherDisplay}>
          {currentWeather ? (
            <span className={styles.weatherText}>🌤️ {currentWeather}</span>
          ) : (
            <span className={styles.weatherText}>No weather set</span>
          )}
          <button className={styles.weatherButton} onClick={onGenerateWeather} title="Roll Weather">
            🎲 Roll
          </button>
        </div>
      </div>

      {/* Moon Phases Section */}
      <div className={styles.sidebarSection}>
        <h3 className={styles.sectionTitle}>Moon Phases</h3>
        <div className={styles.moonDisplay}>
          <div className={styles.moonPhase}>
            <span className={styles.moonIcon}>{getMoonEmoji(mannsliebPhase)}</span>
            <span className={styles.moonName}>Mannslieb:</span>
            <span className={styles.moonDesc}>{mannsliebDesc} ({mannsliebPhase}%)</span>
          </div>
          <div className={`${styles.moonPhase} ${morrsliebDanger ? styles.moonDanger : ''}`}>
            <span className={styles.moonIcon}>{getMoonEmoji(morrsliebPhase)}</span>
            <span className={styles.moonName}>Morrslieb:</span>
            <span className={styles.moonDesc}>
              {morrsliebDesc}
              {morrsliebDanger && <span className={styles.dangerBadge}>⚠️ Danger!</span>}
            </span>
          </div>
        </div>
      </div>

      {/* Tag Filters Section */}
      <div className={styles.sidebarSection}>
        <h3 className={styles.sectionTitle}>Event Filters</h3>
        <div className={styles.tagFilters}>
          {eventTags.map(tag => (
            <label key={tag} className={styles.tagFilter}>
              <input
                type="checkbox"
                checked={enabledTags.includes(tag)}
                onChange={() => onToggleTag(tag)}
              />
              <span 
                className={styles.tagLabel}
                style={{ 
                  borderColor: DEFAULT_EVENT_TAGS[tag] || '#d4af37',
                  backgroundColor: enabledTags.includes(tag) 
                    ? (DEFAULT_EVENT_TAGS[tag] || '#d4af37') + '33'
                    : 'transparent'
                }}
              >
                {tag}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Upcoming Events Section */}
      <div className={styles.sidebarSection + ' ' + styles.eventsSection}>
        <h3 className={styles.sectionTitle}>Upcoming Events</h3>
        <button className={styles.goToTodayButton} onClick={onGoToToday}>
          Go to Today
        </button>
        <div className={styles.eventsList}>
          {upcomingEvents.length === 0 ? (
            <div className={styles.noEvents}>No upcoming events</div>
          ) : (
            upcomingEvents.map(event => {
              const daysAway = daysBetween(currentDate, event.date);
              const daysLabel = daysAway === 0 ? 'Today' : 
                              daysAway === 1 ? 'Tomorrow' :
                              `${daysAway} days`;

              return (
                <div
                  key={event.id}
                  className={styles.eventItem}
                  onClick={() => onEventClick(event)}
                  style={{ borderLeftColor: event.color || '#d4af37' }}
                >
                  <div className={styles.eventHeader}>
                    <span className={styles.eventDate}>
                      {event.date.day} {formatDate(event.date).split(',')[0].split(' ')[1]}
                    </span>
                    <span className={styles.eventDaysAway}>({daysLabel})</span>
                  </div>
                  <div className={styles.eventTitle}>
                    {event.isVisibleToPlayers && <span title="Visible to players">👁️ </span>}
                    {event.title}
                  </div>
                  <div className={styles.eventTags}>
                    {event.tags.map(tag => (
                      <span 
                        key={tag} 
                        className={styles.eventTag}
                        style={{ backgroundColor: DEFAULT_EVENT_TAGS[tag] || '#6c757d' }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default TimelineSidebar;
