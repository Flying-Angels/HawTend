// Contract for the phase-0 journal snapshot schema. Replace with Supabase-generated types after deployment.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      user_journals: {
        Row: { user_id: string; journal: Json; version: number; last_request_id: string; updated_at: string }
        Insert: { user_id: string; journal: Json; last_request_id: string; version?: number; updated_at?: string }
        Update: { journal?: Json; last_request_id?: string }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      save_journal: {
        Args: { p_journal: Json; p_expected_version: number; p_request_id: string }
        Returns: { status: string; version: number; journal: Json; updated_at: string }[]
      }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
