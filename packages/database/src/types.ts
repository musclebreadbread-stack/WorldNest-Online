/**
 * Database type definitions for Supabase.
 * Aligned with the actual SQL migrations (001_initial_schema.sql and
 * 002_gameplay_schema.sql).
 * These will be auto-generated from the Supabase schema in production.
 *
 * `Relationships` is required by postgrest-js for a table to be recognised as
 * writable; it stays empty because nothing here traverses foreign keys in a
 * `select()`.
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Inserts<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

/**
 * Uniform result shape for every data-access helper.
 * Supabase errors are converted to plain `Error`s so callers never have to
 * import Supabase types, and nothing in this layer throws on a failed query.
 */
export interface DbResult<T> {
  data: T;
  error: Error | null;
}
