import React from 'react';
import type { Condition } from '../../../types/wfrp.types';
import styles from '../CodexViewer.module.css';

interface ConditionCodexDisplayProps {
  data: unknown;
}

export function ConditionCodexDisplay({ data }: ConditionCodexDisplayProps) {
  const condition = data as Condition;

  return (
    <div className={styles.jsonDisplay}>
      <p className={styles.description}>
        {condition.description?.split('\n\n').map((para, i) => (
          <React.Fragment key={i}>
            {i > 0 && <br />}
            <span>{para}</span>
            <br />
          </React.Fragment>
        ))}
      </p>

      <div className={styles.tagList}>
        <span className={styles.tag}>
          {condition.stack !== undefined && condition.stack > 0
            ? `Stacks (current: ${condition.stack})`
            : 'Can Stack'}
        </span>
      </div>
    </div>
  );
}
