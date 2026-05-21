import { useEffect, useRef } from 'react'
import { usePlayerNavigation, type PlayerView } from '../../context/PlayerNavigationContext'
import { CharacterView } from '../character/CharacterView'

const VIEW_LABELS: Record<PlayerView, string> = {
  character: 'Character Sheet',
  map: 'Campaign Map',
  journal: 'Journal & Quests',
  chat: 'Chat',
  shops: 'Shops',
  codex: 'Codex',
  calendar: 'Calendar',
}

function ViewPlaceholder({ view }: { view: PlayerView }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="wfrp-panel wfrp-grain-overlay max-w-md w-full text-center py-12 px-6">
        <p className="font-display text-2xl text-accent mb-2 tracking-wide">
          {VIEW_LABELS[view]}
        </p>
        <p className="text-secondary text-sm mb-0">
          This view will be implemented in the next sprint.
        </p>
      </div>
    </div>
  )
}

export function ViewContainer() {
  const { activeView } = usePlayerNavigation()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Reset scroll on view switch
  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [activeView])

  const renderView = () => {
    switch (activeView) {
      case 'character':
        return <CharacterView />
      default:
        return <ViewPlaceholder view={activeView} />
    }
  }

  return (
    <main
      ref={scrollRef}
      className="flex flex-1 flex-col overflow-y-auto wfrp-scrollbar p-4 md:p-6 lg:p-8"
    >
      {renderView()}
    </main>
  )
}
