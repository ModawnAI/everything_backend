-- Create shop owner test account and assign to existing shop

-- First, create the user account (using Supabase auth)
-- Note: Password will be 'Test1234!'
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  role
) VALUES (
  '10000000-0000-0000-0000-000000000001'::uuid,
  'shopowner@test.com',
  '$2a$10$XQKzBqLqL5YZqY3.qv3C6.HqkP1xJxqW7rP8lQZ7dYZqN7fL3vZWS', -- bcrypt hash of 'Test1234!'
  NOW(),
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  '{"name": "테스트 샵 오너"}'::jsonb,
  false,
  'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- Create user profile in users table
INSERT INTO public.users (
  id,
  email,
  name,
  phone_number,
  gender,
  birth_date,
  user_status,
  user_role,
  is_influencer,
  referral_code,
  total_points,
  available_points,
  total_referrals,
  social_provider,
  terms_accepted_at,
  privacy_accepted_at,
  marketing_consent,
  created_at
) VALUES (
  '10000000-0000-0000-0000-000000000001'::uuid,
  'shopowner@test.com',
  '테스트 샵 오너',
  '010-9999-9999',
  'male',
  '1990-01-01',
  'active',
  'shop_owner',
  false,
  'TESTSHOP',
  0,
  0,
  0,
  'email',
  NOW(),
  NOW(),
  true,
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  user_role = 'shop_owner';

-- Update the first shop to be owned by this test account
UPDATE public.shops
SET owner_id = '10000000-0000-0000-0000-000000000001'::uuid
WHERE id = '00000000-0000-0000-0000-000000000101';

-- Verify the changes
SELECT
  u.id,
  u.email,
  u.name,
  u.user_role,
  s.id as shop_id,
  s.name as shop_name,
  s.shop_status
FROM public.users u
LEFT JOIN public.shops s ON s.owner_id = u.id
WHERE u.email = 'shopowner@test.com';
