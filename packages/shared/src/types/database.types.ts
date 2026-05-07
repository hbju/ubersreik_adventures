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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      campaign_members: {
        Row: {
          campaign_id: string
          color: string | null
          role: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          color?: string | null
          role: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          color?: string | null
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
            foreignKeyName: "campaign_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          active_map_id: string | null
          calendar_state: Json | null
          created_at: string
          gm_user_id: string
          id: string
          last_global_restock: string | null
          name: string
          updated_at: string
          version: string
        }
        Insert: {
          active_map_id?: string | null
          calendar_state?: Json | null
          created_at?: string
          gm_user_id: string
          id?: string
          last_global_restock?: string | null
          name: string
          updated_at?: string
          version?: string
        }
        Update: {
          active_map_id?: string | null
          calendar_state?: Json | null
          created_at?: string
          gm_user_id?: string
          id?: string
          last_global_restock?: string | null
          name?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_gm_user_id_fkey"
            columns: ["gm_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_campaigns_active_map"
            columns: ["active_map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
        ]
      }
      character_templates: {
        Row: {
          campaign_id: string
          category: string | null
          id: string
          name: string
          template_data: Json
        }
        Insert: {
          campaign_id: string
          category?: string | null
          id?: string
          name: string
          template_data: Json
        }
        Update: {
          campaign_id?: string
          category?: string | null
          id?: string
          name?: string
          template_data?: Json
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
      characters: {
        Row: {
          action_bar: Json | null
          campaign_id: string
          career_history: Json
          characteristics: Json
          class: string | null
          conditions: Json
          created_at: string
          currency: Json
          current_career_id: string | null
          current_career_level_id: string | null
          details: Json
          id: string
          inventory: Json
          is_minion: boolean
          location_id: string | null
          lore: Json | null
          movement: number
          name: string
          reputations: Json
          skills: Json
          species: string | null
          status: Json
          tags: string[]
          talents: Json
          template_id: string | null
          unlocked_characteristic_ids: string[]
          unlocked_skill_ids: string[]
          unlocked_talent_ids: string[]
          updated_at: string
          user_id: string | null
          xp_current: number
          xp_spent: number
        }
        Insert: {
          action_bar?: Json | null
          campaign_id: string
          career_history?: Json
          characteristics: Json
          class?: string | null
          conditions?: Json
          created_at?: string
          currency?: Json
          current_career_id?: string | null
          current_career_level_id?: string | null
          details?: Json
          id?: string
          inventory?: Json
          is_minion?: boolean
          location_id?: string | null
          lore?: Json | null
          movement?: number
          name: string
          reputations?: Json
          skills?: Json
          species?: string | null
          status: Json
          tags?: string[]
          talents?: Json
          template_id?: string | null
          unlocked_characteristic_ids?: string[]
          unlocked_skill_ids?: string[]
          unlocked_talent_ids?: string[]
          updated_at?: string
          user_id?: string | null
          xp_current?: number
          xp_spent?: number
        }
        Update: {
          action_bar?: Json | null
          campaign_id?: string
          career_history?: Json
          characteristics?: Json
          class?: string | null
          conditions?: Json
          created_at?: string
          currency?: Json
          current_career_id?: string | null
          current_career_level_id?: string | null
          details?: Json
          id?: string
          inventory?: Json
          is_minion?: boolean
          location_id?: string | null
          lore?: Json | null
          movement?: number
          name?: string
          reputations?: Json
          skills?: Json
          species?: string | null
          status?: Json
          tags?: string[]
          talents?: Json
          template_id?: string | null
          unlocked_characteristic_ids?: string[]
          unlocked_skill_ids?: string[]
          unlocked_talent_ids?: string[]
          updated_at?: string
          user_id?: string | null
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
          {
            foreignKeyName: "characters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          campaign_id: string
          content: string
          created_at: string
          id: string
          message_type: string
          roll_data: Json | null
          sender_id: string | null
          sender_name: string
          target_user_id: string | null
        }
        Insert: {
          campaign_id: string
          content: string
          created_at?: string
          id?: string
          message_type?: string
          roll_data?: Json | null
          sender_id?: string | null
          sender_name: string
          target_user_id?: string | null
        }
        Update: {
          campaign_id?: string
          content?: string
          created_at?: string
          id?: string
          message_type?: string
          roll_data?: Json | null
          sender_id?: string | null
          sender_name?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      combat_state: {
        Row: {
          campaign_id: string
          combatants: Json
          current_turn_index: number
          enemy_advantage: number
          id: string
          is_active: boolean
          player_advantage: number
          round_number: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          combatants?: Json
          current_turn_index?: number
          enemy_advantage?: number
          id?: string
          is_active?: boolean
          player_advantage?: number
          round_number?: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          combatants?: Json
          current_turn_index?: number
          enemy_advantage?: number
          id?: string
          is_active?: boolean
          player_advantage?: number
          round_number?: number
          updated_at?: string
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
      factions: {
        Row: {
          campaign_id: string
          category: string | null
          color: string | null
          default_reputation: number
          description: string | null
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
      journal_entries: {
        Row: {
          campaign_id: string
          content: string
          created_at: string
          id: string
          image_data: string | null
          is_public: boolean
          session_date: string | null
          shared_with: string[]
          title: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          content: string
          created_at?: string
          id?: string
          image_data?: string | null
          is_public?: boolean
          session_date?: string | null
          shared_with?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          content?: string
          created_at?: string
          id?: string
          image_data?: string | null
          is_public?: boolean
          session_date?: string | null
          shared_with?: string[]
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
      location_territories: {
        Row: {
          campaign_id: string
          control_level: number
          faction_id: string | null
          id: string
          location_id: string
        }
        Insert: {
          campaign_id: string
          control_level?: number
          faction_id?: string | null
          id?: string
          location_id: string
        }
        Update: {
          campaign_id?: string
          control_level?: number
          faction_id?: string | null
          id?: string
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
            foreignKeyName: "location_territories_faction_id_fkey"
            columns: ["faction_id"]
            isOneToOne: false
            referencedRelation: "factions"
            referencedColumns: ["id"]
          },
        ]
      }
      map_pin_states: {
        Row: {
          campaign_id: string
          id: string
          location_id: string
          map_id: string
          player_discovered: string[]
        }
        Insert: {
          campaign_id: string
          id?: string
          location_id: string
          map_id: string
          player_discovered?: string[]
        }
        Update: {
          campaign_id?: string
          id?: string
          location_id?: string
          map_id?: string
          player_discovered?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "map_pin_states_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "map_pin_states_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
        ]
      }
      map_tokens: {
        Row: {
          campaign_id: string
          character_id: string
          id: string
          map_id: string
          visible: boolean
          x: number
          y: number
        }
        Insert: {
          campaign_id: string
          character_id: string
          id?: string
          map_id: string
          visible?: boolean
          x?: number
          y?: number
        }
        Update: {
          campaign_id?: string
          character_id?: string
          id?: string
          map_id?: string
          visible?: boolean
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
          {
            foreignKeyName: "map_tokens_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
        ]
      }
      maps: {
        Row: {
          campaign_id: string
          grid_size: number | null
          id: string
          image_path: string
          locations: Json
          name: string
          spawn_point: Json | null
        }
        Insert: {
          campaign_id: string
          grid_size?: number | null
          id?: string
          image_path: string
          locations?: Json
          name: string
          spawn_point?: Json | null
        }
        Update: {
          campaign_id?: string
          grid_size?: number | null
          id?: string
          image_path?: string
          locations?: Json
          name?: string
          spawn_point?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "maps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      quests: {
        Row: {
          campaign_id: string
          character_id: string | null
          created_at: string
          description: string | null
          id: string
          objectives: Json
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          character_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          objectives?: Json
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          character_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          objectives?: Json
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
          base_stock: string[]
          campaign_id: string
          category: string
          created_at: string
          id: string
          inventory: Json
          is_custom: boolean
          last_restock_date: string | null
          location_id: string | null
          name: string
          player_access: string[]
          updated_at: string
        }
        Insert: {
          base_stock?: string[]
          campaign_id: string
          category: string
          created_at?: string
          id?: string
          inventory?: Json
          is_custom?: boolean
          last_restock_date?: string | null
          location_id?: string | null
          name: string
          player_access?: string[]
          updated_at?: string
        }
        Update: {
          base_stock?: string[]
          campaign_id?: string
          category?: string
          created_at?: string
          id?: string
          inventory?: Json
          is_custom?: boolean
          last_restock_date?: string | null
          location_id?: string | null
          name?: string
          player_access?: string[]
          updated_at?: string
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
      user_map_pins: {
        Row: {
          campaign_id: string
          character_id: string | null
          color: string | null
          id: string
          label: string | null
          map_id: string
          user_id: string
          x: number
          y: number
        }
        Insert: {
          campaign_id: string
          character_id?: string | null
          color?: string | null
          id?: string
          label?: string | null
          map_id: string
          user_id: string
          x?: number
          y?: number
        }
        Update: {
          campaign_id?: string
          character_id?: string | null
          color?: string | null
          id?: string
          label?: string | null
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
          {
            foreignKeyName: "user_map_pins_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_map_pins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_campaign_gm: { Args: { campaign_uuid: string }; Returns: boolean }
      is_campaign_member: { Args: { campaign_uuid: string }; Returns: boolean }
      owns_character: { Args: { character_uuid: string }; Returns: boolean }
      user_has_character_in: {
        Args: { character_ids: string[] }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
