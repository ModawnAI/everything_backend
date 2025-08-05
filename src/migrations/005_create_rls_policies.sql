-- Migration: 005_create_rls_policies.sql
-- Description: Create Row Level Security policies for all tables
-- Author: Task Master AI
-- Created: 2025-07-28

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- USER DATA POLICIES
-- =============================================

-- Users table - users can only access their own profile
CREATE POLICY users_select_own ON public.users 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY users_update_own ON public.users 
FOR UPDATE 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

CREATE POLICY users_insert_own ON public.users 
FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY admin_users_all ON public.users 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() 
  AND user_role = 'admin'
)) 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() 
  AND user_role = 'admin'
));

-- User Settings - users can only access their own settings
CREATE POLICY user_settings_own ON public.user_settings 
FOR ALL 
USING (user_id = auth.uid()) 
WITH CHECK (user_id = auth.uid());

-- =============================================
-- SHOP DATA POLICIES
-- =============================================

-- Shops table - public read for active shops, owner management
CREATE POLICY shops_public_select ON public.shops 
FOR SELECT 
USING (shop_status = 'active');

CREATE POLICY shops_owner_manage ON public.shops 
FOR ALL 
USING (owner_id = auth.uid()) 
WITH CHECK (owner_id = auth.uid());

CREATE POLICY admin_shops_all ON public.shops 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() 
  AND user_role = 'admin'
)) 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() 
  AND user_role = 'admin'
));

-- Shop Images - public read for active shops, owner management
CREATE POLICY shop_images_public_select ON public.shop_images 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.shops 
  WHERE id = shop_images.shop_id 
  AND shop_status = 'active'
));

CREATE POLICY shop_images_owner_manage ON public.shop_images 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.shops 
  WHERE id = shop_images.shop_id 
  AND owner_id = auth.uid()
)) 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.shops 
  WHERE id = shop_images.shop_id 
  AND owner_id = auth.uid()
));

-- Shop Services - public read for active shops, owner management
CREATE POLICY shop_services_public_select ON public.shop_services 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.shops 
  WHERE id = shop_services.shop_id 
  AND shop_status = 'active'
) AND is_available = true);

CREATE POLICY shop_services_owner_manage ON public.shop_services 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.shops 
  WHERE id = shop_services.shop_id 
  AND owner_id = auth.uid()
)) 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.shops 
  WHERE id = shop_services.shop_id 
  AND owner_id = auth.uid()
));

-- Service Images - public read for available services, owner management
CREATE POLICY service_images_public_select ON public.service_images 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.shop_services ss
  JOIN public.shops s ON s.id = ss.shop_id
  WHERE ss.id = service_images.service_id 
  AND s.shop_status = 'active'
  AND ss.is_available = true
));

CREATE POLICY service_images_owner_manage ON public.service_images 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.shop_services ss
  JOIN public.shops s ON s.id = ss.shop_id
  WHERE ss.id = service_images.service_id 
  AND s.owner_id = auth.uid()
)) 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.shop_services ss
  JOIN public.shops s ON s.id = ss.shop_id
  WHERE ss.id = service_images.service_id 
  AND s.owner_id = auth.uid()
));

-- =============================================
-- RESERVATION & BOOKING POLICIES
-- =============================================

-- Reservations - users see their own, shop owners see their shop's reservations
CREATE POLICY reservations_user_own ON public.reservations 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY reservations_user_create ON public.reservations 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY reservations_user_update_own ON public.reservations 
FOR UPDATE 
USING (user_id = auth.uid() AND status IN ('requested', 'confirmed')) 
WITH CHECK (user_id = auth.uid() AND status IN ('requested', 'confirmed'));

CREATE POLICY reservations_shop_owner_manage ON public.reservations 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.shops 
  WHERE id = reservations.shop_id 
  AND owner_id = auth.uid()
)) 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.shops 
  WHERE id = reservations.shop_id 
  AND owner_id = auth.uid()
));

CREATE POLICY admin_reservations_all ON public.reservations 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() 
  AND user_role = 'admin'
)) 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() 
  AND user_role = 'admin'
));

-- Reservation Services - follows reservation access rules
CREATE POLICY reservation_services_user_select ON public.reservation_services 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.reservations 
  WHERE id = reservation_services.reservation_id 
  AND user_id = auth.uid()
));

CREATE POLICY reservation_services_shop_manage ON public.reservation_services 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.reservations r
  JOIN public.shops s ON s.id = r.shop_id
  WHERE r.id = reservation_services.reservation_id 
  AND s.owner_id = auth.uid()
)) 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.reservations r
  JOIN public.shops s ON s.id = r.shop_id
  WHERE r.id = reservation_services.reservation_id 
  AND s.owner_id = auth.uid()
));

-- =============================================
-- PAYMENT POLICIES
-- =============================================

-- Payments - highly sensitive, strict access control
CREATE POLICY payments_user_own ON public.payments 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY payments_user_create ON public.payments 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY payments_shop_owner_view ON public.payments 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.reservations r
  JOIN public.shops s ON s.id = r.shop_id
  WHERE r.id = payments.reservation_id 
  AND s.owner_id = auth.uid()
));

CREATE POLICY admin_payments_all ON public.payments 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() 
  AND user_role = 'admin'
)) 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() 
  AND user_role = 'admin'
));

-- =============================================
-- POINTS SYSTEM POLICIES
-- =============================================

-- Point Transactions - users see their own transactions
CREATE POLICY point_transactions_user_own ON public.point_transactions 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY point_transactions_system_create ON public.point_transactions 
FOR INSERT 
WITH CHECK (true); -- System-level inserts through service role

CREATE POLICY admin_points_all ON public.point_transactions 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() 
  AND user_role = 'admin'
)) 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() 
  AND user_role = 'admin'
));

-- =============================================
-- USER INTERACTION POLICIES
-- =============================================

-- User Favorites - users manage their own favorites
CREATE POLICY user_favorites_own ON public.user_favorites 
FOR ALL 
USING (user_id = auth.uid()) 
WITH CHECK (user_id = auth.uid());

-- Push Tokens - users manage their own tokens
CREATE POLICY push_tokens_own ON public.push_tokens 
FOR ALL 
USING (user_id = auth.uid()) 
WITH CHECK (user_id = auth.uid());

-- =============================================
-- ADMIN POLICIES
-- =============================================

-- Admin Actions - only admins can create, all can view their related actions
CREATE POLICY admin_actions_admin_create ON public.admin_actions 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() 
  AND user_role = 'admin'
));

CREATE POLICY admin_actions_view_related ON public.admin_actions 
FOR SELECT 
USING (
  admin_id = auth.uid() 
  OR target_id = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND user_role = 'admin'
  )
);

-- Add comments for policy documentation
COMMENT ON POLICY users_select_own ON public.users IS 'Users can view their own profile data';
COMMENT ON POLICY shops_public_select ON public.shops IS 'Public can view active shops';
COMMENT ON POLICY reservations_user_own ON public.reservations IS 'Users can view their own reservations';
COMMENT ON POLICY payments_user_own ON public.payments IS 'Users can view their own payment records';
COMMENT ON POLICY point_transactions_user_own ON public.point_transactions IS 'Users can view their own point transactions';
COMMENT ON POLICY user_favorites_own ON public.user_favorites IS 'Users can manage their own favorites';
COMMENT ON POLICY admin_actions_admin_create ON public.admin_actions IS 'Only admins can create admin action records'; 