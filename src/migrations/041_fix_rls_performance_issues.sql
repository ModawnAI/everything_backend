-- Migration: Fix RLS Performance Issues
-- Date: 2024-12-23
-- Description: Optimize RLS policies for better performance by:
-- 1. Replacing auth.uid() with (select auth.uid()) in refresh_tokens policies
-- 2. Replacing auth.role() with (select auth.role()) in refresh_tokens policies  
-- 3. Consolidating multiple permissive policies to reduce evaluation overhead

-- =============================================
-- 1. FIX AUTH RLS INITIALIZATION PLAN ISSUES
-- =============================================

-- Drop existing refresh_tokens policies
DROP POLICY IF EXISTS "Users can view own refresh tokens" ON refresh_tokens;
DROP POLICY IF EXISTS "Users can create own refresh tokens" ON refresh_tokens;
DROP POLICY IF EXISTS "Users can update own refresh tokens" ON refresh_tokens;
DROP POLICY IF EXISTS "Users can delete own refresh tokens" ON refresh_tokens;
DROP POLICY IF EXISTS "Service role can manage all refresh tokens" ON refresh_tokens;

-- Recreate optimized policies with (select auth.uid()) pattern
CREATE POLICY "Users can view own refresh tokens" ON refresh_tokens
    FOR SELECT USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own refresh tokens" ON refresh_tokens
    FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own refresh tokens" ON refresh_tokens
    FOR UPDATE USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own refresh tokens" ON refresh_tokens
    FOR DELETE USING ((select auth.uid()) = user_id);

CREATE POLICY "Service role can manage all refresh tokens" ON refresh_tokens
    FOR ALL USING ((select auth.role()) = 'service_role');

-- =============================================
-- 2. CONSOLIDATE MULTIPLE PERMISSIVE POLICIES
-- =============================================

-- category_hierarchy table - consolidate read policies
DROP POLICY IF EXISTS "Allow admin full access to category hierarchy" ON category_hierarchy;
DROP POLICY IF EXISTS "Allow public read access to category hierarchy" ON category_hierarchy;

-- Create consolidated policy for all users
CREATE POLICY "Public and admin read access to category hierarchy" ON category_hierarchy
    FOR SELECT USING (true);

-- Create admin management policy
CREATE POLICY "Admins can manage category hierarchy" ON category_hierarchy
    FOR ALL USING ((select auth.role()) = 'service_role');

-- category_metadata table - consolidate read policies  
DROP POLICY IF EXISTS "Allow admin full access to category metadata" ON category_metadata;
DROP POLICY IF EXISTS "Allow public read access to category metadata" ON category_metadata;

-- Create consolidated policy for all users
CREATE POLICY "Public and admin read access to category metadata" ON category_metadata
    FOR SELECT USING (true);

-- Create admin management policy
CREATE POLICY "Admins can manage category metadata" ON category_metadata
    FOR ALL USING ((select auth.role()) = 'service_role');

-- moderation_actions table - consolidate policies
DROP POLICY IF EXISTS "Admins can create moderation actions" ON moderation_actions;
DROP POLICY IF EXISTS "Admins can manage all moderation actions" ON moderation_actions;
DROP POLICY IF EXISTS "Authenticated users can view moderation actions" ON moderation_actions;
DROP POLICY IF EXISTS "Shop owners can view actions on their shops" ON moderation_actions;

-- Create consolidated admin policy for all operations
CREATE POLICY "Admins can manage all moderation actions" ON moderation_actions
    FOR ALL USING ((select auth.role()) = 'service_role');

-- Create consolidated view policy for authenticated users and shop owners
CREATE POLICY "Users can view relevant moderation actions" ON moderation_actions
    FOR SELECT USING (
        (select auth.role()) = 'service_role' OR
        (select auth.uid()) IS NOT NULL OR
        EXISTS (
            SELECT 1 FROM shops s 
            WHERE s.id = moderation_actions.shop_id 
            AND s.owner_id = (select auth.uid())
        )
    );

-- moderation_audit_trail table - consolidate view policies
DROP POLICY IF EXISTS "Admins can view all moderation audit trail entries" ON moderation_audit_trail;
DROP POLICY IF EXISTS "Shop owners can view their shop's moderation audit trail" ON moderation_audit_trail;

-- Create consolidated view policy
CREATE POLICY "Users can view relevant audit trail entries" ON moderation_audit_trail
    FOR SELECT USING (
        (select auth.role()) = 'service_role' OR
        EXISTS (
            SELECT 1 FROM shops s 
            WHERE s.id = moderation_audit_trail.shop_id
            AND s.owner_id = (select auth.uid())
        )
    );

-- moderation_rules table - consolidate view policies
DROP POLICY IF EXISTS "Admins can manage moderation rules" ON moderation_rules;
DROP POLICY IF EXISTS "Admins can view all moderation rules" ON moderation_rules;
DROP POLICY IF EXISTS "Authenticated users can view active moderation rules" ON moderation_rules;

-- Create consolidated admin management policy
CREATE POLICY "Admins can manage moderation rules" ON moderation_rules
    FOR ALL USING ((select auth.role()) = 'service_role');

-- Create consolidated view policy for authenticated users
CREATE POLICY "Authenticated users can view active moderation rules" ON moderation_rules
    FOR SELECT USING (
        (select auth.role()) = 'service_role' OR
        (is_active = true AND (select auth.uid()) IS NOT NULL)
    );

-- security_events table - consolidate policies
DROP POLICY IF EXISTS "Admins can view all security events" ON security_events;
DROP POLICY IF EXISTS "System can insert security events" ON security_events;
DROP POLICY IF EXISTS "Users can view their own security events" ON security_events;

-- Create consolidated admin view policy
CREATE POLICY "Admins can view all security events" ON security_events
    FOR SELECT USING ((select auth.role()) = 'service_role');

-- Create consolidated system insert policy  
CREATE POLICY "System can insert security events" ON security_events
    FOR INSERT WITH CHECK ((select auth.role()) = 'service_role');

-- Create consolidated user view policy
CREATE POLICY "Users can view their own security events" ON security_events
    FOR SELECT USING (
        (select auth.role()) = 'service_role' OR
        user_id = (select auth.uid())
    );

-- service_type_metadata table - consolidate read policies
DROP POLICY IF EXISTS "Allow admin full access to service type metadata" ON service_type_metadata;
DROP POLICY IF EXISTS "Allow public read access to service type metadata" ON service_type_metadata;

-- Create consolidated policy for all users
CREATE POLICY "Public and admin read access to service type metadata" ON service_type_metadata
    FOR SELECT USING (true);

-- Create admin management policy
CREATE POLICY "Admins can manage service type metadata" ON service_type_metadata
    FOR ALL USING ((select auth.role()) = 'service_role');

-- service_types table - consolidate read policies
DROP POLICY IF EXISTS "Allow admin full access to service types" ON service_types;
DROP POLICY IF EXISTS "Allow authenticated users to read all service types" ON service_types;
DROP POLICY IF EXISTS "Allow public read access to active service types" ON service_types;

-- Create consolidated policy for all users with appropriate filtering
CREATE POLICY "Public and user access to service types" ON service_types
    FOR SELECT USING (
        (select auth.role()) = 'service_role' OR
        (is_active = true) OR
        ((select auth.uid()) IS NOT NULL)
    );

-- Create admin management policy
CREATE POLICY "Admins can manage service types" ON service_types
    FOR ALL USING ((select auth.role()) = 'service_role');

-- shop_categories table - consolidate read policies
DROP POLICY IF EXISTS "Allow admin full access to shop categories" ON shop_categories;
DROP POLICY IF EXISTS "Allow authenticated users to read all shop categories" ON shop_categories;
DROP POLICY IF EXISTS "Allow public read access to active shop categories" ON shop_categories;

-- Create consolidated policy for all users with appropriate filtering
CREATE POLICY "Public and user access to shop categories" ON shop_categories
    FOR SELECT USING (
        (select auth.role()) = 'service_role' OR
        (is_active = true) OR
        ((select auth.uid()) IS NOT NULL)
    );

-- Create admin management policy
CREATE POLICY "Admins can manage shop categories" ON shop_categories
    FOR ALL USING ((select auth.role()) = 'service_role');

-- shop_reports table - consolidate policies
DROP POLICY IF EXISTS "Admins can manage all shop reports" ON shop_reports;
DROP POLICY IF EXISTS "Authenticated users can create shop reports" ON shop_reports;
DROP POLICY IF EXISTS "Shop owners can view reports about their shops" ON shop_reports;
DROP POLICY IF EXISTS "Users can view their own reports" ON shop_reports;

-- Create consolidated admin management policy
CREATE POLICY "Admins can manage all shop reports" ON shop_reports
    FOR ALL USING ((select auth.role()) = 'service_role');

-- Create consolidated create policy for authenticated users
CREATE POLICY "Authenticated users can create shop reports" ON shop_reports
    FOR INSERT WITH CHECK ((select auth.uid()) = reporter_id);

-- Create consolidated view policy
CREATE POLICY "Users can view relevant shop reports" ON shop_reports
    FOR SELECT USING (
        (select auth.role()) = 'service_role' OR
        reporter_id = (select auth.uid()) OR
        EXISTS (
            SELECT 1 FROM shops s 
            WHERE s.id = shop_reports.shop_id 
            AND s.owner_id = (select auth.uid())
        )
    );

-- =============================================
-- 3. ADD COMMENTS FOR CLARITY
-- =============================================

COMMENT ON POLICY "Users can view own refresh tokens" ON refresh_tokens IS 'Optimized policy using (select auth.uid()) for better performance';
COMMENT ON POLICY "Users can create own refresh tokens" ON refresh_tokens IS 'Optimized policy using (select auth.uid()) for better performance';
COMMENT ON POLICY "Users can update own refresh tokens" ON refresh_tokens IS 'Optimized policy using (select auth.uid()) for better performance';
COMMENT ON POLICY "Users can delete own refresh tokens" ON refresh_tokens IS 'Optimized policy using (select auth.uid()) for better performance';
COMMENT ON POLICY "Service role can manage all refresh tokens" ON refresh_tokens IS 'Optimized policy using (select auth.role()) for better performance';

COMMENT ON POLICY "Public and admin read access to category hierarchy" ON category_hierarchy IS 'Consolidated policy to eliminate multiple permissive policies';
COMMENT ON POLICY "Public and admin read access to category metadata" ON category_metadata IS 'Consolidated policy to eliminate multiple permissive policies';
COMMENT ON POLICY "Users can view relevant moderation actions" ON moderation_actions IS 'Consolidated policy combining service_role and user access patterns';
COMMENT ON POLICY "Users can view relevant audit trail entries" ON moderation_audit_trail IS 'Consolidated policy combining service_role and shop owner access patterns';
COMMENT ON POLICY "Authenticated users can view active moderation rules" ON moderation_rules IS 'Consolidated policy for public access to active rules';
COMMENT ON POLICY "Users can view their own security events" ON security_events IS 'Consolidated policy combining service_role and user access patterns';
COMMENT ON POLICY "Public and admin read access to service type metadata" ON service_type_metadata IS 'Consolidated policy to eliminate multiple permissive policies';
COMMENT ON POLICY "Public and user access to service types" ON service_types IS 'Consolidated policy with appropriate access filtering';
COMMENT ON POLICY "Public and user access to shop categories" ON shop_categories IS 'Consolidated policy with appropriate access filtering';
COMMENT ON POLICY "Users can view relevant shop reports" ON shop_reports IS 'Consolidated policy combining service_role and user access patterns';
