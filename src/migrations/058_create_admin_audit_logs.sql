-- Admin Audit Logs Migration
-- Creates comprehensive audit logging for admin financial management actions

-- Create admin_audit_logs table for tracking all admin actions
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    request_id VARCHAR(255),
    affected_user_id UUID REFERENCES public.users(id),
    affected_shop_id UUID REFERENCES public.shops(id),
    affected_resource_type VARCHAR(50),
    affected_resource_id UUID,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for admin audit logs
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON public.admin_audit_logs (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_affected_user ON public.admin_audit_logs (affected_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_affected_shop ON public.admin_audit_logs (affected_shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_resource ON public.admin_audit_logs (affected_resource_type, affected_resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_success ON public.admin_audit_logs (success, created_at DESC);

-- Create admin_financial_reports table for storing generated reports
CREATE TABLE IF NOT EXISTS public.admin_financial_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL,
    report_name VARCHAR(255) NOT NULL,
    report_parameters JSONB NOT NULL DEFAULT '{}',
    report_data JSONB,
    file_path TEXT,
    file_size INTEGER,
    file_format VARCHAR(20) DEFAULT 'json',
    generation_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (generation_status IN ('pending', 'generating', 'completed', 'failed')),
    generation_started_at TIMESTAMPTZ,
    generation_completed_at TIMESTAMPTZ,
    generation_time_ms INTEGER,
    error_message TEXT,
    download_count INTEGER NOT NULL DEFAULT 0,
    last_downloaded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for financial reports
CREATE INDEX IF NOT EXISTS idx_admin_financial_reports_admin_id ON public.admin_financial_reports (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_financial_reports_type ON public.admin_financial_reports (report_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_financial_reports_status ON public.admin_financial_reports (generation_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_financial_reports_expires ON public.admin_financial_reports (expires_at ASC);

-- Create admin_point_adjustments table for tracking manual point adjustments
CREATE TABLE IF NOT EXISTS public.admin_point_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('add', 'subtract', 'expire')),
    amount INTEGER NOT NULL CHECK (amount > 0),
    reason TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    notes TEXT,
    previous_balance INTEGER NOT NULL,
    new_balance INTEGER NOT NULL,
    point_transaction_id UUID REFERENCES public.point_transactions(id),
    approval_status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    requires_approval BOOLEAN NOT NULL DEFAULT false,
    approval_level INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for point adjustments
CREATE INDEX IF NOT EXISTS idx_admin_point_adjustments_admin_id ON public.admin_point_adjustments (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_point_adjustments_user_id ON public.admin_point_adjustments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_point_adjustments_status ON public.admin_point_adjustments (approval_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_point_adjustments_type ON public.admin_point_adjustments (adjustment_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_point_adjustments_category ON public.admin_point_adjustments (category, created_at DESC);

-- Create shop_payouts table for tracking shop payout calculations and processing
CREATE TABLE IF NOT EXISTS public.shop_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    period_start_date DATE NOT NULL,
    period_end_date DATE NOT NULL,
    gross_revenue INTEGER NOT NULL DEFAULT 0,
    total_transactions INTEGER NOT NULL DEFAULT 0,
    platform_commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0500,
    platform_commission_amount INTEGER NOT NULL DEFAULT 0,
    payment_processing_fee INTEGER NOT NULL DEFAULT 0,
    other_fees INTEGER NOT NULL DEFAULT 0,
    total_deductions INTEGER NOT NULL DEFAULT 0,
    refund_amount INTEGER NOT NULL DEFAULT 0,
    refund_count INTEGER NOT NULL DEFAULT 0,
    net_payout_amount INTEGER NOT NULL DEFAULT 0,
    payout_status VARCHAR(20) NOT NULL DEFAULT 'calculated' CHECK (payout_status IN ('calculated', 'pending', 'processing', 'completed', 'failed', 'cancelled')),
    payout_method VARCHAR(50) DEFAULT 'bank_transfer',
    payout_account_info JSONB,
    payout_reference VARCHAR(255),
    payout_processed_at TIMESTAMPTZ,
    payout_completed_at TIMESTAMPTZ,
    payout_failure_reason TEXT,
    calculation_details JSONB NOT NULL DEFAULT '{}',
    breakdown_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for shop payouts
CREATE INDEX IF NOT EXISTS idx_shop_payouts_shop_id ON public.shop_payouts (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_payouts_admin_id ON public.shop_payouts (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_payouts_status ON public.shop_payouts (payout_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_payouts_period ON public.shop_payouts (period_start_date, period_end_date);
CREATE INDEX IF NOT EXISTS idx_shop_payouts_processed ON public.shop_payouts (payout_processed_at DESC);

-- Create function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS trigger_admin_financial_reports_updated_at ON public.admin_financial_reports;
CREATE TRIGGER trigger_admin_financial_reports_updated_at
    BEFORE UPDATE ON public.admin_financial_reports
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_admin_point_adjustments_updated_at ON public.admin_point_adjustments;
CREATE TRIGGER trigger_admin_point_adjustments_updated_at
    BEFORE UPDATE ON public.admin_point_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_shop_payouts_updated_at ON public.shop_payouts;
CREATE TRIGGER trigger_shop_payouts_updated_at
    BEFORE UPDATE ON public.shop_payouts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get admin action statistics
CREATE OR REPLACE FUNCTION public.get_admin_action_statistics(
    p_admin_id UUID DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    action VARCHAR(100),
    action_count BIGINT,
    success_count BIGINT,
    failure_count BIGINT,
    success_rate DECIMAL(5,2),
    avg_processing_time_ms DECIMAL(10,2),
    last_performed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        aal.action,
        COUNT(*) as action_count,
        COUNT(*) FILTER (WHERE aal.success = true) as success_count,
        COUNT(*) FILTER (WHERE aal.success = false) as failure_count,
        ROUND(
            (COUNT(*) FILTER (WHERE aal.success = true)::DECIMAL / COUNT(*)) * 100, 
            2
        ) as success_rate,
        ROUND(AVG(aal.processing_time_ms), 2) as avg_processing_time_ms,
        MAX(aal.created_at) as last_performed_at
    FROM public.admin_audit_logs aal
    WHERE 
        (p_admin_id IS NULL OR aal.admin_id = p_admin_id)
        AND (p_start_date IS NULL OR aal.created_at >= p_start_date)
        AND (p_end_date IS NULL OR aal.created_at <= p_end_date)
    GROUP BY aal.action
    ORDER BY action_count DESC;
END;
$$;

-- Create function to get financial summary for admin dashboard
CREATE OR REPLACE FUNCTION public.get_admin_financial_summary(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_shop_id UUID DEFAULT NULL
)
RETURNS TABLE (
    total_revenue BIGINT,
    total_transactions BIGINT,
    total_refunds BIGINT,
    total_refund_amount BIGINT,
    total_points_issued BIGINT,
    total_points_used BIGINT,
    total_commission_earned BIGINT,
    active_shops BIGINT,
    active_users BIGINT,
    avg_transaction_value DECIMAL(10,2),
    refund_rate DECIMAL(5,2),
    point_redemption_rate DECIMAL(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_start_date DATE := COALESCE(p_start_date, CURRENT_DATE - INTERVAL '30 days');
    v_end_date DATE := COALESCE(p_end_date, CURRENT_DATE);
BEGIN
    RETURN QUERY
    WITH payment_stats AS (
        SELECT 
            COUNT(*) as transaction_count,
            SUM(p.amount) as revenue_sum,
            AVG(p.amount) as avg_amount
        FROM public.payments p
        JOIN public.reservations r ON p.reservation_id = r.id
        WHERE 
            p.created_at::DATE BETWEEN v_start_date AND v_end_date
            AND p.payment_status IN ('deposit_paid', 'final_payment_paid', 'fully_paid')
            AND (p_shop_id IS NULL OR r.shop_id = p_shop_id)
    ),
    refund_stats AS (
        SELECT 
            COUNT(*) as refund_count,
            SUM(rf.refunded_amount) as refund_sum
        FROM public.refunds rf
        JOIN public.reservations r ON rf.reservation_id = r.id
        WHERE 
            rf.created_at::DATE BETWEEN v_start_date AND v_end_date
            AND rf.refund_status = 'completed'
            AND (p_shop_id IS NULL OR r.shop_id = p_shop_id)
    ),
    point_stats AS (
        SELECT 
            SUM(CASE WHEN pt.amount > 0 THEN pt.amount ELSE 0 END) as points_issued,
            SUM(CASE WHEN pt.amount < 0 THEN ABS(pt.amount) ELSE 0 END) as points_used
        FROM public.point_transactions pt
        WHERE 
            pt.created_at::DATE BETWEEN v_start_date AND v_end_date
    ),
    shop_user_stats AS (
        SELECT 
            COUNT(DISTINCT r.shop_id) as shop_count,
            COUNT(DISTINCT r.user_id) as user_count
        FROM public.reservations r
        WHERE 
            r.created_at::DATE BETWEEN v_start_date AND v_end_date
            AND (p_shop_id IS NULL OR r.shop_id = p_shop_id)
    )
    SELECT 
        COALESCE(ps.revenue_sum, 0) as total_revenue,
        COALESCE(ps.transaction_count, 0) as total_transactions,
        COALESCE(rs.refund_count, 0) as total_refunds,
        COALESCE(rs.refund_sum, 0) as total_refund_amount,
        COALESCE(pts.points_issued, 0) as total_points_issued,
        COALESCE(pts.points_used, 0) as total_points_used,
        COALESCE(ps.revenue_sum * 0.05, 0)::BIGINT as total_commission_earned,
        COALESCE(sus.shop_count, 0) as active_shops,
        COALESCE(sus.user_count, 0) as active_users,
        COALESCE(ps.avg_amount, 0) as avg_transaction_value,
        CASE 
            WHEN COALESCE(ps.transaction_count, 0) > 0 
            THEN ROUND((COALESCE(rs.refund_count, 0)::DECIMAL / ps.transaction_count) * 100, 2)
            ELSE 0
        END as refund_rate,
        CASE 
            WHEN COALESCE(pts.points_issued, 0) > 0 
            THEN ROUND((COALESCE(pts.points_used, 0)::DECIMAL / pts.points_issued) * 100, 2)
            ELSE 0
        END as point_redemption_rate
    FROM payment_stats ps
    CROSS JOIN refund_stats rs
    CROSS JOIN point_stats pts
    CROSS JOIN shop_user_stats sus;
END;
$$;

-- Create function to cleanup old audit logs (for maintenance)
CREATE OR REPLACE FUNCTION public.cleanup_old_admin_audit_logs(
    p_retention_days INTEGER DEFAULT 365
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted_count INTEGER;
    v_cutoff_date TIMESTAMPTZ;
BEGIN
    v_cutoff_date := NOW() - (p_retention_days || ' days')::INTERVAL;
    
    DELETE FROM public.admin_audit_logs
    WHERE created_at < v_cutoff_date;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$;

-- Add comments for documentation
COMMENT ON TABLE public.admin_audit_logs IS 'Comprehensive audit trail for all admin financial management actions';
COMMENT ON TABLE public.admin_financial_reports IS 'Storage for generated financial reports with metadata';
COMMENT ON TABLE public.admin_point_adjustments IS 'Manual point adjustments performed by administrators';
COMMENT ON TABLE public.shop_payouts IS 'Shop payout calculations and processing records';

COMMENT ON FUNCTION public.get_admin_action_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS 'Get statistics about admin actions for monitoring and reporting';
COMMENT ON FUNCTION public.get_admin_financial_summary(DATE, DATE, UUID) IS 'Get comprehensive financial summary for admin dashboard';
COMMENT ON FUNCTION public.cleanup_old_admin_audit_logs(INTEGER) IS 'Clean up old audit logs to maintain database performance';

-- Create initial admin roles and permissions (if not exists)
DO $$
BEGIN
    -- Add admin-specific columns to users table if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' 
                   AND column_name = 'admin_permissions' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.users ADD COLUMN admin_permissions JSONB DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' 
                   AND column_name = 'last_admin_login' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.users ADD COLUMN last_admin_login TIMESTAMPTZ;
    END IF;
END $$;
