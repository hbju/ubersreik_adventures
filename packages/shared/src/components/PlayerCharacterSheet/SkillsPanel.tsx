import React from 'react';
import {
    Character,
    Skill,
    useGameData,
    calculateCharacteristicValue
} from '@wfrp/shared';
import './SkillsPanel.css';

interface SkillsPanelProps {
    character: Character;
    isEditMode: boolean;
    advancementMode?: boolean;
    onCharacterUpdate: (updates: Partial<Character>) => void;
    onSkillClick?: (skillId: string, skillName: string, skillValue: number) => void;
    onSkillAdvance?: (skillId: string) => void;
}

export const SkillsPanel: React.FC<SkillsPanelProps> = ({
    character,
    isEditMode,
    advancementMode = false,
    onCharacterUpdate,
    onSkillClick,
    onSkillAdvance
}) => {
    const { skills: allSkills } = useGameData();

    // Get character's skills
    const charSkills = character.skills;

    // Get remaining basic skills that the character doesn't have
    const remainingBasicSkills: Skill[] = allSkills
        .filter(skill =>
            !charSkills.some(s => s.id === skill.id) &&
            skill.type === 'skill' &&
            skill.classification === 'basic'
        )
        .map(skill => ({
            id: skill.id,
            name: skill.name,
            characteristic: skill.characteristic,
            advances: 0,
            talents: 0,
            modifier: 0
        }));

    // Combine and sort all basic skills
    const basicSkills = [...charSkills, ...remainingBasicSkills]
        .filter(skill => {
            const skillDef = allSkills.find(s => s.id === skill.id);
            return skillDef?.classification === 'basic';
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    // Get advanced/grouped skills (those with advances > 0 or not basic)
    const advancedSkills = charSkills
        .filter(skill => {
            const skillDef = allSkills.find(s => s.id === skill.id);
            return skillDef?.classification !== 'basic';
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    const handleSkillChange = (skillId: string, field: keyof Skill, value: number) => {
        const skillIndex = character.skills.findIndex(s => s.id === skillId);
        
        if (skillIndex !== -1) {
            const updatedSkills = [...character.skills];
            updatedSkills[skillIndex] = {
                ...updatedSkills[skillIndex],
                [field]: Math.max(0, value)
            };
            onCharacterUpdate({ skills: updatedSkills });
        } else {
            // Skill doesn't exist yet, add it
            const skillDef = allSkills.find(s => s.id === skillId);
            if (skillDef) {
                const newSkill: Skill = {
                    id: skillId,
                    name: skillDef.name,
                    characteristic: skillDef.characteristic,
                    advances: field === 'advances' ? value : 0,
                    talents: field === 'talents' ? value : 0,
                    modifier: field === 'modifier' ? value : 0
                };
                onCharacterUpdate({ skills: [...character.skills, newSkill] });
            }
        }
    };

    const renderSkillRow = (skill: Skill, isBasic: boolean) => {
        const charKey = skill.characteristic.toLowerCase() as keyof Character['characteristics'];
        const characteristicValue = character.characteristics[charKey];
        const baseValue = calculateCharacteristicValue(characteristicValue);
        const total = baseValue + skill.advances + skill.talents + skill.modifier;
        
        const isUnlocked = !character.unlockedSkillIds || character.unlockedSkillIds.includes(skill.id);
        const hasAdvances = skill.advances > 0;

        return (
            <div 
                key={skill.id} 
                className={`skill-row ${isUnlocked ? 'unlocked' : ''}`}
            >
                <span className={`skill-name ${isUnlocked ? 'skill-unlocked' : ''}`}>
                    {skill.name}
                </span>
                <span className="skill-char">{skill.characteristic.toUpperCase()}</span>
                {isEditMode ? (
                    <input
                        type="number"
                        value={skill.advances}
                        onChange={(e) => handleSkillChange(skill.id, 'advances', parseInt(e.target.value) || 0)}
                        className="skill-input"
                        min={0}
                    />
                ) : (
                    <span className="skill-advances">{skill.advances || '—'}</span>
                )}
                {advancementMode && isUnlocked && !isEditMode ? (
                    <button
                        className="skill-advance-button"
                        onClick={() => onSkillAdvance?.(skill.id)}
                        title="Advance with XP"
                    >
                        +
                    </button>
                ) : (
                    <span className="skill-advances-placeholder"></span>
                )
                }
                <span className="skill-total">{total}</span>
                <button
                    className="skill-roll-button"
                    onClick={() => onSkillClick?.(skill.id, skill.name, total)}
                    title={`Roll ${skill.name}`}
                >
                    🎲
                </button>
            </div>
        );
    };

    return (
        <div className="skills-panel">
            <div className="skills-section">
                <h3 className="panel-title">Basic Skills</h3>
                <div className="skills-header">
                    <span className="col-name">Skill</span>
                    <span className="col-char">Char</span>
                    <span className="col-adv">Adv</span>
                    <span className="col-adv-placeholder"></span>
                    <span className="col-total">Total</span>
                    <span className="col-roll"></span>
                </div>
                <div className="skills-list">
                    {basicSkills.map(skill => renderSkillRow(skill, true))}
                </div>
            </div>

            {advancedSkills.length > 0 && (
                <div className="skills-section">
                    <h3 className="panel-title">Advanced & Grouped Skills</h3>
                    <div className="skills-header">
                        <span className="col-name">Skill</span>
                        <span className="col-char">Char</span>
                        <span className="col-adv">Adv</span>
                        <span className="col-total">Total</span>
                        <span className="col-roll"></span>
                    </div>
                    <div className="skills-list">
                        {advancedSkills.map(skill => renderSkillRow(skill, false))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SkillsPanel;
