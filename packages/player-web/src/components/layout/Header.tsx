import { usePlayerSession } from '../../context/PlayerSessionContext'

export function Header() {
  const { campaignName, playerData } = usePlayerSession()
  const characterName = playerData.character?.name ?? null
  const careerHistory = playerData.character?.careerHistory
  const currentCareer = careerHistory?.length
    ? careerHistory[careerHistory.length - 1].careerName
    : null
  const isOnline = playerData.isConnected

  return (
    <header className="fixed top-0 left-0 right-0 z-40 flex h-14 md:h-[56px] items-center border-b border-brass bg-bg-dark px-4">
      {/* Left: Campaign name */}
      <div className="flex-1 min-w-0">
        <p className="mb-0 truncate text-sm text-secondary font-body">
          {campaignName}
        </p>
      </div>

      {/* Center: Character name + career */}
      <div className="flex-1 text-center min-w-0 hidden sm:block">
        {characterName && (
          <p className="mb-0 truncate font-display text-base text-accent tracking-wide">
            {characterName}
            {currentCareer && (
              <span className="text-secondary text-sm ml-2">— {currentCareer}</span>
            )}
          </p>
        )}
      </div>

      {/* Right: Connection indicator + settings */}
      <div className="flex-1 flex items-center justify-end gap-3">
        {/* Connection dot */}
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            isOnline ? 'bg-poison-light' : 'bg-blood-light'
          }`}
          title={isOnline ? 'Connected' : 'Disconnected'}
        />

        {/* Settings gear */}
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-sm border-0 bg-transparent p-0 shadow-none hover:text-accent"
          aria-label="Settings"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-secondary"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </header>
  )
}
