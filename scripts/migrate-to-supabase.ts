/**
 * Migration Script: campaign-state.json → Supabase
 * 
 * Usage:
 *   npx tsx scripts/migrate-to-supabase.ts <campaign-state.json> [user-mapping.json]
 * 
 * Environment variables required:
 *   VITE_SUPABASE_URL       - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (bypasses RLS)
 * 
 * User mapping file format (JSON):
 *   {
 *     "old-user-id-1": "new-supabase-uuid-1",
 *     "old-user-id-2": "new-supabase-uuid-2"
 *   }
 * 
 * If no mapping file is provided, the script will prompt interactively.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createInterface } from 'readline';
import type { Database } from '../packages/shared/src/types/database.types';
import type {
  CampaignState,
  Character,
  JournalEntry,
  Quest,
  Faction,
  MapData,
  MapPinState,
  MapToken,
  UserMapPin,
  ShopDefinition,
  ShopInventoryState,
  CharacterTemplate,
  LocationTerritory,
} from '../packages/shared/src/types/wfrp.types';
import type { CalendarState } from '../packages/shared/src/data/calendar';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MigrationReport {
  campaignId: string;
  campaignName: string;
  timestamp: string;
  counts: Record<string, number>;
  warnings: string[];
  errors: string[];
}

type UserMapping = Record<string, string>; // oldId -> newSupabaseUUID

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUUID(str: string): boolean {
  return UUID_REGEX.test(str);
}

function generateUUID(): string {
  return crypto.randomUUID();
}

/** Map an old ID to a new UUID, generating one if the old ID isn't already a UUID */
function ensureUUID(oldId: string, idMap: Map<string, string>): string {
  if (idMap.has(oldId)) return idMap.get(oldId)!;
  const newId = isUUID(oldId) ? oldId : generateUUID();
  idMap.set(oldId, newId);
  return newId;
}

function createReadlineInterface() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function prompt(rl: ReturnType<typeof createReadlineInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Migration
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: npx tsx scripts/migrate-to-supabase.ts <campaign-state.json> [user-mapping.json]');
    process.exit(1);
  }

  const campaignStatePath = resolve(args[0]);
  const mappingFilePath = args[1] ? resolve(args[1]) : null;

  // Validate env
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
    console.error('Set them in your environment or in a .env file and source it.');
    process.exit(1);
  }

  // Read campaign state
  if (!existsSync(campaignStatePath)) {
    console.error(`Error: File not found: ${campaignStatePath}`);
    process.exit(1);
  }

  const rawJson = readFileSync(campaignStatePath, 'utf-8');
  const campaignState: CampaignState = JSON.parse(rawJson);

  console.log(`\n=== WFRP Campaign Migration to Supabase ===`);
  console.log(`Source: ${campaignStatePath}`);
  console.log(`Version: ${campaignState.version}`);
  console.log(`Characters: ${campaignState.characters.length}`);
  console.log(`Users: ${campaignState.users.length}`);
  console.log(`Maps: ${Object.keys(campaignState.maps).length}`);
  console.log('');

  // Create admin Supabase client (bypasses RLS)
  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Build user mapping
  const userMapping = await buildUserMapping(campaignState, mappingFilePath);
  console.log(`\nUser mapping (${Object.keys(userMapping).length} users):`);
  for (const [oldId, newId] of Object.entries(userMapping)) {
    const user = campaignState.users.find(u => u.id === oldId);
    console.log(`  ${user?.username || oldId} → ${newId}`);
  }

  // ID maps for non-UUID old IDs
  const characterIdMap = new Map<string, string>();
  const factionIdMap = new Map<string, string>();
  const mapIdMap = new Map<string, string>();
  const shopIdMap = new Map<string, string>();
  const templateIdMap = new Map<string, string>();

  // Pre-build ID maps
  for (const char of campaignState.characters) {
    ensureUUID(char.id, characterIdMap);
  }
  for (const faction of campaignState.factions) {
    ensureUUID(faction.id, factionIdMap);
  }
  for (const mapId of Object.keys(campaignState.maps)) {
    ensureUUID(mapId, mapIdMap);
  }
  if (campaignState.customShopDefinitions) {
    for (const shop of campaignState.customShopDefinitions) {
      ensureUUID(shop.id, shopIdMap);
    }
  }
  if (campaignState.shopInventory?.shops) {
    for (const shopId of Object.keys(campaignState.shopInventory.shops)) {
      ensureUUID(shopId, shopIdMap);
    }
  }
  for (const tpl of campaignState.characterTemplates) {
    ensureUUID(tpl.id, templateIdMap);
  }

  const report: MigrationReport = {
    campaignId: '',
    campaignName: '',
    timestamp: new Date().toISOString(),
    counts: {},
    warnings: [],
    errors: [],
  };

  try {
    // ─── Step 1: Create campaign ───────────────────────────────────────
    console.log('\n[1/11] Creating campaign...');
    const campaignId = await migrateCampaign(supabase, campaignState, mapIdMap, report);
    report.campaignId = campaignId;

    // ─── Step 2: Create campaign members ───────────────────────────────
    console.log('[2/11] Creating campaign members...');
    await migrateCampaignMembers(supabase, campaignState, campaignId, userMapping, report);

    // ─── Step 3: Migrate characters ───────────────────────────────────
    console.log('[3/11] Migrating characters...');
    await migrateCharacters(supabase, campaignState, campaignId, userMapping, characterIdMap, report);

    // ─── Step 4: Migrate factions ──────────────────────────────────────
    console.log('[4/11] Migrating factions...');
    await migrateFactions(supabase, campaignState, campaignId, factionIdMap, report);

    // ─── Step 5: Migrate location territories ──────────────────────────
    console.log('[5/11] Migrating location territories...');
    await migrateLocationTerritories(supabase, campaignState, campaignId, factionIdMap, report);

    // ─── Step 6: Migrate maps ──────────────────────────────────────────
    console.log('[6/11] Migrating maps...');
    await migrateMaps(supabase, campaignState, campaignId, mapIdMap, report);

    // ─── Step 7: Migrate map pin states, tokens, user pins ─────────────
    console.log('[7/11] Migrating map data (pins, tokens, user pins)...');
    await migrateMapData(supabase, campaignState, campaignId, mapIdMap, characterIdMap, userMapping, report);

    // ─── Step 8: Migrate journal entries ──────────────────────────────
    console.log('[8/11] Migrating journal entries...');
    await migrateJournalEntries(supabase, campaignState, campaignId, characterIdMap, report);

    // ─── Step 9: Migrate quests ───────────────────────────────────────
    console.log('[9/11] Migrating quests...');
    await migrateQuests(supabase, campaignState, campaignId, characterIdMap, report);

    // ─── Step 10: Migrate shops and templates ─────────────────────────
    console.log('[10/11] Migrating shops and templates...');
    await migrateShopsAndTemplates(supabase, campaignState, campaignId, shopIdMap, templateIdMap, report);

    // ─── Step 11: Migrate combat state ────────────────────────────────
    console.log('[11/11] Migrating combat state...');
    await migrateCombatState(supabase, campaignState, campaignId, report);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    report.errors.push(`Fatal error: ${message}`);
    console.error(`\n❌ Fatal error: ${message}`);
  }

  // Print report
  printReport(report);

  // Save report
  const reportPath = resolve(process.cwd(), 'migration-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to: ${reportPath}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// User Mapping
// ─────────────────────────────────────────────────────────────────────────────

async function buildUserMapping(
  campaignState: CampaignState,
  mappingFilePath: string | null
): Promise<UserMapping> {
  // If mapping file provided, use it
  if (mappingFilePath) {
    if (!existsSync(mappingFilePath)) {
      console.error(`Error: Mapping file not found: ${mappingFilePath}`);
      process.exit(1);
    }
    const raw = readFileSync(mappingFilePath, 'utf-8');
    const mapping: UserMapping = JSON.parse(raw);

    // Validate all users are mapped
    for (const user of campaignState.users) {
      if (!mapping[user.id]) {
        console.error(`Error: User "${user.username}" (id: ${user.id}) not found in mapping file.`);
        process.exit(1);
      }
    }
    return mapping;
  }

  // Interactive prompt
  const rl = createReadlineInterface();
  const mapping: UserMapping = {};

  console.log('\n--- User Mapping ---');
  console.log('For each existing user, provide their new Supabase Auth UUID.');
  console.log('(These users must already exist in Supabase Auth.)\n');

  for (const user of campaignState.users) {
    let newId = '';
    while (!isUUID(newId)) {
      newId = await prompt(rl, `  ${user.username} (old ID: ${user.id}) → Supabase UUID: `);
      if (!isUUID(newId)) {
        console.log('    ⚠ Invalid UUID format. Please enter a valid UUID.');
      }
    }
    mapping[user.id] = newId;
  }

  rl.close();

  // Offer to save the mapping
  const savePath = resolve(process.cwd(), 'user-mapping.json');
  writeFileSync(savePath, JSON.stringify(mapping, null, 2));
  console.log(`\nUser mapping saved to: ${savePath}`);

  return mapping;
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration Functions
// ─────────────────────────────────────────────────────────────────────────────

async function migrateCampaign(
  supabase: SupabaseClient<Database>,
  state: CampaignState,
  mapIdMap: Map<string, string>,
  report: MigrationReport
): Promise<string> {
  const campaignId = generateUUID();
  const activeMapId = state.activeMapId ? mapIdMap.get(state.activeMapId) ?? null : null;

  const { error } = await supabase.from('campaigns').upsert({
    id: campaignId,
    name: 'Ubersreik Adventures', // Default name; can be overridden
    gm_user_id: '', // Will be set in campaign_members step - placeholder
    active_map_id: null, // Set after maps are created
    calendar_state: state.calendar ? (state.calendar as unknown as Record<string, unknown>) : null,
    last_global_restock: state.shopInventory?.lastGlobalRestock ?? null,
    version: state.version,
  });

  if (error) throw new Error(`Failed to create campaign: ${error.message}`);

  report.campaignName = 'Ubersreik Adventures';
  report.counts['campaigns'] = 1;

  // Store for later active_map_id update
  (report as unknown as Record<string, unknown>)._campaignId = campaignId;
  (report as unknown as Record<string, unknown>)._activeMapId = activeMapId;

  return campaignId;
}

async function migrateCampaignMembers(
  supabase: SupabaseClient<Database>,
  state: CampaignState,
  campaignId: string,
  userMapping: UserMapping,
  report: MigrationReport
) {
  const members: Database['public']['Tables']['campaign_members']['Insert'][] = [];

  // Determine GM: first user or user with no characterId (common pattern)
  // Default to first user as GM if unclear
  const gmOldId = state.users[0]?.id;
  const gmNewId = gmOldId ? userMapping[gmOldId] : null;

  if (!gmNewId) {
    report.warnings.push('Could not determine GM user. First user assumed as GM.');
  }

  // Update campaign gm_user_id
  if (gmNewId) {
    const { error } = await supabase
      .from('campaigns')
      .update({ gm_user_id: gmNewId })
      .eq('id', campaignId);
    if (error) report.warnings.push(`Failed to set campaign GM: ${error.message}`);
  }

  for (const user of state.users) {
    const newUserId = userMapping[user.id];
    if (!newUserId) {
      report.warnings.push(`Skipping user "${user.username}" - no mapping found.`);
      continue;
    }

    const isGm = user.id === gmOldId;
    const color = state.playerColors?.[user.id] ?? null;

    members.push({
      campaign_id: campaignId,
      user_id: newUserId,
      role: isGm ? 'gm' : 'player',
      color,
    });
  }

  if (members.length > 0) {
    const { error } = await supabase.from('campaign_members').upsert(members, {
      onConflict: 'campaign_id,user_id',
    });
    if (error) throw new Error(`Failed to insert campaign_members: ${error.message}`);
  }

  report.counts['campaign_members'] = members.length;
}

async function migrateCharacters(
  supabase: SupabaseClient<Database>,
  state: CampaignState,
  campaignId: string,
  userMapping: UserMapping,
  characterIdMap: Map<string, string>,
  report: MigrationReport
) {
  const rows: Database['public']['Tables']['characters']['Insert'][] = [];

  for (const char of state.characters) {
    const newId = characterIdMap.get(char.id)!;
    const newUserId = char.userId ? (userMapping[char.userId] ?? null) : null;

    if (char.userId && !newUserId) {
      report.warnings.push(`Character "${char.name}" has userId "${char.userId}" with no mapping. Setting to null.`);
    }

    rows.push({
      id: newId,
      campaign_id: campaignId,
      user_id: newUserId,
      name: char.name,
      species: char.species ?? null,
      class: char.class ?? null,
      current_career_id: char.currentCareerId ?? null,
      current_career_level_id: char.currentCareerLevelId ?? null,
      tags: char.tags ?? [],
      location_id: char.locationId ?? null,
      xp_current: char.xp?.current ?? 0,
      xp_spent: char.xp?.spent ?? 0,
      career_history: char.careerHistory as unknown as Record<string, unknown>[],
      unlocked_characteristic_ids: char.unlockedCharacteristicIds ?? [],
      unlocked_skill_ids: char.unlockedSkillIds ?? [],
      unlocked_talent_ids: char.unlockedTalentIds ?? [],
      details: char.details as unknown as Record<string, unknown>,
      movement: char.movement ?? 4,
      characteristics: char.characteristics as unknown as Record<string, unknown>,
      skills: char.skills as unknown as Record<string, unknown>[],
      status: char.status as unknown as Record<string, unknown>,
      conditions: char.conditions as unknown as Record<string, unknown>[],
      talents: char.talents as unknown as Record<string, unknown>,
      inventory: char.inventory as unknown as Record<string, unknown>,
      currency: char.currency as unknown as Record<string, unknown>,
      reputations: char.reputations as unknown as Record<string, unknown>[],
      lore: char.lore ? (char.lore as unknown as Record<string, unknown>) : null,
      is_minion: char.isMinion ?? false,
      template_id: char.templateId ?? null,
      action_bar: char.actionBar ? (char.actionBar as unknown as Record<string, unknown>[]) : null,
    });
  }

  // Batch upsert in chunks of 50
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await supabase.from('characters').upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`Failed to insert characters (batch ${i}): ${error.message}`);
  }

  report.counts['characters'] = rows.length;
}

async function migrateFactions(
  supabase: SupabaseClient<Database>,
  state: CampaignState,
  campaignId: string,
  factionIdMap: Map<string, string>,
  report: MigrationReport
) {
  if (!state.factions || state.factions.length === 0) {
    report.counts['factions'] = 0;
    return;
  }

  const rows: Database['public']['Tables']['factions']['Insert'][] = state.factions.map((f) => ({
    id: factionIdMap.get(f.id)!,
    campaign_id: campaignId,
    name: f.name,
    description: f.description ?? null,
    category: f.category ?? null,
    color: f.color ?? null,
    icon: f.icon ?? null,
    hq: f.hq ?? null,
    head: f.head ?? null,
    default_reputation: f.defaultReputation ?? 0,
  }));

  const { error } = await supabase.from('factions').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Failed to insert factions: ${error.message}`);

  report.counts['factions'] = rows.length;
}

async function migrateLocationTerritories(
  supabase: SupabaseClient<Database>,
  state: CampaignState,
  campaignId: string,
  factionIdMap: Map<string, string>,
  report: MigrationReport
) {
  if (!state.locationTerritories || Object.keys(state.locationTerritories).length === 0) {
    report.counts['location_territories'] = 0;
    return;
  }

  const rows: Database['public']['Tables']['location_territories']['Insert'][] = [];

  for (const [locationId, territory] of Object.entries(state.locationTerritories)) {
    const factionId = factionIdMap.get(territory.controllingFactionId) ?? null;
    if (!factionId) {
      report.warnings.push(`Territory for location "${locationId}": faction "${territory.controllingFactionId}" not found in mapping.`);
    }

    rows.push({
      campaign_id: campaignId,
      location_id: locationId,
      faction_id: factionId,
      control_level: territory.influenceWeight ?? 0,
    });
  }

  const { error } = await supabase.from('location_territories').upsert(rows, {
    onConflict: 'campaign_id,location_id',
  });
  if (error) throw new Error(`Failed to insert location_territories: ${error.message}`);

  report.counts['location_territories'] = rows.length;
}

async function migrateMaps(
  supabase: SupabaseClient<Database>,
  state: CampaignState,
  campaignId: string,
  mapIdMap: Map<string, string>,
  report: MigrationReport
) {
  if (!state.maps || Object.keys(state.maps).length === 0) {
    report.counts['maps'] = 0;
    return;
  }

  const rows: Database['public']['Tables']['maps']['Insert'][] = [];

  for (const [oldMapId, mapData] of Object.entries(state.maps)) {
    const newMapId = mapIdMap.get(oldMapId)!;

    rows.push({
      id: newMapId,
      campaign_id: campaignId,
      name: mapData.name,
      image_path: mapData.imagePath || mapData.mapImage || '',
      grid_size: mapData.gridSize ?? null,
      spawn_point: mapData.spawnPoint ? (mapData.spawnPoint as unknown as Record<string, unknown>) : null,
      locations: mapData.locations as unknown as Record<string, unknown>[],
    });
  }

  const { error } = await supabase.from('maps').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Failed to insert maps: ${error.message}`);

  // Now update campaign.active_map_id
  const activeMapId = state.activeMapId ? mapIdMap.get(state.activeMapId) ?? null : null;
  if (activeMapId) {
    const { error: updateErr } = await supabase
      .from('campaigns')
      .update({ active_map_id: activeMapId })
      .eq('id', campaignId);
    if (updateErr) report.warnings.push(`Failed to set active_map_id: ${updateErr.message}`);
  }

  report.counts['maps'] = rows.length;
}

async function migrateMapData(
  supabase: SupabaseClient<Database>,
  state: CampaignState,
  campaignId: string,
  mapIdMap: Map<string, string>,
  characterIdMap: Map<string, string>,
  userMapping: UserMapping,
  report: MigrationReport
) {
  // Map pin states
  let pinStateCount = 0;
  if (state.mapPinStates && Object.keys(state.mapPinStates).length > 0) {
    const pinRows: Database['public']['Tables']['map_pin_states']['Insert'][] = [];

    for (const [locationId, pinState] of Object.entries(state.mapPinStates)) {
      // Determine which map this location belongs to
      let targetMapId: string | null = null;
      for (const [oldMapId, mapData] of Object.entries(state.maps)) {
        if (mapData.locations.some(loc => loc.id === locationId)) {
          targetMapId = mapIdMap.get(oldMapId)!;
          break;
        }
      }

      if (!targetMapId) {
        // Default to active map if can't determine
        targetMapId = state.activeMapId ? mapIdMap.get(state.activeMapId)! : null;
        if (!targetMapId) {
          report.warnings.push(`Pin state for location "${locationId}": could not determine map. Skipping.`);
          continue;
        }
      }

      // Map character IDs in playerDiscovered
      const mappedDiscovered = pinState.playerDiscovered.map(
        charId => characterIdMap.get(charId) ?? charId
      );

      pinRows.push({
        campaign_id: campaignId,
        map_id: targetMapId,
        location_id: locationId,
        player_discovered: mappedDiscovered,
      });
    }

    if (pinRows.length > 0) {
      const { error } = await supabase.from('map_pin_states').upsert(pinRows, {
        onConflict: 'map_id,location_id',
      });
      if (error) throw new Error(`Failed to insert map_pin_states: ${error.message}`);
    }
    pinStateCount = pinRows.length;
  }
  report.counts['map_pin_states'] = pinStateCount;

  // Map tokens
  let tokenCount = 0;
  if (state.tokens && state.tokens.length > 0) {
    const tokenRows: Database['public']['Tables']['map_tokens']['Insert'][] = [];

    for (const token of state.tokens) {
      const mapId = mapIdMap.get(token.mapId);
      const charId = characterIdMap.get(token.characterId);

      if (!mapId) {
        report.warnings.push(`Token "${token.id}": map "${token.mapId}" not found. Skipping.`);
        continue;
      }
      if (!charId) {
        report.warnings.push(`Token "${token.id}": character "${token.characterId}" not found. Skipping.`);
        continue;
      }

      tokenRows.push({
        campaign_id: campaignId,
        map_id: mapId,
        character_id: charId,
        x: token.x,
        y: token.y,
        visible: true,
      });
    }

    if (tokenRows.length > 0) {
      const { error } = await supabase.from('map_tokens').upsert(tokenRows, {
        onConflict: 'id',
      });
      if (error) throw new Error(`Failed to insert map_tokens: ${error.message}`);
    }
    tokenCount = tokenRows.length;
  }
  report.counts['map_tokens'] = tokenCount;

  // User map pins
  let pinCount = 0;
  if (state.userPins && state.userPins.length > 0) {
    const pinRows: Database['public']['Tables']['user_map_pins']['Insert'][] = [];

    for (const pin of state.userPins) {
      const mapId = mapIdMap.get(pin.mapId);
      const userId = userMapping[pin.playerId] ?? null;
      const charId = characterIdMap.get(pin.characterId) ?? null;

      if (!mapId) {
        report.warnings.push(`User pin "${pin.id}": map "${pin.mapId}" not found. Skipping.`);
        continue;
      }
      if (!userId) {
        report.warnings.push(`User pin "${pin.id}": user "${pin.playerId}" not found in mapping. Skipping.`);
        continue;
      }

      pinRows.push({
        campaign_id: campaignId,
        map_id: mapId,
        user_id: userId,
        character_id: charId,
        x: pin.x,
        y: pin.y,
        label: pin.label ?? null,
        color: pin.color ?? null,
      });
    }

    if (pinRows.length > 0) {
      const { error } = await supabase.from('user_map_pins').upsert(pinRows, { onConflict: 'id' });
      if (error) throw new Error(`Failed to insert user_map_pins: ${error.message}`);
    }
    pinCount = pinRows.length;
  }
  report.counts['user_map_pins'] = pinCount;
}

async function migrateJournalEntries(
  supabase: SupabaseClient<Database>,
  state: CampaignState,
  campaignId: string,
  characterIdMap: Map<string, string>,
  report: MigrationReport
) {
  if (!state.journal || state.journal.length === 0) {
    report.counts['journal_entries'] = 0;
    return;
  }

  const rows: Database['public']['Tables']['journal_entries']['Insert'][] = state.journal.map((entry) => {
    // Map shared_with: character IDs or 'all'
    const sharedWith = entry.sharedWith.map(id => {
      if (id === 'all') return 'all';
      return characterIdMap.get(id) ?? id;
    });

    const isPublic = sharedWith.includes('all');

    return {
      id: isUUID(entry.id) ? entry.id : generateUUID(),
      campaign_id: campaignId,
      title: entry.title,
      content: entry.content,
      image_data: entry.imageData ?? null,
      session_date: null,
      shared_with: sharedWith,
      is_public: isPublic,
    };
  });

  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await supabase.from('journal_entries').upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`Failed to insert journal_entries (batch ${i}): ${error.message}`);
  }

  report.counts['journal_entries'] = rows.length;
}

async function migrateQuests(
  supabase: SupabaseClient<Database>,
  state: CampaignState,
  campaignId: string,
  characterIdMap: Map<string, string>,
  report: MigrationReport
) {
  if (!state.quests || state.quests.length === 0) {
    report.counts['quests'] = 0;
    return;
  }

  const rows: Database['public']['Tables']['quests']['Insert'][] = state.quests.map((quest) => {
    const characterId = characterIdMap.get(quest.characterId) ?? null;

    return {
      id: isUUID(quest.id) ? quest.id : generateUUID(),
      campaign_id: campaignId,
      title: quest.title,
      description: quest.description ?? null,
      objectives: quest.objectives as unknown as Record<string, unknown>[],
      status: quest.status as 'active' | 'completed' | 'failed',
      character_id: characterId,
    };
  });

  const { error } = await supabase.from('quests').upsert(rows, { onConflict: 'id' });
  if (error) throw new Error(`Failed to insert quests: ${error.message}`);

  report.counts['quests'] = rows.length;
}

async function migrateShopsAndTemplates(
  supabase: SupabaseClient<Database>,
  state: CampaignState,
  campaignId: string,
  shopIdMap: Map<string, string>,
  templateIdMap: Map<string, string>,
  report: MigrationReport
) {
  // Merge custom shop definitions and shop inventory state
  let shopCount = 0;

  const shopRows: Database['public']['Tables']['shop_definitions']['Insert'][] = [];

  // First: custom shop definitions
  if (state.customShopDefinitions) {
    for (const shop of state.customShopDefinitions) {
      const newId = shopIdMap.get(shop.id)!;
      const shopState = state.shopInventory?.shops?.[shop.id];

      shopRows.push({
        id: newId,
        campaign_id: campaignId,
        name: shop.name,
        location_id: shop.locationId ?? null,
        category: shop.category,
        base_stock: shop.baseStock ?? [],
        inventory: shopState?.inventory
          ? (shopState.inventory as unknown as Record<string, unknown>[])
          : [],
        last_restock_date: shopState?.lastRestockDate ?? null,
        player_access: shopState?.playerAccess ?? [],
        is_custom: true,
      });
    }
  }

  // Then: shops from shopInventory that aren't already covered by customShopDefinitions
  if (state.shopInventory?.shops) {
    const customIds = new Set((state.customShopDefinitions ?? []).map(s => s.id));

    for (const [shopId, shopState] of Object.entries(state.shopInventory.shops)) {
      if (customIds.has(shopId)) continue; // Already handled above

      const newId = shopIdMap.get(shopId)!;

      shopRows.push({
        id: newId,
        campaign_id: campaignId,
        name: `Shop ${shopId}`, // No name available for non-custom shops
        location_id: null,
        category: 'general', // Default category
        base_stock: [],
        inventory: shopState.inventory as unknown as Record<string, unknown>[],
        last_restock_date: shopState.lastRestockDate ?? null,
        player_access: shopState.playerAccess ?? [],
        is_custom: false,
      });
    }
  }

  if (shopRows.length > 0) {
    const { error } = await supabase.from('shop_definitions').upsert(shopRows, { onConflict: 'id' });
    if (error) throw new Error(`Failed to insert shop_definitions: ${error.message}`);
  }
  shopCount = shopRows.length;
  report.counts['shop_definitions'] = shopCount;

  // Character templates
  let templateCount = 0;
  if (state.characterTemplates && state.characterTemplates.length > 0) {
    const templateRows: Database['public']['Tables']['character_templates']['Insert'][] =
      state.characterTemplates.map((tpl) => ({
        id: templateIdMap.get(tpl.id)!,
        campaign_id: campaignId,
        name: tpl.name,
        category: tpl.category ?? null,
        template_data: tpl as unknown as Record<string, unknown>,
      }));

    const { error } = await supabase.from('character_templates').upsert(templateRows, { onConflict: 'id' });
    if (error) throw new Error(`Failed to insert character_templates: ${error.message}`);
    templateCount = templateRows.length;
  }
  report.counts['character_templates'] = templateCount;
}

async function migrateCombatState(
  supabase: SupabaseClient<Database>,
  state: CampaignState,
  campaignId: string,
  report: MigrationReport
) {
  // The existing campaign-state.json doesn't persist combat state long-term,
  // but if there's active combat data in memory during migration, handle it.
  // For now, create an inactive combat_state row as a placeholder.
  const { error } = await supabase.from('combat_state').upsert({
    campaign_id: campaignId,
    is_active: false,
    current_turn_index: 0,
    round_number: 1,
    combatants: [],
    player_advantage: 0,
    enemy_advantage: 0,
  }, { onConflict: 'campaign_id' });

  if (error) {
    report.warnings.push(`Failed to create combat_state: ${error.message}`);
    report.counts['combat_state'] = 0;
  } else {
    report.counts['combat_state'] = 1;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────────────

function printReport(report: MigrationReport) {
  console.log('\n════════════════════════════════════════════');
  console.log('        MIGRATION REPORT');
  console.log('════════════════════════════════════════════');
  console.log(`Campaign: ${report.campaignName} (${report.campaignId})`);
  console.log(`Timestamp: ${report.timestamp}`);
  console.log('');

  console.log('── Inserted Rows ──────────────────────────');
  let total = 0;
  for (const [table, count] of Object.entries(report.counts)) {
    console.log(`  ${table.padEnd(25)} ${count}`);
    total += count;
  }
  console.log(`  ${'TOTAL'.padEnd(25)} ${total}`);

  if (report.warnings.length > 0) {
    console.log('');
    console.log(`── Warnings (${report.warnings.length}) ────────────────────────`);
    for (const w of report.warnings) {
      console.log(`  ⚠ ${w}`);
    }
  }

  if (report.errors.length > 0) {
    console.log('');
    console.log(`── Errors (${report.errors.length}) ──────────────────────────`);
    for (const e of report.errors) {
      console.log(`  ❌ ${e}`);
    }
  }

  console.log('════════════════════════════════════════════\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
