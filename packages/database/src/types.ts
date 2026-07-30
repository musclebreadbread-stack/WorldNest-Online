/**
 * Database type definitions for Supabase.
 * Aligned with the actual SQL migrations (001_initial_schema.sql and
 * 002_gameplay_schema.sql).
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
      world_modifications: {
        Row: {
          world_id: string;
          tile_x: number;
          tile_y: number;
          tile_type: number;
          modified_by: string | null;
          updated_at: string;
        };
        Insert: {
          world_id: string;
          tile_x: number;
          tile_y: number;
          tile_type: number;
          modified_by?: string | null;
          updated_at?: string;
        };
        Update: {
          world_id?: string;
          tile_x?: number;
          tile_y?: number;
          tile_type?: number;
          modified_by?: string | null;
          updated_at?: string;
        };
      };
      structures: {
        Row: {
          id: string;
          world_id: string;
          owner_id: string;
          item_id: string;
          tile_x: number;
          tile_y: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          world_id: string;
          owner_id: string;
          item_id: string;
          tile_x: number;
          tile_y: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          world_id?: string;
          owner_id?: string;
          item_id?: string;
          tile_x?: number;
          tile_y?: number;
          created_at?: string;
        };
      };
      crops: {
        Row: {
          id: string;
          world_id: string;
          owner_id: string;
          item_id: string;
          tile_x: number;
          tile_y: number;
          planted_at_minute: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          world_id: string;
          owner_id: string;
          item_id: string;
          tile_x: number;
          tile_y: number;
          planted_at_minute: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          world_id?: string;
          owner_id?: string;
          item_id?: string;
          tile_x?: number;
          tile_y?: number;
          planted_at_minute?: number;
          created_at?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          world_id: string;
          sender_id: string;
          username: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          world_id: string;
          sender_id: string;
          username: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          world_id?: string;
          sender_id?: string;
          username?: string;
          body?: string;
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
