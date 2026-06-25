import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CombatDecision, CombatDecisionKind, DecisionRequest, LegalDecision } from '@wfrp/shared';
import type { Character } from '@wfrp/shared';
import styles from './PlayerFightScreen.module.css';

interface DecisionPaletteProps {
    decision: DecisionRequest;
    character: Character | null;
    onSubmit: (decision: CombatDecision) => void;
}

// Actions that need a target + optional weapon picker before submitting
const TARGETED_ACTIONS: CombatDecisionKind[] = ['meleeAttack', 'rangedAttack', 'attackWithBoth', 'firstAid', 'intimidate', 'leadership', 'disarm', 'feint', 'distractOpponent', 'beatBlade', 'grappleInitiate'];

// Actions we submit immediately with just {kind, actorId}
const SIMPLE_ACTIONS: CombatDecisionKind[] = ['assess', 'aim', 'reload', 'sprint', 'frenzyEnter', 'frenzyExit', 'disengageDodge', 'grappleMaintain', 'grappleBreak', 'shieldsman', 'reversal', 'infighting'];

function labelForKind(kind: CombatDecisionKind, t: ReturnType<typeof useTranslation>['t']): string {
    const key = `fight.decision.${kind}`;
    return t(key, { defaultValue: kind });
}

interface TargetedPickerProps {
    legal: LegalDecision;
    character: Character | null;
    stateView: DecisionRequest['stateView'];
    onSubmit: (decision: CombatDecision) => void;
}

const TargetedPicker: React.FC<TargetedPickerProps> = ({ legal, character, stateView, onSubmit }) => {
    const { t } = useTranslation();
    const targetIds = legal.targetIds ?? [];
    const weaponIds = legal.weaponIds ?? [];

    const [targetId, setTargetId] = useState(targetIds[0] ?? '');
    const [weaponId, setWeaponId] = useState(weaponIds[0] ?? '');

    const weaponName = (id: string): string => {
        // Try to find weapon name from the combatant's character inventory
        for (const combatant of Object.values(stateView.combatants)) {
            const charWeapons = combatant.character?.inventory?.weapons;
            if (charWeapons && Object.keys(charWeapons).includes(id)) {
                return id; // LP-d will provide weapon name lookup; for now use id
            }
        }
        return id;
    };

    const combatantName = (id: string) => stateView.combatants[id]?.name ?? id;

    if (targetIds.length === 1 && weaponIds.length <= 1) {
        // Single combination — no picker needed
        return (
            <button
                className={`${styles.actionBtn} ${styles.primary}`}
                onClick={() => onSubmit({ ...legal, targetId: targetIds[0], weaponId: weaponIds[0] })}
            >
                {labelForKind(legal.kind, t)}{targetIds[0] ? ` → ${combatantName(targetIds[0])}` : ''}
            </button>
        );
    }

    return (
        <div className={styles.attackPicker}>
            {targetIds.length > 1 && (
                <div className={styles.pickerRow}>
                    <label>{t('fight.pickTarget')}</label>
                    <select value={targetId} onChange={e => setTargetId(e.target.value)}>
                        {targetIds.map(id => (
                            <option key={id} value={id}>{combatantName(id)}</option>
                        ))}
                    </select>
                </div>
            )}
            {weaponIds.length > 1 && (
                <div className={styles.pickerRow}>
                    <label>{t('fight.pickWeapon')}</label>
                    <select value={weaponId} onChange={e => setWeaponId(e.target.value)}>
                        {weaponIds.map(id => (
                            <option key={id} value={id}>{weaponName(id)}</option>
                        ))}
                    </select>
                </div>
            )}
            <button
                className={styles.confirmBtn}
                onClick={() => onSubmit({ ...legal, targetId: targetId || undefined, weaponId: weaponId || undefined })}
            >
                {t('fight.confirmAttack')}
            </button>
        </div>
    );
};

const FortuneRerollCard: React.FC<{
    decision: DecisionRequest;
    onSubmit: (d: CombatDecision) => void;
}> = ({ decision, onSubmit }) => {
    const { t } = useTranslation();
    const actor = decision.stateView.combatants[decision.actorId];
    const fortuneRemaining = (actor?.resources?.fortune?.current ?? 0);
    const rerollLegal = decision.legalDecisions.find(d => d.kind === 'fortuneReroll');
    const waitLegal = decision.legalDecisions.find(d => d.kind === 'wait');

    return (
        <div className={styles.fortuneCard}>
            <h3>{t('fight.psychology.title')}</h3>
            <p>{t('fight.psychology.reroll', { n: fortuneRemaining })}</p>
            <div className={styles.fortuneCardBtns}>
                {rerollLegal && (
                    <button
                        className={styles.rerollBtn}
                        onClick={() => onSubmit(rerollLegal)}
                    >
                        {t('fight.psychology.reroll', { n: fortuneRemaining })}
                    </button>
                )}
                {waitLegal && (
                    <button
                        className={styles.declineBtn}
                        onClick={() => onSubmit(waitLegal)}
                    >
                        {t('fight.psychology.decline')}
                    </button>
                )}
            </div>
        </div>
    );
};

export const DecisionPalette: React.FC<DecisionPaletteProps> = ({ decision, character, onSubmit }) => {
    const { t } = useTranslation();
    const { legalDecisions, actorId, characterName, level, reason, stateView } = decision;

    // Psychology fast-path
    if (level === 'resolution' && reason?.startsWith('psychology:')) {
        return <FortuneRerollCard decision={decision} onSubmit={onSubmit} />;
    }

    // Resolution-level (non-psychology): show each option as a button
    if (level === 'resolution') {
        return (
            <div className={styles.palette}>
                <div className={styles.paletteHeader}>
                    <h3>{characterName}</h3>
                    <span>{reason}</span>
                </div>
                <div className={styles.actionGroup}>
                    {legalDecisions.map((ld, i) => (
                        <button
                            key={`${ld.kind}-${i}`}
                            className={styles.actionBtn}
                            onClick={() => onSubmit(ld)}
                        >
                            {labelForKind(ld.kind, t)}
                            {ld.reason ? ` — ${ld.reason}` : ''}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // Turn-level: group by kind
    const grouped = new Map<CombatDecisionKind, LegalDecision[]>();
    const endTurnDecisions: LegalDecision[] = [];

    for (const ld of legalDecisions) {
        if (ld.kind === 'endTurn') {
            endTurnDecisions.push(ld);
            continue;
        }
        if (!grouped.has(ld.kind)) grouped.set(ld.kind, []);
        grouped.get(ld.kind)!.push(ld);
    }

    return (
        <div className={styles.palette}>
            <div className={styles.paletteHeader}>
                <h3>{t('fight.yourTurn', { name: characterName })}</h3>
                <span>{t('fight.round', { n: decision.round })}</span>
            </div>

            {[...grouped.entries()].map(([kind, decisions]) => {
                const isTargeted = TARGETED_ACTIONS.includes(kind);
                const isSimple = SIMPLE_ACTIONS.includes(kind) || (!isTargeted);

                return (
                    <div key={kind} className={styles.actionGroup}>
                        <h4>{labelForKind(kind, t)}</h4>
                        {isTargeted
                            ? decisions.map((ld, i) => (
                                <TargetedPicker
                                    key={i}
                                    legal={ld}
                                    character={character}
                                    stateView={stateView}
                                    onSubmit={onSubmit}
                                />
                            ))
                            : decisions.map((ld, i) => (
                                <button
                                    key={i}
                                    className={styles.actionBtn}
                                    onClick={() => onSubmit(isSimple
                                        ? { kind: ld.kind, actorId }
                                        : ld
                                    )}
                                >
                                    {labelForKind(kind, t)}
                                    {ld.targetId ? ` → ${stateView.combatants[ld.targetId]?.name ?? ld.targetId}` : ''}
                                </button>
                            ))
                        }
                    </div>
                );
            })}

            {endTurnDecisions.length > 0 && (
                <div className={styles.actionGroup}>
                    <button
                        className={`${styles.actionBtn} ${styles.endTurnBtn}`}
                        onClick={() => onSubmit({ kind: 'endTurn', actorId })}
                    >
                        {t('fight.decision.endTurn')}
                    </button>
                </div>
            )}
        </div>
    );
};
