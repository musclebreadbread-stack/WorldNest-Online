/**
 * Database type definitions for Supabase.
 * Aligned with the actual SQL migrations (001_initial_schema.sql,
 * 002_gameplay_schema.sql, 003_progression_schema.sql,
 * 004_authority_schema.sql and 005_world_layer_schema.sql).
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
          coins: number;
        };
        // `coins` is readable but deliberately absent from `Insert` and
        // `Update`: migration 004 revokes both privileges on that column for
        // `authenticated`, so a write naming it is refused by Postgres. Keeping
        // it out of the type turns that runtime refusal into a compile error.
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
      player_quests: {
        Row: {
          player_id: string;
          quest_id: string;
          state: string;
          progress: number;
          baseline: number;
          updated_at: string;
        };
        // `state` follows the same rule as `player_state.coins`: readable, and
        // absent from both write shapes because migration 004 grants every
        // column except this one. An inserted row gets `'active'` from the
        // column default, and only `worldnest_claim_quest_reward` ever writes
        // `'completed'` (decision D3).
        Insert: {
          player_id: string;
          quest_id: string;
          progress?: number;
          baseline?: number;
          updated_at?: string;
        };
        Update: {
          player_id?: string;
          quest_id?: string;
          progress?: number;
          baseline?: number;
          updated_at?: string;
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
          layer: number;
          tile_x: number;
          tile_y: number;
          tile_type: number;
          modified_by: string | null;
          updated_at: string;
        };
        Insert: {
          world_id: string;
          layer?: number;
          tile_x: number;
          tile_y: number;
          tile_type: number;
          modified_by?: string | null;
          updated_at?: string;
        };
        Update: {
          world_id?: string;
          layer?: number;
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
      shop_prices: {
        Row: {
          item_id: string;
          buy: number;
          sell: number;
        };
        Insert: {
          item_id: string;
          buy: number;
          sell: number;
        };
        Update: {
          item_id?: string;
          buy?: number;
          sell?: number;
        };
        Relationships: [];
      };
      quest_rewards: {
        Row: {
          quest_id: string;
          target: number;
          reward_coins: number;
          reward_items: unknown;
        };
        Insert: {
          quest_id: string;
          target: number;
          reward_coins: number;
          reward_items?: unknown;
        };
        Update: {
          quest_id?: string;
          target?: number;
          reward_coins?: number;
          reward_items?: unknown;
        };
        Relationships: [];
      };
      coin_ledger: {
        Row: {
          id: string;
          player_id: string;
          operation_id: string;
          delta: number;
          reason: string;
          ref: string | null;
          balance_after: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          player_id: string;
          operation_id: string;
          delta: number;
          reason: string;
          ref?: string | null;
          balance_after: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          player_id?: string;
          operation_id?: string;
          delta?: number;
          reason?: string;
          ref?: string | null;
          balance_after?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      chat_config: {
        Row: {
          id: boolean;
          rate_limit_per_minute: number;
          max_message_length: number;
        };
        Insert: {
          id?: boolean;
          rate_limit_per_minute?: number;
          max_message_length?: number;
        };
        Update: {
          id?: boolean;
          rate_limit_per_minute?: number;
          max_message_length?: number;
        };
        Relationships: [];
      };
      blocked_words: {
        Row: {
          word: string;
        };
        Insert: {
          word: string;
        };
        Update: {
          word?: string;
        };
        Relationships: [];
      };
      mute_list: {
        Row: {
          muter_id: string;
          muted_id: string;
          created_at: string;
        };
        Insert: {
          muter_id: string;
          muted_id: string;
          created_at?: string;
        };
        Update: {
          muter_id?: string;
          muted_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    /**
     * The two `security definer` functions migration 004 adds. `Returns` is
     * `unknown` because both return raw jsonb and `authority.ts` narrows it
     * defensively — an unexpected shape has to become a refusal, not a cast.
     */
    Functions: {
      worldnest_shop_trade: {
        Args: {
          p_operation_id: string;
          p_kind: string;
          p_item_id: string;
          p_quantity: number;
        };
        Returns: unknown;
      };
      worldnest_claim_quest_reward: {
        Args: { p_quest_id: string; p_progress: number };
        Returns: unknown;
      };
      worldnest_send_chat: {
        Args: { p_world_id: string; p_body: string };
        Returns: unknown;
      };
    };
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
