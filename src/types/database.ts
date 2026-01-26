/**
 * Database Types for niuexa.ai
 *
 * TypeScript type definitions for Supabase database tables.
 * These types match the schema defined in supabase/migrations/00001_initial_schema.sql
 *
 * In production, these types can be auto-generated with:
 * npx supabase gen types typescript --project-id <project-id> > src/types/database.ts
 *
 * For now, these are manually maintained to match the schema.
 */

// =============================================================================
// Table Row Types
// =============================================================================

/**
 * Tenant represents an organization/account using the platform.
 * Each tenant has multiple users (profiles) and owns all their data.
 */
export interface Tenant {
  id: string
  name: string
  created_at: string
  updated_at: string
}

/**
 * Profile represents a user's profile data.
 * Linked to auth.users via id (1:1 relationship).
 * Linked to tenants via tenant_id (many:1 relationship).
 */
export interface Profile {
  id: string
  tenant_id: string
  full_name: string | null
  created_at: string
  updated_at: string
}

// =============================================================================
// Database Schema Type for Supabase Client
// =============================================================================

/**
 * Database schema type following Supabase TypeScript patterns.
 * Use with createClient<Database>() for fully typed Supabase operations.
 *
 * Row: The shape of data returned from SELECT queries
 * Insert: The shape of data for INSERT operations (auto-generated fields optional)
 * Update: The shape of data for UPDATE operations (all fields optional except constraints)
 */
export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: Tenant
        Insert: Omit<Tenant, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Tenant, 'id' | 'created_at' | 'updated_at'>> & {
          updated_at?: string
        }
      }
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'> & {
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Profile, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>> & {
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_tenant_id: {
        Args: Record<string, never>
        Returns: string
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

// =============================================================================
// Helper Types
// =============================================================================

/**
 * Helper type to extract table row types
 */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

/**
 * Helper type for insert operations
 */
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

/**
 * Helper type for update operations
 */
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
