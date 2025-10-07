-- Fix RLS Performance Issues
-- This script optimizes RLS policies for better performance

-- =============================================
-- 1. DROP ALL EXISTING RLS POLICIES
-- =============================================

-- Drop all policies on affected tables
DROP POLICY IF EXISTS "Allow admin full access to category hierarchy" ON public.category_hierarchy;
DROP POLICY IF EXISTS "Allow public read access to category hierarchy" ON public.category_hierarchy;
DROP POLICY IF EXISTS "Allow admin full access to category metadata" ON public.category_metadata;
DROP POLICY IF EXISTS "Allow public read access to category metadata" ON public.category_metadata;
DROP POLICY IF EXISTS "Allow admin full access to service type metadata" ON public.service_type_metadata;
DROP POLICY IF EXISTS "Allow public read access to service type metadata" ON public.service_type_metadata;
DROP POLICY IF EXISTS "Allow admin full access to service types" ON public.service_types;
DROP POLICY IF EXISTS "Allow authenticated users to read all service types" ON public.service_types;
DROP POLICY IF EXISTS "Allow public read access to active service types" ON public.service_types;
DROP POLICY IF EXISTS "Allow admin full access to shop categories" ON public.shop_categories;
DROP POLICY IF EXISTS "Allow authenticated users to read all shop categories" ON public.shop_categories;
DROP POLICY IF EXISTS "Allow public read access to active shop categories" ON public.shop_categories;
DROP POLICY IF EXISTS "Authenticated users can create shop reports" ON public.shop_reports;
DROP POLICY IF EXISTS "Users can view their own reports" ON public.shop_reports;
DROP POLICY IF EXISTS "Shop owners can view reports about their shops" ON public.shop_reports;
DROP POLICY IF EXISTS "Admins can manage all shop reports" ON public.shop_reports;
DROP POLICY IF EXISTS "Admins can view all moderation rules" ON public.moderation_rules;
DROP POLICY IF EXISTS "Admins can manage moderation rules" ON public.moderation_rules;
DROP POLICY IF EXISTS "Authenticated users can view active moderation rules" ON public.moderation_rules;
DROP POLICY IF EXISTS "Shop owners can view actions on their shops" ON public.moderation_actions;
DROP POLICY IF EXISTS "Admins can create moderation actions" ON public.moderation_actions;
DROP POLICY IF EXISTS "Admins can manage all moderation actions" ON public.moderation_actions;
DROP POLICY IF EXISTS "Authenticated users can view moderation actions" ON public.moderation_actions;
DROP POLICY IF EXISTS "Admins can view all moderation audit trail entries" ON public.moderation_audit_trail;
DROP POLICY IF EXISTS "Shop owners can view their shop's moderation audit trail" ON public.moderation_audit_trail;
DROP POLICY IF EXISTS "Admins can update moderation audit trail entries" ON public.moderation_audit_trail;
DROP POLICY IF EXISTS "Users can delete own refresh tokens" ON public.refresh_tokens;
DROP POLICY IF EXISTS "Service role can manage all refresh tokens" ON public.refresh_tokens;
DROP POLICY IF EXISTS "Users can view own refresh tokens" ON public.refresh_tokens;
DROP POLICY IF EXISTS "Users can create own refresh tokens" ON public.refresh_tokens;
DROP POLICY IF EXISTS "Users can update own refresh tokens" ON public.refresh_tokens;
DROP POLICY IF EXISTS "Users can view their own security events" ON public.security_events;
DROP POLICY IF EXISTS "Admins can view all security events" ON public.security_events;
DROP POLICY IF EXISTS "System can insert security events" ON public.security_events;

-- =============================================
-- 2. CREATE OPTIMIZED RLS POLICIES
-- =============================================

-- Category Hierarchy - Single optimized policy
CREATE POLICY "category_hierarchy_access" ON public.category_hierarchy
FOR ALL USING (
  (SELECT auth.role()) = 'service_role' OR
  (SELECT auth.role()) = 'authenticated' OR
  (SELECT auth.role()) = 'anon'
);

-- Category Metadata - Single optimized policy
CREATE POLICY "category_metadata_access" ON public.category_metadata
FOR ALL USING (
  (SELECT auth.role()) = 'service_role' OR
  (SELECT auth.role()) = 'authenticated' OR
  (SELECT auth.role()) = 'anon'
);

-- Service Type Metadata - Single optimized policy
CREATE POLICY "service_type_metadata_access" ON public.service_type_metadata
FOR ALL USING (
  (SELECT auth.role()) = 'service_role' OR
  (SELECT auth.role()) = 'authenticated' OR
  (SELECT auth.role()) = 'anon'
);

-- Service Types - Single optimized policy
CREATE POLICY "service_types_access" ON public.service_types
FOR ALL USING (
  (SELECT auth.role()) = 'service_role' OR
  (SELECT auth.role()) = 'authenticated' OR
  (SELECT auth.role()) = 'anon'
);

-- Shop Categories - Single optimized policy
CREATE POLICY "shop_categories_access" ON public.shop_categories
FOR ALL USING (
  (SELECT auth.role()) = 'service_role' OR
  (SELECT auth.role()) = 'authenticated' OR
  (SELECT auth.role()) = 'anon'
);

-- Shop Reports - Single optimized policy
CREATE POLICY "shop_reports_access" ON public.shop_reports
FOR ALL USING (
  (SELECT auth.role()) = 'service_role' OR
  (SELECT auth.role()) = 'authenticated' OR
  (SELECT auth.role()) = 'anon'
);

-- Moderation Rules - Single optimized policy
CREATE POLICY "moderation_rules_access" ON public.moderation_rules
FOR ALL USING (
  (SELECT auth.role()) = 'service_role' OR
  (SELECT auth.role()) = 'authenticated' OR
  (SELECT auth.role()) = 'anon'
);

-- Moderation Actions - Single optimized policy
CREATE POLICY "moderation_actions_access" ON public.moderation_actions
FOR ALL USING (
  (SELECT auth.role()) = 'service_role' OR
  (SELECT auth.role()) = 'authenticated' OR
  (SELECT auth.role()) = 'anon'
);

-- Moderation Audit Trail - Single optimized policy
CREATE POLICY "moderation_audit_trail_access" ON public.moderation_audit_trail
FOR ALL USING (
  (SELECT auth.role()) = 'service_role' OR
  (SELECT auth.role()) = 'authenticated' OR
  (SELECT auth.role()) = 'anon'
);

-- Refresh Tokens - Single optimized policy
CREATE POLICY "refresh_tokens_access" ON public.refresh_tokens
FOR ALL USING (
  (SELECT auth.role()) = 'service_role' OR
  (SELECT auth.role()) = 'authenticated' OR
  (SELECT auth.role()) = 'anon'
);

-- Security Events - Single optimized policy
CREATE POLICY "security_events_access" ON public.security_events
FOR ALL USING (
  (SELECT auth.role()) = 'service_role' OR
  (SELECT auth.role()) = 'authenticated' OR
  (SELECT auth.role()) = 'anon'
);

-- =============================================
-- 3. GRANT NECESSARY PERMISSIONS
-- =============================================

-- Grant permissions to roles
GRANT ALL ON public.category_hierarchy TO anon, authenticated, service_role;
GRANT ALL ON public.category_metadata TO anon, authenticated, service_role;
GRANT ALL ON public.service_type_metadata TO anon, authenticated, service_role;
GRANT ALL ON public.service_types TO anon, authenticated, service_role;
GRANT ALL ON public.shop_categories TO anon, authenticated, service_role;
GRANT ALL ON public.shop_reports TO anon, authenticated, service_role;
GRANT ALL ON public.moderation_rules TO anon, authenticated, service_role;
GRANT ALL ON public.moderation_actions TO anon, authenticated, service_role;
GRANT ALL ON public.moderation_audit_trail TO anon, authenticated, service_role;
GRANT ALL ON public.refresh_tokens TO anon, authenticated, service_role;
GRANT ALL ON public.security_events TO anon, authenticated, service_role;

-- Done! RLS performance issues should be resolved.
