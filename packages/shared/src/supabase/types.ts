export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audio_playlists: {
        Row: {
          campaign_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audio_playlists_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      audio_tracks: {
        Row: {
          campaign_id: string
          display_name: string | null
          duration: number | null
          filename: string
          id: string
          is_missing: boolean
          last_modified: string | null
          path: string
          tags: Json
        }
        Insert: {
          campaign_id: string
          display_name?: string | null
          duration?: number | null
          filename: string
          id?: string
          is_missing?: boolean
          last_modified?: string | null
          path: string
          tags?: Json
        }
        Update: {
          campaign_id?: string
          display_name?: string | null
          duration?: number | null
          filename?: string
          id?: string
          is_missing?: boolean
          last_modified?: string | null
          path?: string
          tags?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audio_tracks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          campaign_id: string
          category: string | null
          date_day: number
          date_month_index: number
          date_year: number
          description: string | null
          id: string
          is_visible_to_players: boolean
          title: string
        }
        Insert: {
          campaign_id: string
          category?: string | null
          date_day: number
          date_month_index: number
          date_year: number
          description?: string | null
          id?: string
          is_visible_to_players?: boolean
          title: string
        }
        Update: {
          campaign_id?: string
          category?: string | null
          date_day?: number
          date_month_index?: number
          date_year?: number
          description?: string | null
          id?: string
          is_visible_to_players?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_state: {
        Row: {
          campaign_id: string
          current_day: number
          current_month_index: number
          current_weather: string | null
          current_year: number
        }
        Insert: {
          campaign_id: string
          current_day?: number
          current_month_index?: number
          current_weather?: string | null
          current_year?: number
        }
        Update: {
          campaign_id?: string
          current_day?: number
          current_month_index?: number
          current_weather?: string | null
          current_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "calendar_state_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_map_locations: {
        Row: {
          controlling_faction_id: string | null
          coords_x: number
          coords_y: number
          gm_notes: string | null
          hooks: Json
          id: string
          image: string | null
          influence_weight: number | null
          location_key: string
          map_id: string
          music: string | null
          name: string
          player_description: string | null
          tag: string | null
        }
        Insert: {
          controlling_faction_id?: string | null
          coords_x: number
          coords_y: number
          gm_notes?: string | null
          hooks?: Json
          id?: string
          image?: string | null
          influence_weight?: number | null
          location_key: string
          map_id: string
          music?: string | null
          name: string
          player_description?: string | null
          tag?: string | null
        }
        Update: {
          controlling_faction_id?: string | null
          coords_x?: number
          coords_y?: number
          gm_notes?: string | null
          hooks?: Json
          id?: string
          image?: string | null
          influence_weight?: number | null
          location_key?: string
          map_id?: string
          music?: string | null
          name?: string
          player_description?: string | null
          tag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_map_locations_controlling_faction_id_fkey"
            columns: ["controlling_faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_map_locations_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "campaign_maps"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_maps: {
        Row: {
          campaign_id: string
          grid_size: number
          id: string
          image_path: string | null
          map_key: string
          name: string
          spawn_point_x: number | null
          spawn_point_y: number | null
        }
        Insert: {
          campaign_id: string
          grid_size?: number
          id?: string
          image_path?: string | null
          map_key: string
          name: string
          spawn_point_x?: number | null
          spawn_point_y?: number | null
        }
        Update: {
          campaign_id?: string
          grid_size?: number
          id?: string
          image_path?: string | null
          map_key?: string
          name?: string
          spawn_point_x?: number | null
          spawn_point_y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_maps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_members: {
        Row: {
          campaign_id: string
          character_id: string | null
          color: string | null
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          character_id?: string | null
          color?: string | null
          id?: string
          joined_at?: string
          role: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          character_id?: string | null
          color?: string | null
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_campaign_members_character"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          active_map_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          owner_id: string
          updated_at: string
          version: string
        }
        Insert: {
          active_map_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_id: string
          updated_at?: string
          version?: string
        }
        Update: {
          active_map_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      character_action_bar: {
        Row: {
          action_id: string
          character_id: string
          label: string
          slot_index: number
          type: string
        }
        Insert: {
          action_id: string
          character_id: string
          label: string
          slot_index: number
          type: string
        }
        Update: {
          action_id?: string
          character_id?: string
          label?: string
          slot_index?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_action_bar_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_career_history: {
        Row: {
          advancement_id: string
          advancement_name: string
          advancement_type: string
          career_id: string
          career_level_id: string
          career_name: string
          character_id: string
          id: string
          level: number
          level_name: string
          timestamp: string
          xp_spent: number
        }
        Insert: {
          advancement_id: string
          advancement_name: string
          advancement_type: string
          career_id: string
          career_level_id: string
          career_name: string
          character_id: string
          id?: string
          level: number
          level_name: string
          timestamp?: string
          xp_spent?: number
        }
        Update: {
          advancement_id?: string
          advancement_name?: string
          advancement_type?: string
          career_id?: string
          career_level_id?: string
          career_name?: string
          character_id?: string
          id?: string
          level?: number
          level_name?: string
          timestamp?: string
          xp_spent?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_career_history_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_conditions: {
        Row: {
          character_id: string
          condition_id: string
          id: string
          stack_count: number
        }
        Insert: {
          character_id: string
          condition_id: string
          id?: string
          stack_count?: number
        }
        Update: {
          character_id?: string
          condition_id?: string
          id?: string
          stack_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_conditions_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_inventory: {
        Row: {
          character_id: string
          id: string
          is_equipped: boolean
          item_id: string
          item_type: string
          quantity: number
        }
        Insert: {
          character_id: string
          id?: string
          is_equipped?: boolean
          item_id: string
          item_type: string
          quantity?: number
        }
        Update: {
          character_id?: string
          id?: string
          is_equipped?: boolean
          item_id?: string
          item_type?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_inventory_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_knowledge_entries: {
        Row: {
          character_id: string
          content: string
          created_at: string
          id: string
          topic: string
          updated_at: string
          visibility: Json
        }
        Insert: {
          character_id: string
          content: string
          created_at?: string
          id?: string
          topic: string
          updated_at?: string
          visibility?: Json
        }
        Update: {
          character_id?: string
          content?: string
          created_at?: string
          id?: string
          topic?: string
          updated_at?: string
          visibility?: Json
        }
        Relationships: [
          {
            foreignKeyName: "character_knowledge_entries_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_lore: {
        Row: {
          ambition_long: string | null
          ambition_short: string | null
          appearance: string | null
          biography: string | null
          character_id: string
          gm_notes: string | null
          mannerisms: string | null
          motivation_key: string | null
          player_notes: string | null
          voice: string | null
        }
        Insert: {
          ambition_long?: string | null
          ambition_short?: string | null
          appearance?: string | null
          biography?: string | null
          character_id: string
          gm_notes?: string | null
          mannerisms?: string | null
          motivation_key?: string | null
          player_notes?: string | null
          voice?: string | null
        }
        Update: {
          ambition_long?: string | null
          ambition_short?: string | null
          appearance?: string | null
          biography?: string | null
          character_id?: string
          gm_notes?: string | null
          mannerisms?: string | null
          motivation_key?: string | null
          player_notes?: string | null
          voice?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "character_lore_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: true
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_relationships: {
        Row: {
          character_id: string
          description: string | null
          id: string
          target_character_id: string
          type: string
        }
        Insert: {
          character_id: string
          description?: string | null
          id?: string
          target_character_id: string
          type: string
        }
        Update: {
          character_id?: string
          description?: string | null
          id?: string
          target_character_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_relationships_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "character_relationships_target_character_id_fkey"
            columns: ["target_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_reputations: {
        Row: {
          character_id: string
          faction_id: string
          knowledge_level: string
          notes: string | null
          value: number
        }
        Insert: {
          character_id: string
          faction_id: string
          knowledge_level?: string
          notes?: string | null
          value?: number
        }
        Update: {
          character_id?: string
          faction_id?: string
          knowledge_level?: string
          notes?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_reputations_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_skills: {
        Row: {
          advances: number
          character_id: string
          modifier: number
          skill_id: string
          talents: number
        }
        Insert: {
          advances?: number
          character_id: string
          modifier?: number
          skill_id: string
          talents?: number
        }
        Update: {
          advances?: number
          character_id?: string
          modifier?: number
          skill_id?: string
          talents?: number
        }
        Relationships: [
          {
            foreignKeyName: "character_skills_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_talents: {
        Row: {
          character_id: string
          ranks: number
          talent_id: string
        }
        Insert: {
          character_id: string
          ranks?: number
          talent_id: string
        }
        Update: {
          character_id?: string
          ranks?: number
          talent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_talents_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      character_templates: {
        Row: {
          base_wounds: number | null
          campaign_id: string
          career_id: string | null
          career_level_id: string | null
          category: string
          characteristics: Json
          description: string | null
          id: string
          is_minion: boolean
          movement: number
          name: string
          name_list: Json
          skills: Json
          species: string | null
          tags: Json
          talents: Json
          trappings: Json
          wounds_variance: number | null
        }
        Insert: {
          base_wounds?: number | null
          campaign_id: string
          career_id?: string | null
          career_level_id?: string | null
          category: string
          characteristics?: Json
          description?: string | null
          id?: string
          is_minion?: boolean
          movement?: number
          name: string
          name_list?: Json
          skills?: Json
          species?: string | null
          tags?: Json
          talents?: Json
          trappings?: Json
          wounds_variance?: number | null
        }
        Update: {
          base_wounds?: number | null
          campaign_id?: string
          career_id?: string | null
          career_level_id?: string | null
          category?: string
          characteristics?: Json
          description?: string | null
          id?: string
          is_minion?: boolean
          movement?: number
          name?: string
          name_list?: Json
          skills?: Json
          species?: string | null
          tags?: Json
          talents?: Json
          trappings?: Json
          wounds_variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "character_templates_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      character_unlocks: {
        Row: {
          character_id: string
          unlock_id: string
          unlock_type: string
        }
        Insert: {
          character_id: string
          unlock_id: string
          unlock_type: string
        }
        Update: {
          character_id?: string
          unlock_id?: string
          unlock_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "character_unlocks_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          ag_advances: number
          ag_initial: number
          ag_modifier: number
          ag_talents: number
          age: string | null
          bp: number
          bs_advances: number
          bs_initial: number
          bs_modifier: number
          bs_talents: number
          campaign_id: string
          class: string | null
          corruption_current: number
          corruption_max: number
          created_at: string
          current_career_id: string | null
          current_career_level_id: string | null
          dex_advances: number
          dex_initial: number
          dex_modifier: number
          dex_talents: number
          eyes: string | null
          fate_current: number
          fate_max: number
          fel_advances: number
          fel_initial: number
          fel_modifier: number
          fel_talents: number
          fortune_current: number
          fortune_max: number
          gc: number
          hair: string | null
          height: string | null
          i_advances: number
          i_initial: number
          i_modifier: number
          i_talents: number
          id: string
          image_path: string | null
          int_advances: number
          int_initial: number
          int_modifier: number
          int_talents: number
          is_minion: boolean
          location_id: string | null
          long_term_ambition: string | null
          movement: number
          name: string
          party_long_term_ambition: string | null
          party_name: string | null
          party_short_term_ambition: string | null
          resilience_current: number
          resilience_max: number
          resolve_current: number
          resolve_max: number
          s_advances: number
          s_initial: number
          s_modifier: number
          s_talents: number
          short_term_ambition: string | null
          species: string | null
          ss: number
          t_advances: number
          t_initial: number
          t_modifier: number
          t_talents: number
          tags: Json
          template_id: string | null
          updated_at: string
          user_id: string | null
          wounds_current: number
          wounds_max: number
          wp_advances: number
          wp_initial: number
          wp_modifier: number
          wp_talents: number
          ws_advances: number
          ws_initial: number
          ws_modifier: number
          ws_talents: number
          xp_current: number
          xp_spent: number
        }
        Insert: {
          ag_advances?: number
          ag_initial?: number
          ag_modifier?: number
          ag_talents?: number
          age?: string | null
          bp?: number
          bs_advances?: number
          bs_initial?: number
          bs_modifier?: number
          bs_talents?: number
          campaign_id: string
          class?: string | null
          corruption_current?: number
          corruption_max?: number
          created_at?: string
          current_career_id?: string | null
          current_career_level_id?: string | null
          dex_advances?: number
          dex_initial?: number
          dex_modifier?: number
          dex_talents?: number
          eyes?: string | null
          fate_current?: number
          fate_max?: number
          fel_advances?: number
          fel_initial?: number
          fel_modifier?: number
          fel_talents?: number
          fortune_current?: number
          fortune_max?: number
          gc?: number
          hair?: string | null
          height?: string | null
          i_advances?: number
          i_initial?: number
          i_modifier?: number
          i_talents?: number
          id?: string
          image_path?: string | null
          int_advances?: number
          int_initial?: number
          int_modifier?: number
          int_talents?: number
          is_minion?: boolean
          location_id?: string | null
          long_term_ambition?: string | null
          movement?: number
          name: string
          party_long_term_ambition?: string | null
          party_name?: string | null
          party_short_term_ambition?: string | null
          resilience_current?: number
          resilience_max?: number
          resolve_current?: number
          resolve_max?: number
          s_advances?: number
          s_initial?: number
          s_modifier?: number
          s_talents?: number
          short_term_ambition?: string | null
          species?: string | null
          ss?: number
          t_advances?: number
          t_initial?: number
          t_modifier?: number
          t_talents?: number
          tags?: Json
          template_id?: string | null
          updated_at?: string
          user_id?: string | null
          wounds_current?: number
          wounds_max?: number
          wp_advances?: number
          wp_initial?: number
          wp_modifier?: number
          wp_talents?: number
          ws_advances?: number
          ws_initial?: number
          ws_modifier?: number
          ws_talents?: number
          xp_current?: number
          xp_spent?: number
        }
        Update: {
          ag_advances?: number
          ag_initial?: number
          ag_modifier?: number
          ag_talents?: number
          age?: string | null
          bp?: number
          bs_advances?: number
          bs_initial?: number
          bs_modifier?: number
          bs_talents?: number
          campaign_id?: string
          class?: string | null
          corruption_current?: number
          corruption_max?: number
          created_at?: string
          current_career_id?: string | null
          current_career_level_id?: string | null
          dex_advances?: number
          dex_initial?: number
          dex_modifier?: number
          dex_talents?: number
          eyes?: string | null
          fate_current?: number
          fate_max?: number
          fel_advances?: number
          fel_initial?: number
          fel_modifier?: number
          fel_talents?: number
          fortune_current?: number
          fortune_max?: number
          gc?: number
          hair?: string | null
          height?: string | null
          i_advances?: number
          i_initial?: number
          i_modifier?: number
          i_talents?: number
          id?: string
          image_path?: string | null
          int_advances?: number
          int_initial?: number
          int_modifier?: number
          int_talents?: number
          is_minion?: boolean
          location_id?: string | null
          long_term_ambition?: string | null
          movement?: number
          name?: string
          party_long_term_ambition?: string | null
          party_name?: string | null
          party_short_term_ambition?: string | null
          resilience_current?: number
          resilience_max?: number
          resolve_current?: number
          resolve_max?: number
          s_advances?: number
          s_initial?: number
          s_modifier?: number
          s_talents?: number
          short_term_ambition?: string | null
          species?: string | null
          ss?: number
          t_advances?: number
          t_initial?: number
          t_modifier?: number
          t_talents?: number
          tags?: Json
          template_id?: string | null
          updated_at?: string
          user_id?: string | null
          wounds_current?: number
          wounds_max?: number
          wp_advances?: number
          wp_initial?: number
          wp_modifier?: number
          wp_talents?: number
          ws_advances?: number
          ws_initial?: number
          ws_modifier?: number
          ws_talents?: number
          xp_current?: number
          xp_spent?: number
        }
        Relationships: [
          {
            foreignKeyName: "characters_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          campaign_id: string
          content: string
          created_at: string
          data: Json | null
          id: string
          is_private: boolean
          sender_color: string | null
          sender_id: string | null
          sender_name: string
          type: string
        }
        Insert: {
          campaign_id: string
          content: string
          created_at?: string
          data?: Json | null
          id?: string
          is_private?: boolean
          sender_color?: string | null
          sender_id?: string | null
          sender_name: string
          type?: string
        }
        Update: {
          campaign_id?: string
          content?: string
          created_at?: string
          data?: Json | null
          id?: string
          is_private?: boolean
          sender_color?: string | null
          sender_id?: string | null
          sender_name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      combat_state: {
        Row: {
          campaign_id: string
          current_turn_id: string | null
          enemy_advantage: number
          is_active: boolean
          player_advantage: number
        }
        Insert: {
          campaign_id: string
          current_turn_id?: string | null
          enemy_advantage?: number
          is_active?: boolean
          player_advantage?: number
        }
        Update: {
          campaign_id?: string
          current_turn_id?: string | null
          enemy_advantage?: number
          is_active?: boolean
          player_advantage?: number
        }
        Relationships: [
          {
            foreignKeyName: "combat_state_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      combatants: {
        Row: {
          base_ag: number
          base_initiative: number
          campaign_id: string
          condition_instances: Json
          conditions: Json
          current_wounds: number
          id: string
          initiative: number | null
          is_player: boolean
          max_wounds: number
          name: string
          source_id: string
        }
        Insert: {
          base_ag: number
          base_initiative: number
          campaign_id: string
          condition_instances?: Json
          conditions?: Json
          current_wounds: number
          id?: string
          initiative?: number | null
          is_player?: boolean
          max_wounds: number
          name: string
          source_id: string
        }
        Update: {
          base_ag?: number
          base_initiative?: number
          campaign_id?: string
          condition_instances?: Json
          conditions?: Json
          current_wounds?: number
          id?: string
          initiative?: number | null
          is_player?: boolean
          max_wounds?: number
          name?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "combatants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      factions: {
        Row: {
          campaign_id: string
          category: string | null
          color: string | null
          default_reputation: number
          description: string | null
          faction_key: string
          head: string | null
          hq: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          campaign_id: string
          category?: string | null
          color?: string | null
          default_reputation?: number
          description?: string | null
          faction_key: string
          head?: string | null
          hq?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          campaign_id?: string
          category?: string | null
          color?: string | null
          default_reputation?: number
          description?: string | null
          faction_key?: string
          head?: string | null
          hq?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "factions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      game_log_entries: {
        Row: {
          actor_name: string | null
          campaign_id: string
          content: string
          created_at: string
          data: Json | null
          id: string
          type: string
        }
        Insert: {
          actor_name?: string | null
          campaign_id: string
          content: string
          created_at?: string
          data?: Json | null
          id?: string
          type: string
        }
        Update: {
          actor_name?: string | null
          campaign_id?: string
          content?: string
          created_at?: string
          data?: Json | null
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_log_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          campaign_id: string
          content: string
          created_at: string
          id: string
          image_data: string | null
          title: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          content?: string
          created_at?: string
          id?: string
          image_data?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          content?: string
          created_at?: string
          id?: string
          image_data?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_shared_with: {
        Row: {
          journal_id: string
          target: string
        }
        Insert: {
          journal_id: string
          target: string
        }
        Update: {
          journal_id?: string
          target?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_shared_with_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      location_territories: {
        Row: {
          campaign_id: string
          controlling_faction_id: string
          influence_weight: number
          location_id: string
        }
        Insert: {
          campaign_id: string
          controlling_faction_id: string
          influence_weight?: number
          location_id: string
        }
        Update: {
          campaign_id?: string
          controlling_faction_id?: string
          influence_weight?: number
          location_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_territories_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_territories_controlling_faction_id_fkey"
            columns: ["controlling_faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
        ]
      }
      map_pin_discoveries: {
        Row: {
          campaign_id: string
          character_id: string
          location_key: string
        }
        Insert: {
          campaign_id: string
          character_id: string
          location_key: string
        }
        Update: {
          campaign_id?: string
          character_id?: string
          location_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "map_pin_discoveries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_pin_discoveries_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      map_tokens: {
        Row: {
          campaign_id: string
          character_id: string
          character_name: string | null
          id: string
          map_id: string
          updated_at: string
          x: number
          y: number
        }
        Insert: {
          campaign_id: string
          character_id: string
          character_name?: string | null
          id?: string
          map_id: string
          updated_at?: string
          x?: number
          y?: number
        }
        Update: {
          campaign_id?: string
          character_id?: string
          character_name?: string | null
          id?: string
          map_id?: string
          updated_at?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "map_tokens_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_tokens_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      player_preferences: {
        Row: {
          campaign_id: string
          key: string
          user_id: string
          value: Json
        }
        Insert: {
          campaign_id: string
          key: string
          user_id: string
          value?: Json
        }
        Update: {
          campaign_id?: string
          key?: string
          user_id?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "player_preferences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_tracks: {
        Row: {
          playlist_id: string
          position: number
          track_id: string
        }
        Insert: {
          playlist_id: string
          position?: number
          track_id: string
        }
        Update: {
          playlist_id?: string
          position?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_tracks_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "audio_playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_tracks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "audio_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      quest_objectives: {
        Row: {
          id: string
          is_completed: boolean
          location_id: string | null
          quest_id: string
          text: string
        }
        Insert: {
          id?: string
          is_completed?: boolean
          location_id?: string | null
          quest_id: string
          text: string
        }
        Update: {
          id?: string
          is_completed?: boolean
          location_id?: string | null
          quest_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "quest_objectives_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      quests: {
        Row: {
          campaign_id: string
          character_id: string
          created_at: string
          description: string
          id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          character_id: string
          created_at?: string
          description?: string
          id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          character_id?: string
          created_at?: string
          description?: string
          id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quests_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quests_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_definitions: {
        Row: {
          base_stock: Json
          campaign_id: string
          category: string
          id: string
          is_custom: boolean
          location_id: string | null
          name: string
          shop_key: string
        }
        Insert: {
          base_stock?: Json
          campaign_id: string
          category: string
          id?: string
          is_custom?: boolean
          location_id?: string | null
          name: string
          shop_key: string
        }
        Update: {
          base_stock?: Json
          campaign_id?: string
          category?: string
          id?: string
          is_custom?: boolean
          location_id?: string | null
          name?: string
          shop_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_definitions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_inventory_items: {
        Row: {
          base_item_id: string
          base_item_type: string
          base_price: number
          campaign_id: string
          display_price: string | null
          flaws: Json
          instance_id: string
          is_identified: boolean
          modification: string
          name_override: string | null
          qualities: Json
          quantity: number
          shop_id: string
        }
        Insert: {
          base_item_id: string
          base_item_type: string
          base_price: number
          campaign_id: string
          display_price?: string | null
          flaws?: Json
          instance_id?: string
          is_identified?: boolean
          modification?: string
          name_override?: string | null
          qualities?: Json
          quantity?: number
          shop_id: string
        }
        Update: {
          base_item_id?: string
          base_item_type?: string
          base_price?: number
          campaign_id?: string
          display_price?: string | null
          flaws?: Json
          instance_id?: string
          is_identified?: boolean
          modification?: string
          name_override?: string | null
          qualities?: Json
          quantity?: number
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_inventory_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_inventory_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shop_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_map_pins: {
        Row: {
          campaign_id: string
          character_id: string
          color: string | null
          id: string
          label: string
          map_id: string
          user_id: string
          x: number
          y: number
        }
        Insert: {
          campaign_id: string
          character_id: string
          color?: string | null
          id?: string
          label: string
          map_id: string
          user_id: string
          x: number
          y: number
        }
        Update: {
          campaign_id?: string
          character_id?: string
          color?: string | null
          id?: string
          label?: string
          map_id?: string
          user_id?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_map_pins_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_map_pins_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_campaign_state: { Args: { p_campaign_id: string }; Returns: Json }
      get_full_character: { Args: { p_character_id: string }; Returns: Json }
      get_shop_inventory_for_player: {
        Args: { p_campaign_id: string; p_shop_id: string }
        Returns: {
          base_item_id: string
          base_item_type: string
          base_price: number
          campaign_id: string
          display_price: string
          flaws: Json
          instance_id: string
          is_identified: boolean
          modification: string
          name_override: string
          qualities: Json
          quantity: number
          shop_id: string
        }[]
      }
      is_campaign_gm: { Args: { p_campaign_id: string }; Returns: boolean }
      is_campaign_member: { Args: { p_campaign_id: string }; Returns: boolean }
      my_character_id: { Args: { p_campaign_id: string }; Returns: string }
      save_character: { Args: { p_data: Json }; Returns: string }
      save_character_relationships: {
        Args: { p_character_id: string; p_relationships: Json }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
