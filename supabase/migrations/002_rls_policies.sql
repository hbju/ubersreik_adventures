-- ============================================================================
-- WFRP4e Campaign Manager — Row Level Security Policies
-- Migration 002: RLS for all tables
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_talents ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_career_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_reputations ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_lore ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_action_bar ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_shared_with ENABLE ROW LEVEL SECURITY;
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE factions ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_map_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_pin_discoveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_map_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE combat_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE combatants ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Check if user is a member of a campaign
CREATE OR REPLACE FUNCTION is_campaign_member(p_campaign_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM campaign_members
        WHERE campaign_id = p_campaign_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is GM of a campaign
CREATE OR REPLACE FUNCTION is_campaign_gm(p_campaign_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM campaign_members
        WHERE campaign_id = p_campaign_id AND user_id = auth.uid() AND role = 'gm'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Get the character_id assigned to current user in a campaign
CREATE OR REPLACE FUNCTION my_character_id(p_campaign_id UUID)
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT character_id FROM campaign_members
        WHERE campaign_id = p_campaign_id AND user_id = auth.uid()
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- CAMPAIGNS
-- ============================================================================

-- Members can read their campaigns
CREATE POLICY "campaigns_select" ON campaigns FOR SELECT
    USING (is_campaign_member(id) OR owner_id = auth.uid());

-- Only the owner (GM) can insert
CREATE POLICY "campaigns_insert" ON campaigns FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- Only the owner (GM) can update
CREATE POLICY "campaigns_update" ON campaigns FOR UPDATE
    USING (owner_id = auth.uid());

-- Only the owner (GM) can delete
CREATE POLICY "campaigns_delete" ON campaigns FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================================================
-- CAMPAIGN MEMBERS
-- ============================================================================

-- Members can see who is in their campaign
CREATE POLICY "campaign_members_select" ON campaign_members FOR SELECT
    USING (is_campaign_member(campaign_id));

-- GM can manage membership
CREATE POLICY "campaign_members_insert" ON campaign_members FOR INSERT
    WITH CHECK (
        is_campaign_gm(campaign_id)
        OR (
            -- Allow campaign owner to add themselves as the first member
            user_id = auth.uid()
            AND EXISTS (
                SELECT 1 FROM campaigns
                WHERE id = campaign_id AND owner_id = auth.uid()
            )
        )
    );

CREATE POLICY "campaign_members_update" ON campaign_members FOR UPDATE
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "campaign_members_delete" ON campaign_members FOR DELETE
    USING (is_campaign_gm(campaign_id));

-- ============================================================================
-- CHARACTERS
-- ============================================================================

-- GM can see all characters in their campaign; players see their own
CREATE POLICY "characters_select" ON characters FOR SELECT
    USING (
        is_campaign_gm(campaign_id)
        OR user_id = auth.uid()
        OR is_campaign_member(campaign_id) -- players can see other characters for combat/social
    );

-- GM can insert characters
CREATE POLICY "characters_insert" ON characters FOR INSERT
    WITH CHECK (is_campaign_gm(campaign_id));

-- GM can update any character; player can update only their own
CREATE POLICY "characters_update" ON characters FOR UPDATE
    USING (
        is_campaign_gm(campaign_id)
        OR user_id = auth.uid()
    );

-- Only GM can delete characters
CREATE POLICY "characters_delete" ON characters FOR DELETE
    USING (is_campaign_gm(campaign_id));

-- ============================================================================
-- CHARACTER SUB-TABLES (skills, talents, conditions, inventory, etc.)
-- Pattern: GM full access, player access to own character only
-- ============================================================================

-- character_skills
CREATE POLICY "char_skills_select" ON character_skills FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid() OR is_campaign_member(c.campaign_id))
    ));
CREATE POLICY "char_skills_insert" ON character_skills FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));
CREATE POLICY "char_skills_update" ON character_skills FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));
CREATE POLICY "char_skills_delete" ON character_skills FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));

-- character_talents
CREATE POLICY "char_talents_select" ON character_talents FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid() OR is_campaign_member(c.campaign_id))
    ));
CREATE POLICY "char_talents_insert" ON character_talents FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));
CREATE POLICY "char_talents_update" ON character_talents FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));
CREATE POLICY "char_talents_delete" ON character_talents FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));

-- character_conditions
CREATE POLICY "char_conditions_select" ON character_conditions FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid() OR is_campaign_member(c.campaign_id))
    ));
CREATE POLICY "char_conditions_insert" ON character_conditions FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));
CREATE POLICY "char_conditions_update" ON character_conditions FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));
CREATE POLICY "char_conditions_delete" ON character_conditions FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));

-- character_inventory
CREATE POLICY "char_inventory_select" ON character_inventory FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid() OR is_campaign_member(c.campaign_id))
    ));
CREATE POLICY "char_inventory_insert" ON character_inventory FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));
CREATE POLICY "char_inventory_update" ON character_inventory FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));
CREATE POLICY "char_inventory_delete" ON character_inventory FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));

-- character_career_history
CREATE POLICY "char_career_history_select" ON character_career_history FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid() OR is_campaign_member(c.campaign_id))
    ));
CREATE POLICY "char_career_history_insert" ON character_career_history FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));
CREATE POLICY "char_career_history_delete" ON character_career_history FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND is_campaign_gm(c.campaign_id)
    ));

-- character_unlocks
CREATE POLICY "char_unlocks_select" ON character_unlocks FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));
CREATE POLICY "char_unlocks_insert" ON character_unlocks FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));
CREATE POLICY "char_unlocks_delete" ON character_unlocks FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));

-- character_reputations
CREATE POLICY "char_reputations_select" ON character_reputations FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid() OR is_campaign_member(c.campaign_id))
    ));
CREATE POLICY "char_reputations_insert" ON character_reputations FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND is_campaign_gm(c.campaign_id)
    ));
CREATE POLICY "char_reputations_update" ON character_reputations FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND is_campaign_gm(c.campaign_id)
    ));
CREATE POLICY "char_reputations_delete" ON character_reputations FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND is_campaign_gm(c.campaign_id)
    ));

-- character_lore
CREATE POLICY "char_lore_select" ON character_lore FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));
CREATE POLICY "char_lore_insert" ON character_lore FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));
CREATE POLICY "char_lore_update" ON character_lore FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));

-- character_knowledge_entries
CREATE POLICY "char_knowledge_select" ON character_knowledge_entries FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (
            is_campaign_gm(c.campaign_id)
            OR c.user_id = auth.uid()
        )
    ));
CREATE POLICY "char_knowledge_insert" ON character_knowledge_entries FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND is_campaign_gm(c.campaign_id)
    ));
CREATE POLICY "char_knowledge_update" ON character_knowledge_entries FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND is_campaign_gm(c.campaign_id)
    ));
CREATE POLICY "char_knowledge_delete" ON character_knowledge_entries FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND is_campaign_gm(c.campaign_id)
    ));

-- character_relationships
CREATE POLICY "char_relationships_select" ON character_relationships FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid() OR is_campaign_member(c.campaign_id))
    ));
CREATE POLICY "char_relationships_insert" ON character_relationships FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND is_campaign_gm(c.campaign_id)
    ));
CREATE POLICY "char_relationships_update" ON character_relationships FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND is_campaign_gm(c.campaign_id)
    ));
CREATE POLICY "char_relationships_delete" ON character_relationships FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND is_campaign_gm(c.campaign_id)
    ));

-- character_action_bar
CREATE POLICY "char_action_bar_select" ON character_action_bar FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));
CREATE POLICY "char_action_bar_insert" ON character_action_bar FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));
CREATE POLICY "char_action_bar_update" ON character_action_bar FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));
CREATE POLICY "char_action_bar_delete" ON character_action_bar FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM characters c WHERE c.id = character_id
        AND (is_campaign_gm(c.campaign_id) OR c.user_id = auth.uid())
    ));

-- ============================================================================
-- JOURNAL
-- ============================================================================

-- GM can see all; players can see entries shared with their character or 'all'
CREATE POLICY "journal_entries_select" ON journal_entries FOR SELECT
    USING (
        is_campaign_gm(campaign_id)
        OR is_journal_shared_with(id, my_character_id(campaign_id)::text)
    );

CREATE POLICY "journal_entries_insert" ON journal_entries FOR INSERT
    WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY "journal_entries_update" ON journal_entries FOR UPDATE
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "journal_entries_delete" ON journal_entries FOR DELETE
    USING (is_campaign_gm(campaign_id));

-- journal_shared_with
CREATE POLICY "journal_shared_with_select" ON journal_shared_with FOR SELECT
    USING (is_campaign_member(journal_entry_campaign_id(journal_id)));

CREATE POLICY "journal_shared_with_insert" ON journal_shared_with FOR INSERT
    WITH CHECK (is_campaign_gm(journal_entry_campaign_id(journal_id)));

CREATE POLICY "journal_shared_with_delete" ON journal_shared_with FOR DELETE
    USING (is_campaign_gm(journal_entry_campaign_id(journal_id)));

-- ============================================================================
-- QUESTS
-- ============================================================================

CREATE POLICY "quests_select" ON quests FOR SELECT
    USING (is_campaign_member(campaign_id));

CREATE POLICY "quests_insert" ON quests FOR INSERT
    WITH CHECK (
        is_campaign_gm(campaign_id)
        OR character_id = my_character_id(campaign_id)
    );

CREATE POLICY "quests_update" ON quests FOR UPDATE
    USING (
        is_campaign_gm(campaign_id)
        OR character_id = my_character_id(campaign_id)
    );

CREATE POLICY "quests_delete" ON quests FOR DELETE
    USING (is_campaign_gm(campaign_id));

-- quest_objectives
CREATE POLICY "quest_objectives_select" ON quest_objectives FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM quests q WHERE q.id = quest_id AND is_campaign_member(q.campaign_id)
    ));
CREATE POLICY "quest_objectives_insert" ON quest_objectives FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM quests q WHERE q.id = quest_id
        AND (is_campaign_gm(q.campaign_id) OR q.character_id = my_character_id(q.campaign_id))
    ));
CREATE POLICY "quest_objectives_update" ON quest_objectives FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM quests q WHERE q.id = quest_id
        AND (is_campaign_gm(q.campaign_id) OR q.character_id = my_character_id(q.campaign_id))
    ));
CREATE POLICY "quest_objectives_delete" ON quest_objectives FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM quests q WHERE q.id = quest_id AND is_campaign_gm(q.campaign_id)
    ));

-- ============================================================================
-- FACTIONS & TERRITORIES
-- ============================================================================

CREATE POLICY "factions_select" ON factions FOR SELECT
    USING (is_campaign_member(campaign_id));

CREATE POLICY "factions_insert" ON factions FOR INSERT
    WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY "factions_update" ON factions FOR UPDATE
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "factions_delete" ON factions FOR DELETE
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "location_territories_select" ON location_territories FOR SELECT
    USING (is_campaign_member(campaign_id));

CREATE POLICY "location_territories_insert" ON location_territories FOR INSERT
    WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY "location_territories_update" ON location_territories FOR UPDATE
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "location_territories_delete" ON location_territories FOR DELETE
    USING (is_campaign_gm(campaign_id));

-- ============================================================================
-- MAPS, TOKENS & PINS
-- ============================================================================

CREATE POLICY "campaign_maps_select" ON campaign_maps FOR SELECT
    USING (is_campaign_member(campaign_id));

CREATE POLICY "campaign_maps_insert" ON campaign_maps FOR INSERT
    WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY "campaign_maps_update" ON campaign_maps FOR UPDATE
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "campaign_maps_delete" ON campaign_maps FOR DELETE
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "campaign_map_locations_select" ON campaign_map_locations FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM campaign_maps cm WHERE cm.id = map_id AND is_campaign_member(cm.campaign_id)
    ));

CREATE POLICY "campaign_map_locations_insert" ON campaign_map_locations FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM campaign_maps cm WHERE cm.id = map_id AND is_campaign_gm(cm.campaign_id)
    ));

CREATE POLICY "campaign_map_locations_update" ON campaign_map_locations FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM campaign_maps cm WHERE cm.id = map_id AND is_campaign_gm(cm.campaign_id)
    ));

CREATE POLICY "campaign_map_locations_delete" ON campaign_map_locations FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM campaign_maps cm WHERE cm.id = map_id AND is_campaign_gm(cm.campaign_id)
    ));

-- map_pin_discoveries: members can see their campaign's discoveries
CREATE POLICY "map_pin_discoveries_select" ON map_pin_discoveries FOR SELECT
    USING (is_campaign_member(campaign_id));

CREATE POLICY "map_pin_discoveries_insert" ON map_pin_discoveries FOR INSERT
    WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY "map_pin_discoveries_delete" ON map_pin_discoveries FOR DELETE
    USING (is_campaign_gm(campaign_id));

-- map_tokens: members can see all tokens; can update only own
CREATE POLICY "map_tokens_select" ON map_tokens FOR SELECT
    USING (is_campaign_member(campaign_id));

CREATE POLICY "map_tokens_insert" ON map_tokens FOR INSERT
    WITH CHECK (
        is_campaign_gm(campaign_id)
        OR character_id = my_character_id(campaign_id)
    );

CREATE POLICY "map_tokens_update" ON map_tokens FOR UPDATE
    USING (
        is_campaign_gm(campaign_id)
        OR character_id = my_character_id(campaign_id)
    );

CREATE POLICY "map_tokens_delete" ON map_tokens FOR DELETE
    USING (is_campaign_gm(campaign_id));

-- user_map_pins: players manage their own pins
CREATE POLICY "user_map_pins_select" ON user_map_pins FOR SELECT
    USING (
        is_campaign_gm(campaign_id)
        OR user_id = auth.uid()
    );

CREATE POLICY "user_map_pins_insert" ON user_map_pins FOR INSERT
    WITH CHECK (user_id = auth.uid() AND is_campaign_member(campaign_id));

CREATE POLICY "user_map_pins_update" ON user_map_pins FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "user_map_pins_delete" ON user_map_pins FOR DELETE
    USING (user_id = auth.uid());

-- ============================================================================
-- SHOPS
-- ============================================================================

CREATE POLICY "shop_definitions_select" ON shop_definitions FOR SELECT
    USING (is_campaign_member(campaign_id));

CREATE POLICY "shop_definitions_insert" ON shop_definitions FOR INSERT
    WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY "shop_definitions_update" ON shop_definitions FOR UPDATE
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "shop_definitions_delete" ON shop_definitions FOR DELETE
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "shop_inventory_select" ON shop_inventory_items FOR SELECT
    USING (is_campaign_member(campaign_id));

CREATE POLICY "shop_inventory_insert" ON shop_inventory_items FOR INSERT
    WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY "shop_inventory_update" ON shop_inventory_items FOR UPDATE
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "shop_inventory_delete" ON shop_inventory_items FOR DELETE
    USING (is_campaign_gm(campaign_id));

-- ============================================================================
-- CALENDAR
-- ============================================================================

CREATE POLICY "calendar_state_select" ON calendar_state FOR SELECT
    USING (is_campaign_member(campaign_id));

CREATE POLICY "calendar_state_insert" ON calendar_state FOR INSERT
    WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY "calendar_state_update" ON calendar_state FOR UPDATE
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "calendar_events_select" ON calendar_events FOR SELECT
    USING (
        is_campaign_gm(campaign_id)
        OR (is_campaign_member(campaign_id) AND is_visible_to_players = true)
    );

CREATE POLICY "calendar_events_insert" ON calendar_events FOR INSERT
    WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY "calendar_events_update" ON calendar_events FOR UPDATE
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "calendar_events_delete" ON calendar_events FOR DELETE
    USING (is_campaign_gm(campaign_id));

-- ============================================================================
-- CHAT MESSAGES
-- ============================================================================

CREATE POLICY "chat_messages_select" ON chat_messages FOR SELECT
    USING (
        is_campaign_member(campaign_id)
        AND (is_private = false OR sender_id = auth.uid() OR is_campaign_gm(campaign_id))
    );

CREATE POLICY "chat_messages_insert" ON chat_messages FOR INSERT
    WITH CHECK (
        is_campaign_member(campaign_id)
        AND sender_id = auth.uid()
    );

-- Chat messages are immutable (no update/delete for players)
CREATE POLICY "chat_messages_delete" ON chat_messages FOR DELETE
    USING (is_campaign_gm(campaign_id));

-- ============================================================================
-- GAME LOG
-- ============================================================================

CREATE POLICY "game_log_select" ON game_log_entries FOR SELECT
    USING (is_campaign_member(campaign_id));

CREATE POLICY "game_log_insert" ON game_log_entries FOR INSERT
    WITH CHECK (is_campaign_member(campaign_id));

-- ============================================================================
-- COMBAT STATE
-- ============================================================================

CREATE POLICY "combat_state_select" ON combat_state FOR SELECT
    USING (is_campaign_member(campaign_id));

CREATE POLICY "combat_state_insert" ON combat_state FOR INSERT
    WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY "combat_state_update" ON combat_state FOR UPDATE
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "combatants_select" ON combatants FOR SELECT
    USING (is_campaign_member(campaign_id));

CREATE POLICY "combatants_insert" ON combatants FOR INSERT
    WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY "combatants_update" ON combatants FOR UPDATE
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "combatants_delete" ON combatants FOR DELETE
    USING (is_campaign_gm(campaign_id));

-- ============================================================================
-- PLAYER PREFERENCES
-- ============================================================================

CREATE POLICY "player_prefs_select" ON player_preferences FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "player_prefs_insert" ON player_preferences FOR INSERT
    WITH CHECK (user_id = auth.uid() AND is_campaign_member(campaign_id));

CREATE POLICY "player_prefs_update" ON player_preferences FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "player_prefs_delete" ON player_preferences FOR DELETE
    USING (user_id = auth.uid());

-- ============================================================================
-- AUDIO
-- ============================================================================

CREATE POLICY "audio_tracks_select" ON audio_tracks FOR SELECT
    USING (is_campaign_member(campaign_id));

CREATE POLICY "audio_tracks_insert" ON audio_tracks FOR INSERT
    WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY "audio_tracks_update" ON audio_tracks FOR UPDATE
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "audio_tracks_delete" ON audio_tracks FOR DELETE
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "audio_playlists_select" ON audio_playlists FOR SELECT
    USING (is_campaign_member(campaign_id));

CREATE POLICY "audio_playlists_insert" ON audio_playlists FOR INSERT
    WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY "audio_playlists_update" ON audio_playlists FOR UPDATE
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "audio_playlists_delete" ON audio_playlists FOR DELETE
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "playlist_tracks_select" ON playlist_tracks FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM audio_playlists ap WHERE ap.id = playlist_id AND is_campaign_member(ap.campaign_id)
    ));

CREATE POLICY "playlist_tracks_insert" ON playlist_tracks FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM audio_playlists ap WHERE ap.id = playlist_id AND is_campaign_gm(ap.campaign_id)
    ));

CREATE POLICY "playlist_tracks_delete" ON playlist_tracks FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM audio_playlists ap WHERE ap.id = playlist_id AND is_campaign_gm(ap.campaign_id)
    ));

-- ============================================================================
-- CHARACTER TEMPLATES
-- ============================================================================

CREATE POLICY "char_templates_select" ON character_templates FOR SELECT
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "char_templates_insert" ON character_templates FOR INSERT
    WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY "char_templates_update" ON character_templates FOR UPDATE
    USING (is_campaign_gm(campaign_id));

CREATE POLICY "char_templates_delete" ON character_templates FOR DELETE
    USING (is_campaign_gm(campaign_id));

-- ============================================================================
-- STORAGE POLICIES (character-images bucket)
-- ============================================================================

CREATE POLICY "character_images_select" ON storage.objects FOR SELECT
    USING (bucket_id = 'character-images');

CREATE POLICY "character_images_insert" ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'character-images' AND auth.role() = 'authenticated');

CREATE POLICY "character_images_update" ON storage.objects FOR UPDATE
    USING (bucket_id = 'character-images' AND auth.role() = 'authenticated');

CREATE POLICY "character_images_delete" ON storage.objects FOR DELETE
    USING (bucket_id = 'character-images' AND auth.role() = 'authenticated');
