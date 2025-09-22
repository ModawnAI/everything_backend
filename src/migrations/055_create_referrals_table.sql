-- Create Referrals Table Migration
-- Creates the base referrals table that tracks referral relationships and rewards

-- Create referral_status enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_status') THEN
        CREATE TYPE referral_status AS ENUM ('pending', 'completed', 'cancelled', 'expired');
    END IF;
END $$;

-- Create referrals table for tracking referral relationships and rewards
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    referral_code VARCHAR(20) NOT NULL,
    status referral_status NOT NULL DEFAULT 'pending',
    bonus_paid BOOLEAN NOT NULL DEFAULT false,
    bonus_amount INTEGER NOT NULL DEFAULT 0,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Ensure one referral per referred user
    UNIQUE(referred_id),
    
    -- Ensure referrer and referred are different users
    CHECK (referrer_id != referred_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals (referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON public.referrals (referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals (status);
CREATE INDEX IF NOT EXISTS idx_referrals_bonus_paid ON public.referrals (bonus_paid);
CREATE INDEX IF NOT EXISTS idx_referrals_created_at ON public.referrals (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_referral_code ON public.referrals (referral_code);

-- Add comments for documentation
COMMENT ON TABLE public.referrals IS 'Tracks referral relationships between users and their reward status';
COMMENT ON COLUMN public.referrals.referrer_id IS 'User who made the referral';
COMMENT ON COLUMN public.referrals.referred_id IS 'User who was referred';
COMMENT ON COLUMN public.referrals.referral_code IS 'Code used for the referral';
COMMENT ON COLUMN public.referrals.status IS 'Current status of the referral';
COMMENT ON COLUMN public.referrals.bonus_paid IS 'Whether the referral bonus has been paid';
COMMENT ON COLUMN public.referrals.bonus_amount IS 'Amount of bonus points earned from this referral';
COMMENT ON COLUMN public.referrals.payment_id IS 'Payment that triggered the referral completion';
