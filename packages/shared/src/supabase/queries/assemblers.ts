/**
 * Assemblers: Convert between flat DB rows and nested TypeScript types.
 *
 * These functions are the compatibility bridge — the React layer keeps
 * using the same Character / CampaignState types while the DB stores
 * normalised flat rows.
 */

import type {
  Character, Characteristic, Skill, Condition, Currency, XP, CharacterDetails,
  CareerHistoryEntry, KnowledgeEntry, Relationship, CharacterLore,
  ReputationEntry, ActionBarEntry, JournalEntry, Quest, QuestObjective,
  Faction, MapData, Location, MapToken, UserMapPin, MapPinState,
  ShopDefinition, ShopInventoryItem, ShopState, ShopInventoryState,
  Combatant, Advantages, CharacterTemplate, CharacteristicVariance,
  TemplateSkill, LocationTerritory, CampaignState, User
} from '../../types/wfrp.types';
import type { ChatMessage } from '../../types/chat.types';
import type { AudioTrack, Playlist } from '../../types/audio.types';
import type { CalendarState, TimelineEvent, GameDate } from '../../data/calendar';

// ─── Character ──────────────────────────────────────────────────────────────

const CHAR_KEYS = ['ws', 'bs', 's', 't', 'i', 'ag', 'dex', 'int', 'wp', 'fel'] as const;

/**
 * Assemble a Character object from a DB character row + sub-table arrays.
 *
 * The sub-tables are expected as extra properties on the row object
 * (as returned by get_full_character RPC or manual joins).
 */
export function assembleCharacter(row: Record<string, any>): Character {
  const characteristics: Character['characteristics'] = {} as any;
  for (const key of CHAR_KEYS) {
    characteristics[key] = {
      initial: row[`${key}_initial`] ?? 0,
      advances: row[`${key}_advances`] ?? 0,
      talents: row[`${key}_talents`] ?? 0,
      modifier: row[`${key}_modifier`] ?? 0,
    } as Characteristic;
  }

  const skills: Skill[] = (row.skills ?? []).map((s: any) => ({
    id: s.skill_id,
    name: s.name,
    characteristic: s.characteristic,
    advances: s.advances ?? 0,
    talents: s.talents ?? 0,
    modifier: s.modifier ?? 0,
  }));

  const talents: Record<string, number> = {};
  for (const t of (row.talents ?? [])) {
    talents[t.talent_id] = t.ranks ?? 1;
  }

  const conditions: Condition[] = (row.conditions ?? []).map((c: any) => ({
    id: c.condition_id,
    name: '', // looked up from static data
    description: '',
    stack: c.stack_count ?? 1,
  }));

  // Inventory: flatten into Record<string, number> per type + equipped maps
  const inventory: Character['inventory'] = {
    weapons: {},
    armor: {},
    items: {},
    equippedWeapons: {},
    equippedArmor: {},
    equippedItems: {},
  };
  for (const inv of (row.inventory ?? [])) {
    const type = inv.item_type as 'weapon' | 'armor' | 'item';
    if (type === 'weapon') {
      inventory.weapons[inv.item_id] = inv.quantity ?? 1;
      if (inv.is_equipped) inventory.equippedWeapons![inv.item_id] = true;
    } else if (type === 'armor') {
      inventory.armor[inv.item_id] = inv.quantity ?? 1;
      if (inv.is_equipped) inventory.equippedArmor![inv.item_id] = true;
    } else {
      inventory.items[inv.item_id] = inv.quantity ?? 1;
      if (inv.is_equipped) inventory.equippedItems![inv.item_id] = true;
    }
  }

  const careerHistory: CareerHistoryEntry[] = (row.career_history ?? []).map((ch: any) => ({
    careerId: ch.career_id,
    careerLevelId: ch.career_level_id,
    careerName: ch.career_name,
    levelName: ch.level_name,
    level: ch.level,
    xpSpent: ch.xp_spent ?? 0,
    advancementType: ch.advancement_type,
    advancementId: ch.advancement_id,
    advancementName: ch.advancement_name,
    timestamp: ch.timestamp,
  }));

  // Unlocks
  const unlockedCharacteristicIds: string[] = [];
  const unlockedSkillIds: string[] = [];
  const unlockedTalentIds: string[] = [];
  for (const u of (row.unlocks ?? [])) {
    if (u.unlock_type === 'characteristic') unlockedCharacteristicIds.push(u.unlock_id);
    else if (u.unlock_type === 'skill') unlockedSkillIds.push(u.unlock_id);
    else if (u.unlock_type === 'talent') unlockedTalentIds.push(u.unlock_id);
  }

  const reputations: ReputationEntry[] = (row.reputations ?? []).map((r: any) => ({
    factionId: r.faction_id,
    value: r.value ?? 0,
    knowledgeLevel: r.knowledge_level ?? 'unknown',
    notes: r.notes,
  }));

  // Lore
  const loreRow = row.lore;
  let lore: CharacterLore | undefined;
  if (loreRow) {
    lore = {
      gmNotes: loreRow.gm_notes ?? '',
      background: (row.knowledge_entries ?? []).map((k: any) => ({
        id: k.id,
        topic: k.topic,
        content: k.content,
        visibility: k.visibility ?? [],
        createdAt: k.created_at,
        updatedAt: k.updated_at,
      } as KnowledgeEntry)),
      playerNotes: loreRow.player_notes ?? undefined,
      appearance: loreRow.appearance ?? undefined,
      voice: loreRow.voice ?? undefined,
      mannerisms: loreRow.mannerisms ?? undefined,
      biography: loreRow.biography ?? undefined,
      ambitions: (loreRow.ambition_short || loreRow.ambition_long)
        ? { short: loreRow.ambition_short ?? '', long: loreRow.ambition_long ?? '' }
        : undefined,
      motivationKey: loreRow.motivation_key ?? undefined,
      imageUrl: row.image_path ?? undefined,
      relationships: (row.relationships ?? []).map((rel: any) => ({
        id: rel.id,
        targetCharacterId: rel.target_character_id,
        type: rel.type,
        description: rel.description ?? '',
      } as Relationship)),
    };
  }

  const actionBar: ActionBarEntry[] = (row.action_bar ?? []).map((ab: any) => ({
    slotIndex: ab.slot_index,
    type: ab.type,
    id: ab.action_id,
    label: ab.label,
  }));

  return {
    id: row.id,
    name: row.name ?? '',
    species: row.species ?? '',
    class: row.class ?? '',
    currentCareerId: row.current_career_id ?? '',
    currentCareerLevelId: row.current_career_level_id ?? '',
    userId: row.user_id ?? null,
    tags: row.tags ?? [],
    locationId: row.location_id ?? null,
    xp: { current: row.xp_current ?? 0, spent: row.xp_spent ?? 0 } as XP,
    careerHistory,
    unlockedCharacteristicIds,
    unlockedSkillIds,
    unlockedTalentIds,
    details: {
      age: row.age ?? '',
      height: row.height ?? '',
      hair: row.hair ?? '',
      eyes: row.eyes ?? '',
      partyName: row.party_name ?? '',
      shortTermAmbition: row.short_term_ambition ?? '',
      longTermAmbition: row.long_term_ambition ?? '',
      partyShortTermAmbition: row.party_short_term_ambition ?? '',
      partyLongTermAmbition: row.party_long_term_ambition ?? '',
    } as CharacterDetails,
    movement: row.movement ?? 4,
    characteristics,
    skills,
    status: {
      wounds: { current: row.wounds_current ?? 0, max: row.wounds_max ?? 0 },
      fate: { current: row.fate_current ?? 0, max: row.fate_max ?? 0 },
      fortune: { current: row.fortune_current ?? 0, max: row.fortune_max ?? 0 },
      resilience: { current: row.resilience_current ?? 0, max: row.resilience_max ?? 0 },
      resolve: { current: row.resolve_current ?? 0, max: row.resolve_max ?? 0 },
      corruption: { current: row.corruption_current ?? 0, max: row.corruption_max ?? 0 },
    },
    conditions,
    talents,
    inventory,
    currency: { gc: row.gc ?? 0, ss: row.ss ?? 0, bp: row.bp ?? 0 } as Currency,
    reputations,
    lore,
    isMinion: row.is_minion ?? false,
    templateId: row.template_id ?? undefined,
    actionBar,
  };
}

/**
 * Decompose a Character object into the JSONB payload expected by save_character RPC.
 */
export function decomposeCharacter(char: Character, campaignId: string): Record<string, any> {
  const flat: Record<string, any> = {
    id: char.id,
    campaign_id: campaignId,
    name: char.name,
    species: char.species,
    class: char.class,
    current_career_id: char.currentCareerId,
    current_career_level_id: char.currentCareerLevelId,
    user_id: char.userId,
    location_id: char.locationId,
    movement: char.movement,
    is_minion: char.isMinion ?? false,
    template_id: char.templateId ?? null,
    xp_current: char.xp.current,
    xp_spent: char.xp.spent,
    tags: char.tags,
    image_path: char.lore?.imageUrl ?? null,
    // Currency
    gc: char.currency.gc,
    ss: char.currency.ss,
    bp: char.currency.bp,
    // Details
    age: char.details.age,
    height: char.details.height,
    hair: char.details.hair,
    eyes: char.details.eyes,
    party_name: char.details.partyName,
    short_term_ambition: char.details.shortTermAmbition,
    long_term_ambition: char.details.longTermAmbition,
    party_short_term_ambition: char.details.partyShortTermAmbition,
    party_long_term_ambition: char.details.partyLongTermAmbition,
    // Status
    wounds_current: char.status.wounds.current,
    wounds_max: char.status.wounds.max,
    fate_current: char.status.fate.current,
    fate_max: char.status.fate.max,
    fortune_current: char.status.fortune.current,
    fortune_max: char.status.fortune.max,
    resilience_current: char.status.resilience.current,
    resilience_max: char.status.resilience.max,
    resolve_current: char.status.resolve.current,
    resolve_max: char.status.resolve.max,
    corruption_current: char.status.corruption.current,
    corruption_max: char.status.corruption.max,
  };

  for (const key of CHAR_KEYS) {
    const c = char.characteristics[key];
    flat[`${key}_initial`] = c.initial;
    flat[`${key}_advances`] = c.advances;
    flat[`${key}_talents`] = c.talents;
    flat[`${key}_modifier`] = c.modifier;
  }

  // Sub-tables
  flat.skills = char.skills.map(s => ({
    skill_id: s.id,
    characteristic: s.characteristic,
    advances: s.advances,
    talents: s.talents,
    modifier: s.modifier,
  }));

  flat.talents = Object.entries(char.talents).map(([id, ranks]) => ({
    talent_id: id,
    ranks,
  }));

  flat.conditions = char.conditions.map(c => ({
    condition_id: c.id,
    stack_count: c.stack,
  }));

  // Inventory
  const invItems: any[] = [];
  for (const [itemId, qty] of Object.entries(char.inventory.weapons)) {
    invItems.push({ item_id: itemId, item_type: 'weapon', quantity: qty, is_equipped: !!char.inventory.equippedWeapons?.[itemId] });
  }
  for (const [itemId, qty] of Object.entries(char.inventory.armor)) {
    invItems.push({ item_id: itemId, item_type: 'armor', quantity: qty, is_equipped: !!char.inventory.equippedArmor?.[itemId] });
  }
  for (const [itemId, qty] of Object.entries(char.inventory.items)) {
    invItems.push({ item_id: itemId, item_type: 'item', quantity: qty, is_equipped: !!char.inventory.equippedItems?.[itemId] });
  }
  flat.inventory = invItems;

  flat.career_history = char.careerHistory.map(ch => ({
    career_id: ch.careerId,
    career_level_id: ch.careerLevelId,
    career_name: ch.careerName,
    level_name: ch.levelName,
    level: ch.level,
    xp_spent: ch.xpSpent,
    advancement_type: ch.advancementType,
    advancement_id: ch.advancementId,
    advancement_name: ch.advancementName,
    timestamp: ch.timestamp,
  }));

  // Unlocks
  const unlocks: any[] = [];
  for (const id of char.unlockedCharacteristicIds) unlocks.push({ unlock_type: 'characteristic', unlock_id: id });
  for (const id of char.unlockedSkillIds) unlocks.push({ unlock_type: 'skill', unlock_id: id });
  for (const id of char.unlockedTalentIds) unlocks.push({ unlock_type: 'talent', unlock_id: id });
  flat.unlocks = unlocks;

  flat.reputations = (char.reputations ?? []).map(r => ({
    faction_id: r.factionId,
    value: r.value,
    knowledge_level: r.knowledgeLevel,
    notes: r.notes,
  }));

  if (char.lore) {
    flat.lore = {
      gm_notes: char.lore.gmNotes,
      player_notes: char.lore.playerNotes ?? null,
      appearance: char.lore.appearance ?? null,
      voice: char.lore.voice ?? null,
      mannerisms: char.lore.mannerisms ?? null,
      biography: char.lore.biography ?? null,
      ambition_short: char.lore.ambitions?.short ?? null,
      ambition_long: char.lore.ambitions?.long ?? null,
      motivation_key: char.lore.motivationKey ?? null,
    };
    flat.knowledge_entries = (char.lore.background ?? []).map(k => ({
      topic: k.topic,
      content: k.content,
      visibility: k.visibility,
    }));
    flat.relationships = (char.lore.relationships ?? []).map(r => ({
      target_character_id: r.targetCharacterId,
      type: r.type,
      description: r.description,
    }));
  }

  flat.action_bar = (char.actionBar ?? []).map(ab => ({
    slot_index: ab.slotIndex,
    type: ab.type,
    action_id: ab.id,
    label: ab.label,
  }));

  return flat;
}

// ─── Journal ────────────────────────────────────────────────────────────────

export function assembleJournalEntry(row: any): JournalEntry {
  return {
    id: row.id,
    title: row.title,
    content: row.content ?? '',
    imageData: row.image_data ?? undefined,
    sharedWith: row.shared_with ?? [],
  };
}

// ─── Quest ───────────────────────────────────────────────────────────────────

export function assembleQuest(row: any): Quest {
  return {
    id: row.id,
    title: row.title,
    characterId: row.character_id,
    description: row.description ?? '',
    status: row.status ?? 'active',
    objectives: (row.objectives ?? []).map((o: any) => ({
      id: o.id,
      text: o.text,
      isCompleted: o.is_completed ?? false,
      locationId: o.location_id ?? undefined,
    } as QuestObjective)),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

// ─── Faction ─────────────────────────────────────────────────────────────────

export function assembleFaction(row: any): Faction {
  return {
    id: row.faction_key ?? row.id,
    name: row.name,
    description: row.description ?? '',
    category: row.category ?? 'other',
    icon: row.icon ?? undefined,
    hq: row.hq ?? '',
    head: row.head ?? '',
    defaultReputation: row.default_reputation ?? 0,
    color: row.color ?? undefined,
  };
}

// ─── Map ─────────────────────────────────────────────────────────────────────

export function assembleMapData(mapRow: any, locationRows: any[]): MapData {
  return {
    id: mapRow.map_key ?? mapRow.id,
    name: mapRow.name,
    imagePath: mapRow.image_path ?? '',
    gridSize: mapRow.grid_size ?? 100,
    spawnPoint: (mapRow.spawn_point_x != null && mapRow.spawn_point_y != null)
      ? { x: mapRow.spawn_point_x, y: mapRow.spawn_point_y }
      : undefined,
    locations: locationRows.map(loc => ({
      id: loc.location_key ?? loc.id,
      name: loc.name,
      coords: { x: loc.coords_x, y: loc.coords_y },
      playerDescription: loc.player_description ?? '',
      gmNotes: loc.gm_notes ?? '',
      image: loc.image ?? '',
      music: loc.music ?? '',
      hooks: loc.hooks ?? [],
      tag: loc.tag ?? '',
      controllingFactionId: loc.controlling_faction_id ?? undefined,
      influenceWeight: loc.influence_weight ?? undefined,
    } as Location)),
  };
}

export function assembleMapToken(row: any): MapToken {
  return {
    id: row.id,
    characterId: row.character_id,
    characterName: row.character_name ?? undefined,
    mapId: row.map_id,
    x: row.x,
    y: row.y,
  };
}

export function assembleUserMapPin(row: any): UserMapPin {
  return {
    id: row.id,
    playerId: row.user_id,
    characterId: row.character_id,
    mapId: row.map_id,
    x: row.x,
    y: row.y,
    label: row.label,
    color: row.color ?? undefined,
  };
}

// ─── Shop ────────────────────────────────────────────────────────────────────

export function assembleShopDefinition(row: any): ShopDefinition {
  return {
    id: row.shop_key ?? row.id,
    name: row.name,
    locationId: row.location_id ?? '',
    category: row.category,
    baseStock: row.base_stock ?? [],
  };
}

export function assembleShopInventoryItem(row: any): ShopInventoryItem {
  return {
    instanceId: row.instance_id,
    baseItemId: row.base_item_id,
    baseItemType: row.base_item_type,
    nameOverride: row.name_override ?? undefined,
    modification: row.modification ?? 'standard',
    qualities: row.qualities ?? [],
    flaws: row.flaws ?? [],
    basePrice: row.base_price,
    displayPrice: row.display_price ?? '',
    quantity: row.quantity ?? 1,
    isIdentified: row.is_identified ?? false,
  };
}

// ─── Calendar ────────────────────────────────────────────────────────────────

export function assembleCalendarState(stateRow: any, eventRows: any[]): CalendarState {
  return {
    currentDate: {
      year: stateRow.current_year,
      monthIndex: stateRow.current_month_index,
      day: stateRow.current_day,
    } as GameDate,
    events: eventRows.map(e => ({
      id: e.id,
      date: { year: e.date_year, monthIndex: e.date_month_index, day: e.date_day } as GameDate,
      title: e.title,
      description: e.description ?? '',
      tags: [],
      isVisibleToPlayers: e.is_visible_to_players ?? false,
      color: e.category ?? undefined,
    } as TimelineEvent)),
    eventTags: [],
    currentWeather: stateRow.current_weather ?? undefined,
  };
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export function assembleChatMessage(row: any): ChatMessage {
  return {
    id: row.id,
    timestamp: new Date(row.created_at).getTime(),
    senderId: row.sender_id ?? '',
    senderName: row.sender_name,
    senderColor: row.sender_color ?? undefined,
    type: row.type ?? 'chat',
    content: row.content,
    isPrivate: row.is_private ?? false,
    data: row.data ?? undefined,
  };
}

// ─── Combat ──────────────────────────────────────────────────────────────────

export function assembleCombatant(row: any): Combatant {
  return {
    id: row.id,
    sourceId: row.source_id,
    name: row.name,
    initiative: row.initiative,
    currentWounds: row.current_wounds,
    maxWounds: row.max_wounds,
    baseInitiative: row.base_initiative,
    baseAg: row.base_ag,
    isPlayer: row.is_player ?? false,
    conditions: row.conditions ?? [],
    conditionInstances: row.condition_instances ?? [],
  };
}

export function assembleAdvantages(row: any): Advantages {
  return {
    playerAdvantage: row.player_advantage ?? 0,
    enemyAdvantage: row.enemy_advantage ?? 0,
  };
}

// ─── Audio ───────────────────────────────────────────────────────────────────

export function assembleAudioTrack(row: any): AudioTrack {
  return {
    id: row.id,
    filename: row.filename,
    path: row.path,
    tags: row.tags ?? [],
    duration: row.duration ?? undefined,
    isMissing: row.is_missing ?? false,
    displayName: row.display_name ?? undefined,
    lastModified: row.last_modified ?? undefined,
  };
}

export function assemblePlaylist(row: any, trackIds: string[]): Playlist {
  return {
    id: row.id,
    name: row.name,
    trackIds,
    description: row.description ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Character Template ──────────────────────────────────────────────────────

export function assembleCharacterTemplate(row: any): CharacterTemplate {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description ?? undefined,
    species: row.species ?? '',
    careerId: row.career_id ?? undefined,
    careerLevelId: row.career_level_id ?? undefined,
    movement: row.movement ?? 4,
    nameList: row.name_list ?? [],
    characteristics: row.characteristics ?? {},
    skills: row.skills ?? [],
    talents: row.talents ?? [],
    trappings: row.trappings ?? { weapons: [], armor: [], items: [] },
    baseWounds: row.base_wounds ?? undefined,
    woundsVariance: row.wounds_variance ?? undefined,
    isMinion: row.is_minion ?? false,
    tags: row.tags ?? [],
  };
}
