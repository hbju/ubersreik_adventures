-- 004_enable_realtime.sql
-- Enable Supabase Realtime (Postgres publication) for tables that the
-- player-web app subscribes to.  This allows clients to receive
-- postgres_changes events via the Supabase Realtime multiplexer.
--
-- NOTE: Run this in the Supabase SQL Editor or via `supabase db push`.

-- Add tables to the default `supabase_realtime` publication.
-- The publication is created automatically by Supabase; we just add tables.

ALTER PUBLICATION supabase_realtime ADD TABLE characters;
ALTER PUBLICATION supabase_realtime ADD TABLE journal_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE quests;
ALTER PUBLICATION supabase_realtime ADD TABLE factions;
ALTER PUBLICATION supabase_realtime ADD TABLE location_territories;
ALTER PUBLICATION supabase_realtime ADD TABLE map_pin_discoveries;
ALTER PUBLICATION supabase_realtime ADD TABLE map_tokens;
ALTER PUBLICATION supabase_realtime ADD TABLE user_map_pins;
ALTER PUBLICATION supabase_realtime ADD TABLE shop_definitions;
ALTER PUBLICATION supabase_realtime ADD TABLE combat_state;
ALTER PUBLICATION supabase_realtime ADD TABLE combatants;
ALTER PUBLICATION supabase_realtime ADD TABLE calendar_state;
ALTER PUBLICATION supabase_realtime ADD TABLE calendar_events;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE campaigns;
