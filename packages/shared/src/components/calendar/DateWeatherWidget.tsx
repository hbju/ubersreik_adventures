import React from 'react';
import {
  GameDate,
  formatDate,
  getMannsliebPhase,
  getMorrsliebPhase,
  getMoonPhaseDescription,
  isMorrsliebDangerous,
} from '../../data/calendar';
import styles from './DateWeatherWidget.module.css';

interface DateWeatherWidgetProps {
  currentDate: GameDate;
  weather?: string;
  onClick?: () => void;
}

function getMoonEmoji(phase: number): string {
  if (phase >= 95) return '🌕';
  if (phase >= 75) return '🌔';
  if (phase >= 50) return '🌓';
  if (phase >= 25) return '🌒';
  return '🌑';
}

export const DateWeatherWidget: React.FC<DateWeatherWidgetProps> = ({
  currentDate,
  weather,
  onClick
}) => {
  const mannsliebPhase = getMannsliebPhase(currentDate);
  const morrsliebPhase = getMorrsliebPhase(currentDate);
  const morrsliebDanger = isMorrsliebDangerous(currentDate);
  const formattedDate = formatDate(currentDate);

  return (
    <div className={styles.widget} onClick={onClick} title="Open Calendar">
      <span className={styles.dateText}>📅 {formattedDate}</span>

      {weather && (
        <>
          <span className={styles.separator}>|</span>
          <span className={styles.weatherText}>🌤️ {weather}</span>
        </>
      )}

      <span className={styles.separator}>|</span>
      <span className={`${styles.moonText} ${morrsliebDanger ? styles.dangerMoon : ''}`}>
        {getMoonEmoji(mannsliebPhase)} {getMoonEmoji(morrsliebPhase)}
        {morrsliebDanger && ' ⚠️'}
      </span>
    </div>
  );
};

export default DateWeatherWidget;
