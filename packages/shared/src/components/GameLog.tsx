import React from 'react';
import './GameLog.css';

export interface LogEntry {
  id: string;
  type: 'roll' | 'info' | 'system';
  content: string;
}

interface GameLogProps {
  entries: LogEntry[];
}

export const GameLog: React.FC<GameLogProps> = ({ entries }) => {
  return (
    <div className="gameLogContainer">
      <ul className="logList">
        {entries.map(entry => (
          <li key={entry.id} className={`logEntry ${entry.type}`}>
            {entry.content}
          </li>
        ))}
      </ul>
    </div>
  );
};