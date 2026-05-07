-- =============================================================================
-- PBI 1.2: Row Level Security (RLS) Policies
-- Supabase Migration
-- =============================================================================
-- Enables RLS on all public tables and creates policies enforcing:
-- - GMs can CRUD everything in their campaigns
-- - Players can read campaign data they are members of
-- - Players can only update their own character(s)
-- - Players can insert chat messages and quests
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper Functions
-- ─────────────────────────────────────────────────────────────────────────────

-- Check if the current user is a member of a campaign
CREATE OR REPLACE FUNCTION public.is_campaign_member(campaign_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaign_members
    WHERE campaign_id = campaign_uuid AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if the current user is the GM of a campaign
CREATE OR REPLACE FUNCTION public.is_campaign_gm(campaign_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaign_members
    WHERE campaign_id = campaign_uuid AND user_id = auth.uid() AND role = 'gm'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if the current user owns a specific character
CREATE OR REPLACE FUNCTION public.owns_character(character_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.characters
    WHERE id = character_uuid AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if the current user owns any character whose ID is in a text array
-- (used for journal_entries.shared_with which stores character IDs)
CREATE OR REPLACE FUNCTION public.user_has_character_in(character_ids TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.characters
    WHERE user_id = auth.uid() AND id::text = ANY(character_ids)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Enable RLS on all tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_pin_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_map_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combat_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- Profiles Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Anyone authenticated can read profiles (needed for display names in UI)
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Users can only update their own profile
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Campaigns Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Members can read campaigns they belong to
CREATE POLICY campaigns_select ON public.campaigns
  FOR SELECT TO authenticated
  USING (is_campaign_member(id));

-- Any authenticated user can create a campaign
CREATE POLICY campaigns_insert ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (gm_user_id = auth.uid());

-- Only the GM can update their campaign
CREATE POLICY campaigns_update ON public.campaigns
  FOR UPDATE TO authenticated
  USING (gm_user_id = auth.uid())
  WITH CHECK (gm_user_id = auth.uid());

-- Only the GM can delete their campaign
CREATE POLICY campaigns_delete ON public.campaigns
  FOR DELETE TO authenticated
  USING (gm_user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- Campaign Members Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Members can see fellow members in their campaigns
CREATE POLICY campaign_members_select ON public.campaign_members
  FOR SELECT TO authenticated
  USING (is_campaign_member(campaign_id));

-- Only the campaign GM can add members
CREATE POLICY campaign_members_insert ON public.campaign_members
  FOR INSERT TO authenticated
  WITH CHECK (is_campaign_gm(campaign_id));

-- Only the campaign GM can update member records (e.g., color assignment)
CREATE POLICY campaign_members_update ON public.campaign_members
  FOR UPDATE TO authenticated
  USING (is_campaign_gm(campaign_id))
  WITH CHECK (is_campaign_gm(campaign_id));

-- Only the campaign GM can remove members
CREATE POLICY campaign_members_delete ON public.campaign_members
  FOR DELETE TO authenticated
  USING (is_campaign_gm(campaign_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Characters Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Campaign members can read all characters in their campaigns
CREATE POLICY characters_select ON public.characters
  FOR SELECT TO authenticated
  USING (is_campaign_member(campaign_id));

-- Only the GM can create characters
CREATE POLICY characters_insert ON public.characters
  FOR INSERT TO authenticated
  WITH CHECK (is_campaign_gm(campaign_id));

-- GM can update any character; players can update only their own
CREATE POLICY characters_update ON public.characters
  FOR UPDATE TO authenticated
  USING (
    is_campaign_gm(campaign_id)
    OR (is_campaign_member(campaign_id) AND user_id = auth.uid())
  )
  WITH CHECK (
    is_campaign_gm(campaign_id)
    OR (is_campaign_member(campaign_id) AND user_id = auth.uid())
  );

-- Only the GM can delete characters
CREATE POLICY characters_delete ON public.characters
  FOR DELETE TO authenticated
  USING (is_campaign_gm(campaign_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Journal Entries Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- GM can see all entries; players can see public entries or entries shared with their characters
CREATE POLICY journal_entries_select ON public.journal_entries
  FOR SELECT TO authenticated
  USING (
    is_campaign_gm(campaign_id)
    OR (
      is_campaign_member(campaign_id)
      AND (
        is_public = true
        OR 'all' = ANY(shared_with)
        OR user_has_character_in(shared_with)
      )
    )
  );

-- Only the GM can create journal entries
CREATE POLICY journal_entries_insert ON public.journal_entries
  FOR INSERT TO authenticated
  WITH CHECK (is_campaign_gm(campaign_id));

-- Only the GM can update journal entries
CREATE POLICY journal_entries_update ON public.journal_entries
  FOR UPDATE TO authenticated
  USING (is_campaign_gm(campaign_id))
  WITH CHECK (is_campaign_gm(campaign_id));

-- Only the GM can delete journal entries
CREATE POLICY journal_entries_delete ON public.journal_entries
  FOR DELETE TO authenticated
  USING (is_campaign_gm(campaign_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Quests Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- All campaign members can see quests
CREATE POLICY quests_select ON public.quests
  FOR SELECT TO authenticated
  USING (is_campaign_member(campaign_id));

-- All campaign members can create quests
CREATE POLICY quests_insert ON public.quests
  FOR INSERT TO authenticated
  WITH CHECK (is_campaign_member(campaign_id));

-- All campaign members can update quests (e.g., check off objectives)
CREATE POLICY quests_update ON public.quests
  FOR UPDATE TO authenticated
  USING (is_campaign_member(campaign_id))
  WITH CHECK (is_campaign_member(campaign_id));

-- GM can delete any quest; players can delete quests created by their characters
CREATE POLICY quests_delete ON public.quests
  FOR DELETE TO authenticated
  USING (
    is_campaign_gm(campaign_id)
    OR (is_campaign_member(campaign_id) AND owns_character(character_id))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Chat Messages Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Campaign members can read messages:
-- Non-whispers visible to all members; whispers only to sender or target
CREATE POLICY chat_messages_select ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    is_campaign_member(campaign_id)
    AND (
      message_type != 'whisper'
      OR sender_id = auth.uid()
      OR target_user_id = auth.uid()
    )
  );

-- Campaign members can send messages (sender must be self)
CREATE POLICY chat_messages_insert ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    is_campaign_member(campaign_id)
    AND (sender_id = auth.uid() OR sender_id IS NULL)
  );

-- Messages are immutable (no update policy)
-- Only GM can delete messages (moderation)
CREATE POLICY chat_messages_delete ON public.chat_messages
  FOR DELETE TO authenticated
  USING (is_campaign_gm(campaign_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Factions Policies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY factions_select ON public.factions
  FOR SELECT TO authenticated
  USING (is_campaign_member(campaign_id));

CREATE POLICY factions_insert ON public.factions
  FOR INSERT TO authenticated
  WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY factions_update ON public.factions
  FOR UPDATE TO authenticated
  USING (is_campaign_gm(campaign_id))
  WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY factions_delete ON public.factions
  FOR DELETE TO authenticated
  USING (is_campaign_gm(campaign_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Maps Policies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY maps_select ON public.maps
  FOR SELECT TO authenticated
  USING (is_campaign_member(campaign_id));

CREATE POLICY maps_insert ON public.maps
  FOR INSERT TO authenticated
  WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY maps_update ON public.maps
  FOR UPDATE TO authenticated
  USING (is_campaign_gm(campaign_id))
  WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY maps_delete ON public.maps
  FOR DELETE TO authenticated
  USING (is_campaign_gm(campaign_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Map Pin States Policies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY map_pin_states_select ON public.map_pin_states
  FOR SELECT TO authenticated
  USING (is_campaign_member(campaign_id));

CREATE POLICY map_pin_states_insert ON public.map_pin_states
  FOR INSERT TO authenticated
  WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY map_pin_states_update ON public.map_pin_states
  FOR UPDATE TO authenticated
  USING (is_campaign_gm(campaign_id))
  WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY map_pin_states_delete ON public.map_pin_states
  FOR DELETE TO authenticated
  USING (is_campaign_gm(campaign_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Map Tokens Policies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY map_tokens_select ON public.map_tokens
  FOR SELECT TO authenticated
  USING (is_campaign_member(campaign_id));

-- Only GM can place tokens
CREATE POLICY map_tokens_insert ON public.map_tokens
  FOR INSERT TO authenticated
  WITH CHECK (is_campaign_gm(campaign_id));

-- GM can update any token; players can move their own character's token
CREATE POLICY map_tokens_update ON public.map_tokens
  FOR UPDATE TO authenticated
  USING (
    is_campaign_gm(campaign_id)
    OR (is_campaign_member(campaign_id) AND owns_character(character_id))
  )
  WITH CHECK (
    is_campaign_gm(campaign_id)
    OR (is_campaign_member(campaign_id) AND owns_character(character_id))
  );

-- Only GM can remove tokens
CREATE POLICY map_tokens_delete ON public.map_tokens
  FOR DELETE TO authenticated
  USING (is_campaign_gm(campaign_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- User Map Pins Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- Players can only see their own pins
CREATE POLICY user_map_pins_select ON public.user_map_pins
  FOR SELECT TO authenticated
  USING (
    is_campaign_gm(campaign_id)
    OR (is_campaign_member(campaign_id) AND user_id = auth.uid())
  );

-- Players can create their own pins
CREATE POLICY user_map_pins_insert ON public.user_map_pins
  FOR INSERT TO authenticated
  WITH CHECK (
    is_campaign_member(campaign_id)
    AND user_id = auth.uid()
  );

-- Players can update their own pins
CREATE POLICY user_map_pins_update ON public.user_map_pins
  FOR UPDATE TO authenticated
  USING (
    is_campaign_gm(campaign_id)
    OR (is_campaign_member(campaign_id) AND user_id = auth.uid())
  )
  WITH CHECK (
    is_campaign_gm(campaign_id)
    OR (is_campaign_member(campaign_id) AND user_id = auth.uid())
  );

-- Players can delete their own pins; GM can delete any
CREATE POLICY user_map_pins_delete ON public.user_map_pins
  FOR DELETE TO authenticated
  USING (
    is_campaign_gm(campaign_id)
    OR (is_campaign_member(campaign_id) AND user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Shop Definitions Policies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY shop_definitions_select ON public.shop_definitions
  FOR SELECT TO authenticated
  USING (is_campaign_member(campaign_id));

CREATE POLICY shop_definitions_insert ON public.shop_definitions
  FOR INSERT TO authenticated
  WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY shop_definitions_update ON public.shop_definitions
  FOR UPDATE TO authenticated
  USING (is_campaign_gm(campaign_id))
  WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY shop_definitions_delete ON public.shop_definitions
  FOR DELETE TO authenticated
  USING (is_campaign_gm(campaign_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Character Templates Policies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY character_templates_select ON public.character_templates
  FOR SELECT TO authenticated
  USING (is_campaign_member(campaign_id));

CREATE POLICY character_templates_insert ON public.character_templates
  FOR INSERT TO authenticated
  WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY character_templates_update ON public.character_templates
  FOR UPDATE TO authenticated
  USING (is_campaign_gm(campaign_id))
  WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY character_templates_delete ON public.character_templates
  FOR DELETE TO authenticated
  USING (is_campaign_gm(campaign_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Location Territories Policies
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY location_territories_select ON public.location_territories
  FOR SELECT TO authenticated
  USING (is_campaign_member(campaign_id));

CREATE POLICY location_territories_insert ON public.location_territories
  FOR INSERT TO authenticated
  WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY location_territories_update ON public.location_territories
  FOR UPDATE TO authenticated
  USING (is_campaign_gm(campaign_id))
  WITH CHECK (is_campaign_gm(campaign_id));

CREATE POLICY location_territories_delete ON public.location_territories
  FOR DELETE TO authenticated
  USING (is_campaign_gm(campaign_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Combat State Policies
-- ─────────────────────────────────────────────────────────────────────────────

-- All campaign members can see combat state (needed for initiative tracker UI)
CREATE POLICY combat_state_select ON public.combat_state
  FOR SELECT TO authenticated
  USING (is_campaign_member(campaign_id));

-- Only GM can initiate combat
CREATE POLICY combat_state_insert ON public.combat_state
  FOR INSERT TO authenticated
  WITH CHECK (is_campaign_gm(campaign_id));

-- Only GM can update combat state
CREATE POLICY combat_state_update ON public.combat_state
  FOR UPDATE TO authenticated
  USING (is_campaign_gm(campaign_id))
  WITH CHECK (is_campaign_gm(campaign_id));

-- Only GM can end/delete combat
CREATE POLICY combat_state_delete ON public.combat_state
  FOR DELETE TO authenticated
  USING (is_campaign_gm(campaign_id));

-- =============================================================================
-- End of RLS migration
-- =============================================================================
