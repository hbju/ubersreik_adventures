/**
 * Data Manager — Supabase-backed campaign persistence.
 *
 * Replaces the old JSON-file data manager. All data now lives in
 * Supabase PostgreSQL. An in-memory cache is kept for fast reads
 * by the Socket.io server and IPC handlers.
 */
import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    supabase,
} from '@wfrp/shared';
import type {
    CampaignState,
    Character,
    JournalEntry,
    Quest,
    Faction,
    MapPinState,
    ShopInventoryState,
    ShopDefinition,
    CharacterTemplate,
    UserMapPin,
    LocationTerritory,
    CalendarState,
} from '@wfrp/shared';
import type { MapToken } from '@wfrp/shared/src/types/wfrp.types';
import { getCurrentCampaignId } from './supabaseManager';

const {
    campaignQueries,
    characterQueries,
    journalQueries,
    questQueries,
    factionQueries,
    mapQueries,
    shopQueries,
    calendarQueries,
    chatQueries,
    combatQueries,
    audioQueries,
} = supabase;

/** In-memory cache of the campaign data */
let campaignData: CampaignState | null = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

function requireCampaignId(): string {
    const id = getCurrentCampaignId();
    if (!id) throw new Error('No active campaign. Select or create a campaign first.');
    return id;
}

function defaultCampaignState(): CampaignState {
    return {
        characters: [],
        users: [],
        journal: [],
        mapPinStates: {},
        factions: [],
        customShopDefinitions: [],
        version: '1.0.0',
        characterTemplates: [],
        maps: {},
        activeMapId: '',
        tokens: [],
        userPins: [],
        quests: [],
        playerColors: {},
        lastModified: new Date().toISOString(),
    };
}

// ─── Loading (Supabase → CampaignState) ─────────────────────────────────────

/**
 * Load full campaign data from Supabase into the in-memory cache.
 * This fetches every entity type in parallel.
 */
export async function loadCampaignData(): Promise<CampaignState> {
    const cid = requireCampaignId();
    console.log(`[DATA] Loading campaign ${cid} from Supabase…`);

    try {
        const [
            campaign,
            characters,
            journal,
            quests,
            factions,
            territories,
            mapsRecord,
            mapPinStates,
            tokens,
            userPins,
            shopInventory,
            customShops,
            calendarState,
            members,
        ] = await Promise.all([
            campaignQueries.getCampaign(cid),
            characterQueries.getAllCharacters(cid),
            journalQueries.getJournalEntries(cid),
            questQueries.getQuests(cid),
            factionQueries.getFactions(cid),
            factionQueries.getTerritories(cid),
            mapQueries.getMaps(cid),
            mapQueries.getMapPinStates(cid),
            mapQueries.getTokens(cid),
            mapQueries.getUserPins(cid),
            shopQueries.getShopInventoryState(cid),
            shopQueries.getCustomShopDefinitions(cid),
            calendarQueries.getCalendarState(cid),
            campaignQueries.getMembers(cid),
        ]);

        // Map campaign_members to the legacy User type the UI expects
        const users = members.map((m: any) => ({
            id: m.user_id,
            username: m.user_id, // Will be resolved via Supabase Auth profile later
            passwordHash: '', // Not used with Supabase Auth
            characterId: m.character_id ?? null,
            createdAt: m.joined_at,
        }));

        // Build player colors from members (stored on campaign_members.color)
        const playerColors: Record<string, string> = {};
        for (const m of members) {
            if (m.color) playerColors[m.user_id] = m.color;
        }

        campaignData = {
            characters,
            users,
            journal,
            quests,
            factions,
            locationTerritories: territories,
            mapPinStates,
            maps: mapsRecord,
            activeMapId: campaign.active_map_id || '',
            tokens,
            userPins,
            shopInventory,
            customShopDefinitions: customShops,
            characterTemplates: [], // loaded separately if needed
            calendar: calendarState ?? undefined,
            playerColors,
            version: campaign.version || '1.0.0',
            lastModified: campaign.updated_at || new Date().toISOString(),
        };

        console.log(`[DATA] Campaign loaded: ${characters.length} characters, ${journal.length} journal entries`);
        return campaignData;
    } catch (error) {
        console.error('[DATA] Error loading campaign from Supabase:', error);
        campaignData = defaultCampaignState();
        return campaignData;
    }
}

// ─── Granular Saves ─────────────────────────────────────────────────────────

/** Save a single character to Supabase. */
export async function saveCharacter(character: Character): Promise<void> {
    const cid = requireCampaignId();
    await characterQueries.saveCharacter(cid, character);
    // Update cache
    if (campaignData) {
        const idx = campaignData.characters.findIndex(c => c.id === character.id);
        if (idx >= 0) campaignData.characters[idx] = character;
        else campaignData.characters.push(character);
    }
}

/** Delete a character from Supabase. */
export async function deleteCharacter(characterId: string): Promise<void> {
    await characterQueries.deleteCharacter(characterId);
    if (campaignData) {
        campaignData.characters = campaignData.characters.filter(c => c.id !== characterId);
    }
}

/** Save all journal entries. */
export async function saveJournal(entries: JournalEntry[]): Promise<void> {
    const cid = requireCampaignId();
    // For simplicity, we upsert each entry and delete removed ones
    const existingIds = new Set((await journalQueries.getJournalEntries(cid)).map(e => e.id));
    const newIds = new Set(entries.map(e => e.id));

    // Delete removed entries
    for (const id of existingIds) {
        if (!newIds.has(id)) {
            await journalQueries.deleteJournalEntry(id);
        }
    }

    // Upsert entries (create or update)
    for (const entry of entries) {
        if (existingIds.has(entry.id)) {
            await journalQueries.updateJournalEntry(entry.id, entry);
        } else {
            await journalQueries.createJournalEntry(cid, entry);
        }
    }

    if (campaignData) campaignData.journal = entries;
}

/** Save quests. */
export async function saveQuests(quests: Quest[]): Promise<void> {
    const cid = requireCampaignId();
    const existingIds = new Set((await questQueries.getQuests(cid)).map(q => q.id));
    const newIds = new Set(quests.map(q => q.id));

    for (const id of existingIds) {
        if (!newIds.has(id)) await questQueries.deleteQuest(id);
    }
    for (const quest of quests) {
        if (existingIds.has(quest.id)) {
            await questQueries.updateQuest(quest.id, quest);
        } else {
            await questQueries.createQuest(cid, quest);
        }
    }

    if (campaignData) campaignData.quests = quests;
}

/** Save factions and territories. */
export async function saveFactions(factions: Faction[], territories?: Record<string, LocationTerritory>): Promise<void> {
    const cid = requireCampaignId();
    for (const faction of factions) {
        await factionQueries.upsertFaction(cid, faction);
    }
    if (territories) {
        for (const [locationId, territory] of Object.entries(territories)) {
            await factionQueries.setTerritory(cid, locationId, territory.controllingFactionId, territory.influenceWeight);
        }
    }
    if (campaignData) {
        campaignData.factions = factions;
        if (territories) campaignData.locationTerritories = territories;
    }
}

/** Save map pin states. */
export async function saveMapPinStates(pinStates: Record<string, MapPinState>): Promise<void> {
    const cid = requireCampaignId();
    for (const [locationKey, state] of Object.entries(pinStates)) {
        for (const charId of state.playerDiscovered) {
            await mapQueries.discoverPin(cid, locationKey, charId);
        }
    }
    if (campaignData) campaignData.mapPinStates = pinStates;
}

/** Save tokens. */
export async function saveTokens(tokens: MapToken[]): Promise<void> {
    const cid = requireCampaignId();
    for (const token of tokens) {
        await mapQueries.upsertToken(cid, token);
    }
    if (campaignData) campaignData.tokens = tokens;
}

/** Save user pins. */
export async function saveUserPins(pins: UserMapPin[]): Promise<void> {
    // Individual pin operations are done via the map queries
    if (campaignData) campaignData.userPins = pins;
}

/** Save calendar state. */
export async function saveCalendarState(calendar: CalendarState): Promise<void> {
    const cid = requireCampaignId();
    if (calendar.currentDate) {
        await calendarQueries.updateCalendarDate(cid, calendar.currentDate, calendar.currentWeather);
    }
    if (campaignData) campaignData.calendar = calendar;
}

/** Save active map ID. */
export async function saveActiveMapId(mapId: string): Promise<void> {
    const cid = requireCampaignId();
    await campaignQueries.updateCampaign(cid, { active_map_id: mapId });
    if (campaignData) campaignData.activeMapId = mapId;
}

/** Save shop inventory state. */
export async function saveShopInventory(shopInventory: ShopInventoryState): Promise<void> {
    if (campaignData) campaignData.shopInventory = shopInventory;
    // Shop inventory items are saved per-shop via shopQueries.setShopInventory
}

/** Save custom shop definitions. */
export async function saveCustomShopDefinitions(defs: ShopDefinition[]): Promise<void> {
    const cid = requireCampaignId();
    for (const def of defs) {
        await shopQueries.upsertShopDefinition(cid, def);
    }
    if (campaignData) campaignData.customShopDefinitions = defs;
}

// ─── Full State Save (legacy compatibility) ──────────────────────────────────

/**
 * Save the full campaign state. This is called by the existing save-data IPC
 * handler for backward compatibility. It delegates to granular saves.
 */
export async function saveCampaignData(data: CampaignState): Promise<void> {
    const cid = requireCampaignId();
    console.log('[DATA] Saving full campaign state to Supabase…');

    try {
        // Save characters
        for (const character of data.characters) {
            await characterQueries.saveCharacter(cid, character);
        }

        // Update campaign metadata
        await campaignQueries.updateCampaign(cid, { active_map_id: data.activeMapId || undefined });

        // Update cache
        data.lastModified = new Date().toISOString();
        campaignData = data;

        console.log('[DATA] Campaign state saved');
    } catch (error) {
        console.error('[DATA] Error saving campaign state:', error);
        throw error;
    }
}

// ─── Export to JSON (replaces backup) ────────────────────────────────────────

/**
 * Export the current campaign data to a JSON file (backup).
 */
export function exportCampaignToJson(): string {
    if (!campaignData) throw new Error('No campaign data to export');

    const userDataPath = app.getPath('userData');
    const backupsDir = path.join(userDataPath, 'backups');

    if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupsDir, `campaign-export-${timestamp}.json`);

    fs.writeFileSync(backupPath, JSON.stringify(campaignData, null, 2), 'utf-8');
    console.log('[DATA] Campaign exported to:', backupPath);

    return backupPath;
}

/**
 * Import campaign data from a legacy JSON file into Supabase.
 * Creates a new campaign and inserts all entities, remapping legacy
 * text-based IDs to proper UUIDs where required by the schema.
 */
export async function importCampaignFromJson(jsonPath: string, campaignName: string): Promise<string> {
    const fileContent = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(fileContent) as CampaignState;

    // Create a new campaign
    const campaign = await campaignQueries.createCampaign(campaignName, `Imported from ${path.basename(jsonPath)}`);
    const newCampaignId = campaign.id;

    console.log(`[IMPORT] Importing campaign "${campaignName}" → ${newCampaignId}`);

    // ── Step 1: Build character ID mapping (oldId → newUUID) ──────────
    const charIdMap = new Map<string, string>();
    for (const character of data.characters || []) {
        const oldId = character.id;
        const newId = isValidUUID(oldId) ? oldId : crypto.randomUUID();
        charIdMap.set(oldId, newId);
    }
    console.log(`[IMPORT] Mapped ${charIdMap.size} character IDs`);

    // ── Step 2: Import characters with remapped IDs ───────────────────
    for (const character of data.characters || []) {
        const remapped = remapCharacterIds(character, charIdMap);
        await characterQueries.saveCharacter(newCampaignId, remapped);
    }
    console.log(`[IMPORT] Imported ${data.characters?.length ?? 0} characters`);
    const charsWithRelationships = data.characters.filter(
        c => c.lore?.relationships?.length
    );
    for (const character of charsWithRelationships) {
        await characterQueries.saveCharacterRelationships(character.id, character);
    }
    console.log(`[IMPORT] Imported ${charsWithRelationships.length} characters with relationships`);

    // ── Step 3: Import journal entries (remap sharedWith) ─────────────
    for (const entry of data.journal || []) {
        const remappedSharedWith = (entry.sharedWith || []).map(
            sw => sw === 'all' ? 'all' : (charIdMap.get(sw) ?? sw)
        );
        await journalQueries.createJournalEntry(newCampaignId, {
            ...entry,
            sharedWith: remappedSharedWith,
        });
    }
    console.log(`[IMPORT] Imported ${data.journal?.length ?? 0} journal entries`);

    // ── Step 4: Import quests (remap characterId) ─────────────────────
    for (const quest of data.quests || []) {
        const remappedCharId = charIdMap.get(quest.characterId) ?? quest.characterId;
        // Only import if the character exists (UUID is valid)
        if (isValidUUID(remappedCharId)) {
            await questQueries.createQuest(newCampaignId, {
                ...quest,
                characterId: remappedCharId,
            });
        } else {
            console.warn(`[IMPORT] Skipping quest "${quest.title}": invalid characterId after remap`);
        }
    }
    console.log(`[IMPORT] Imported quests`);

    // ── Step 5: Import factions ───────────────────────────────────────
    for (const faction of data.factions || []) {
        await factionQueries.upsertFaction(newCampaignId, faction);
    }
    console.log(`[IMPORT] Imported ${data.factions?.length ?? 0} factions`);

    // ── Step 6: Import map pin discoveries (remap character IDs) ──────
    if (data.mapPinStates) {
        for (const [locationKey, state] of Object.entries(data.mapPinStates)) {
            for (const oldCharId of state.playerDiscovered) {
                const newCharId = charIdMap.get(oldCharId) ?? oldCharId;
                if (isValidUUID(newCharId) && data.characters.some(c => c.id === oldCharId)) {
                    await mapQueries.discoverPin(newCampaignId, locationKey, newCharId);
                }
            }
        }
    }
    console.log(`[IMPORT] Imported map pin discoveries`);

    // ── Step 7: Import tokens (remap character IDs, generate token UUID) ─
    for (const token of data.tokens || []) {
        const newCharId = charIdMap.get(token.characterId) ?? token.characterId;
        if (isValidUUID(newCharId) && data.characters.some(c => c.id === token.characterId)) {
            await mapQueries.upsertToken(newCampaignId, {
                ...token,
                id: crypto.randomUUID(), // generate fresh UUID for token
                characterId: newCharId,
            });
        }
    }
    console.log(`[IMPORT] Imported ${data.tokens?.length ?? 0} tokens`);

    // ── Step 8: Import custom shop definitions ────────────────────────
    for (const shop of data.customShopDefinitions || []) {
        await shopQueries.upsertShopDefinition(newCampaignId, shop);
    }
    console.log(`[IMPORT] Imported ${data.customShopDefinitions?.length ?? 0} custom shops`);

    // ── Step 9: Import calendar ───────────────────────────────────────
    if (data.calendar?.currentDate) {
        await calendarQueries.updateCalendarDate(newCampaignId, data.calendar.currentDate, data.calendar.currentWeather);
        for (const event of data.calendar.events || []) {
            await calendarQueries.createCalendarEvent(newCampaignId, event);
        }
    }
    console.log(`[IMPORT] Imported calendar`);

    // ── Step 10: Set active map ID ────────────────────────────────────
    if (data.activeMapId) {
        await campaignQueries.updateCampaign(newCampaignId, { active_map_id: data.activeMapId });
    }

    console.log(`[IMPORT] Campaign "${campaignName}" imported successfully as ${newCampaignId}`);
    return newCampaignId;
}

// ─── Import Helpers ──────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: string): boolean {
    return UUID_REGEX.test(value);
}

/**
 * Remap a character's own ID and all internal cross-references.
 * Strips userId (legacy users don't map to Supabase Auth).
 */
function remapCharacterIds(
    character: Character,
    charIdMap: Map<string, string>,
): Character {
    const newId = charIdMap.get(character.id) ?? character.id;

    // Remap relationship target IDs
    let remappedLore = character.lore;
    if (remappedLore) {
        remappedLore = {
            ...remappedLore,
            relationships: (remappedLore.relationships ?? []).map(rel => ({
                ...rel,
                targetCharacterId: charIdMap.get(rel.targetCharacterId) ?? rel.targetCharacterId,
            })),
            background: (remappedLore.background ?? []).map(k => ({
                ...k,
                visibility: (k.visibility ?? []).map(
                    v => charIdMap.get(v) ?? v
                ),
            })),
        };
    }

    // Remap reputation faction IDs (these stay as-is; they use faction_key text)
    return {
        ...character,
        id: newId,
        userId: null, // legacy users can't map to Supabase Auth
        lore: remappedLore,
    };
}

// ─── Cache Accessors ─────────────────────────────────────────────────────────

/**
 * Get the current in-memory campaign data.
 */
export function getCampaignData(): CampaignState | null {
    return campaignData;
}

/**
 * Clear the in-memory cache.
 */
export function clearCampaignCache(): void {
    console.log('[DATA] Clearing campaign data cache');
    campaignData = null;
}

// Legacy alias kept for backward compatibility with server.ts
export const backupCampaignData = exportCampaignToJson;
