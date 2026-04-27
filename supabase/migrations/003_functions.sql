-- ============================================================================
-- WFRP4e Campaign Manager — Database Functions
-- Migration 003: Helper functions for complex queries
-- ============================================================================

-- ============================================================================
-- 1. PLAYER SHOP VIEW (hides qualities/flaws for unidentified items)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_shop_inventory_for_player(
    p_shop_id UUID,
    p_campaign_id UUID
)
RETURNS TABLE (
    instance_id UUID,
    shop_id UUID,
    campaign_id UUID,
    base_item_id TEXT,
    base_item_type TEXT,
    name_override TEXT,
    modification TEXT,
    qualities JSONB,
    flaws JSONB,
    base_price INT,
    display_price TEXT,
    quantity INT,
    is_identified BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        si.instance_id,
        si.shop_id,
        si.campaign_id,
        si.base_item_id,
        si.base_item_type,
        si.name_override,
        CASE WHEN si.is_identified THEN si.modification ELSE 'standard' END,
        CASE WHEN si.is_identified THEN si.qualities ELSE '[]'::jsonb END,
        CASE WHEN si.is_identified THEN si.flaws ELSE '[]'::jsonb END,
        si.base_price,
        si.display_price,
        si.quantity,
        si.is_identified
    FROM shop_inventory_items si
    WHERE si.shop_id = p_shop_id
    AND si.campaign_id = p_campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- 2. FULL CHARACTER LOAD (single call to get character + all sub-data)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_full_character(p_character_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    char_row RECORD;
BEGIN
    -- Get main character
    SELECT * INTO char_row FROM characters WHERE id = p_character_id;
    IF NOT FOUND THEN RETURN NULL; END IF;

    result := to_jsonb(char_row);

    -- Attach sub-tables
    result := result || jsonb_build_object(
        'skills', COALESCE((
            SELECT jsonb_agg(to_jsonb(s))
            FROM character_skills s WHERE s.character_id = p_character_id
        ), '[]'::jsonb),
        'talents', COALESCE((
            SELECT jsonb_agg(to_jsonb(t))
            FROM character_talents t WHERE t.character_id = p_character_id
        ), '[]'::jsonb),
        'conditions', COALESCE((
            SELECT jsonb_agg(to_jsonb(c))
            FROM character_conditions c WHERE c.character_id = p_character_id
        ), '[]'::jsonb),
        'inventory', COALESCE((
            SELECT jsonb_agg(to_jsonb(i))
            FROM character_inventory i WHERE i.character_id = p_character_id
        ), '[]'::jsonb),
        'career_history', COALESCE((
            SELECT jsonb_agg(to_jsonb(ch) ORDER BY ch.timestamp)
            FROM character_career_history ch WHERE ch.character_id = p_character_id
        ), '[]'::jsonb),
        'unlocks', COALESCE((
            SELECT jsonb_agg(to_jsonb(u))
            FROM character_unlocks u WHERE u.character_id = p_character_id
        ), '[]'::jsonb),
        'reputations', COALESCE((
            SELECT jsonb_agg(to_jsonb(r))
            FROM character_reputations r WHERE r.character_id = p_character_id
        ), '[]'::jsonb),
        'lore', (
            SELECT to_jsonb(l) FROM character_lore l WHERE l.character_id = p_character_id
        ),
        'knowledge_entries', COALESCE((
            SELECT jsonb_agg(to_jsonb(k))
            FROM character_knowledge_entries k WHERE k.character_id = p_character_id
        ), '[]'::jsonb),
        'relationships', COALESCE((
            SELECT jsonb_agg(to_jsonb(rel))
            FROM character_relationships rel WHERE rel.character_id = p_character_id
        ), '[]'::jsonb),
        'action_bar', COALESCE((
            SELECT jsonb_agg(to_jsonb(ab) ORDER BY ab.slot_index)
            FROM character_action_bar ab WHERE ab.character_id = p_character_id
        ), '[]'::jsonb)
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- 3. FULL CAMPAIGN STATE LOAD (for GM app initial data)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_campaign_state(p_campaign_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    -- Campaign base data
    SELECT to_jsonb(c) INTO result FROM campaigns c WHERE c.id = p_campaign_id;
    IF result IS NULL THEN RETURN NULL; END IF;

    -- Members
    result := result || jsonb_build_object('members', COALESCE((
        SELECT jsonb_agg(to_jsonb(m))
        FROM campaign_members m WHERE m.campaign_id = p_campaign_id
    ), '[]'::jsonb));

    -- Characters (full data for each)
    result := result || jsonb_build_object('characters', COALESCE((
        SELECT jsonb_agg(get_full_character(ch.id))
        FROM characters ch WHERE ch.campaign_id = p_campaign_id
    ), '[]'::jsonb));

    -- Journal entries + shared_with
    result := result || jsonb_build_object('journal_entries', COALESCE((
        SELECT jsonb_agg(
            to_jsonb(je) || jsonb_build_object('shared_with', COALESCE((
                SELECT jsonb_agg(jsw.target)
                FROM journal_shared_with jsw WHERE jsw.journal_id = je.id
            ), '[]'::jsonb))
        )
        FROM journal_entries je WHERE je.campaign_id = p_campaign_id
    ), '[]'::jsonb));

    -- Quests + objectives
    result := result || jsonb_build_object('quests', COALESCE((
        SELECT jsonb_agg(
            to_jsonb(q) || jsonb_build_object('objectives', COALESCE((
                SELECT jsonb_agg(to_jsonb(qo))
                FROM quest_objectives qo WHERE qo.quest_id = q.id
            ), '[]'::jsonb))
        )
        FROM quests q WHERE q.campaign_id = p_campaign_id
    ), '[]'::jsonb));

    -- Factions
    result := result || jsonb_build_object('factions', COALESCE((
        SELECT jsonb_agg(to_jsonb(f))
        FROM factions f WHERE f.campaign_id = p_campaign_id
    ), '[]'::jsonb));

    -- Maps + locations
    result := result || jsonb_build_object('maps', COALESCE((
        SELECT jsonb_agg(
            to_jsonb(cm) || jsonb_build_object('locations', COALESCE((
                SELECT jsonb_agg(to_jsonb(cml))
                FROM campaign_map_locations cml WHERE cml.map_id = cm.id
            ), '[]'::jsonb))
        )
        FROM campaign_maps cm WHERE cm.campaign_id = p_campaign_id
    ), '[]'::jsonb));

    -- Map pin discoveries
    result := result || jsonb_build_object('map_pin_discoveries', COALESCE((
        SELECT jsonb_agg(to_jsonb(mpd))
        FROM map_pin_discoveries mpd WHERE mpd.campaign_id = p_campaign_id
    ), '[]'::jsonb));

    -- Map tokens
    result := result || jsonb_build_object('map_tokens', COALESCE((
        SELECT jsonb_agg(to_jsonb(mt))
        FROM map_tokens mt WHERE mt.campaign_id = p_campaign_id
    ), '[]'::jsonb));

    -- Shops + inventory
    result := result || jsonb_build_object('shops', COALESCE((
        SELECT jsonb_agg(
            to_jsonb(sd) || jsonb_build_object('items', COALESCE((
                SELECT jsonb_agg(to_jsonb(si))
                FROM shop_inventory_items si WHERE si.shop_id = sd.id
            ), '[]'::jsonb))
        )
        FROM shop_definitions sd WHERE sd.campaign_id = p_campaign_id
    ), '[]'::jsonb));

    -- Calendar
    result := result || jsonb_build_object('calendar', (
        SELECT to_jsonb(cs) FROM calendar_state cs WHERE cs.campaign_id = p_campaign_id
    ));
    result := result || jsonb_build_object('calendar_events', COALESCE((
        SELECT jsonb_agg(to_jsonb(ce))
        FROM calendar_events ce WHERE ce.campaign_id = p_campaign_id
    ), '[]'::jsonb));

    -- Combat
    result := result || jsonb_build_object('combat_state', (
        SELECT to_jsonb(cbs) FROM combat_state cbs WHERE cbs.campaign_id = p_campaign_id
    ));
    result := result || jsonb_build_object('combatants', COALESCE((
        SELECT jsonb_agg(to_jsonb(cb))
        FROM combatants cb WHERE cb.campaign_id = p_campaign_id
    ), '[]'::jsonb));

    -- Location territories
    result := result || jsonb_build_object('location_territories', COALESCE((
        SELECT jsonb_agg(to_jsonb(lt))
        FROM location_territories lt WHERE lt.campaign_id = p_campaign_id
    ), '[]'::jsonb));

    -- Character templates
    result := result || jsonb_build_object('character_templates', COALESCE((
        SELECT jsonb_agg(to_jsonb(ct))
        FROM character_templates ct WHERE ct.campaign_id = p_campaign_id
    ), '[]'::jsonb));

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- 4. SAVE CHARACTER TRANSACTION (upsert character + all sub-tables atomically)
-- ============================================================================

CREATE OR REPLACE FUNCTION save_character(p_data JSONB)
RETURNS UUID AS $$  
DECLARE
    v_char_id UUID;
    v_campaign_id UUID;
    v_skill JSONB;
    v_talent JSONB;
    v_condition JSONB;
    v_inv_item JSONB;
    v_career JSONB;
    v_unlock JSONB;
    v_rep JSONB;
    v_knowledge JSONB;
    v_rel JSONB;
    v_action JSONB;
BEGIN
    v_char_id := (p_data->>'id')::UUID;
    v_campaign_id := (p_data->>'campaign_id')::UUID;

    -- Upsert main character row
    INSERT INTO characters (
        id, campaign_id, name, species, class,
        current_career_id, current_career_level_id, user_id, location_id,
        movement, is_minion, template_id, xp_current, xp_spent, tags,
        ws_initial, ws_advances, ws_talents, ws_modifier,
        bs_initial, bs_advances, bs_talents, bs_modifier,
        s_initial, s_advances, s_talents, s_modifier,
        t_initial, t_advances, t_talents, t_modifier,
        i_initial, i_advances, i_talents, i_modifier,
        ag_initial, ag_advances, ag_talents, ag_modifier,
        dex_initial, dex_advances, dex_talents, dex_modifier,
        int_initial, int_advances, int_talents, int_modifier,
        wp_initial, wp_advances, wp_talents, wp_modifier,
        fel_initial, fel_advances, fel_talents, fel_modifier,
        wounds_current, wounds_max, fate_current, fate_max,
        fortune_current, fortune_max, resilience_current, resilience_max,
        resolve_current, resolve_max, corruption_current, corruption_max,
        gc, ss, bp,
        age, height, hair, eyes, party_name,
        short_term_ambition, long_term_ambition,
        party_short_term_ambition, party_long_term_ambition,
        image_path
    ) VALUES (
        v_char_id, v_campaign_id,
        p_data->>'name', p_data->>'species', p_data->>'class',
        p_data->>'current_career_id', p_data->>'current_career_level_id',
        (p_data->>'user_id')::UUID, p_data->>'location_id',
        COALESCE((p_data->>'movement')::INT, 4),
        COALESCE((p_data->>'is_minion')::BOOLEAN, false),
        p_data->>'template_id',
        COALESCE((p_data->>'xp_current')::INT, 0),
        COALESCE((p_data->>'xp_spent')::INT, 0),
        COALESCE(p_data->'tags', '[]'::jsonb),
        COALESCE((p_data->>'ws_initial')::INT, 0), COALESCE((p_data->>'ws_advances')::INT, 0), COALESCE((p_data->>'ws_talents')::INT, 0), COALESCE((p_data->>'ws_modifier')::INT, 0),
        COALESCE((p_data->>'bs_initial')::INT, 0), COALESCE((p_data->>'bs_advances')::INT, 0), COALESCE((p_data->>'bs_talents')::INT, 0), COALESCE((p_data->>'bs_modifier')::INT, 0),
        COALESCE((p_data->>'s_initial')::INT, 0), COALESCE((p_data->>'s_advances')::INT, 0), COALESCE((p_data->>'s_talents')::INT, 0), COALESCE((p_data->>'s_modifier')::INT, 0),
        COALESCE((p_data->>'t_initial')::INT, 0), COALESCE((p_data->>'t_advances')::INT, 0), COALESCE((p_data->>'t_talents')::INT, 0), COALESCE((p_data->>'t_modifier')::INT, 0),
        COALESCE((p_data->>'i_initial')::INT, 0), COALESCE((p_data->>'i_advances')::INT, 0), COALESCE((p_data->>'i_talents')::INT, 0), COALESCE((p_data->>'i_modifier')::INT, 0),
        COALESCE((p_data->>'ag_initial')::INT, 0), COALESCE((p_data->>'ag_advances')::INT, 0), COALESCE((p_data->>'ag_talents')::INT, 0), COALESCE((p_data->>'ag_modifier')::INT, 0),
        COALESCE((p_data->>'dex_initial')::INT, 0), COALESCE((p_data->>'dex_advances')::INT, 0), COALESCE((p_data->>'dex_talents')::INT, 0), COALESCE((p_data->>'dex_modifier')::INT, 0),
        COALESCE((p_data->>'int_initial')::INT, 0), COALESCE((p_data->>'int_advances')::INT, 0), COALESCE((p_data->>'int_talents')::INT, 0), COALESCE((p_data->>'int_modifier')::INT, 0),
        COALESCE((p_data->>'wp_initial')::INT, 0), COALESCE((p_data->>'wp_advances')::INT, 0), COALESCE((p_data->>'wp_talents')::INT, 0), COALESCE((p_data->>'wp_modifier')::INT, 0),
        COALESCE((p_data->>'fel_initial')::INT, 0), COALESCE((p_data->>'fel_advances')::INT, 0), COALESCE((p_data->>'fel_talents')::INT, 0), COALESCE((p_data->>'fel_modifier')::INT, 0),
        COALESCE((p_data->>'wounds_current')::INT, 0), COALESCE((p_data->>'wounds_max')::INT, 0),
        COALESCE((p_data->>'fate_current')::INT, 0), COALESCE((p_data->>'fate_max')::INT, 0),
        COALESCE((p_data->>'fortune_current')::INT, 0), COALESCE((p_data->>'fortune_max')::INT, 0),
        COALESCE((p_data->>'resilience_current')::INT, 0), COALESCE((p_data->>'resilience_max')::INT, 0),
        COALESCE((p_data->>'resolve_current')::INT, 0), COALESCE((p_data->>'resolve_max')::INT, 0),
        COALESCE((p_data->>'corruption_current')::INT, 0), COALESCE((p_data->>'corruption_max')::INT, 0),
        COALESCE((p_data->>'gc')::INT, 0), COALESCE((p_data->>'ss')::INT, 0), COALESCE((p_data->>'bp')::INT, 0),
        p_data->>'age', p_data->>'height', p_data->>'hair', p_data->>'eyes', p_data->>'party_name',
        p_data->>'short_term_ambition', p_data->>'long_term_ambition',
        p_data->>'party_short_term_ambition', p_data->>'party_long_term_ambition',
        p_data->>'image_path'
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, species = EXCLUDED.species, class = EXCLUDED.class,
        current_career_id = EXCLUDED.current_career_id, current_career_level_id = EXCLUDED.current_career_level_id,
        user_id = EXCLUDED.user_id, location_id = EXCLUDED.location_id,
        movement = EXCLUDED.movement, is_minion = EXCLUDED.is_minion, template_id = EXCLUDED.template_id,
        xp_current = EXCLUDED.xp_current, xp_spent = EXCLUDED.xp_spent, tags = EXCLUDED.tags,
        ws_initial = EXCLUDED.ws_initial, ws_advances = EXCLUDED.ws_advances, ws_talents = EXCLUDED.ws_talents, ws_modifier = EXCLUDED.ws_modifier,
        bs_initial = EXCLUDED.bs_initial, bs_advances = EXCLUDED.bs_advances, bs_talents = EXCLUDED.bs_talents, bs_modifier = EXCLUDED.bs_modifier,
        s_initial = EXCLUDED.s_initial, s_advances = EXCLUDED.s_advances, s_talents = EXCLUDED.s_talents, s_modifier = EXCLUDED.s_modifier,
        t_initial = EXCLUDED.t_initial, t_advances = EXCLUDED.t_advances, t_talents = EXCLUDED.t_talents, t_modifier = EXCLUDED.t_modifier,
        i_initial = EXCLUDED.i_initial, i_advances = EXCLUDED.i_advances, i_talents = EXCLUDED.i_talents, i_modifier = EXCLUDED.i_modifier,
        ag_initial = EXCLUDED.ag_initial, ag_advances = EXCLUDED.ag_advances, ag_talents = EXCLUDED.ag_talents, ag_modifier = EXCLUDED.ag_modifier,
        dex_initial = EXCLUDED.dex_initial, dex_advances = EXCLUDED.dex_advances, dex_talents = EXCLUDED.dex_talents, dex_modifier = EXCLUDED.dex_modifier,
        int_initial = EXCLUDED.int_initial, int_advances = EXCLUDED.int_advances, int_talents = EXCLUDED.int_talents, int_modifier = EXCLUDED.int_modifier,
        wp_initial = EXCLUDED.wp_initial, wp_advances = EXCLUDED.wp_advances, wp_talents = EXCLUDED.wp_talents, wp_modifier = EXCLUDED.wp_modifier,
        fel_initial = EXCLUDED.fel_initial, fel_advances = EXCLUDED.fel_advances, fel_talents = EXCLUDED.fel_talents, fel_modifier = EXCLUDED.fel_modifier,
        wounds_current = EXCLUDED.wounds_current, wounds_max = EXCLUDED.wounds_max,
        fate_current = EXCLUDED.fate_current, fate_max = EXCLUDED.fate_max,
        fortune_current = EXCLUDED.fortune_current, fortune_max = EXCLUDED.fortune_max,
        resilience_current = EXCLUDED.resilience_current, resilience_max = EXCLUDED.resilience_max,
        resolve_current = EXCLUDED.resolve_current, resolve_max = EXCLUDED.resolve_max,
        corruption_current = EXCLUDED.corruption_current, corruption_max = EXCLUDED.corruption_max,
        gc = EXCLUDED.gc, ss = EXCLUDED.ss, bp = EXCLUDED.bp,
        age = EXCLUDED.age, height = EXCLUDED.height, hair = EXCLUDED.hair, eyes = EXCLUDED.eyes,
        party_name = EXCLUDED.party_name,
        short_term_ambition = EXCLUDED.short_term_ambition, long_term_ambition = EXCLUDED.long_term_ambition,
        party_short_term_ambition = EXCLUDED.party_short_term_ambition, party_long_term_ambition = EXCLUDED.party_long_term_ambition,
        image_path = EXCLUDED.image_path;

    -- Replace sub-table data (delete + insert pattern for simplicity)

    -- Skills
    DELETE FROM character_skills WHERE character_id = v_char_id;
    IF p_data->'skills' IS NOT NULL THEN
        FOR v_skill IN SELECT * FROM jsonb_array_elements(p_data->'skills')
        LOOP
            INSERT INTO character_skills (character_id, skill_id, characteristic, advances, talents, modifier)
            VALUES (v_char_id, v_skill->>'skill_id', v_skill->>'characteristic',
                    COALESCE((v_skill->>'advances')::INT, 0),
                    COALESCE((v_skill->>'talents')::INT, 0),
                    COALESCE((v_skill->>'modifier')::INT, 0));
        END LOOP;
    END IF;

    -- Talents
    DELETE FROM character_talents WHERE character_id = v_char_id;
    IF p_data->'talents' IS NOT NULL THEN
        FOR v_talent IN SELECT * FROM jsonb_array_elements(p_data->'talents')
        LOOP
            INSERT INTO character_talents (character_id, talent_id, ranks)
            VALUES (v_char_id, v_talent->>'talent_id',
                    COALESCE((v_talent->>'ranks')::INT, 1));
        END LOOP;
    END IF;

    -- Conditions
    DELETE FROM character_conditions WHERE character_id = v_char_id;
    IF p_data->'conditions' IS NOT NULL THEN
        FOR v_condition IN SELECT * FROM jsonb_array_elements(p_data->'conditions')
        LOOP
            INSERT INTO character_conditions (character_id, condition_id, stack_count)
            VALUES (v_char_id, v_condition->>'condition_id',
                    COALESCE((v_condition->>'stack_count')::INT, 1));
        END LOOP;
    END IF;

    -- Inventory
    DELETE FROM character_inventory WHERE character_id = v_char_id;
    IF p_data->'inventory' IS NOT NULL THEN
        FOR v_inv_item IN SELECT * FROM jsonb_array_elements(p_data->'inventory')
        LOOP
            INSERT INTO character_inventory (character_id, item_id, item_type, quantity, is_equipped)
            VALUES (v_char_id, v_inv_item->>'item_id', v_inv_item->>'item_type',
                    COALESCE((v_inv_item->>'quantity')::INT, 1),
                    COALESCE((v_inv_item->>'is_equipped')::BOOLEAN, false));
        END LOOP;
    END IF;

    -- Unlocks
    DELETE FROM character_unlocks WHERE character_id = v_char_id;
    IF p_data->'unlocks' IS NOT NULL THEN
        FOR v_unlock IN SELECT * FROM jsonb_array_elements(p_data->'unlocks')
        LOOP
            INSERT INTO character_unlocks (character_id, unlock_type, unlock_id)
            VALUES (v_char_id, v_unlock->>'unlock_type', v_unlock->>'unlock_id');
        END LOOP;
    END IF;

    -- Reputations
    DELETE FROM character_reputations WHERE character_id = v_char_id;
    IF p_data->'reputations' IS NOT NULL THEN
        FOR v_rep IN SELECT * FROM jsonb_array_elements(p_data->'reputations')
        LOOP
            INSERT INTO character_reputations (character_id, faction_id, value, knowledge_level, notes)
            VALUES (v_char_id, v_rep->>'faction_id',
                    COALESCE((v_rep->>'value')::INT, 0),
                    COALESCE(v_rep->>'knowledge_level', 'unknown'),
                    v_rep->>'notes');
        END LOOP;
    END IF;

    -- Lore
    DELETE FROM character_lore WHERE character_id = v_char_id;
    IF p_data->'lore' IS NOT NULL THEN
        INSERT INTO character_lore (character_id, gm_notes, player_notes, appearance, voice, mannerisms, biography, ambition_short, ambition_long, motivation_key)
        VALUES (v_char_id,
                p_data->'lore'->>'gm_notes', p_data->'lore'->>'player_notes',
                p_data->'lore'->>'appearance', p_data->'lore'->>'voice',
                p_data->'lore'->>'mannerisms', p_data->'lore'->>'biography',
                p_data->'lore'->>'ambition_short', p_data->'lore'->>'ambition_long',
                p_data->'lore'->>'motivation_key');
    END IF;

    -- Knowledge entries
    DELETE FROM character_knowledge_entries WHERE character_id = v_char_id;
    IF p_data->'knowledge_entries' IS NOT NULL THEN
        FOR v_knowledge IN SELECT * FROM jsonb_array_elements(p_data->'knowledge_entries')
        LOOP
            INSERT INTO character_knowledge_entries (character_id, topic, content, visibility)
            VALUES (v_char_id, v_knowledge->>'topic', v_knowledge->>'content',
                    COALESCE(v_knowledge->'visibility', '[]'::jsonb));
        END LOOP;
    END IF;

    -- Relationships
    DELETE FROM character_relationships WHERE character_id = v_char_id;
    IF p_data->'relationships' IS NOT NULL THEN
        FOR v_rel IN SELECT * FROM jsonb_array_elements(p_data->'relationships')
        LOOP
            INSERT INTO character_relationships (character_id, target_character_id, type, description)
            SELECT v_char_id, (v_rel->>'target_character_id')::UUID, v_rel->>'type', v_rel->>'description'
            WHERE EXISTS (SELECT 1 FROM characters WHERE id = (v_rel->>'target_character_id')::UUID);
        END LOOP;
    END IF;

    -- Action bar
    DELETE FROM character_action_bar WHERE character_id = v_char_id;
    IF p_data->'action_bar' IS NOT NULL THEN
        FOR v_action IN SELECT * FROM jsonb_array_elements(p_data->'action_bar')
        LOOP
            INSERT INTO character_action_bar (character_id, slot_index, type, action_id, label)
            VALUES (v_char_id, (v_action->>'slot_index')::INT, v_action->>'type', v_action->>'action_id', v_action->>'label');
        END LOOP;
    END IF;

    RETURN v_char_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION save_character_relationships(
    p_character_id UUID,
    p_relationships JSONB
) RETURNS void AS $$
DECLARE
    v_rel RECORD;
BEGIN
    DELETE FROM character_relationships WHERE character_id = p_character_id;
    IF p_relationships IS NOT NULL THEN
        FOR v_rel IN SELECT * FROM jsonb_array_elements(p_relationships)
        LOOP
            INSERT INTO character_relationships (character_id, target_character_id, type, description)
            VALUES (
                p_character_id,
                (v_rel.value->>'target_character_id')::UUID,
                v_rel.value->>'type',
                v_rel.value->>'description'
            );
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- New helper: check campaign membership via journal_entry without triggering journal_entries RLS
CREATE OR REPLACE FUNCTION journal_entry_campaign_id(p_journal_id UUID)
RETURNS UUID AS $$
  SELECT campaign_id FROM journal_entries WHERE id = p_journal_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_journal_shared_with(p_journal_id UUID, p_target TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM journal_shared_with
    WHERE journal_id = p_journal_id
    AND (target = 'all' OR target = p_target)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
