-- =============================================
-- SHOP OWNER REFUND ACCESS POLICIES
-- =============================================
-- Implements RLS policies to allow shop owners to:
-- 1. View refunds for their own shops only
-- 2. Process refunds for payments related to their shops
-- Project: ysrudwzwnzxrrwjtpuoh
-- =============================================

-- =============================================
-- REFUNDS TABLE RLS POLICIES
-- =============================================

-- Enable RLS on refunds table if not already enabled
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all refunds" ON public.refunds;
DROP POLICY IF EXISTS "Shop owners can view their shop refunds" ON public.refunds;
DROP POLICY IF EXISTS "Admins can manage all refunds" ON public.refunds;
DROP POLICY IF EXISTS "Shop owners can manage their shop refunds" ON public.refunds;

-- Policy 1: Admins can view all refunds
CREATE POLICY "Admins can view all refunds" ON public.refunds
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND user_role = 'admin'
        )
    );

-- Policy 2: Shop owners can view refunds for their own shops
CREATE POLICY "Shop owners can view their shop refunds" ON public.refunds
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users u
            INNER JOIN public.reservations r ON r.id = refunds.reservation_id
            INNER JOIN public.shops s ON s.id = r.shop_id
            WHERE u.id = auth.uid()
            AND u.user_role = 'shop_owner'
            AND s.owner_id = u.id
        )
    );

-- Policy 3: Admins can manage (insert/update/delete) all refunds
CREATE POLICY "Admins can manage all refunds" ON public.refunds
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND user_role = 'admin'
        )
    );

-- Policy 4: Shop owners can manage refunds for their own shops
CREATE POLICY "Shop owners can manage their shop refunds" ON public.refunds
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users u
            INNER JOIN public.reservations r ON r.id = refunds.reservation_id
            INNER JOIN public.shops s ON s.id = r.shop_id
            WHERE u.id = auth.uid()
            AND u.user_role = 'shop_owner'
            AND s.owner_id = u.id
        )
    );

-- =============================================
-- PAYMENTS TABLE RLS POLICIES
-- =============================================

-- Enable RLS on payments table if not already enabled
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing shop owner payment policies if they exist
DROP POLICY IF EXISTS "Shop owners can view their shop payments" ON public.payments;
DROP POLICY IF EXISTS "Shop owners can update their shop payments" ON public.payments;

-- Policy 5: Shop owners can view payments for their shops
CREATE POLICY "Shop owners can view their shop payments" ON public.payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users u
            INNER JOIN public.reservations r ON r.id = payments.reservation_id
            INNER JOIN public.shops s ON s.id = r.shop_id
            WHERE u.id = auth.uid()
            AND u.user_role = 'shop_owner'
            AND s.owner_id = u.id
        )
    );

-- Policy 6: Shop owners can update payments for their shops (for refund processing)
CREATE POLICY "Shop owners can update their shop payments" ON public.payments
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users u
            INNER JOIN public.reservations r ON r.id = payments.reservation_id
            INNER JOIN public.shops s ON s.id = r.shop_id
            WHERE u.id = auth.uid()
            AND u.user_role = 'shop_owner'
            AND s.owner_id = u.id
        )
    );

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Add indexes to optimize shop owner refund queries
CREATE INDEX IF NOT EXISTS idx_refunds_reservation_id ON public.refunds(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservations_shop_id ON public.reservations(shop_id);
CREATE INDEX IF NOT EXISTS idx_shops_owner_id ON public.shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_payments_reservation_id ON public.payments(reservation_id);

-- Composite index for shop owner refund lookups
CREATE INDEX IF NOT EXISTS idx_refunds_shop_owner_lookup
    ON public.refunds(reservation_id, refund_status, created_at DESC);

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Run these to verify the policies are working correctly:

-- 1. Check RLS is enabled
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('refunds', 'payments')
ORDER BY tablename;

-- 2. Check policies exist
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('refunds', 'payments')
ORDER BY tablename, policyname;

-- 3. Check indexes
SELECT
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('refunds', 'payments', 'reservations', 'shops')
AND indexname LIKE 'idx_%owner%' OR indexname LIKE 'idx_refunds%'
ORDER BY tablename, indexname;

-- =============================================
-- SUCCESS MESSAGE
-- =============================================
DO $$
BEGIN
    RAISE NOTICE '✓ Shop owner refund access policies applied!';
    RAISE NOTICE '✓ Shop owners can now view refunds for their shops';
    RAISE NOTICE '✓ Shop owners can process refunds for their shop payments';
    RAISE NOTICE '✓ Admins retain full access to all refunds';
    RAISE NOTICE '✓ Performance indexes created';
    RAISE NOTICE '✓ Row Level Security enabled on refunds and payments';
END $$;
