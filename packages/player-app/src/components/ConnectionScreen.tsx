import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@wfrp/shared';
import styles from './ConnectionScreen.module.css';

const STORAGE_KEY = 'wfrp_saved_credentials';

interface SavedCredentials {
  ip: string;
  username: string;
  password: string;
}

interface ConnectionScreenProps {
  onConnect: (ip: string, username: string, password: string) => void;
  error?: string;
  isConnecting?: boolean;
}

export const ConnectionScreen: React.FC<ConnectionScreenProps> = ({ onConnect, error, isConnecting }) => {
  const { t } = useTranslation();
  const [ip, setIp] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Load saved credentials on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const credentials: SavedCredentials = JSON.parse(saved);
        setIp(credentials.ip || '');
        setUsername(credentials.username || '');
        setPassword(credentials.password || '');
        setRememberMe(true);
      }
    } catch (e) {
      console.error('Failed to load saved credentials:', e);
    }
  }, []);

  const handleConnect = () => {
    if (ip.trim() && username.trim() && password.trim()) {
      if (rememberMe) {
        const credentials: SavedCredentials = {
          ip: ip.trim(),
          username: username.trim(),
          password: password.trim()
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      onConnect(ip.trim(), username.trim(), password.trim());
    }
  };

  const isFormValid = ip.trim() && username.trim() && password.trim();

  return (
    <div className={styles.connectionContainer}>
      <div className={styles.connectionBox}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <LanguageSwitcher />
        </div>
        <h1 className={styles.title}>{t('connection.title')}</h1>
        <p className={styles.subtitle}>{t('connection.subtitle')}</p>
        
        <div className={styles.formGroup}>
          <label className={styles.label}>{t('connection.ipLabel')}</label>
          <input
            type="text"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder={t('connection.placeholderIp')}
            onKeyUp={(e) => e.key === 'Enter' && isFormValid && handleConnect()}
            className={styles.input}
            disabled={isConnecting}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>{t('connection.usernameLabel')}</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t('connection.placeholderUsername')}
            onKeyUp={(e) => e.key === 'Enter' && isFormValid && handleConnect()}
            className={styles.input}
            disabled={isConnecting}
            autoComplete="username"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>{t('connection.passwordLabel')}</label>
          <div className={styles.passwordContainer}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('connection.placeholderPassword')}
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

        <div className={styles.rememberMeContainer}>
          <label className={styles.rememberMeLabel}>
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className={styles.rememberMeCheckbox}
              disabled={isConnecting}
            />
            <span className={styles.rememberMeText}>{t('connection.rememberMe')}</span>
          </label>
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
          {isConnecting ? t('connection.connecting') : t('connection.connectButton')}
        </button>

        <div className={styles.helpText}>
          {t('connection.helpText')}
        </div>
      </div>
    </div>
  );
};