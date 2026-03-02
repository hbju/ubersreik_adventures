import React from 'react';
import type { SkillCharDefinition } from '../../../types/wfrp.types';
import styles from '../CodexViewer.module.css';

const CHAR_FULL_NAMES: Record<string, string> = {
  ws: 'Weapon Skill',
  bs: 'Ballistic Skill',
  s: 'Strength',
  t: 'Toughness',
  i: 'Initiative',
  ag: 'Agility',
  dex: 'Dexterity',
  int: 'Intelligence',
  wp: 'Willpower',
  fel: 'Fellowship',
};

interface SkillCodexDisplayProps {
  data: unknown;
}

export function SkillCodexDisplay({ data }: SkillCodexDisplayProps) {
  const skill = data as SkillCharDefinition;

  return (
    <div className={styles.jsonDisplay}>
      <div className={styles.tagList}>
        <span className={styles.tag}>
          {CHAR_FULL_NAMES[skill.characteristic] ?? skill.characteristic}
        </span>
        {skill.classification && (
          <span className={styles.tag}>
            {skill.classification === 'advanced' ? '⚡ Advanced' : '📗 Basic'}
          </span>
        )}
      </div>

      <h3>Linked Characteristic</h3>
      <p>
        <strong>{CHAR_FULL_NAMES[skill.characteristic] ?? skill.characteristic.toUpperCase()}</strong>{' '}
        ({skill.characteristic.toUpperCase()})
      </p>

      <h3>Type</h3>
      <p>{skill.classification === 'advanced' ? 'Advanced Skill — must be trained before use' : 'Basic Skill — can be attempted untrained at base characteristic value'}</p>
    </div>
  );
}
