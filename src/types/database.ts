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

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          tenant_id: string
          full_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          tenant_id: string
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_tenant_id: {
        Args: Record<PropertyKey, never>
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
 * Tenant represents an organization/account using the platform.
 * Each tenant has multiple users (profiles) and owns all their data.
 */
export type Tenant = Database['public']['Tables']['tenants']['Row']

/**
 * Profile represents a user's profile data.
 * Linked to auth.users via id (1:1 relationship).
 * Linked to tenants via tenant_id (many:1 relationship).
 */
export type Profile = Database['public']['Tables']['profiles']['Row']

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
