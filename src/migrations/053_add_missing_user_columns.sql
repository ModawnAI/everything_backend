-- Add missing columns to users table for influencer qualification system
-- This migration adds columns that are expected by the influencer qualification service

-- Ensure users table exists
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing last_qualification_check column
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_qualification_check TIMESTAMPTZ;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_last_qualification_check 
ON public.users(last_qualification_check);

-- Add comment for documentation
COMMENT ON COLUMN public.users.last_qualification_check IS 'Timestamp of last influencer qualification check for automated promotion system';

-- Update existing users to have a default qualification check date
UPDATE public.users 
SET last_qualification_check = created_at 
WHERE last_qualification_check IS NULL;

