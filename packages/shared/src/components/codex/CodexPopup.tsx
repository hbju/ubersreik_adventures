import React, { useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useCodex } from '../../hooks/useCodex';
import type { CodexEntry } from '../../types/codex.types';
import { TalentCodexDisplay } from './renderers/TalentCodexDisplay';
import { SkillCodexDisplay } from './renderers/SkillCodexDisplay';
import { CareerCodexDisplay } from './renderers/CareerCodexDisplay';
import { ConditionCodexDisplay } from './renderers/ConditionCodexDisplay';
import { QualityCodexDisplay } from './renderers/QualityCodexDisplay';
import styles from './CodexPopup.module.css';


interface CodexPopupTriggerProps {
  lookupId: string;
  children: React.ReactNode;
  className?: string;
}

export function CodexPopupTrigger({ lookupId, children, className }: CodexPopupTriggerProps) {
  const { openPopup } = useCodex();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      openPopup(lookupId);
    },
    [lookupId, openPopup],
  );

  return (
    <span className={`${styles.trigger} ${className ?? ''}`} onClick={handleClick} role="button" tabIndex={0}>
      {children}
    </span>
  );
}


const CATEGORY_LABELS: Record<string, string> = {
  talents: 'Talent',
  skills: 'Skill',
  careers: 'Career',
  conditions: 'Condition',
  qualities: 'Quality / Flaw',
  'core-rules': 'Rule',
  combat: 'Combat Rule',
  magic: 'Magic Rule',
};

export function CodexPopupModal() {
  const { popupEntry, closePopup, openViewer } = useCodex();

  const handleOpenFull = useCallback(() => {
    if (popupEntry) {
      closePopup();
      openViewer(popupEntry.id);
    }
  }, [popupEntry, closePopup, openViewer]);

  if (!popupEntry) return null;

  return (
    <>
      <div className={styles.popupOverlay} onClick={closePopup} />
      <div className={styles.popup}>
        <div className={styles.popupHeader}>
          <span className={styles.popupTitle}>{popupEntry.title}</span>
          <span className={styles.popupBadge}>
            {CATEGORY_LABELS[popupEntry.category] ?? popupEntry.category}
          </span>
          <button className={styles.popupOpenFull} onClick={handleOpenFull}>
            Open in Codex
          </button>
          <button className={styles.popupClose} onClick={closePopup} title="Close">
            ✕
          </button>
        </div>
        <div className={styles.popupContent}>
          <PopupEntryRenderer entry={popupEntry} />
        </div>
      </div>
    </>
  );
}

function PopupEntryRenderer({ entry }: { entry: CodexEntry }) {
  if (entry.type === 'markdown') {
    return (
      <div style={{ color: '#d0d0e0', lineHeight: 1.65 }}>
        <ReactMarkdown>{entry.content as string}</ReactMarkdown>
      </div>
    );
  }

  switch (entry.category) {
    case 'talents':
      return <TalentCodexDisplay data={entry.content} />;
    case 'skills':
      return <SkillCodexDisplay data={entry.content} />;
    case 'careers':
      return <CareerCodexDisplay data={entry.content} />;
    case 'conditions':
      return <ConditionCodexDisplay data={entry.content} />;
    case 'qualities':
      return <QualityCodexDisplay data={entry.content} />;
    default:
      return (
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: '#8a8aaa' }}>
          {JSON.stringify(entry.content, null, 2)}
        </pre>
      );
  }
}

export default CodexPopupModal;
