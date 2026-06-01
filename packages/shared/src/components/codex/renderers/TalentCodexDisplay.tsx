import React from 'react';
import type { Talent, TalentEffect } from '../../../types/wfrp.types';
import styles from '../CodexViewer.module.css';

interface TalentCodexDisplayProps {
  data: unknown;
}

function effectLabel(effect: TalentEffect): string {
  return (effect.type ?? effect.kind ?? 'effect')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function TalentCodexDisplay({ data }: TalentCodexDisplayProps) {
  const talent = data as Talent;

  return (
    <div className={styles.jsonDisplay}>
      <p className={styles.description}>{talent.description}</p>

      {/* Tests */}
      {talent.tests && talent.tests.length > 0 && (
        <>
          <h3>Tests</h3>
          <div className={styles.tagList}>
            {talent.tests.map((t, i) => (
              <span key={i} className={styles.tag}>{t}</span>
            ))}
          </div>
        </>
      )}

      {/* Max Ranks */}
      <h3>Max Ranks</h3>
      <p>
        {typeof talent.max_ranks === 'number'
          ? talent.max_ranks
          : talent.max_ranks?.toString().toUpperCase() + ' Bonus'}
      </p>

      {/* Effects */}
      {talent.effects && talent.effects.length > 0 && (
        <>
          <h3>Effects</h3>
          {talent.effects.map((eff, i) => (
            <div key={i} className={styles.effectItem}>
              <span className={styles.effectType}>
                {effectLabel(eff)}
              </span>
              <span className={styles.effectValue}>
                {typeof eff.value === 'number' && eff.value > 0 ? '+' : ''}
                {eff.value}
              </span>
              {eff.appliesTo && eff.appliesTo.length > 0 && (
                <span className={styles.effectAppliesTo}>
                  → {eff.appliesTo.join(', ')}
                </span>
              )}
            </div>
          ))}
        </>
      )}

      {/* Careers */}
      {talent.careers && Object.keys(talent.careers).length > 0 && (
        <>
          <h3>Available in Careers</h3>
          <div className={styles.tagList}>
            {Object.entries(talent.careers).map(([career, level]) => (
              <span key={career} className={styles.tag}>
                {career} (Tier {level})
              </span>
            ))}
          </div>
        </>
      )}

      {/* Racial */}
      {talent.racial && talent.racial.length > 0 && (
        <>
          <h3>Racial Talent</h3>
          <div className={styles.tagList}>
            {talent.racial.map((r, i) => (
              <span key={i} className={styles.tag}>{r}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
