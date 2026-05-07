-- =============================================================================
-- PBI 1.1: Full Schema Creation for WFRP4e Campaign Manager
-- Supabase Migration
-- =============================================================================
-- This migration creates all tables for the Ubersreik Adventures campaign 
-- management system, migrating from local JSON persistence to Supabase.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Utility: Reusable updated_at trigger function
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: profiles
-- Links to Supabase auth.users. Auto-created on signup via trigger.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Unnamed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'User profiles linked to Supabase auth. Auto-created on signup.';

-- Trigger: auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', 'Unnamed'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: campaigns
-- Top-level campaign entity. All other data is scoped to a campaign.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  gm_user_id UUID NOT NULL REFERENCES public.profiles(id),
  active_map_id UUID NULL, -- FK added after maps table is created
  calendar_state JSONB NULL, -- CalendarState (complex nested object)
  version TEXT NOT NULL DEFAULT '1.0.0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.campaigns IS 'Top-level campaign entity. All game data is scoped to a campaign_id.';
COMMENT ON COLUMN public.campaigns.calendar_state IS 'Imperial Calendar state: { currentDate, events[], eventTags[], currentWeather }';

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: campaign_members
-- Junction table linking users to campaigns with roles.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.campaign_members (
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('gm', 'player')),
  color TEXT NULL, -- Hex color for player tokens/pings
  PRIMARY KEY (campaign_id, user_id)
);

COMMENT ON TABLE public.campaign_members IS 'Maps users to campaigns with their role (gm/player).';

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: characters
-- Player characters and NPCs. Core of the data model.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL, -- null = unassigned NPC
  name TEXT NOT NULL,
  species TEXT NULL,
  class TEXT NULL,
  current_career_id TEXT NULL,
  current_career_level_id TEXT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  location_id TEXT NULL,
  xp_current INTEGER NOT NULL DEFAULT 0,
  xp_spent INTEGER NOT NULL DEFAULT 0,
  career_history JSONB NOT NULL DEFAULT '[]', -- CareerHistoryEntry[]
  unlocked_characteristic_ids TEXT[] NOT NULL DEFAULT '{}',
  unlocked_skill_ids TEXT[] NOT NULL DEFAULT '{}',
  unlocked_talent_ids TEXT[] NOT NULL DEFAULT '{}',
  details JSONB NOT NULL DEFAULT '{}', -- CharacterDetails
  movement INTEGER NOT NULL DEFAULT 4,
  characteristics JSONB NOT NULL, -- { ws, bs, s, t, i, ag, dex, int, wp, fel } each { initial, advances, talents, modifier }
  skills JSONB NOT NULL DEFAULT '[]', -- Skill[]
  status JSONB NOT NULL, -- { wounds: {current,max}, fate: {current,max}, fortune: {current,max}, resilience: {current,max}, resolve: {current,max}, corruption: {current,max} }
  conditions JSONB NOT NULL DEFAULT '[]', -- Condition[]
  talents JSONB NOT NULL DEFAULT '{}', -- Record<talentId, ranks>
  inventory JSONB NOT NULL DEFAULT '{"weapons":{},"armor":{},"items":{}}', -- { weapons, armor, items, equippedWeapons?, equippedArmor?, equippedItems? }
  currency JSONB NOT NULL DEFAULT '{"gc":0,"ss":0,"bp":0}', -- Currency
  reputations JSONB NOT NULL DEFAULT '[]', -- ReputationEntry[]
  lore JSONB NULL, -- CharacterLore
  is_minion BOOLEAN NOT NULL DEFAULT false,
  template_id TEXT NULL,
  action_bar JSONB NULL, -- ActionBarEntry[]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.characters IS 'Player characters and NPCs. JSONB columns hold data always loaded/saved atomically with the character.';
COMMENT ON COLUMN public.characters.characteristics IS '10 WFRP characteristics: { ws, bs, s, t, i, ag, dex, int, wp, fel } each with { initial, advances, talents, modifier }';
COMMENT ON COLUMN public.characters.status IS 'Derived stats: wounds, fate, fortune, resilience, resolve, corruption (each { current, max })';
COMMENT ON COLUMN public.characters.inventory IS 'Equipment: { weapons: Record<id, qty>, armor: Record<id, qty>, items: Record<id, qty>, equippedWeapons?, equippedArmor?, equippedItems? }';

CREATE INDEX idx_characters_campaign ON public.characters(campaign_id);
CREATE INDEX idx_characters_user ON public.characters(user_id);

CREATE TRIGGER characters_updated_at
  BEFORE UPDATE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: journal_entries
-- GM journal entries, optionally shared with specific players.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_data TEXT NULL, -- Base64 encoded image data
  session_date TEXT NULL, -- In-game date string
  shared_with TEXT[] NOT NULL DEFAULT '{}', -- Array of character IDs or 'all'
  is_public BOOLEAN NOT NULL DEFAULT false, -- Visible to all players
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.journal_entries IS 'GM journal entries shared with players. shared_with uses character IDs for granular access.';
COMMENT ON COLUMN public.journal_entries.shared_with IS 'Array of character IDs who can see this entry, or contains "all" for everyone.';

CREATE INDEX idx_journal_entries_campaign ON public.journal_entries(campaign_id);

CREATE TRIGGER journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: quests
-- Party-wide quest journal with objectives.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NULL,
  objectives JSONB NOT NULL DEFAULT '[]', -- QuestObjective[] { id, text, isCompleted, locationId? }
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  character_id UUID NULL REFERENCES public.characters(id) ON DELETE SET NULL, -- Creator (character)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.quests IS 'Party-wide quest journal. Created by characters (players), managed by GM.';
COMMENT ON COLUMN public.quests.character_id IS 'The character who created this quest (maps to existing Quest.characterId).';

CREATE INDEX idx_quests_campaign ON public.quests(campaign_id);

CREATE TRIGGER quests_updated_at
  BEFORE UPDATE ON public.quests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: factions
-- Campaign factions for reputation and territory systems.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.factions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NULL,
  category TEXT NULL, -- 'government', 'noble_house', 'guild', 'criminal', 'religious', 'military', 'cult', 'other'
  color TEXT NULL,
  icon TEXT NULL, -- Icon identifier
  hq TEXT NULL, -- Headquarters location
  head TEXT NULL, -- Leader name
  default_reputation INTEGER NOT NULL DEFAULT 0 -- Default reputation value for new characters
);

COMMENT ON TABLE public.factions IS 'Campaign factions for reputation tracking and territory control.';

CREATE INDEX idx_factions_campaign ON public.factions(campaign_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: maps
-- Campaign maps with their locations embedded as JSONB.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  image_path TEXT NOT NULL, -- Local path initially; Supabase Storage URL later
  grid_size FLOAT NULL, -- Single grid cell size (existing model uses number, not {w,h})
  spawn_point JSONB NULL, -- { x, y }
  locations JSONB NOT NULL DEFAULT '[]' -- Location[] (always loaded with map)
);

COMMENT ON TABLE public.maps IS 'Campaign maps. Locations are stored as JSONB since they are always loaded with the map.';
COMMENT ON COLUMN public.maps.grid_size IS 'Grid cell size in scale. Single number matching existing MapData.gridSize.';
COMMENT ON COLUMN public.maps.locations IS 'Array of Location objects: { id, name, coords, playerDescription, gmNotes, image, music, hooks, tag, controllingFactionId?, influenceWeight? }';

CREATE INDEX idx_maps_campaign ON public.maps(campaign_id);

-- Now add the FK from campaigns.active_map_id -> maps.id
ALTER TABLE public.campaigns
  ADD CONSTRAINT fk_campaigns_active_map
  FOREIGN KEY (active_map_id) REFERENCES public.maps(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: map_pin_states
-- Tracks which characters have discovered which map locations.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.map_pin_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  map_id UUID NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL, -- Matches location ID within the map's locations JSONB
  player_discovered TEXT[] NOT NULL DEFAULT '{}', -- Array of character IDs who discovered this location
  UNIQUE (map_id, location_id)
);

COMMENT ON TABLE public.map_pin_states IS 'Tracks location discovery per character. Maps existing Record<locationId, MapPinState>.';
COMMENT ON COLUMN public.map_pin_states.player_discovered IS 'Character IDs who have discovered this location (maps to MapPinState.playerDiscovered).';

CREATE INDEX idx_map_pin_states_campaign ON public.map_pin_states(campaign_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: map_tokens
-- Character tokens placed on maps.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.map_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  map_id UUID NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  visible BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE public.map_tokens IS 'Character tokens on maps. Position stored as x/y coordinates.';

CREATE INDEX idx_map_tokens_map ON public.map_tokens(map_id);
CREATE UNIQUE INDEX idx_map_tokens_char_map ON public.map_tokens(character_id, map_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: user_map_pins
-- Personal pins/notes created by players on maps.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.user_map_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  map_id UUID NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  character_id UUID NULL REFERENCES public.characters(id) ON DELETE SET NULL, -- Character who created the pin
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  label TEXT NULL,
  color TEXT NULL
);

COMMENT ON TABLE public.user_map_pins IS 'Personal pins created by players. Only visible to the owner.';

CREATE INDEX idx_user_map_pins_map ON public.user_map_pins(map_id);
CREATE INDEX idx_user_map_pins_user ON public.user_map_pins(user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: shop_definitions
-- Shop configurations and generated inventories.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.shop_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location_id TEXT NULL, -- Reference to a map location ID
  category TEXT NOT NULL, -- 'weapon', 'armor', 'general', 'apothecary', 'tavern', 'specialty'
  base_stock TEXT[] NOT NULL DEFAULT '{}', -- Array of item IDs this shop can stock
  inventory JSONB NOT NULL DEFAULT '[]', -- ShopInventoryItem[] (generated inventory)
  last_restock_date TEXT NULL, -- ISO date string
  player_access TEXT[] NOT NULL DEFAULT '{}', -- Character IDs who can access this shop
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.shop_definitions IS 'Shop definitions with generated inventories. Combines ShopDefinition + ShopState from existing model.';
COMMENT ON COLUMN public.shop_definitions.base_stock IS 'Item IDs this shop can potentially stock (maps to ShopDefinition.baseStock).';
COMMENT ON COLUMN public.shop_definitions.inventory IS 'Generated ShopInventoryItem[] with modifications, qualities, quantities.';

CREATE INDEX idx_shop_definitions_campaign ON public.shop_definitions(campaign_id);

CREATE TRIGGER shop_definitions_updated_at
  BEFORE UPDATE ON public.shop_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: character_templates
-- NPC templates for generating characters with variance.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.character_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NULL, -- 'Human', 'Dwarf', 'Elf', 'Halfling', 'Creature', 'Undead', 'Chaos', 'Other'
  template_data JSONB NOT NULL -- Full CharacterTemplate definition with variance ranges
);

COMMENT ON TABLE public.character_templates IS 'NPC templates for generating characters with slight stat variations.';
COMMENT ON COLUMN public.character_templates.template_data IS 'Full CharacterTemplate: species, characteristics with variance, skills, talents, trappings, etc.';

CREATE INDEX idx_character_templates_campaign ON public.character_templates(campaign_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: location_territories
-- Faction control over map locations.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.location_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  location_id TEXT NOT NULL, -- References a location ID within a map's locations JSONB
  faction_id UUID NULL REFERENCES public.factions(id) ON DELETE SET NULL,
  control_level INTEGER NOT NULL DEFAULT 0, -- Alias for influenceWeight (1-5)
  UNIQUE (campaign_id, location_id)
);

COMMENT ON TABLE public.location_territories IS 'Faction territory control per location. Maps existing LocationTerritory data.';
COMMENT ON COLUMN public.location_territories.control_level IS 'Influence weight 1-5 (maps to LocationTerritory.influenceWeight).';

CREATE INDEX idx_location_territories_campaign ON public.location_territories(campaign_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: combat_state
-- Active combat tracker state (one per campaign).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.combat_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  current_turn_index INTEGER NOT NULL DEFAULT 0,
  round_number INTEGER NOT NULL DEFAULT 1,
  combatants JSONB NOT NULL DEFAULT '[]', -- Combatant[] with full combat data
  player_advantage INTEGER NOT NULL DEFAULT 0,
  enemy_advantage INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id)
);

COMMENT ON TABLE public.combat_state IS 'Active combat state. One row per campaign (UNIQUE constraint). Combatants stored as JSONB for atomic updates.';
COMMENT ON COLUMN public.combat_state.combatants IS 'Combatant[]: { id, sourceId, name, initiative, currentWounds, maxWounds, baseInitiative, baseAg, isPlayer, conditions, conditionInstances }';

CREATE TRIGGER combat_state_updated_at
  BEFORE UPDATE ON public.combat_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Table: chat_messages
-- In-game chat, dice rolls, and system messages.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  sender_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL, -- null = system message
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'dice_roll', 'system', 'whisper')),
  roll_data JSONB NULL, -- Dice roll results if applicable
  target_user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL, -- For whispers
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.chat_messages IS 'Campaign chat messages including dice rolls and system events.';

CREATE INDEX idx_chat_messages_campaign_time ON public.chat_messages(campaign_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Global shop state (campaign-level restock tracking)
-- Stored as a column on campaigns to avoid a separate single-row table.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.campaigns
  ADD COLUMN last_global_restock TEXT NULL; -- ISO date string of last "Restock Day" action

COMMENT ON COLUMN public.campaigns.last_global_restock IS 'ISO date of last global shop restock (maps to ShopInventoryState.lastGlobalRestock).';

-- ─────────────────────────────────────────────────────────────────────────────
-- Player colors (stored on campaign_members instead of separate structure)
-- The existing model uses Record<userId, colorHex> on CampaignState.
-- This is already covered by campaign_members.color column.
-- ─────────────────────────────────────────────────────────────────────────────

-- No additional table needed. campaign_members.color serves this purpose.

-- =============================================================================
-- End of migration
-- =============================================================================
