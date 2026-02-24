import React from 'react';
import type { ItemQualityDefinition } from '../../../types/wfrp.types';
import styles from '../CodexViewer.module.css';

interface QualityCodexDisplayProps {
  data: unknown;
}

export function QualityCodexDisplay({ data }: QualityCodexDisplayProps) {
  const quality = data as ItemQualityDefinition;

  return (
    <div className={styles.jsonDisplay}>
      <div className={styles.tagList}>
        <span className={styles.tag}>
          {quality.type === 'quality' ? '✅ Quality' : '⚠️ Flaw'}
        </span>
        {quality.equipment && (
          <span className={styles.tag}>
            {quality.equipment.charAt(0).toUpperCase() + quality.equipment.slice(1)}
          </span>
        )}
      </div>

      <p className={styles.description}>{quality.description}</p>
    </div>
  );
}
