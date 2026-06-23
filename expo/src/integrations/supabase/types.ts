/* eslint-disable */
// AUTO-GENERATED — DO NOT EDIT
// Run migrations to regenerate.

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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      drivers: {
        Row: {
          id: string
          name: string
          number: number | null
          team_id: string | null
        }
        Insert: {
          id?: string
          name: string
          number?: number | null
          team_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          number?: number | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      league_members: {
        Row: {
          id: string
          joined_at: string | null
          league_id: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          joined_at?: string | null
          league_id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          joined_at?: string | null
          league_id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "league_members_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "league_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          join_code: string | null
          name: string
          owner_id: string | null
          visibility: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          join_code?: string | null
          name: string
          owner_id?: string | null
          visibility?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          join_code?: string | null
          name?: string
          owner_id?: string | null
          visibility?: string | null
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          id: string
          race_id: string
          recipient_count: number | null
          sent_at: string | null
        }
        Insert: {
          id?: string
          race_id: string
          recipient_count?: number | null
          sent_at?: string | null
        }
        Update: {
          id?: string
          race_id?: string
          recipient_count?: number | null
          sent_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string
          id: string
          total_points: number
          updated_at: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          id: string
          total_points?: number
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          id?: string
          total_points?: number
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      race_results: {
        Row: {
          classification: Json
          created_at: string | null
          dnf_driver_ids: string[] | null
          dns_driver_ids: string[] | null
          fastest_lap_driver_id: string | null
          id: string
          race_id: string | null
          sprint_classification: Json | null
        }
        Insert: {
          classification?: Json
          created_at?: string | null
          dnf_driver_ids?: string[] | null
          dns_driver_ids?: string[] | null
          fastest_lap_driver_id?: string | null
          id?: string
          race_id?: string | null
          sprint_classification?: Json | null
        }
        Update: {
          classification?: Json
          created_at?: string | null
          dnf_driver_ids?: string[] | null
          dns_driver_ids?: string[] | null
          fastest_lap_driver_id?: string | null
          id?: string
          race_id?: string | null
          sprint_classification?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "race_results_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: true
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
      races: {
        Row: {
          country: string
          country_flag: string | null
          current_lap: number | null
          has_sprint: boolean | null
          id: string
          location: string
          name: string
          race_date: string
          race_time: string | null
          round: number
          status: string | null
          total_laps: number | null
          winner: string | null
        }
        Insert: {
          country: string
          country_flag?: string | null
          current_lap?: number | null
          has_sprint?: boolean | null
          id: string
          location: string
          name: string
          race_date: string
          race_time?: string | null
          round: number
          status?: string | null
          total_laps?: number | null
          winner?: string | null
        }
        Update: {
          country?: string
          country_flag?: string | null
          current_lap?: number | null
          has_sprint?: boolean | null
          id?: string
          location?: string
          name?: string
          race_date?: string
          race_time?: string | null
          round?: number
          status?: string | null
          total_laps?: number | null
          winner?: string | null
        }
        Relationships: []
      }
      teams: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          current_value: number | null
          unlocked_at: Json | null
          unlocked_tiers: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          achievement_id: string
          current_value?: number | null
          unlocked_at?: Json | null
          unlocked_tiers?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          achievement_id?: string
          current_value?: number | null
          unlocked_at?: Json | null
          unlocked_tiers?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_predictions: {
        Row: {
          created_at: string
          display_name: string
          id: string
          points_earned: number
          predicted_dnf: string | null
          predicted_fastest_lap: string | null
          predicted_sprint_top8: string[]
          predicted_top10: string[]
          race_id: string
          sprint_points_earned: number
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          points_earned?: number
          predicted_dnf?: string | null
          predicted_fastest_lap?: string | null
          predicted_sprint_top8?: string[]
          predicted_top10?: string[]
          race_id: string
          sprint_points_earned?: number
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          points_earned?: number
          predicted_dnf?: string | null
          predicted_fastest_lap?: string | null
          predicted_sprint_top8?: string[]
          predicted_top10?: string[]
          race_id?: string
          sprint_points_earned?: number
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_predictions_race_id_fkey"
            columns: ["race_id"]
            isOneToOne: false
            referencedRelation: "races"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_stale_accounts: {
        Args: never
        Returns: {
          deleted_user_id: string
          reason: string
        }[]
      }
      save_user_prediction: {
        Args: {
          p_display_name?: string
          p_points_earned?: number
          p_predicted_dnf?: string
          p_predicted_fastest_lap?: string
          p_predicted_sprint_top8?: string[]
          p_predicted_top10: string[]
          p_race_id: string
          p_sprint_points_earned?: number
          p_username?: string
        }
        Returns: {
          created_at: string
          display_name: string
          id: string
          points_earned: number
          predicted_dnf: string | null
          predicted_fastest_lap: string | null
          predicted_sprint_top8: string[]
          predicted_top10: string[]
          race_id: string
          sprint_points_earned: number
          updated_at: string
          user_id: string
          username: string
        }
        SetofOptions: {
          from: "*"
          to: "user_predictions"
          isOneToOne: true
          isSetofReturn: false
        }
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
