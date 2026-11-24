import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    calculateCharacteristicValue,
    calculateSkillValue,
    calculateSuccessLevel,
    Character,
    rolld100,
    useGameData,
} from '@wfrp/shared';
import styles from './DiceTray.module.css';

interface PartyCheckResult {
    id: string;
    name: string;
    test: { roll: number; target: number; success: boolean; sl: number } | null;
}

const formatModifier = (modifier: number) => modifier > 0 ? `+${modifier}` : String(modifier);

export default function SecretPartyCheck({ party }: { party: Character[] }) {
    const { t, i18n } = useTranslation();
    const { skills } = useGameData();
    const [skillId, setSkillId] = useState('perception');
    const [modifier, setModifier] = useState(0);
    const [results, setResults] = useState<PartyCheckResult[] | null>(null);

    const options = new Map(
        skills.filter(skill => skill.type === 'skill' && skill.classification === 'basic')
            .map(skill => [skill.id, skill.name])
    );
    for (const character of party) {
        for (const skill of character.skills) {
            if (!options.has(skill.id)) {
                options.set(skill.id, skills.find(definition => definition.id === skill.id)?.name ?? skill.name);
            }
        }
    }
    const selectedSkillId = options.has(skillId) ? skillId : (options.has('perception') ? 'perception' : '');

    const rollPartyCheck = () => {
        const basicSkill = skills.find(skill => skill.id === selectedSkillId && skill.classification === 'basic');
        setResults(party.map(character => {
            const { id, name } = character;
            const skill = character.skills.find(skill => skill.id === selectedSkillId);
            const characteristicId = (skill?.characteristic ?? basicSkill?.characteristic)?.toLowerCase() as keyof Character['characteristics'] | undefined;
            const characteristic = characteristicId && character.characteristics[characteristicId];
            if (!characteristic) return { id, name, test: null };

            const baseTarget = skill
                ? calculateSkillValue({ ...skill, characteristic: characteristicId }, character)
                : calculateCharacteristicValue(characteristic);
            const target = baseTarget + modifier;
            const roll = rolld100();
            const success = roll <= 5 || (roll <= 95 && roll <= target);
            const sl = Math.trunc(calculateSuccessLevel(roll, target));
            return { id, name, test: { roll, target, success, sl } };
        }));
    };

    return (
        <section className={styles.partyCheck} aria-label={t('partyCheck.title')}>
            <h3>{t('partyCheck.title')}</h3>
            <form className={styles.partyForm} onSubmit={event => {
                event.preventDefault();
                if (party.length && selectedSkillId) rollPartyCheck();
            }}>
                <label>
                    {t('partyCheck.skill')}
                    <select value={selectedSkillId} onChange={event => {
                        setSkillId(event.target.value);
                        setResults(null);
                    }} disabled={!options.size}>
                        {[...options].sort(([, a], [, b]) => a.localeCompare(b, i18n.resolvedLanguage)).map(([id, name]) => (
                            <option key={id} value={id}>{name}</option>
                        ))}
                    </select>
                </label>
                <label>
                    {t('partyCheck.modifier')}
                    <select value={modifier} onChange={event => {
                        setModifier(Number(event.target.value));
                        setResults(null);
                    }}>
                        {[60, 40, 20, 0, -10, -20, -30].map(value => (
                            <option key={value} value={value}>{formatModifier(value)}</option>
                        ))}
                    </select>
                </label>
                <button type="submit" disabled={!party.length || !selectedSkillId}>{t('partyCheck.roll')}</button>
            </form>
            <div aria-live="polite">
                {!party.length && <p>{t('partyCheck.empty')}</p>}
                {results && party.length > 0 && (
                    <table className={styles.partyResults} aria-label={t('partyCheck.results')}>
                        <thead>
                            <tr>
                                <th scope="col">{t('partyCheck.character')}</th>
                                <th scope="col">{t('partyCheck.rollVsTarget')}</th>
                                <th scope="col">{t('partyCheck.outcome')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map(({ id, name, test }) => (
                                <tr key={id}>
                                    <th scope="row">{name}</th>
                                    {test ? (
                                        <>
                                            <td>{test.roll} / {test.target}</td>
                                            <td className={test.success ? styles.partySuccess : undefined}>
                                                {t(test.success ? 'partyCheck.success' : 'partyCheck.failure')}
                                                {' '}({formatModifier(test.sl)} {t('partyCheck.sl')})
                                            </td>
                                        </>
                                    ) : <td colSpan={2}>{t('partyCheck.unavailable')}</td>}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </section>
    );
}
