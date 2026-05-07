/**
 * Supabase Database Types
 * 
 * Generated from the schema defined in:
 *   supabase/migrations/20250506000001_initial_schema.sql
 * 
 * To regenerate from a live project:
 *   npx supabase gen types typescript --project-id <project-id> > src/types/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          created_at: string
        }
        Insert: {
          id: string
          display_name?: string
          created_at?: string
        }
        Update: {
          id?: string
          display_name?: string
          created_at?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          id: string
          name: string
          gm_user_id: string
          active_map_id: string | null
          calendar_state: Json | null
          last_global_restock: string | null
          version: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          gm_user_id: string
          active_map_id?: string | null
          calendar_state?: Json | null
          last_global_restock?: string | null
          version?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          gm_user_id?: string
          active_map_id?: string | null
          calendar_state?: Json | null
          last_global_restock?: string | null
          version?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_gm_user_id_fkey"
            columns: ["gm_user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_campaigns_active_map"
            columns: ["active_map_id"]
            referencedRelation: "maps"
            referencedColumns: ["id"]
          }
        ]
      }
      campaign_members: {
        Row: {
          campaign_id: string
          user_id: string
          role: 'gm' | 'player'
          color: string | null
        }
        Insert: {
          campaign_id: string
          user_id: string
          role: 'gm' | 'player'
          color?: string | null
        }
        Update: {
          campaign_id?: string
          user_id?: string
          role?: 'gm' | 'player'
          color?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_members_campaign_id_fkey"
            columns: ["campaign_id"]
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_members_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      characters: {
        Row: {
          id: string
          campaign_id: string
          user_id: string | null
          name: string
          species: string | null
          class: string | null
          current_career_id: string | null
          current_career_level_id: string | null
          tags: string[]
          location_id: string | null
          xp_current: number
          xp_spent: number
          career_history: Json
          unlocked_characteristic_ids: string[]
          unlocked_skill_ids: string[]
          unlocked_talent_ids: string[]
          details: Json
          movement: number
          characteristics: Json
          skills: Json
          status: Json
          conditions: Json
          talents: Json
          inventory: Json
          currency: Json
          reputations: Json
          lore: Json | null
          is_minion: boolean
          template_id: string | null
          action_bar: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          user_id?: string | null
          name: string
          species?: string | null
          class?: string | null
          current_career_id?: string | null
          current_career_level_id?: string | null
          tags?: string[]
          location_id?: string | null
          xp_current?: number
          xp_spent?: number
          career_history?: Json
          unlocked_characteristic_ids?: string[]
          unlocked_skill_ids?: string[]
          unlocked_talent_ids?: string[]
          details?: Json
          movement?: number
          characteristics: Json
          skills?: Json
          status: Json
          conditions?: Json
          talents?: Json
          inventory?: Json
          currency?: Json
          reputations?: Json
          lore?: Json | null
          is_minion?: boolean
          template_id?: string | null
          action_bar?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          user_id?: string | null
          name?: string
          species?: string | null
          class?: string | null
          current_career_id?: string | null
          current_career_level_id?: string | null
          tags?: string[]
          location_id?: string | null
          xp_current?: number
          xp_spent?: number
          career_history?: Json
          unlocked_characteristic_ids?: string[]
          unlocked_skill_ids?: string[]
          unlocked_talent_ids?: string[]
          details?: Json
          movement?: number
          characteristics?: Json
          skills?: Json
          status?: Json
          conditions?: Json
          talents?: Json
          inventory?: Json
          currency?: Json
          reputations?: Json
          lore?: Json | null
          is_minion?: boolean
          template_id?: string | null
          action_bar?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_campaign_id_fkey"
            columns: ["campaign_id"]
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "characters_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      journal_entries: {
        Row: {
          id: string
          campaign_id: string
          title: string
          content: string
          image_data: string | null
          session_date: string | null
          shared_with: string[]
          is_public: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          title: string
          content: string
          image_data?: string | null
          session_date?: string | null
          shared_with?: string[]
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          title?: string
          content?: string
          image_data?: string | null
          session_date?: string | null
          shared_with?: string[]
          is_public?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_campaign_id_fkey"
            columns: ["campaign_id"]
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          }
        ]
      }
      quests: {
        Row: {
          id: string
          campaign_id: string
          title: string
          description: string | null
          objectives: Json
          status: 'active' | 'completed' | 'failed'
          character_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          title: string
          description?: string | null
          objectives?: Json
          status?: 'active' | 'completed' | 'failed'
          character_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          title?: string
          description?: string | null
          objectives?: Json
          status?: 'active' | 'completed' | 'failed'
          character_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quests_campaign_id_fkey"
            columns: ["campaign_id"]
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quests_character_id_fkey"
            columns: ["character_id"]
            referencedRelation: "characters"
            referencedColumns: ["id"]
          }
        ]
      }
      factions: {
        Row: {
          id: string
          campaign_id: string
          name: string
          description: string | null
          category: string | null
          color: string | null
          icon: string | null
          hq: string | null
          head: string | null
          default_reputation: number
        }
        Insert: {
          id?: string
          campaign_id: string
          name: string
          description?: string | null
          category?: string | null
          color?: string | null
          icon?: string | null
          hq?: string | null
          head?: string | null
          default_reputation?: number
        }
        Update: {
          id?: string
          campaign_id?: string
          name?: string
          description?: string | null
          category?: string | null
          color?: string | null
          icon?: string | null
          hq?: string | null
          head?: string | null
          default_reputation?: number
        }
        Relationships: [
          {
            foreignKeyName: "factions_campaign_id_fkey"
            columns: ["campaign_id"]
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          }
        ]
      }
      maps: {
        Row: {
          id: string
          campaign_id: string
          name: string
          image_path: string
          grid_size: number | null
          spawn_point: Json | null
          locations: Json
        }
        Insert: {
          id?: string
          campaign_id: string
          name: string
          image_path: string
          grid_size?: number | null
          spawn_point?: Json | null
          locations?: Json
        }
        Update: {
          id?: string
          campaign_id?: string
          name?: string
          image_path?: string
          grid_size?: number | null
          spawn_point?: Json | null
          locations?: Json
        }
        Relationships: [
          {
            foreignKeyName: "maps_campaign_id_fkey"
            columns: ["campaign_id"]
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          }
        ]
      }
      map_pin_states: {
        Row: {
          id: string
          campaign_id: string
          map_id: string
          location_id: string
          player_discovered: string[]
        }
        Insert: {
          id?: string
          campaign_id: string
          map_id: string
          location_id: string
          player_discovered?: string[]
        }
        Update: {
          id?: string
          campaign_id?: string
          map_id?: string
          location_id?: string
          player_discovered?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "map_pin_states_campaign_id_fkey"
            columns: ["campaign_id"]
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_pin_states_map_id_fkey"
            columns: ["map_id"]
            referencedRelation: "maps"
            referencedColumns: ["id"]
          }
        ]
      }
      map_tokens: {
        Row: {
          id: string
          campaign_id: string
          map_id: string
          character_id: string
          x: number
          y: number
          visible: boolean
        }
        Insert: {
          id?: string
          campaign_id: string
          map_id: string
          character_id: string
          x?: number
          y?: number
          visible?: boolean
        }
        Update: {
          id?: string
          campaign_id?: string
          map_id?: string
          character_id?: string
          x?: number
          y?: number
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "map_tokens_campaign_id_fkey"
            columns: ["campaign_id"]
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_tokens_map_id_fkey"
            columns: ["map_id"]
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_tokens_character_id_fkey"
            columns: ["character_id"]
            referencedRelation: "characters"
            referencedColumns: ["id"]
          }
        ]
      }
      user_map_pins: {
        Row: {
          id: string
          campaign_id: string
          map_id: string
          user_id: string
          character_id: string | null
          x: number
          y: number
          label: string | null
          color: string | null
        }
        Insert: {
          id?: string
          campaign_id: string
          map_id: string
          user_id: string
          character_id?: string | null
          x?: number
          y?: number
          label?: string | null
          color?: string | null
        }
        Update: {
          id?: string
          campaign_id?: string
          map_id?: string
          user_id?: string
          character_id?: string | null
          x?: number
          y?: number
          label?: string | null
          color?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_map_pins_campaign_id_fkey"
            columns: ["campaign_id"]
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_map_pins_map_id_fkey"
            columns: ["map_id"]
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_map_pins_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_map_pins_character_id_fkey"
            columns: ["character_id"]
            referencedRelation: "characters"
            referencedColumns: ["id"]
          }
        ]
      }
      shop_definitions: {
        Row: {
          id: string
          campaign_id: string
          name: string
          location_id: string | null
          category: string
          base_stock: string[]
          inventory: Json
          last_restock_date: string | null
          player_access: string[]
          is_custom: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          name: string
          location_id?: string | null
          category: string
          base_stock?: string[]
          inventory?: Json
          last_restock_date?: string | null
          player_access?: string[]
          is_custom?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          name?: string
          location_id?: string | null
          category?: string
          base_stock?: string[]
          inventory?: Json
          last_restock_date?: string | null
          player_access?: string[]
          is_custom?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_definitions_campaign_id_fkey"
            columns: ["campaign_id"]
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          }
        ]
      }
      character_templates: {
        Row: {
          id: string
          campaign_id: string
          name: string
          category: string | null
          template_data: Json
        }
        Insert: {
          id?: string
          campaign_id: string
          name: string
          category?: string | null
          template_data: Json
        }
        Update: {
          id?: string
          campaign_id?: string
          name?: string
          category?: string | null
          template_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "character_templates_campaign_id_fkey"
            columns: ["campaign_id"]
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          }
        ]
      }
      location_territories: {
        Row: {
          id: string
          campaign_id: string
          location_id: string
          faction_id: string | null
          control_level: number
        }
        Insert: {
          id?: string
          campaign_id: string
          location_id: string
          faction_id?: string | null
          control_level?: number
        }
        Update: {
          id?: string
          campaign_id?: string
          location_id?: string
          faction_id?: string | null
          control_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "location_territories_campaign_id_fkey"
            columns: ["campaign_id"]
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_territories_faction_id_fkey"
            columns: ["faction_id"]
            referencedRelation: "factions"
            referencedColumns: ["id"]
          }
        ]
      }
      combat_state: {
        Row: {
          id: string
          campaign_id: string
          is_active: boolean
          current_turn_index: number
          round_number: number
          combatants: Json
          player_advantage: number
          enemy_advantage: number
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          is_active?: boolean
          current_turn_index?: number
          round_number?: number
          combatants?: Json
          player_advantage?: number
          enemy_advantage?: number
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          is_active?: boolean
          current_turn_index?: number
          round_number?: number
          combatants?: Json
          player_advantage?: number
          enemy_advantage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "combat_state_campaign_id_fkey"
            columns: ["campaign_id"]
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          }
        ]
      }
      chat_messages: {
        Row: {
          id: string
          campaign_id: string
          sender_id: string | null
          sender_name: string
          content: string
          message_type: 'text' | 'dice_roll' | 'system' | 'whisper'
          roll_data: Json | null
          target_user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          sender_id?: string | null
          sender_name: string
          content: string
          message_type?: 'text' | 'dice_roll' | 'system' | 'whisper'
          roll_data?: Json | null
          target_user_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          sender_id?: string | null
          sender_name?: string
          content?: string
          message_type?: 'text' | 'dice_roll' | 'system' | 'whisper'
          roll_data?: Json | null
          target_user_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_target_user_id_fkey"
            columns: ["target_user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_campaign_member: {
        Args: {
          campaign_uuid: string
        }
        Returns: boolean
      }
      is_campaign_gm: {
        Args: {
          campaign_uuid: string
        }
        Returns: boolean
      }
      owns_character: {
        Args: {
          character_uuid: string
        }
        Returns: boolean
      }
      user_has_character_in: {
        Args: {
          character_ids: string[]
        }
        Returns: boolean
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

// Convenience type aliases
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertDto<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateDto<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
