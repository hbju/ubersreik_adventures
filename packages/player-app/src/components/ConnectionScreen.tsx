import React, { useState } from 'react';
import styles from './ConnectionScreen.module.css';

interface ConnectionScreenProps {
  onConnect: (ip: string, username: string, password: string) => void;
  error?: string;
  isConnecting?: boolean;
}

export const ConnectionScreen: React.FC<ConnectionScreenProps> = ({ onConnect, error, isConnecting }) => {
  const [ip, setIp] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleConnect = () => {
    if (ip.trim() && username.trim() && password.trim()) {
      onConnect(ip.trim(), username.trim(), password.trim());
    }
  };

  const isFormValid = ip.trim() && username.trim() && password.trim();

  return (
    <div className={styles.connectionContainer}>
      <div className={styles.connectionBox}>
        <h1 className={styles.title}>Ubersreik Adventures</h1>
        <p className={styles.subtitle}>Enter your credentials to join the adventure</p>
        
        <div className={styles.formGroup}>
          <label className={styles.label}>Game Master's IP Address</label>
          <input
            type="text"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="e.g., 192.168.1.100"
            onKeyUp={(e) => e.key === 'Enter' && isFormValid && handleConnect()}
            className={styles.input}
            disabled={isConnecting}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your username"
            onKeyUp={(e) => e.key === 'Enter' && isFormValid && handleConnect()}
            className={styles.input}
            disabled={isConnecting}
            autoComplete="username"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Password</label>
          <div className={styles.passwordContainer}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              onKeyUp={(e) => e.key === 'Enter' && isFormValid && handleConnect()}
              className={styles.input}
              disabled={isConnecting}
              autoComplete="current-password"
            />
            <button
              type="button"
              className={styles.togglePassword}
              onClick={() => setShowPassword(!showPassword)}
              disabled={isConnecting}
            >
              {showPassword ? '👁️' : '🔒'}
            </button>
          </div>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            ⚠️ {error}
          </div>
        )}

        <button 
          onClick={handleConnect} 
          className={styles.connectButton}
          disabled={!isFormValid || isConnecting}
        >
          {isConnecting ? '🔄 Connecting...' : 'Login & Join Game'}
        </button>

        <div className={styles.helpText}>
          Contact your Game Master if you need login credentials.
        </div>
      </div>
    </div>
  );
};