-- Add version field for optimistic locking to reservations table
-- This enables concurrent update detection and prevents lost updates

-- Ensure required tables exist (in case base schema wasn't applied)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL,
    user_id UUID NOT NULL,
    amount INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add version column to reservations table
ALTER TABLE public.reservations 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;

-- Create index on version field for performance
CREATE INDEX IF NOT EXISTS idx_reservations_version ON public.reservations(version);

-- Add comment for documentation
COMMENT ON COLUMN public.reservations.version IS 'Version field for optimistic locking. Incremented on each update to detect concurrent modifications.';

-- Update the update_updated_at_column function to also increment version
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Increment version for optimistic locking (only for reservations table)
    IF TG_TABLE_NAME = 'reservations' THEN
        NEW.version = OLD.version + 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger to ensure version is incremented
DROP TRIGGER IF EXISTS update_reservations_updated_at ON public.reservations;
CREATE TRIGGER update_reservations_updated_at 
    BEFORE UPDATE ON public.reservations
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add version field to reservation_services table as well for consistency
ALTER TABLE public.reservation_services 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservation_services_version ON public.reservation_services(version);

COMMENT ON COLUMN public.reservation_services.version IS 'Version field for optimistic locking. Incremented on each update to detect concurrent modifications.';

-- Create trigger for reservation_services version updates
DROP TRIGGER IF EXISTS update_reservation_services_updated_at ON public.reservation_services;
CREATE TRIGGER update_reservation_services_updated_at 
    BEFORE UPDATE ON public.reservation_services
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add version field to payments table for concurrent payment updates
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_version ON public.payments(version);

COMMENT ON COLUMN public.payments.version IS 'Version field for optimistic locking. Incremented on each update to detect concurrent modifications.';

-- Create trigger for payments version updates
DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at 
    BEFORE UPDATE ON public.payments
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
