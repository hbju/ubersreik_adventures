/**
 * Converters between Supabase CharacterRow (snake_case, Json blobs)
 * and the app-domain Character type (camelCase, fully typed).
 *
 * These keep the DB schema isolated from UI components.
 */
import type { CharacterRow, CharacterInsert } from '../services/characterService';
import type { Character } from '../types/wfrp.types';
import type { Json } from '../types/database.types';

/**
 * Convert a Supabase CharacterRow to the app-domain Character.
 */
export function characterRowToCharacter(row: CharacterRow): Character {
  return {
    id: row.id,
    name: row.name,
    species: row.species ?? 'Human',
    class: row.class ?? '',
    currentCareerId: row.current_career_id ?? '',
    currentCareerLevelId: row.current_career_level_id ?? '',
    userId: row.user_id,
    tags: row.tags ?? [],
    locationId: row.location_id,
    xp: { current: row.xp_current, spent: row.xp_spent },
    careerHistory: row.career_history as unknown as Character['careerHistory'],
    unlockedCharacteristicIds: row.unlocked_characteristic_ids ?? [],
    unlockedSkillIds: row.unlocked_skill_ids ?? [],
    unlockedTalentIds: row.unlocked_talent_ids ?? [],
    details: row.details as unknown as Character['details'],
    movement: row.movement,
    characteristics: row.characteristics as unknown as Character['characteristics'],
    skills: row.skills as unknown as Character['skills'],
    status: row.status as unknown as Character['status'],
    conditions: row.conditions as unknown as Character['conditions'],
    talents: row.talents as unknown as Character['talents'],
    inventory: row.inventory as unknown as Character['inventory'],
    currency: row.currency as unknown as Character['currency'],
    reputations: row.reputations as unknown as Character['reputations'],
    lore: row.lore as unknown as Character['lore'],
    isMinion: row.is_minion,
    templateId: row.template_id ?? undefined,
    actionBar: row.action_bar as unknown as Character['actionBar'],
  };
}

/**
 * Convert an app-domain Character to a Supabase CharacterInsert payload.
 * Omits `campaign_id` — the caller must provide it.
 */
export function characterToInsert(char: Character): Omit<CharacterInsert, 'campaign_id'> {
  return {
    id: char.id,
    name: char.name,
    species: char.species,
    class: char.class,
    current_career_id: char.currentCareerId || null,
    current_career_level_id: char.currentCareerLevelId || null,
    user_id: char.userId,
    tags: char.tags,
    location_id: char.locationId,
    xp_current: char.xp.current,
    xp_spent: char.xp.spent,
    career_history: char.careerHistory as unknown as Json,
    unlocked_characteristic_ids: char.unlockedCharacteristicIds,
    unlocked_skill_ids: char.unlockedSkillIds,
    unlocked_talent_ids: char.unlockedTalentIds,
    details: char.details as unknown as Json,
    movement: char.movement,
    characteristics: char.characteristics as unknown as Json,
    skills: char.skills as unknown as Json,
    status: char.status as unknown as Json,
    conditions: char.conditions as unknown as Json,
    talents: char.talents as unknown as Json,
    inventory: char.inventory as unknown as Json,
    currency: char.currency as unknown as Json,
    reputations: char.reputations as unknown as Json,
    lore: (char.lore ?? null) as unknown as Json,
    is_minion: char.isMinion ?? false,
    template_id: char.templateId ?? null,
    action_bar: (char.actionBar ?? null) as unknown as Json,
  };
}

/**
 * Convert a partial Character update to a Supabase update payload.
 * Only includes the keys present in the partial.
 */
export function characterToUpdate(partial: Partial<Character>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (partial.name !== undefined) out.name = partial.name;
  if (partial.species !== undefined) out.species = partial.species;
  if (partial.class !== undefined) out.class = partial.class;
  if (partial.currentCareerId !== undefined) out.current_career_id = partial.currentCareerId || null;
  if (partial.currentCareerLevelId !== undefined) out.current_career_level_id = partial.currentCareerLevelId || null;
  if (partial.userId !== undefined) out.user_id = partial.userId;
  if (partial.tags !== undefined) out.tags = partial.tags;
  if (partial.locationId !== undefined) out.location_id = partial.locationId;
  if (partial.xp !== undefined) {
    out.xp_current = partial.xp.current;
    out.xp_spent = partial.xp.spent;
  }
  if (partial.careerHistory !== undefined) out.career_history = partial.careerHistory as unknown as Json;
  if (partial.unlockedCharacteristicIds !== undefined) out.unlocked_characteristic_ids = partial.unlockedCharacteristicIds;
  if (partial.unlockedSkillIds !== undefined) out.unlocked_skill_ids = partial.unlockedSkillIds;
  if (partial.unlockedTalentIds !== undefined) out.unlocked_talent_ids = partial.unlockedTalentIds;
  if (partial.details !== undefined) out.details = partial.details as unknown as Json;
  if (partial.movement !== undefined) out.movement = partial.movement;
  if (partial.characteristics !== undefined) out.characteristics = partial.characteristics as unknown as Json;
  if (partial.skills !== undefined) out.skills = partial.skills as unknown as Json;
  if (partial.status !== undefined) out.status = partial.status as unknown as Json;
  if (partial.conditions !== undefined) out.conditions = partial.conditions as unknown as Json;
  if (partial.talents !== undefined) out.talents = partial.talents as unknown as Json;
  if (partial.inventory !== undefined) out.inventory = partial.inventory as unknown as Json;
  if (partial.currency !== undefined) out.currency = partial.currency as unknown as Json;
  if (partial.reputations !== undefined) out.reputations = partial.reputations as unknown as Json;
  if (partial.lore !== undefined) out.lore = (partial.lore ?? null) as unknown as Json;
  if (partial.isMinion !== undefined) out.is_minion = partial.isMinion;
  if (partial.templateId !== undefined) out.template_id = partial.templateId ?? null;
  if (partial.actionBar !== undefined) out.action_bar = (partial.actionBar ?? null) as unknown as Json;

  return out;
}
