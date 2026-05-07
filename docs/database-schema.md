# Database Schema Documentation

## Overview

This document describes the Supabase PostgreSQL schema for the Ubersreik Adventures WFRP4e campaign manager. The schema migrates from a single `campaign-state.json` file to a fully relational (with strategic JSONB) database that supports multi-campaign, multi-user, and real-time features.

**Migration file:** `supabase/migrations/20250506000001_initial_schema.sql`

---

## Design Principles

1. **Multi-campaign from day one** — All entities are scoped to a `campaign_id`
2. **JSONB for atomic sub-documents** — Data always loaded/saved together (characteristics, inventory, skills) stays as JSONB to avoid join table explosion
3. **Normalized for independent entities** — Characters, maps, factions, journal entries are proper tables with FKs
4. **Supabase Auth integration** — `profiles` table links to `auth.users`; all user references use UUIDs

---

## Entity Relationship Diagram

```
auth.users
    │
    ▼ (1:1)
profiles
    │
    ├──< campaign_members >──┐
    │                         │
    ▼ (GM owns)              ▼
campaigns ───────────────────────────────────────────────────┐
    │                                                         │
    ├──> maps ──────> map_pin_states                          │
    │       │──────> map_tokens                               │
    │       └──────> user_map_pins                            │
    │                                                         │
    ├──> characters ──> (referenced by map_tokens,            │
    │                    user_map_pins, quests)                │
    │                                                         │
    ├──> journal_entries                                       │
    ├──> quests                                               │
    ├──> factions ──> location_territories                    │
    ├──> shop_definitions                                     │
    ├──> character_templates                                  │
    ├──> combat_state (1:1 per campaign)                      │
    └──> chat_messages                                        │
```

---

## Tables

### `profiles`

Links to Supabase `auth.users`. Auto-created on signup via database trigger.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, FK → auth.users(id) ON DELETE CASCADE | Same ID as auth user |
| `display_name` | TEXT | NOT NULL, default 'Unnamed' | Player display name |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | Account creation time |

**Trigger:** `on_auth_user_created` calls `handle_new_user()` to auto-insert a profile row.

---

### `campaigns`

Top-level campaign entity. All game data references a campaign.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, default gen_random_uuid() | Campaign ID |
| `name` | TEXT | NOT NULL | Campaign name |
| `gm_user_id` | UUID | NOT NULL, FK → profiles(id) | Game Master |
| `active_map_id` | UUID | NULL, FK → maps(id) ON DELETE SET NULL | Currently active map |
| `calendar_state` | JSONB | NULL | Imperial Calendar state |
| `last_global_restock` | TEXT | NULL | ISO date of last shop restock |
| `version` | TEXT | NOT NULL, default '1.0.0' | Data version |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | Auto-updated by trigger |

**Maps from:** `CampaignState.activeMapId`, `CampaignState.calendar`, `CampaignState.version`, `ShopInventoryState.lastGlobalRestock`

---

### `campaign_members`

Junction table for campaign membership and roles.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `campaign_id` | UUID | PK (composite), FK → campaigns(id) ON DELETE CASCADE | |
| `user_id` | UUID | PK (composite), FK → profiles(id) ON DELETE CASCADE | |
| `role` | TEXT | NOT NULL, CHECK ('gm', 'player') | User's role |
| `color` | TEXT | NULL | Hex color for tokens/pings |

**Maps from:** `CampaignState.users[]` (role derived), `CampaignState.playerColors`

---

### `characters`

Player characters and NPCs. Core entity with JSONB sub-documents.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, default gen_random_uuid() | Character ID |
| `campaign_id` | UUID | NOT NULL, FK → campaigns(id) ON DELETE CASCADE | |
| `user_id` | UUID | NULL, FK → profiles(id) ON DELETE SET NULL | Owning player (null = NPC) |
| `name` | TEXT | NOT NULL | Character name |
| `species` | TEXT | NULL | Human, Dwarf, Elf, Halfling |
| `class` | TEXT | NULL | Warrior, Ranger, etc. |
| `current_career_id` | TEXT | NULL | Active career reference |
| `current_career_level_id` | TEXT | NULL | Active career level |
| `tags` | TEXT[] | NOT NULL, default '{}' | Classification tags |
| `location_id` | TEXT | NULL | Map location reference |
| `xp_current` | INTEGER | NOT NULL, default 0 | Available XP |
| `xp_spent` | INTEGER | NOT NULL, default 0 | Total XP spent |
| `career_history` | JSONB | NOT NULL, default '[]' | CareerHistoryEntry[] |
| `unlocked_characteristic_ids` | TEXT[] | NOT NULL, default '{}' | GM-granted unlocks |
| `unlocked_skill_ids` | TEXT[] | NOT NULL, default '{}' | GM-granted unlocks |
| `unlocked_talent_ids` | TEXT[] | NOT NULL, default '{}' | GM-granted unlocks |
| `details` | JSONB | NOT NULL, default '{}' | CharacterDetails |
| `movement` | INTEGER | NOT NULL, default 4 | Walk speed |
| `characteristics` | JSONB | NOT NULL | 10 characteristics |
| `skills` | JSONB | NOT NULL, default '[]' | Skill[] |
| `status` | JSONB | NOT NULL | wounds/fate/fortune/resilience/resolve/corruption |
| `conditions` | JSONB | NOT NULL, default '[]' | Active conditions |
| `talents` | JSONB | NOT NULL, default '{}' | Record<talentId, ranks> |
| `inventory` | JSONB | NOT NULL, default '{...}' | Weapons, armor, items, equipped |
| `currency` | JSONB | NOT NULL, default '{...}' | { gc, ss, bp } |
| `reputations` | JSONB | NOT NULL, default '[]' | ReputationEntry[] |
| `lore` | JSONB | NULL | CharacterLore (GM notes, background, relationships) |
| `is_minion` | BOOLEAN | NOT NULL, default false | Minion view flag |
| `template_id` | TEXT | NULL | Source template reference |
| `action_bar` | JSONB | NULL | ActionBarEntry[] |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL, default now() | Auto-updated |

**JSONB Rationale:** `characteristics`, `skills`, `status`, `conditions`, `talents`, `inventory`, `currency`, `reputations`, `lore`, `action_bar` are always loaded and saved atomically with the character. Normalizing these into separate tables would require 5+ JOINs for every character load with no independent query benefit.

**Maps from:** `Character` interface in `wfrp.types.ts`

---

### `journal_entries`

GM journal entries shared with players.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `campaign_id` | UUID | NOT NULL, FK → campaigns | |
| `title` | TEXT | NOT NULL | Entry title |
| `content` | TEXT | NOT NULL | Entry body |
| `image_data` | TEXT | NULL | Base64 encoded image |
| `session_date` | TEXT | NULL | In-game date string |
| `shared_with` | TEXT[] | NOT NULL, default '{}' | Character IDs or 'all' |
| `is_public` | BOOLEAN | NOT NULL, default false | Visible to all |
| `created_at` | TIMESTAMPTZ | | |
| `updated_at` | TIMESTAMPTZ | | Auto-updated |

**Maps from:** `CampaignState.journal[]` (`JournalEntry` interface)

**Note:** `shared_with` uses character IDs (matching the existing model) rather than user IDs. The `is_public` column is new and equivalent to `shared_with` containing `'all'`.

---

### `quests`

Party-wide quest journal.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `campaign_id` | UUID | NOT NULL, FK → campaigns | |
| `title` | TEXT | NOT NULL | Quest title |
| `description` | TEXT | NULL | Quest description |
| `objectives` | JSONB | NOT NULL, default '[]' | QuestObjective[] |
| `status` | TEXT | NOT NULL, CHECK ('active','completed','failed') | |
| `character_id` | UUID | NULL, FK → characters ON DELETE SET NULL | Creator |
| `created_at` | TIMESTAMPTZ | | |
| `updated_at` | TIMESTAMPTZ | | Auto-updated |

**Maps from:** `CampaignState.quests[]` (`Quest` interface)

---

### `factions`

Campaign factions for reputation and territory systems.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `campaign_id` | UUID | NOT NULL, FK → campaigns | |
| `name` | TEXT | NOT NULL | Faction name |
| `description` | TEXT | NULL | Faction description |
| `category` | TEXT | NULL | FactionCategory enum value |
| `color` | TEXT | NULL | Display color |
| `icon` | TEXT | NULL | Icon identifier |
| `hq` | TEXT | NULL | Headquarters |
| `head` | TEXT | NULL | Leader name |
| `default_reputation` | INTEGER | NOT NULL, default 0 | Starting reputation |

**Maps from:** `CampaignState.factions[]` (`Faction` interface)

---

### `maps`

Campaign maps with embedded location data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `campaign_id` | UUID | NOT NULL, FK → campaigns | |
| `name` | TEXT | NOT NULL | Map name |
| `image_path` | TEXT | NOT NULL | Image URL/path |
| `grid_size` | INTEGER | NULL | Grid cell size in pixels |
| `spawn_point` | JSONB | NULL | { x, y } |
| `locations` | JSONB | NOT NULL, default '[]' | Location[] |

**Maps from:** `CampaignState.maps` (`MapData` interface)

**Note:** `grid_size` is a single integer (matching `MapData.gridSize: number`), not a `{width, height}` object as proposed in the original spec.

---

### `map_pin_states`

Location discovery tracking per character.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `campaign_id` | UUID | NOT NULL, FK → campaigns | |
| `map_id` | UUID | NOT NULL, FK → maps ON DELETE CASCADE | |
| `location_id` | TEXT | NOT NULL | Location ID within map's JSONB |
| `player_discovered` | TEXT[] | NOT NULL, default '{}' | Character IDs |

**Unique:** (`map_id`, `location_id`)

**Maps from:** `CampaignState.mapPinStates` (`Record<locationId, MapPinState>`)

---

### `map_tokens`

Character tokens placed on maps.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `campaign_id` | UUID | NOT NULL, FK → campaigns | |
| `map_id` | UUID | NOT NULL, FK → maps ON DELETE CASCADE | |
| `character_id` | UUID | NOT NULL, FK → characters ON DELETE CASCADE | |
| `x` | DOUBLE PRECISION | NOT NULL, default 0 | X coordinate |
| `y` | DOUBLE PRECISION | NOT NULL, default 0 | Y coordinate |
| `visible` | BOOLEAN | NOT NULL, default true | Visibility flag |

**Unique index:** (`character_id`, `map_id`) — one token per character per map.

**Maps from:** `CampaignState.tokens[]` (`MapToken` interface)

---

### `user_map_pins`

Personal pins/notes created by players on maps.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `campaign_id` | UUID | NOT NULL, FK → campaigns | |
| `map_id` | UUID | NOT NULL, FK → maps ON DELETE CASCADE | |
| `user_id` | UUID | NOT NULL, FK → profiles ON DELETE CASCADE | |
| `character_id` | UUID | NULL, FK → characters ON DELETE SET NULL | Creating character |
| `x` | DOUBLE PRECISION | NOT NULL, default 0 | |
| `y` | DOUBLE PRECISION | NOT NULL, default 0 | |
| `label` | TEXT | NULL | Pin label |
| `color` | TEXT | NULL | Custom color |

**Maps from:** `CampaignState.userPins[]` (`UserMapPin` interface)

---

### `shop_definitions`

Shop configurations with generated inventories.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `campaign_id` | UUID | NOT NULL, FK → campaigns | |
| `name` | TEXT | NOT NULL | Shop name |
| `location_id` | TEXT | NULL | Map location reference |
| `category` | TEXT | NOT NULL | Shop type category |
| `base_stock` | TEXT[] | NOT NULL, default '{}' | Item IDs this shop can stock |
| `inventory` | JSONB | NOT NULL, default '[]' | Generated ShopInventoryItem[] |
| `last_restock_date` | TEXT | NULL | ISO date of last restock |
| `player_access` | TEXT[] | NOT NULL, default '{}' | Character IDs with access |
| `is_custom` | BOOLEAN | NOT NULL, default false | GM-created flag |
| `created_at` | TIMESTAMPTZ | | |
| `updated_at` | TIMESTAMPTZ | | Auto-updated |

**Maps from:** `ShopDefinition` + `ShopState` (combined into one table)

---

### `character_templates`

NPC generation templates with variance.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `campaign_id` | UUID | NOT NULL, FK → campaigns | |
| `name` | TEXT | NOT NULL | Template name |
| `category` | TEXT | NULL | CharacterTemplateCategory |
| `template_data` | JSONB | NOT NULL | Full CharacterTemplate definition |

**Maps from:** `CampaignState.characterTemplates[]` (`CharacterTemplate` interface)

---

### `location_territories`

Faction territory control per map location.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `campaign_id` | UUID | NOT NULL, FK → campaigns | |
| `location_id` | TEXT | NOT NULL | Map location reference |
| `faction_id` | UUID | NULL, FK → factions ON DELETE SET NULL | Controlling faction |
| `control_level` | INTEGER | NOT NULL, default 0 | Influence weight (1-5) |

**Unique:** (`campaign_id`, `location_id`)

**Maps from:** `CampaignState.locationTerritories` (`Record<locationId, LocationTerritory>`)

---

### `combat_state`

Active combat tracker (one per campaign).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `campaign_id` | UUID | NOT NULL, FK → campaigns, UNIQUE | One per campaign |
| `is_active` | BOOLEAN | NOT NULL, default false | Combat in progress |
| `current_turn_index` | INTEGER | NOT NULL, default 0 | Active combatant index |
| `round_number` | INTEGER | NOT NULL, default 1 | Current round |
| `combatants` | JSONB | NOT NULL, default '[]' | Full Combatant[] data |
| `player_advantage` | INTEGER | NOT NULL, default 0 | |
| `enemy_advantage` | INTEGER | NOT NULL, default 0 | |
| `updated_at` | TIMESTAMPTZ | | Auto-updated |

**Maps from:** Combat tracker state (previously managed in-memory and broadcast via Socket.io)

**Note:** `combatants` stores full `Combatant[]` as JSONB because combat is ephemeral, frequently updated atomically, and has no need for independent combatant queries.

---

### `chat_messages`

In-game chat, dice rolls, and system messages.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK | |
| `campaign_id` | UUID | NOT NULL, FK → campaigns | |
| `sender_id` | UUID | NULL, FK → profiles ON DELETE SET NULL | null = system |
| `sender_name` | TEXT | NOT NULL | Display name at time of send |
| `content` | TEXT | NOT NULL | Message content |
| `message_type` | TEXT | NOT NULL, CHECK ('text','dice_roll','system','whisper') | |
| `roll_data` | JSONB | NULL | Dice results if applicable |
| `target_user_id` | UUID | NULL, FK → profiles ON DELETE SET NULL | Whisper target |
| `created_at` | TIMESTAMPTZ | NOT NULL, default now() | |

**Index:** (`campaign_id`, `created_at` DESC) for paginated loading.

**New table** — no direct mapping from existing model (previously messages were ephemeral Socket.io events).

---

## Mapping: CampaignState → Supabase Tables

| CampaignState Field | Target Table/Column |
|---------------------|---------------------|
| `characters[]` | `characters` table |
| `users[]` | `profiles` + `campaign_members` |
| `journal[]` | `journal_entries` table |
| `quests[]` | `quests` table |
| `mapPinStates{}` | `map_pin_states` table |
| `factions[]` | `factions` table |
| `shopInventory.shops{}` | `shop_definitions` table (merged) |
| `shopInventory.lastGlobalRestock` | `campaigns.last_global_restock` |
| `customShopDefinitions[]` | `shop_definitions` (with `is_custom = true`) |
| `tokens[]` | `map_tokens` table |
| `userPins[]` | `user_map_pins` table |
| `playerColors{}` | `campaign_members.color` |
| `characterTemplates[]` | `character_templates` table |
| `maps{}` | `maps` table |
| `activeMapId` | `campaigns.active_map_id` |
| `calendar` | `campaigns.calendar_state` |
| `locationTerritories{}` | `location_territories` table |
| `version` | `campaigns.version` |
| `lastModified` | `campaigns.updated_at` |

---

## JSONB vs Normalized Decision Rationale

| Data | Decision | Reason |
|------|----------|--------|
| `characteristics` | JSONB | Always loaded/saved with character. 10 fixed keys. No independent queries needed. |
| `skills` | JSONB | Variable array, always loaded with character. Indexed access not needed. |
| `status` | JSONB | 6 sub-objects, always atomic with character. |
| `conditions` | JSONB | Ephemeral, changes frequently during combat. |
| `talents` | JSONB | Simple key-value map. No relational queries. |
| `inventory` | JSONB | Complex nested structure. Always saved atomically. |
| `career_history` | JSONB | Append-only log. No cross-character queries. |
| `locations` (maps) | JSONB | Always loaded with the map. No independent location queries. |
| `combatants` | JSONB | Ephemeral combat data. Entire array updated atomically each turn. |
| `objectives` (quests) | JSONB | Always loaded with the quest. Simple sub-array. |
| `calendar_state` | JSONB | Complex nested object (dates, events, tags). One per campaign. |
| `template_data` | JSONB | Heterogeneous template definitions. Full document always needed. |
| `factions` | **Normalized** | Independent entities referenced by location_territories and character reputations. |
| `characters` | **Normalized** | Independent entities with ownership, tokens, and cross-references. |
| `maps` | **Normalized** | Independent entities with tokens, pins, and pin_states referencing them. |
| `journal_entries` | **Normalized** | Independent documents with their own sharing permissions. |
| `quests` | **Normalized** | Independent entities with status tracking. |

---

## Triggers

| Trigger | Table | Function | Purpose |
|---------|-------|----------|---------|
| `on_auth_user_created` | `auth.users` | `handle_new_user()` | Auto-create profile on signup |
| `campaigns_updated_at` | `campaigns` | `update_updated_at()` | Auto-update timestamp |
| `characters_updated_at` | `characters` | `update_updated_at()` | Auto-update timestamp |
| `journal_entries_updated_at` | `journal_entries` | `update_updated_at()` | Auto-update timestamp |
| `quests_updated_at` | `quests` | `update_updated_at()` | Auto-update timestamp |
| `shop_definitions_updated_at` | `shop_definitions` | `update_updated_at()` | Auto-update timestamp |
| `combat_state_updated_at` | `combat_state` | `update_updated_at()` | Auto-update timestamp |

---

## Indexes

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| `characters` | `idx_characters_campaign` | `campaign_id` | Filter characters by campaign |
| `characters` | `idx_characters_user` | `user_id` | Find user's characters |
| `journal_entries` | `idx_journal_entries_campaign` | `campaign_id` | Filter by campaign |
| `quests` | `idx_quests_campaign` | `campaign_id` | Filter by campaign |
| `factions` | `idx_factions_campaign` | `campaign_id` | Filter by campaign |
| `maps` | `idx_maps_campaign` | `campaign_id` | Filter by campaign |
| `map_pin_states` | `idx_map_pin_states_campaign` | `campaign_id` | Filter by campaign |
| `map_tokens` | `idx_map_tokens_map` | `map_id` | Tokens on a map |
| `map_tokens` | `idx_map_tokens_char_map` | `character_id, map_id` (UNIQUE) | One token per char per map |
| `user_map_pins` | `idx_user_map_pins_map` | `map_id` | Pins on a map |
| `user_map_pins` | `idx_user_map_pins_user` | `user_id` | User's pins |
| `shop_definitions` | `idx_shop_definitions_campaign` | `campaign_id` | Filter by campaign |
| `character_templates` | `idx_character_templates_campaign` | `campaign_id` | Filter by campaign |
| `location_territories` | `idx_location_territories_campaign` | `campaign_id` | Filter by campaign |
| `chat_messages` | `idx_chat_messages_campaign_time` | `campaign_id, created_at DESC` | Paginated chat loading |
