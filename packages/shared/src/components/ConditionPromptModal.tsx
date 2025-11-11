import React, { useState } from 'react';
import { Combatant, Character } from '../types/wfrp.types';
import { checkConditionEffects, ConditionCheckResult } from '../utils/conditions';
import { rolld100, calculateSuccessLevel } from '../utils/mechanics';
import conditionsData from '../data/conditions.json';

interface ConditionPromptModalProps {
  combatant: Combatant;
  character?: Character;
  conditions: string[];
  onClose: () => void;
  onApplyEffects: (conditionsRemoved: number, conditionsAdded: string[], log: string[]) => void;
}

export const ConditionPromptModal: React.FC<ConditionPromptModalProps> = ({
  combatant,
  character,
  conditions,
  onClose,
  onApplyEffects
}) => {
  const [currentConditionIndex, setCurrentConditionIndex] = useState(0);
  const [testRoll, setTestRoll] = useState<number | null>(null);
  const [testTarget, setTestTarget] = useState<number>(50);
  const [log, setLog] = useState<string[]>([]);
  const [conditionsRemoved, setConditionsRemoved] = useState(0);
  const [conditionsToAdd, setConditionsToAdd] = useState<string[]>([]);

  // Get unique conditions that need processing
  const uniqueConditions = Array.from(new Set(conditions));
  const currentConditionId = uniqueConditions[currentConditionIndex];
  const conditionEffect = currentConditionId ? checkConditionEffects(currentConditionId, combatant, character) : null;
  const conditionCount = conditions.filter(c => c === currentConditionId).length;

  const getConditionName = (conditionId: string): string => {
    const condition = conditionsData.find(c => c.id === conditionId);
    return condition ? condition.name : conditionId;
  };

  const handleRollTest = () => {
    const roll = rolld100();
    setTestRoll(roll);

    if (conditionEffect) {
      const sl = calculateSuccessLevel(roll, testTarget);
      const newLog = [...log];

      if (sl >= 0) {
        // Success - remove 1 + SL conditions
        const removed = Math.min(1 + sl, conditionCount);
        setConditionsRemoved(prev => prev + removed);
        newLog.push(
          `${combatant.name} rolled ${roll} vs ${testTarget} for ${conditionEffect.testType} (SL ${sl}): Success! Removed ${removed} ${getConditionName(currentConditionId)} condition(s).`
        );

        // Check if condition causes another condition when removed
        if (currentConditionId === 'condition_broken' ||
            currentConditionId === 'condition_poisoned' ||
            currentConditionId === 'condition_stunned') {
          if (!combatant.conditions?.includes('condition_fatigued')) {
            setConditionsToAdd(prev => [...prev, 'condition_fatigued']);
            newLog.push(`${combatant.name} gains Fatigued condition.`);
          }
        }

        if (currentConditionId === 'condition_unconscious') {
          setConditionsToAdd(prev => [...prev, 'condition_prone', 'condition_fatigued']);
          newLog.push(`${combatant.name} gains Prone and Fatigued conditions.`);
        }
      } else {
        // Failure
        newLog.push(
          `${combatant.name} rolled ${roll} vs ${testTarget} for ${conditionEffect.testType} (SL ${sl}): Failed. ${getConditionName(currentConditionId)} persists.`
        );
      }

      setLog(newLog);
    }
  };

  const handleSkipTest = () => {
    const newLog = [...log];
    newLog.push(`${combatant.name} skipped ${conditionEffect?.testType} test for ${getConditionName(currentConditionId)}.`);
    setLog(newLog);
    moveToNext();
  };

  const moveToNext = () => {
    if (currentConditionIndex < uniqueConditions.length - 1) {
      setCurrentConditionIndex(prev => prev + 1);
      setTestRoll(null);
    } else {
      // Done with all conditions
      onApplyEffects(conditionsRemoved, conditionsToAdd, log);
      onClose();
    }
  };

  const handleContinue = () => {
    if (testRoll !== null || !conditionEffect?.needsTest) {
      moveToNext();
    }
  };

  const handleAutomatic = () => {
    const newLog = [...log];
    if (currentConditionId === 'condition_surprised' ||
        currentConditionId === 'condition_blinded' ||
        currentConditionId === 'condition_deafened') {
      // These are removed automatically
      setConditionsRemoved(prev => prev + 1);
      console.log('Removing condition automatically:', conditionsRemoved + 1);
      newLog.push(`${combatant.name}'s ${getConditionName(currentConditionId)} condition is automatically removed.`);
    }

    setLog(newLog);
    moveToNext();
  };

  if (!conditionEffect) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#2a2a2a',
        color: '#e0e0e0',
        padding: '24px',
        borderRadius: '8px',
        maxWidth: '600px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '16px', color: '#ffffff' }}>
          Condition: {getConditionName(currentConditionId)}
          {conditionCount > 1 && ` (x${conditionCount})`}
        </h2>

        <div style={{
          padding: '12px',
          backgroundColor: '#1a1a1a',
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '14px',
          lineHeight: '1.5'
        }}>
          {conditionEffect.description}
        </div>

        {conditionEffect.needsTest ? (
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '12px' }}>Test Required: {conditionEffect.testType}</h3>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px' }}>
                Target Number:
              </label>
              <input
                type="number"
                value={testTarget}
                onChange={(e) => setTestTarget(parseInt(e.target.value) || 0)}
                style={{
                  padding: '8px',
                  backgroundColor: '#1a1a1a',
                  color: '#e0e0e0',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  width: '100px'
                }}
              />
              {conditionEffect.testDifficulty !== undefined && conditionEffect.testDifficulty !== 0 && (
                <span style={{ marginLeft: '8px', fontSize: '14px', color: '#888' }}>
                  (Difficulty modifier: {conditionEffect.testDifficulty > 0 ? '+' : ''}{conditionEffect.testDifficulty})
                </span>
              )}
            </div>

            {testRoll === null ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleRollTest}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  Roll {conditionEffect.testType} Test
                </button>
                <button
                  onClick={handleSkipTest}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Skip Test
                </button>
              </div>
            ) : (
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  padding: '12px',
                  backgroundColor: '#1a1a1a',
                  borderRadius: '4px',
                  marginBottom: '8px'
                }}>
                  <strong>Roll Result:</strong> {testRoll} vs {testTarget}
                  <br />
                  <strong>SL:</strong> {calculateSuccessLevel(testRoll, testTarget)}
                </div>
                <button
                  onClick={handleContinue}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: '14px', color: '#aaa' }}>
              This condition has automatic effects. No test required.
            </p>
            <button
              onClick={handleAutomatic}
              style={{
                padding: '10px 20px',
                backgroundColor: '#2196F3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Apply Effects & Continue
            </button>
          </div>
        )}

        {log.length > 0 && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#1a1a1a',
            borderRadius: '4px',
            maxHeight: '150px',
            overflow: 'auto'
          }}>
            <h4 style={{ marginTop: 0, marginBottom: '8px', fontSize: '14px' }}>Log:</h4>
            {log.map((entry, index) => (
              <div key={index} style={{ fontSize: '12px', marginBottom: '4px', color: '#ccc' }}>
                {entry}
              </div>
            ))}
          </div>
        )}

        <div style={{
          marginTop: '16px',
          paddingTop: '16px',
          borderTop: '1px solid #444',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '14px',
          color: '#888'
        }}>
          <span>
            Condition {currentConditionIndex + 1} of {uniqueConditions.length}
          </span>
          <button
            onClick={() => {
              onApplyEffects(conditionsRemoved, conditionsToAdd, log);
              onClose();
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Finish & Close
          </button>
        </div>
      </div>
    </div>
  );
};
