-- niuexa.ai Initial Schema Migration
-- Phase: 01-foundation-authentication, Plan: 02
-- Purpose: Multi-tenant authentication with Row-Level Security
--
-- This migration creates the foundational tables for multi-tenant isolation:
-- - tenants: Organizations/accounts using the platform
-- - profiles: User profiles linked to auth.users and their tenant
--
-- Run this migration via Supabase Dashboard SQL Editor or Supabase CLI.

-- =============================================================================
-- 1. Enable Required Extensions
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 2. Create Tenants Table
-- =============================================================================

CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS on tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 3. Create Profiles Table
-- =============================================================================

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  full_name text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 4. Create Helper Function for Tenant ID
-- =============================================================================

-- get_tenant_id() retrieves the current user's tenant_id from their profile.
-- Used in RLS policies to filter data by tenant.
-- SECURITY DEFINER allows this function to read profiles table even when
-- the calling user might not have direct access.

CREATE OR REPLACE FUNCTION public.get_tenant_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$;

-- =============================================================================
-- 5. RLS Policies for Tenants
-- =============================================================================

-- Users can only view their own tenant
CREATE POLICY "Users can view their own tenant"
  ON public.tenants FOR SELECT
  USING (id = public.get_tenant_id());

-- =============================================================================
-- 6. RLS Policies for Profiles
-- =============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Users can insert their own profile (needed during signup)
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- =============================================================================
-- 7. Create Indexes for Performance
-- =============================================================================

-- Index on tenant_id for efficient RLS policy evaluation
-- Critical for performance as tenant_id is used in WHERE clauses via RLS
CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);

-- =============================================================================
-- 8. Create Updated At Trigger Function
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 9. Apply Updated At Triggers to Tables
-- =============================================================================

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================================================
-- End of Migration
-- =============================================================================
