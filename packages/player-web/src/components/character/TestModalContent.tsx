import { useState } from 'react'
import { rolld100, calculateSuccessLevel } from '@wfrp/shared'
import { Badge } from '../ui/Badge'

interface TestModalContentProps {
  characterName: string
  testName: string
  baseTarget: number
  onClose: () => void
  onResult: (result: TestResult) => void
}

export interface TestResult {
  characterName: string
  testName: string
  targetNumber: number
  rollResult: number
  successLevel: number
}

export function TestModalContent({
  characterName,
  testName,
  baseTarget,
  onClose,
  onResult,
}: TestModalContentProps) {
  const [modifier, setModifier] = useState(0)
  const [result, setResult] = useState<TestResult | null>(null)

  const finalTarget = Math.max(0, baseTarget + modifier)

  const handleRoll = () => {
    const roll = rolld100()
    const sl = calculateSuccessLevel(roll, finalTarget)
    const testResult: TestResult = {
      characterName,
      testName,
      targetNumber: finalTarget,
      rollResult: roll,
      successLevel: sl,
    }
    setResult(testResult)
    onResult(testResult)
    // Auto-close after brief delay to show result
    setTimeout(onClose, 1500)
  }

  const isSuccess = result ? result.successLevel > 0 : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2
          id="modal-title-test-modal"
          className="font-display text-xl text-accent tracking-wide m-0"
        >
          {testName} Test
        </h2>
        <p className="text-sm text-secondary mt-1">{characterName}</p>
      </div>

      {/* Target Display */}
      <div className="text-center py-3 bg-bg-dark rounded-sm">
        <p className="text-xs text-secondary mb-1">Target Number</p>
        <p className="text-3xl font-display text-primary m-0">
          {baseTarget}
          {modifier !== 0 && (
            <span className={modifier > 0 ? 'text-poison-light' : 'text-blood-light'}>
              {' '}
              {modifier > 0 ? '+' : ''}
              {modifier}
            </span>
          )}
          {modifier !== 0 && (
            <span className="text-accent"> = {finalTarget}</span>
          )}
        </p>
      </div>

      {/* Modifier Input */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-secondary whitespace-nowrap">Modifier:</label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setModifier((m) => m - 10)}
            className="w-8 h-8 flex items-center justify-center rounded-sm bg-bg-dark border border-border-dark text-primary hover:border-brass transition-colors"
          >
            −10
          </button>
          <input
            type="number"
            value={modifier}
            onChange={(e) => setModifier(parseInt(e.target.value, 10) || 0)}
            step={10}
            className="w-16 text-center bg-bg-dark border border-border-dark rounded-sm px-2 py-1.5 text-primary text-sm focus:border-brass focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setModifier((m) => m + 10)}
            className="w-8 h-8 flex items-center justify-center rounded-sm bg-bg-dark border border-border-dark text-primary hover:border-brass transition-colors"
          >
            +10
          </button>
        </div>
      </div>

      {/* Result Display */}
      {result && (
        <div className="text-center py-4 rounded-sm border border-border-dark bg-bg-dark space-y-2">
          <p className="text-4xl font-display m-0 text-primary">{result.rollResult}</p>
          <div className="flex items-center justify-center gap-2">
            <Badge variant={isSuccess ? 'success' : 'danger'}>
              {isSuccess ? 'Success' : 'Failure'}
            </Badge>
            <span className="text-sm text-secondary">
              SL: {result.successLevel > 0 ? '+' : ''}
              {Math.floor(result.successLevel)}
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      {!result && (
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleRoll}
            className="flex-1 py-2.5 px-4 rounded-sm font-display tracking-wide text-sm
              bg-brass text-text-on-brass border border-brass-dark
              hover:bg-brass-light active:bg-brass-dark transition-colors"
          >
            Roll d100
          </button>
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-sm font-display tracking-wide text-sm
              bg-bg-dark text-secondary border border-border-dark
              hover:text-primary hover:border-border-subtle transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
