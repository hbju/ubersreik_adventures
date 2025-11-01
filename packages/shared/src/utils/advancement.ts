import { Character, Skill, Talent } from '../types/wfrp.types';

export function calculateCharacteristicAdvanceCost(currentAdvances: number, career: boolean): number {
  if (currentAdvances < 0) {
    throw new Error('Current advances cannot be negative');
  }

  const costTable = [25, 30, 40, 50, 70, 90, 120, 150, 190, 230, 280, 330, 390, 450, 520];

  if (currentAdvances / 5 >= costTable.length) {
    return career ? costTable[costTable.length - 1] : costTable[costTable.length - 1] * 2;
  }

  return career ? costTable[Math.floor(currentAdvances / 5)] : costTable[Math.floor(currentAdvances / 5)] * 2;
}

export function calculateSkillAdvanceCost(currentAdvances: number, career: boolean): number {
  if (currentAdvances < 0) {
    throw new Error('Current advances cannot be negative');
  }

  const costTable = [10, 15, 20, 30, 40, 60, 80, 110, 140, 180, 220, 270, 320, 380, 440];

  if (currentAdvances / 5 >= costTable.length) {
    return career ? costTable[costTable.length - 1] : costTable[costTable.length - 1] * 2;
  }
  return career ? costTable[Math.floor(currentAdvances / 5)] : costTable[Math.floor(currentAdvances / 5)] * 2;
}

export function calculateTalentAdvanceCost(talentName: string, character: Character, career: boolean): number {
  const characterTalents: Record<string, number> = character.talents;
  const currentAdvances = characterTalents[talentName] || 0;

  return (currentAdvances + 1) * (career ? 100 : 200);
}

