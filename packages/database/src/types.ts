/**
 * Database type definitions for Supabase.
 * These will be auto-generated from the Supabase schema in production.
 */
export interface Database {
  public: {
    Tables: {
      players: {
        Row: {
          id: string;
          name: string;
          avatar: string;
          level: number;
          position_x: number;
          position_y: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          avatar?: string;
          level?: number;
          position_x?: number;
          position_y?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          avatar?: string;
          level?: number;
          position_x?: number;
          position_y?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      worlds: {
        Row: {
          id: string;
          seed: number;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          seed: number;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          seed?: number;
          name?: string;
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
