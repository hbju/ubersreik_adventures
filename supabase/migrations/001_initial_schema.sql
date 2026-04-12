-- ============================================================================
-- WFRP4e Campaign Manager — Initial Schema
-- Migration 001: Core tables for all campaign data
-- ============================================================================

-- ============================================================================
-- 1. CAMPAIGNS & MEMBERSHIP
-- ============================================================================

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    active_map_id TEXT,
    version TEXT NOT NULL DEFAULT '1.0.0',
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE campaign_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('gm', 'player')),
    character_id UUID, -- FK added after characters table exists
    color TEXT,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (campaign_id, user_id)
);

-- ============================================================================
-- 2. CHARACTERS (main table with flattened characteristics/status/details)
-- ============================================================================

CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    species TEXT,
    class TEXT,
    current_career_id TEXT,
    current_career_level_id TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    location_id TEXT,
    movement INT NOT NULL DEFAULT 4,
    is_minion BOOLEAN NOT NULL DEFAULT false,
    template_id TEXT,
    xp_current INT NOT NULL DEFAULT 0,
    xp_spent INT NOT NULL DEFAULT 0,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Characteristics: 10 stats × 4 fields = 40 columns
    ws_initial INT NOT NULL DEFAULT 0, ws_advances INT NOT NULL DEFAULT 0, ws_talents INT NOT NULL DEFAULT 0, ws_modifier INT NOT NULL DEFAULT 0,
    bs_initial INT NOT NULL DEFAULT 0, bs_advances INT NOT NULL DEFAULT 0, bs_talents INT NOT NULL DEFAULT 0, bs_modifier INT NOT NULL DEFAULT 0,
    s_initial INT NOT NULL DEFAULT 0, s_advances INT NOT NULL DEFAULT 0, s_talents INT NOT NULL DEFAULT 0, s_modifier INT NOT NULL DEFAULT 0,
    t_initial INT NOT NULL DEFAULT 0, t_advances INT NOT NULL DEFAULT 0, t_talents INT NOT NULL DEFAULT 0, t_modifier INT NOT NULL DEFAULT 0,
    i_initial INT NOT NULL DEFAULT 0, i_advances INT NOT NULL DEFAULT 0, i_talents INT NOT NULL DEFAULT 0, i_modifier INT NOT NULL DEFAULT 0,
    ag_initial INT NOT NULL DEFAULT 0, ag_advances INT NOT NULL DEFAULT 0, ag_talents INT NOT NULL DEFAULT 0, ag_modifier INT NOT NULL DEFAULT 0,
    dex_initial INT NOT NULL DEFAULT 0, dex_advances INT NOT NULL DEFAULT 0, dex_talents INT NOT NULL DEFAULT 0, dex_modifier INT NOT NULL DEFAULT 0,
    int_initial INT NOT NULL DEFAULT 0, int_advances INT NOT NULL DEFAULT 0, int_talents INT NOT NULL DEFAULT 0, int_modifier INT NOT NULL DEFAULT 0,
    wp_initial INT NOT NULL DEFAULT 0, wp_advances INT NOT NULL DEFAULT 0, wp_talents INT NOT NULL DEFAULT 0, wp_modifier INT NOT NULL DEFAULT 0,
    fel_initial INT NOT NULL DEFAULT 0, fel_advances INT NOT NULL DEFAULT 0, fel_talents INT NOT NULL DEFAULT 0, fel_modifier INT NOT NULL DEFAULT 0,

    -- Status: 6 pairs × 2 (current/max) = 12 columns
    wounds_current INT NOT NULL DEFAULT 0, wounds_max INT NOT NULL DEFAULT 0,
    fate_current INT NOT NULL DEFAULT 0, fate_max INT NOT NULL DEFAULT 0,
    fortune_current INT NOT NULL DEFAULT 0, fortune_max INT NOT NULL DEFAULT 0,
    resilience_current INT NOT NULL DEFAULT 0, resilience_max INT NOT NULL DEFAULT 0,
    resolve_current INT NOT NULL DEFAULT 0, resolve_max INT NOT NULL DEFAULT 0,
    corruption_current INT NOT NULL DEFAULT 0, corruption_max INT NOT NULL DEFAULT 0,

    -- Currency
    gc INT NOT NULL DEFAULT 0,
    ss INT NOT NULL DEFAULT 0,
    bp INT NOT NULL DEFAULT 0,

    -- Character details
    age TEXT,
    height TEXT,
    hair TEXT,
    eyes TEXT,
    party_name TEXT,
    short_term_ambition TEXT,
    long_term_ambition TEXT,
    party_short_term_ambition TEXT,
    party_long_term_ambition TEXT,

    -- Image (Supabase Storage path)
    image_path TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Now add the FK from campaign_members.character_id -> characters.id
ALTER TABLE campaign_members
    ADD CONSTRAINT fk_campaign_members_character
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL;

CREATE INDEX idx_characters_campaign ON characters(campaign_id);
CREATE INDEX idx_characters_user ON characters(user_id);

-- ============================================================================
-- 3. CHARACTER SUB-TABLES
-- ============================================================================

CREATE TABLE character_skills (
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL,
    advances INT NOT NULL DEFAULT 0,
    talents INT NOT NULL DEFAULT 0,
    modifier INT NOT NULL DEFAULT 0,
    PRIMARY KEY (character_id, skill_id)
);

CREATE TABLE character_talents (
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    talent_id TEXT NOT NULL,
    ranks INT NOT NULL DEFAULT 1,
    PRIMARY KEY (character_id, talent_id)
);

CREATE TABLE character_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    condition_id TEXT NOT NULL,
    stack_count INT NOT NULL DEFAULT 1
);
CREATE INDEX idx_char_conditions_char ON character_conditions(character_id);

CREATE TABLE character_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    item_type TEXT NOT NULL CHECK (item_type IN ('weapon', 'armor', 'item')),
    quantity INT NOT NULL DEFAULT 1,
    is_equipped BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_char_inventory_char ON character_inventory(character_id);

CREATE TABLE character_career_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    career_id TEXT NOT NULL,
    career_level_id TEXT NOT NULL,
    career_name TEXT NOT NULL,
    level_name TEXT NOT NULL,
    level INT NOT NULL,
    xp_spent INT NOT NULL DEFAULT 0,
    advancement_type TEXT NOT NULL,
    advancement_id TEXT NOT NULL,
    advancement_name TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_char_career_history_char ON character_career_history(character_id);

CREATE TABLE character_unlocks (
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    unlock_type TEXT NOT NULL CHECK (unlock_type IN ('characteristic', 'skill', 'talent')),
    unlock_id TEXT NOT NULL,
    PRIMARY KEY (character_id, unlock_type, unlock_id)
);

CREATE TABLE character_reputations (
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    faction_id TEXT NOT NULL,
    value INT NOT NULL DEFAULT 0,
    knowledge_level TEXT NOT NULL DEFAULT 'unknown',
    notes TEXT,
    PRIMARY KEY (character_id, faction_id)
);

CREATE TABLE character_lore (
    character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
    gm_notes TEXT,
    player_notes TEXT,
    appearance TEXT,
    voice TEXT,
    mannerisms TEXT,
    biography TEXT,
    ambition_short TEXT,
    ambition_long TEXT,
    motivation_key TEXT
);

CREATE TABLE character_knowledge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    content TEXT NOT NULL,
    visibility JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_char_knowledge_char ON character_knowledge_entries(character_id);

CREATE TABLE character_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    target_character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    description TEXT
);
CREATE INDEX idx_char_relationships_char ON character_relationships(character_id);

CREATE TABLE character_action_bar (
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    slot_index INT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('skill', 'weapon', 'characteristic')),
    action_id TEXT NOT NULL,
    label TEXT NOT NULL,
    PRIMARY KEY (character_id, slot_index)
);

-- ============================================================================
-- 4. JOURNAL
-- ============================================================================

CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    image_data TEXT, -- base64 or Supabase Storage path
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_journal_campaign ON journal_entries(campaign_id);

CREATE TABLE journal_shared_with (
    journal_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    target TEXT NOT NULL, -- character_id (UUID as text) or 'all'
    PRIMARY KEY (journal_id, target)
);

-- ============================================================================
-- 5. QUESTS
-- ============================================================================

CREATE TABLE quests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_quests_campaign ON quests(campaign_id);
CREATE INDEX idx_quests_character ON quests(character_id);

CREATE TABLE quest_objectives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    location_id TEXT
);
CREATE INDEX idx_quest_objectives_quest ON quest_objectives(quest_id);

-- ============================================================================
-- 6. FACTIONS & TERRITORIES
-- ============================================================================

CREATE TABLE factions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    faction_key TEXT NOT NULL, -- original id from game data JSON
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    icon TEXT,
    hq TEXT,
    head TEXT,
    default_reputation INT NOT NULL DEFAULT 0,
    color TEXT
);
CREATE INDEX idx_factions_campaign ON factions(campaign_id);
CREATE UNIQUE INDEX idx_factions_campaign_key ON factions(campaign_id, faction_key);

CREATE TABLE location_territories (
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    location_id TEXT NOT NULL,
    controlling_faction_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
    influence_weight INT NOT NULL DEFAULT 1,
    PRIMARY KEY (campaign_id, location_id)
);

-- ============================================================================
-- 7. MAPS, TOKENS & PINS
-- ============================================================================

CREATE TABLE campaign_maps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    map_key TEXT NOT NULL, -- original id from game data JSON
    name TEXT NOT NULL,
    image_path TEXT,
    grid_size INT NOT NULL DEFAULT 100,
    spawn_point_x REAL,
    spawn_point_y REAL
);
CREATE INDEX idx_campaign_maps_campaign ON campaign_maps(campaign_id);
CREATE UNIQUE INDEX idx_campaign_maps_campaign_key ON campaign_maps(campaign_id, map_key);

CREATE TABLE campaign_map_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    map_id UUID NOT NULL REFERENCES campaign_maps(id) ON DELETE CASCADE,
    location_key TEXT NOT NULL, -- original id from game data JSON
    name TEXT NOT NULL,
    coords_x REAL NOT NULL,
    coords_y REAL NOT NULL,
    player_description TEXT,
    gm_notes TEXT,
    image TEXT,
    music TEXT,
    hooks JSONB NOT NULL DEFAULT '[]'::jsonb,
    tag TEXT,
    controlling_faction_id UUID REFERENCES factions(id) ON DELETE SET NULL,
    influence_weight INT
);
CREATE INDEX idx_map_locations_map ON campaign_map_locations(map_id);

CREATE TABLE map_pin_discoveries (
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    location_key TEXT NOT NULL,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    PRIMARY KEY (campaign_id, location_key, character_id)
);

CREATE TABLE map_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    character_name TEXT,
    map_id TEXT NOT NULL,
    x REAL NOT NULL DEFAULT 0,
    y REAL NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_map_tokens_campaign ON map_tokens(campaign_id);

CREATE TABLE user_map_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    map_id TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    label TEXT NOT NULL,
    color TEXT
);
CREATE INDEX idx_user_map_pins_campaign ON user_map_pins(campaign_id);
CREATE INDEX idx_user_map_pins_user ON user_map_pins(user_id);

-- ============================================================================
-- 8. SHOPS
-- ============================================================================

CREATE TABLE shop_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    shop_key TEXT NOT NULL,
    name TEXT NOT NULL,
    location_id TEXT,
    category TEXT NOT NULL,
    is_custom BOOLEAN NOT NULL DEFAULT false,
    base_stock JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX idx_shop_definitions_campaign ON shop_definitions(campaign_id);

CREATE TABLE shop_inventory_items (
    instance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shop_definitions(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    base_item_id TEXT NOT NULL,
    base_item_type TEXT NOT NULL CHECK (base_item_type IN ('weapon', 'armor', 'item')),
    name_override TEXT,
    modification TEXT NOT NULL DEFAULT 'standard',
    qualities JSONB NOT NULL DEFAULT '[]'::jsonb,
    flaws JSONB NOT NULL DEFAULT '[]'::jsonb,
    base_price INT NOT NULL,
    display_price TEXT,
    quantity INT NOT NULL DEFAULT 1,
    is_identified BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_shop_inventory_shop ON shop_inventory_items(shop_id);
CREATE INDEX idx_shop_inventory_campaign ON shop_inventory_items(campaign_id);

-- ============================================================================
-- 9. CALENDAR
-- ============================================================================

CREATE TABLE calendar_state (
    campaign_id UUID PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
    current_year INT NOT NULL DEFAULT 2512,
    current_month_index INT NOT NULL DEFAULT 0,
    current_day INT NOT NULL DEFAULT 1,
    current_weather TEXT
);

CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    date_year INT NOT NULL,
    date_month_index INT NOT NULL,
    date_day INT NOT NULL,
    is_visible_to_players BOOLEAN NOT NULL DEFAULT false,
    category TEXT
);
CREATE INDEX idx_calendar_events_campaign ON calendar_events(campaign_id);

-- ============================================================================
-- 10. CHAT MESSAGES
-- ============================================================================

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_name TEXT NOT NULL,
    sender_color TEXT,
    type TEXT NOT NULL DEFAULT 'chat',
    content TEXT NOT NULL,
    is_private BOOLEAN NOT NULL DEFAULT false,
    data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_messages_campaign ON chat_messages(campaign_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(campaign_id, created_at DESC);

-- ============================================================================
-- 11. GAME LOG
-- ============================================================================

CREATE TABLE game_log_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    actor_name TEXT,
    content TEXT NOT NULL,
    data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_game_log_campaign ON game_log_entries(campaign_id);
CREATE INDEX idx_game_log_created ON game_log_entries(campaign_id, created_at DESC);

-- ============================================================================
-- 12. COMBAT STATE
-- ============================================================================

CREATE TABLE combat_state (
    campaign_id UUID PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT false,
    current_turn_id TEXT,
    player_advantage INT NOT NULL DEFAULT 0,
    enemy_advantage INT NOT NULL DEFAULT 0
);

CREATE TABLE combatants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL,
    name TEXT NOT NULL,
    initiative INT,
    current_wounds INT NOT NULL,
    max_wounds INT NOT NULL,
    base_initiative INT NOT NULL,
    base_ag INT NOT NULL,
    is_player BOOLEAN NOT NULL DEFAULT false,
    conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    condition_instances JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX idx_combatants_campaign ON combatants(campaign_id);

-- ============================================================================
-- 13. PLAYER PREFERENCES
-- ============================================================================

CREATE TABLE player_preferences (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (user_id, campaign_id, key)
);

-- ============================================================================
-- 14. AUDIO LIBRARY
-- ============================================================================

CREATE TABLE audio_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    path TEXT NOT NULL,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    duration REAL,
    is_missing BOOLEAN NOT NULL DEFAULT false,
    display_name TEXT,
    last_modified TIMESTAMPTZ
);
CREATE INDEX idx_audio_tracks_campaign ON audio_tracks(campaign_id);

CREATE TABLE audio_playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audio_playlists_campaign ON audio_playlists(campaign_id);

CREATE TABLE playlist_tracks (
    playlist_id UUID NOT NULL REFERENCES audio_playlists(id) ON DELETE CASCADE,
    track_id UUID NOT NULL REFERENCES audio_tracks(id) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 0,
    PRIMARY KEY (playlist_id, track_id)
);

-- ============================================================================
-- 15. CHARACTER TEMPLATES
-- ============================================================================

CREATE TABLE character_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    species TEXT,
    career_id TEXT,
    career_level_id TEXT,
    movement INT NOT NULL DEFAULT 4,
    is_minion BOOLEAN NOT NULL DEFAULT false,
    name_list JSONB NOT NULL DEFAULT '[]'::jsonb,
    characteristics JSONB NOT NULL DEFAULT '{}'::jsonb,
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    talents JSONB NOT NULL DEFAULT '[]'::jsonb,
    trappings JSONB NOT NULL DEFAULT '{}'::jsonb,
    base_wounds INT,
    wounds_variance INT,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX idx_char_templates_campaign ON character_templates(campaign_id);

-- ============================================================================
-- 16. UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON characters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON quests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON character_knowledge_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON audio_playlists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 17. STORAGE BUCKET FOR CHARACTER IMAGES
-- ============================================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('character-images', 'character-images', true);
