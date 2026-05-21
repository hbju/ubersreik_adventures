import { usePlayerSession } from '../../context/PlayerSessionContext'

type ConnectionState = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING'

const STATUS_CONFIG: Record<ConnectionState, { color: string; label: string; tooltip: string }> = {
  CONNECTED: {
    color: 'bg-poison-light',
    label: 'Connected',
    tooltip: 'Connected',
  },
  RECONNECTING: {
    color: 'bg-warning animate-pulse-slow',
    label: 'Reconnecting…',
    tooltip: 'Reconnecting…',
  },
  DISCONNECTED: {
    color: 'bg-blood-light',
    label: 'Disconnected',
    tooltip: 'Disconnected — retrying',
  },
}

export function ConnectionIndicator({ showLabel = false }: { showLabel?: boolean }) {
  const { playerData } = usePlayerSession()
  const state = (playerData.ephemeralConnectionState ?? 'DISCONNECTED') as ConnectionState
  const config = STATUS_CONFIG[state]

  return (
    <div className="flex items-center gap-2" title={config.tooltip}>
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${config.color}`} />
      {showLabel && (
        <span className="text-xs text-secondary hidden lg:inline">
          {config.label}
        </span>
      )}
    </div>
  )
}
