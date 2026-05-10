/**
 * Builds a {@link CampaignState} JSON snapshot from Supabase for offline backup /
 * migration. Mirrors data written by `scripts/migrate-to-supabase.ts`.
 */
import type { TypedSupabaseClient } from '../lib/supabase';
import type { Database } from '../types/database.types';
import type {
  CampaignState,
  CharacterTemplate,
  Faction,
  FactionCategory,
  JournalEntry,
  Location,
  MapData,
  MapPinState,
  MapToken,
  Quest,
  QuestObjective,
  QuestStatus,
  ShopDefinition,
  ShopInventoryItem,
  ShopInventoryState,
  ShopState,
  User,
  UserMapPin,
} from '../types/wfrp.types';
import type { CalendarState } from '../data/calendar';
import { ErrorCode, failure, success, type ServiceResult } from '../types/errors';
import { mapSupabaseError } from './baseService';
import { characterRowToCharacter } from '../utils/characterConverter';

type CampaignRow = Database['public']['Tables']['campaigns']['Row'];
type CharacterRow = Database['public']['Tables']['characters']['Row'];
type JournalRow = Database['public']['Tables']['journal_entries']['Row'];
type QuestRow = Database['public']['Tables']['quests']['Row'];
type FactionRow = Database['public']['Tables']['factions']['Row'];
type TerritoryRow = Database['public']['Tables']['location_territories']['Row'];
type MapRow = Database['public']['Tables']['maps']['Row'];
type PinStateRow = Database['public']['Tables']['map_pin_states']['Row'];
type TokenRow = Database['public']['Tables']['map_tokens']['Row'];
type UserPinRow = Database['public']['Tables']['user_map_pins']['Row'];
type ShopRow = Database['public']['Tables']['shop_definitions']['Row'];
type TemplateRow = Database['public']['Tables']['character_templates']['Row'];
type CombatRow = Database['public']['Tables']['combat_state']['Row'];
type ChatRow = Database['public']['Tables']['chat_messages']['Row'];

/** Extra tables included for a full Supabase snapshot (ignored by legacy migration script). */
export interface SupabaseBackupExtra {
  exportedAt: string;
  sourceCampaignId: string;
  campaignName: string;
  combatState: CombatRow | null;
  chatMessages: ChatRow[];
}

export type CampaignBackupPayload = CampaignState & {
  _supabaseBackupExtra?: SupabaseBackupExtra;
};

type ObjectiveInput = {
  id?: string;
  text?: string;
  isCompleted?: boolean;
  completed?: boolean;
  locationId?: string;
};

function questObjectiveFromJson(input: ObjectiveInput): QuestObjective {
  return {
    id: input?.id ?? crypto.randomUUID(),
    text: input?.text ?? '',
    isCompleted: Boolean(input?.isCompleted ?? input?.completed),
    locationId: input?.locationId,
  };
}

function rowToQuest(row: QuestRow): Quest {
  const objectivesInput = Array.isArray(row.objectives) ? row.objectives : [];
  return {
    id: row.id,
    title: row.title,
    characterId: row.character_id ?? '',
    description: row.description ?? '',
    status: (row.status as QuestStatus) ?? 'active',
    objectives: (objectivesInput as ObjectiveInput[]).map(questObjectiveFromJson),
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function rowToFaction(row: FactionRow): Faction {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    category: (row.category ?? 'other') as FactionCategory,
    icon: row.icon ?? undefined,
    hq: row.hq ?? '',
    head: row.head ?? '',
    defaultReputation: row.default_reputation ?? 0,
    color: row.color ?? undefined,
  };
}

function rowToJournalEntry(row: JournalRow): JournalEntry {
  const hasAll = row.is_public;
  const shared = row.shared_with ?? [];
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    imageData: row.image_data ?? undefined,
    sharedWith: hasAll ? ['all', ...shared] : shared,
  };
}

function rowToMapData(row: MapRow): MapData {
  const imagePath = row.image_path ?? '';
  return {
    id: row.id,
    name: row.name,
    imagePath,
    mapImage: imagePath,
    gridSize: row.grid_size ?? 0,
    spawnPoint: row.spawn_point as MapData['spawnPoint'],
    locations: (Array.isArray(row.locations) ? row.locations : []) as unknown as Location[],
  };
}

function rowToShopState(row: ShopRow): ShopState {
  return {
    shopId: row.id,
    lastRestockDate: row.last_restock_date ?? row.updated_at,
    inventory: (Array.isArray(row.inventory) ? row.inventory : []) as ShopInventoryItem[],
    playerAccess: row.player_access ?? [],
  };
}

function rowToShopDefinition(row: ShopRow): ShopDefinition {
  return {
    id: row.id,
    name: row.name,
    locationId: row.location_id ?? '',
    category: row.category as ShopDefinition['category'],
    baseStock: row.base_stock ?? [],
  };
}

function templateRowToCharacterTemplate(row: TemplateRow): CharacterTemplate {
  const data = row.template_data as unknown as Partial<CharacterTemplate>;
  return {
    ...data,
    id: row.id,
    name: row.name,
    category: (row.category ?? data.category ?? 'Other') as CharacterTemplate['category'],
  } as CharacterTemplate;
}

/**
 * Export the full campaign as a {@link CampaignState}-compatible document plus optional
 * `_supabaseBackupExtra` (combat + chat).
 */
export async function exportCampaignBackupFromSupabase(
  client: TypedSupabaseClient,
  campaignId: string
): Promise<ServiceResult<CampaignBackupPayload>> {
  const { data: campaign, error: campError } = await client
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (campError) return mapSupabaseError<CampaignBackupPayload>(campError);
  if (!campaign) {
    return failure(ErrorCode.NOT_FOUND, `Campaign not found: ${campaignId}`);
  }

  const c = campaign as CampaignRow;

  const [
    membersRes,
    charactersRes,
    journalRes,
    questsRes,
    factionsRes,
    territoriesRes,
    mapsRes,
    pinStatesRes,
    tokensRes,
    userPinsRes,
    shopsRes,
    templatesRes,
    combatRes,
    chatRes,
  ] = await Promise.all([
    client
      .from('campaign_members')
      .select('user_id, role, color, profiles(display_name, created_at)')
      .eq('campaign_id', campaignId),
    client.from('characters').select('*').eq('campaign_id', campaignId),
    client.from('journal_entries').select('*').eq('campaign_id', campaignId),
    client.from('quests').select('*').eq('campaign_id', campaignId),
    client.from('factions').select('*').eq('campaign_id', campaignId),
    client.from('location_territories').select('*').eq('campaign_id', campaignId),
    client.from('maps').select('*').eq('campaign_id', campaignId),
    client.from('map_pin_states').select('*').eq('campaign_id', campaignId),
    client.from('map_tokens').select('*').eq('campaign_id', campaignId),
    client.from('user_map_pins').select('*').eq('campaign_id', campaignId),
    client.from('shop_definitions').select('*').eq('campaign_id', campaignId),
    client.from('character_templates').select('*').eq('campaign_id', campaignId),
    client.from('combat_state').select('*').eq('campaign_id', campaignId).maybeSingle(),
    client.from('chat_messages').select('*').eq('campaign_id', campaignId),
  ]);

  const errors = [
    membersRes.error,
    charactersRes.error,
    journalRes.error,
    questsRes.error,
    factionsRes.error,
    territoriesRes.error,
    mapsRes.error,
    pinStatesRes.error,
    tokensRes.error,
    userPinsRes.error,
    shopsRes.error,
    templatesRes.error,
    combatRes.error,
    chatRes.error,
  ].filter(Boolean);
  if (errors.length > 0) {
    return mapSupabaseError<CampaignBackupPayload>(errors[0]!);
  }

  const characterRows = (charactersRes.data ?? []) as CharacterRow[];
  const characters = characterRows.map(characterRowToCharacter);

  const userIdToCharacterId = new Map<string, string>();
  for (const row of characterRows) {
    if (row.user_id) {
      userIdToCharacterId.set(row.user_id, row.id);
    }
  }

  const users: User[] = ((membersRes.data ?? []) as Array<{
    user_id: string;
    role: string;
    color: string | null;
    profiles: { display_name?: string | null; created_at?: string | null } | null;
  }>).map((m) => ({
    id: m.user_id,
    username: m.profiles?.display_name ?? 'Unknown user',
    passwordHash: '',
    characterId: userIdToCharacterId.get(m.user_id) ?? null,
    createdAt: m.profiles?.created_at ?? new Date().toISOString(),
  }));

  const playerColors: Record<string, string> = {};
  for (const m of membersRes.data ?? []) {
    const row = m as { user_id: string; color: string | null };
    if (row.color) playerColors[row.user_id] = row.color;
  }

  const journal = ((journalRes.data ?? []) as JournalRow[]).map(rowToJournalEntry);
  const quests = ((questsRes.data ?? []) as QuestRow[]).map(rowToQuest);
  const factions = ((factionsRes.data ?? []) as FactionRow[]).map(rowToFaction);

  const locationTerritories: CampaignState['locationTerritories'] = {};
  for (const row of (territoriesRes.data ?? []) as TerritoryRow[]) {
    if (!row.faction_id) continue;
    locationTerritories[row.location_id] = {
      controllingFactionId: row.faction_id,
      influenceWeight: row.control_level ?? 1,
    };
  }

  const maps: Record<string, MapData> = {};
  for (const row of (mapsRes.data ?? []) as MapRow[]) {
    maps[row.id] = rowToMapData(row);
  }

  const mapPinStates: Record<string, MapPinState> = {};
  for (const row of (pinStatesRes.data ?? []) as PinStateRow[]) {
    const existing = mapPinStates[row.location_id];
    const discovered = row.player_discovered ?? [];
    if (existing) {
      const merged = new Set([...existing.playerDiscovered, ...discovered]);
      mapPinStates[row.location_id] = { playerDiscovered: [...merged] };
    } else {
      mapPinStates[row.location_id] = { playerDiscovered: [...discovered] };
    }
  }

  const tokens: MapToken[] = ((tokensRes.data ?? []) as TokenRow[]).map((row) => ({
    id: row.id,
    characterId: row.character_id,
    mapId: row.map_id,
    x: row.x,
    y: row.y,
  }));

  const userPins: UserMapPin[] = ((userPinsRes.data ?? []) as UserPinRow[]).map((row) => ({
    id: row.id,
    playerId: row.user_id,
    characterId: row.character_id ?? '',
    mapId: row.map_id,
    x: row.x,
    y: row.y,
    label: row.label ?? '',
    color: row.color ?? undefined,
  }));

  const shopRows = (shopsRes.data ?? []) as ShopRow[];
  const customShopDefinitions = shopRows.filter((r) => r.is_custom).map(rowToShopDefinition);

  const shopsRecord: Record<string, ShopState> = {};
  shopRows.forEach((row) => {
    shopsRecord[row.id] = rowToShopState(row);
  });

  const shopInventory: ShopInventoryState = {
    shops: shopsRecord,
    lastGlobalRestock: c.last_global_restock ?? new Date().toISOString(),
  };

  const characterTemplates = ((templatesRes.data ?? []) as TemplateRow[]).map(templateRowToCharacterTemplate);

  const calendar = (c.calendar_state as CalendarState | null) ?? undefined;

  const payload: CampaignBackupPayload = {
    characters,
    users,
    journal,
    quests,
    mapPinStates,
    factions,
    shopInventory,
    customShopDefinitions,
    tokens,
    userPins,
    playerColors,
    characterTemplates,
    maps,
    activeMapId: c.active_map_id ?? '',
    calendar,
    locationTerritories:
      Object.keys(locationTerritories).length > 0 ? locationTerritories : undefined,
    version: c.version ?? '1.0.0',
    lastModified: new Date().toISOString(),
    _supabaseBackupExtra: {
      exportedAt: new Date().toISOString(),
      sourceCampaignId: campaignId,
      campaignName: c.name,
      combatState: (combatRes.data ?? null) as CombatRow | null,
      chatMessages: (chatRes.data ?? []) as ChatRow[],
    },
  };

  return success(payload);
}
