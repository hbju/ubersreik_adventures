import React from 'react';
import type { Career } from '../../../types/wfrp.types';
import styles from '../CodexViewer.module.css';

interface CareerCodexDisplayProps {
  data: unknown;
  onLinkClick?: (href: string) => void;
}

export function CareerCodexDisplay({ data, onLinkClick }: CareerCodexDisplayProps) {
  const career = data as Career;

  return (
    <div className={styles.jsonDisplay}>
      {/* Description */}
      <p className={styles.description}>{career.description}</p>

      {/* Metadata tags */}
      <div className={styles.tagList}>
        {career.class && <span className={styles.tag}>📂 {career.class}</span>}
        {career.races?.map((r) => (
          <span key={r} className={styles.tag}>{r}</span>
        ))}
      </div>

      {/* Career levels */}
      <h2>Career Levels</h2>
      {career.career_level?.map((lvl) => (
        <div key={lvl.id} className={styles.careerLevel}>
          <div className={styles.careerLevelHeader}>
            <span className={styles.careerLevelName}>{lvl.name}</span>
            <span className={styles.careerLevelBadge}>Tier {lvl.lvl}</span>
            {lvl.status && <span className={styles.careerStatusBadge}>{lvl.status}</span>}
          </div>

          {/* Characteristics */}
          {lvl.characteristic_advances && lvl.characteristic_advances.length > 0 && (
            <div className={styles.careerDetailRow}>
              <span className={styles.careerDetailLabel}>Characteristics:</span>
              <span className={styles.careerDetailValue}>
                {lvl.characteristic_advances.map((c) => c.toUpperCase()).join(', ')}
              </span>
            </div>
          )}

          {/* Skills */}
          {lvl.skills_ids && lvl.skills_ids.length > 0 && (
            <div className={styles.careerDetailRow}>
              <span className={styles.careerDetailLabel}>Skills:</span>
              <span className={styles.careerDetailValue}>
                {lvl.skills_ids.map((sid, i) => (
                  <React.Fragment key={sid}>
                    {i > 0 && ', '}
                    <a
                      className={styles.inlineLink}
                      onClick={(e) => {
                        e.preventDefault();
                        onLinkClick?.(`/codex/skill/${sid}`);
                      }}
                      href={`/codex/skill/${sid}`}
                    >
                      {sid.replace(/-/g, ' ').replace(/_/g, ' (')}
                      {sid.includes('_') ? ')' : ''}
                    </a>
                  </React.Fragment>
                ))}
              </span>
            </div>
          )}

          {/* Talents */}
          {lvl.talent_ids && lvl.talent_ids.length > 0 && (
            <div className={styles.careerDetailRow}>
              <span className={styles.careerDetailLabel}>Talents:</span>
              <span className={styles.careerDetailValue}>
                {lvl.talent_ids.map((tid, i) => (
                  <React.Fragment key={tid}>
                    {i > 0 && ', '}
                    <a
                      className={styles.inlineLink}
                      onClick={(e) => {
                        e.preventDefault();
                        onLinkClick?.(`/codex/talent/${tid}`);
                      }}
                      href={`/codex/talent/${tid}`}
                    >
                      {tid.replace(/-/g, ' ').replace(/_/g, ' (')}
                      {tid.includes('_') ? ')' : ''}
                    </a>
                  </React.Fragment>
                ))}
              </span>
            </div>
          )}

          {/* Trappings */}
          {lvl.trappings && lvl.trappings.length > 0 && (
            <div className={styles.careerDetailRow}>
              <span className={styles.careerDetailLabel}>Trappings:</span>
              <span className={styles.careerDetailValue}>
                {lvl.trappings.join(', ')}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
