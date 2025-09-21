-- Create base reservation tables and types
-- This migration creates the foundational tables for the reservation state machine

-- =============================================
-- ENUM TYPES
-- =============================================

-- Create reservation status enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reservation_status') THEN
        CREATE TYPE public.reservation_status AS ENUM (
            'requested',
            'confirmed', 
            'completed',
            'cancelled_by_user',
            'cancelled_by_shop',
            'no_show'
        );
    END IF;
END $$;

-- =============================================
-- BASE TABLES
-- =============================================

-- Create reservations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL, -- Will reference users table when it exists
    shop_id UUID NOT NULL, -- Will reference shops table when it exists
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    reservation_datetime TIMESTAMPTZ,
    status reservation_status DEFAULT 'requested',
    total_amount INTEGER NOT NULL,
    deposit_amount INTEGER NOT NULL,
    remaining_amount INTEGER,
    points_used INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    special_requests TEXT,
    cancellation_reason TEXT,
    no_show_reason TEXT,
    shop_notes TEXT,
    confirmed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Basic constraints
    CONSTRAINT check_deposit_amount CHECK (deposit_amount > 0),
    CONSTRAINT check_total_amount CHECK (total_amount > 0),
    CONSTRAINT check_points_used CHECK (points_used >= 0),
    CONSTRAINT check_points_earned CHECK (points_earned >= 0),
    CONSTRAINT check_remaining_amount CHECK (remaining_amount IS NULL OR remaining_amount >= 0)
);

-- Create reservation status logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.reservation_status_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    from_status reservation_status NOT NULL,
    to_status reservation_status NOT NULL,
    changed_by TEXT NOT NULL CHECK (changed_by IN ('user', 'shop', 'system', 'admin')),
    changed_by_id UUID NOT NULL,
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- BASIC INDEXES
-- =============================================

-- Index for reservation queries
CREATE INDEX IF NOT EXISTS idx_reservations_status 
ON public.reservations(status);

-- Index for reservation datetime queries
CREATE INDEX IF NOT EXISTS idx_reservations_datetime 
ON public.reservations(reservation_datetime);

-- Index for status logs by reservation
CREATE INDEX IF NOT EXISTS idx_reservation_status_logs_reservation_id 
ON public.reservation_status_logs(reservation_id);

-- Index for status logs by timestamp
CREATE INDEX IF NOT EXISTS idx_reservation_status_logs_timestamp 
ON public.reservation_status_logs(timestamp DESC);

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE public.reservations IS 'Core reservations table for the reservation system';
COMMENT ON TABLE public.reservation_status_logs IS 'Audit trail for reservation status changes';
COMMENT ON TYPE public.reservation_status IS 'Enumeration of possible reservation statuses';
