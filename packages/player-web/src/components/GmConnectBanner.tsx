import React, { useState } from 'react';

interface GmConnectBannerProps {
  isConnected: boolean;
  isAuthenticated: boolean;
  error: string | null;
  onConnect: (address: string) => void;
  onDisconnect: () => void;
}

export const GmConnectBanner: React.FC<GmConnectBannerProps> = ({
  isConnected,
  isAuthenticated,
  error,
  onConnect,
  onDisconnect
}) => {
  const [showForm, setShowForm] = useState(false);
  const [address, setAddress] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (address.trim()) {
      onConnect(address.trim());
      setShowForm(false);
    }
  };

  if (isConnected && isAuthenticated) {
    return (
      <div className="gm-connection-banner connected">
        🟢 Connected to GM session
        <button
          onClick={onDisconnect}
          style={{
            marginLeft: '12px',
            padding: '2px 10px',
            fontSize: '0.75rem',
            background: 'transparent',
            color: 'var(--color-parchment)',
            border: '1px solid var(--color-parchment)',
            cursor: 'pointer',
            textTransform: 'none',
          }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="gm-connection-banner disconnected">
      {error ? (
        <span>⚠️ {error}</span>
      ) : isConnected ? (
        <span>⏳ Authenticating...</span>
      ) : (
        <span>🔴 Not connected to GM session</span>
      )}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          style={{
            marginLeft: '12px',
            padding: '2px 10px',
            fontSize: '0.75rem',
            background: 'transparent',
            color: 'var(--color-parchment)',
            border: '1px solid var(--color-parchment)',
            cursor: 'pointer',
            textTransform: 'none',
          }}
        >
          Connect
        </button>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'inline-flex', gap: '6px', marginLeft: '12px' }}>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="GM IP address"
            style={{
              padding: '2px 8px',
              fontSize: '0.75rem',
              width: '160px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid var(--color-parchment)',
              color: 'var(--color-parchment)',
            }}
            autoFocus
          />
          <button
            type="submit"
            style={{
              padding: '2px 10px',
              fontSize: '0.75rem',
              background: 'transparent',
              color: 'var(--color-parchment)',
              border: '1px solid var(--color-parchment)',
              cursor: 'pointer',
              textTransform: 'none',
            }}
          >
            Go
          </button>
          <button
            type="button"
            onClick={() => setShowForm(false)}
            style={{
              padding: '2px 10px',
              fontSize: '0.75rem',
              background: 'transparent',
              color: 'var(--color-parchment)',
              border: '1px solid var(--color-parchment)',
              cursor: 'pointer',
              textTransform: 'none',
            }}
          >
            ✕
          </button>
        </form>
      )}
    </div>
  );
};
