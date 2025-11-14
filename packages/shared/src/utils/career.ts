import { Character, Career, CareerLevel } from '../types/wfrp.types';

/**
 * Get all career levels available to a character (current + all previous in their career path)
 */
export function getCareerLevelsForCharacter(
  character: Character,
  allCareers: Career[]
): CareerLevel[] {
  const career = allCareers.find(c => c.id === character.currentCareerId);
  if (!career) return [];

  const currentLevelIndex = career.career_level.findIndex(
    lvl => lvl.id === character.currentCareerLevelId
  );
  
  if (currentLevelIndex === -1) return [];

  // Return current level and all previous levels in this career
  return career.career_level.slice(0, currentLevelIndex + 1);
}

/**
 * Get all advancements available to the character based on their career path and GM unlocks
 */
export function getAvailableAdvancements(
  career: Career,
  careerLevel: number
): {
  characteristics: string[];
  skills: string[];
  talents: string[];
} {
  const careerLevels = career.career_level.slice(0, careerLevel);
  
  // Collect all characteristics, skills, and talents from career levels
  const careerCharacteristics = new Set<string>();
  const careerSkills = new Set<string>();
  const careerTalents = new Set<string>();

  careerLevels.forEach(level => {
    level.characteristic_advances.forEach(char => careerCharacteristics.add(char.toLowerCase()));
    level.skills_ids.forEach(skill => careerSkills.add(skill));
    level.talent_ids.forEach(talent => careerTalents.add(talent));
  });

  return {
    characteristics: Array.from(careerCharacteristics),
    skills: Array.from(careerSkills),
    talents: Array.from(careerTalents)
  };
}

/**
 * Check if the character has completed their current career level
 * Requirements:
 * - All characteristics advanced to the required level (5/10/15/20 based on level)
 * - At least 8 skills advanced to the required level
 * - At least 1 talent from the current level
 */
export function hasCompletedCurrentLevel(
  character: Character,
  allCareers: Career[]
): boolean {
  const career = allCareers.find(c => c.id === character.currentCareerId);
  if (!career) return false;

  const currentLevel = career.career_level.find(
    lvl => lvl.id === character.currentCareerLevelId
  );
  if (!currentLevel) return false;

  // Determine required advances based on level (5, 10, 15, 20)
  const requiredAdvances = currentLevel.lvl * 5;

  // Check characteristics - all must be at required level
  const characteristicsComplete = currentLevel.characteristic_advances.every(charId => {
    const charKey = charId.toLowerCase() as keyof Character['characteristics'];
    const characteristic = character.characteristics[charKey];
    return characteristic && characteristic.advances >= requiredAdvances;
  });

  if (!characteristicsComplete) return false;

  // Check skills - at least 8 must be at required level
  let completedSkills = 0;
  currentLevel.skills_ids.forEach(skillId => {
    const skill = character.skills.find(s => s.id === skillId);
    if (skill && skill.advances >= requiredAdvances) {
      completedSkills++;
    }
  });

  if (completedSkills < 8) return false;

  // Check talents - at least 1 from current level must be taken
  const hasTalent = currentLevel.talent_ids.some(talentId => {
    return character.talents[talentId] && character.talents[talentId] > 0;
  });

  return hasTalent;
}

/**
 * Calculate XP cost for advancing to a new career level
 */
export function getCareerChangeCost(
  character: Character,
  targetCareerId: string,
  targetCareerLevelId: string,
  allCareers: Career[]
): number {
  const currentCareer = allCareers.find(c => c.id === character.currentCareerId);
  const targetCareer = allCareers.find(c => c.id === targetCareerId);
  
  if (!currentCareer || !targetCareer) return 0;

  const targetLevel = targetCareer.career_level.find(lvl => lvl.id === targetCareerLevelId);
  if (!targetLevel) return 0;

  // Advancing within same career
  if (currentCareer.id === targetCareerId) {
    return 100;
  }

  // Advancing to same level of a career in the same class
  if (currentCareer.class === targetCareer.class) {
    return 100;
  }

  // Advancing to first level of a career in a different class
  if (targetLevel.lvl === 1) {
    return 200;
  }

  // Not allowed
  return 0;
}

/**
 * Get all careers available for a character to change to
 */
export function getAvailableCareerChanges(
  character: Character,
  allCareers: Career[]
): Array<{ career: Career; level: CareerLevel; cost: number }> {
  const currentCareer = allCareers.find(c => c.id === character.currentCareerId);
  if (!currentCareer) return [];

  const currentLevel = currentCareer.career_level.find(
    lvl => lvl.id === character.currentCareerLevelId
  );
  if (!currentLevel) return [];

  const available: Array<{ career: Career; level: CareerLevel; cost: number }> = [];

  allCareers.forEach(career => {
    career.career_level.forEach(level => {
      // Same career - can advance to any higher level for 100 XP
      if (career.id === currentCareer.id && level.lvl > currentLevel.lvl) {
        available.push({ career, level, cost: 100 });
      }
      // Same class - can advance to same or lower level for 100 XP
      else if (
        career.class === currentCareer.class &&
        career.id !== currentCareer.id &&
        level.lvl <= currentLevel.lvl
      ) {
        available.push({ career, level, cost: 100 });
      }
      // Different class - can only take level 1 for 200 XP
      else if (career.class !== currentCareer.class && level.lvl === 1) {
        available.push({ career, level, cost: 200 });
      }
    });
  });

  return available;
}

/**
 * Count how many times a characteristic has been advanced in career history
 */
export function getCharacteristicAdvancesFromHistory(
  character: Character,
  characteristicId: string
): number {
  return character.careerHistory?.filter(
    entry =>
      entry.advancementType === 'characteristic' &&
      entry.advancementId === characteristicId
  ).length || 0;
}

/**
 * Count how many times a skill has been advanced in career history
 */
export function getSkillAdvancesFromHistory(
  character: Character,
  skillId: string
): number {
  return character.careerHistory?.filter(
    entry =>
      entry.advancementType === 'skill' &&
      entry.advancementId === skillId
  ).length || 0;
}

/**
 * Count how many times a talent has been purchased in career history
 */
export function getTalentRankFromHistory(
  character: Character,
  talentId: string
): number {
  return character.careerHistory?.filter(
    entry =>
      entry.advancementType === 'talent' &&
      entry.advancementId === talentId
  ).length || 0;
}
