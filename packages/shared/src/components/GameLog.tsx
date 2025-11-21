import React from 'react';
import { useTranslation } from 'react-i18next';
import './GameLog.css';

export interface LogEntry {
  id: string;
  type: 'roll' | 'info' | 'system';
  content: string;
  messageCode?: string;
  params?: Record<string, any>;
}

interface GameLogProps {
  entries: LogEntry[];
}

export const GameLog: React.FC<GameLogProps> = ({ entries }) => {
  const { t } = useTranslation();
  return (
    <div className="gameLogContainer">
      <ul className="logList">
        {entries.map(entry => (
          <li key={entry.id} className={`logEntry ${entry.type}`}>
            {entry.messageCode ? t(entry.messageCode, entry.params) : entry.content}
          </li>
        ))}
      </ul>
    </div>
  );
};