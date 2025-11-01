import React, { useState } from 'react';
import styles from './ConnectionScreen.module.css';

interface ConnectionScreenProps {
  onConnect: (ip: string) => void;
}

export const ConnectionScreen: React.FC<ConnectionScreenProps> = ({ onConnect }) => {
  const [ip, setIp] = useState('');

  const handleConnect = () => {
    if (ip.trim()) {
      onConnect(ip.trim());
    }
  };

  return (
    <div className={styles.connectionContainer}>
      <div className={styles.connectionBox}>
        <h1>WFRP Player Client</h1>
        <p>Enter the Game Master's IP Address to connect.</p>
        <input
          type="text"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="e.g., 192.168.1.100"
          onKeyUp={(e) => e.key === 'Enter' && handleConnect()}
          className={styles.ipInput}
        />
        <button onClick={handleConnect}>Connect</button>
      </div>
    </div>
  );
};