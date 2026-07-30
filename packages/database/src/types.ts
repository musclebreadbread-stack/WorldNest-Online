/**
 * Database type definitions for Supabase.
 * Aligned with the actual SQL migration (001_initial_schema.sql).
 * These will be auto-generated from the Supabase schema in production.
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar: string;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          avatar?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          avatar?: string;
          created_at?: string;
        };
      };
      player_state: {
        Row: {
          player_id: string;
          x: number;
          y: number;
          chunk: string;
          last_online: string;
          inventory: Record<string, unknown>;
        };
        Insert: {
          player_id: string;
          x?: number;
          y?: number;
          chunk?: string;
          last_online?: string;
          inventory?: Record<string, unknown>;
        };
        Update: {
          player_id?: string;
          x?: number;
          y?: number;
          chunk?: string;
          last_online?: string;
          inventory?: Record<string, unknown>;
        };
      };
      worlds: {
        Row: {
          id: string;
          name: string;
          seed: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          seed: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          seed?: number;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
