import { useCallback } from 'react'
import { sendMessage as chatSendMessage } from '@wfrp/shared'
import { usePlayerSession } from '../../context/PlayerSessionContext'
import { usePlayerModal } from '../../context/PlayerModalContext'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { CharacterHeader } from './CharacterHeader'
import { StatusBar } from './StatusBar'
import { ConditionsBar } from './ConditionsBar'
import { CharacteristicsGrid } from './CharacteristicsGrid'
import { SkillsPanel } from './SkillsPanel'
import { TalentsPanel } from './TalentsPanel'
import { InventoryPanel } from './InventoryPanel'
import { Divider } from '../ui/Divider'
import { TestModalContent, type TestResult } from './TestModalContent'

export function CharacterView() {
  const { playerData, serviceContext } = usePlayerSession()
  const { openModal, closeModal } = usePlayerModal()
  const breakpoint = useBreakpoint()
  const character = playerData.character

  const handleTestResult = useCallback(
    async (result: TestResult) => {
      if (!serviceContext) return
      const content = `${result.testName}: rolled ${result.rollResult} vs ${result.targetNumber} → SL ${result.successLevel > 0 ? '+' : ''}${Math.floor(result.successLevel)}`
      await chatSendMessage(
        serviceContext.client,
        serviceContext.campaignId,
        serviceContext.userId,
        result.characterName,
        content,
        'dice_roll',
        {
          formula: `d100 vs ${result.targetNumber}`,
          rolls: [result.rollResult],
          modifier: 0,
          total: result.rollResult,
          targetNumber: result.targetNumber,
          successLevel: result.successLevel,
          testName: result.testName,
        }
      )
    },
    [serviceContext]
  )

  const handleCharacteristicClick = useCallback(
    (_charId: string, charName: string, charValue: number) => {
      if (!character) return
      openModal(
        'test-modal',
        <TestModalContent
          characterName={character.name}
          testName={charName}
          baseTarget={charValue}
          onClose={() => closeModal('test-modal')}
          onResult={handleTestResult}
        />,
        {
          variant: breakpoint === 'mobile' ? 'sheet' : 'modal',
          size: 'sm',
        }
      )
    },
    [character, openModal, closeModal, handleTestResult, breakpoint]
  )

  const handleSkillClick = useCallback(
    (_skillId: string, skillName: string, skillValue: number) => {
      if (!character) return
      openModal(
        'test-modal',
        <TestModalContent
          characterName={character.name}
          testName={skillName}
          baseTarget={skillValue}
          onClose={() => closeModal('test-modal')}
          onResult={handleTestResult}
        />,
        {
          variant: breakpoint === 'mobile' ? 'sheet' : 'modal',
          size: 'sm',
        }
      )
    },
    [character, openModal, closeModal, handleTestResult, breakpoint]
  )

  if (!character) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="wfrp-panel wfrp-grain-overlay max-w-md w-full text-center py-12 px-6">
          <p className="font-display text-xl text-accent mb-2">No Character Assigned</p>
          <p className="text-secondary text-sm">
            Your GM has not yet assigned a character to you.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 w-full max-w-6xl mx-auto">
      <CharacterHeader character={character} />
      <StatusBar character={character} onUpdate={playerData.updateCharacter} />
      {character.conditions.length > 0 && (
        <ConditionsBar conditions={character.conditions} />
      )}
      <CharacteristicsGrid
        character={character}
        onCharacteristicClick={handleCharacteristicClick}
      />
      <Divider variant="ornate" />
      <div
        className={
          breakpoint === 'desktop'
            ? 'grid grid-cols-2 gap-4 items-start'
            : 'space-y-4'
        }
      >
        <SkillsPanel character={character} onSkillClick={handleSkillClick} />
        <TalentsPanel character={character} />
      </div>
      <Divider variant="ornate" />
      <InventoryPanel character={character} onUpdate={playerData.updateCharacter} />
    </div>
  )
}
