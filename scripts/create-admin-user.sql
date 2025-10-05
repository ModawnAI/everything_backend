-- =============================================
-- Create Admin User in Supabase
-- =============================================
--
-- Instructions:
-- 1. Go to Supabase Dashboard: https://ysrudwzwnzxrrwjtpuoh.supabase.co
-- 2. Navigate to: Authentication → Users
-- 3. Click "Add user" (via email)
-- 4. Enter:
--    Email: admin@ebeautything.com
--    Password: AdminPassword123!
--    ✅ Auto Confirm Email
-- 5. Copy the generated User ID (UUID)
-- 6. Replace 'PASTE_USER_ID_HERE' below with the actual UUID
-- 7. Go to: SQL Editor
-- 8. Run this script
-- =============================================

-- Insert admin user into users table
INSERT INTO users (
  id,
  email,
  name,
  user_role,
  user_status,
  phone_number,
  gender,
  birth_date,
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
)
VALUES (
  'PASTE_USER_ID_HERE'::uuid, -- Replace with actual UUID from Auth user
  'admin@ebeautything.com',
  '시스템 관리자',
  'admin',
  'active',
  '010-1234-5678',
  'prefer_not_to_say',
  '1990-01-01',
  false,
  'ADMIN001',
  0,
  0,
  0,
  'email',
  NOW(),
  NOW(),
  false,
  NOW()
)
ON CONFLICT (id)
DO UPDATE SET
  user_role = 'admin',
  user_status = 'active',
  name = '시스템 관리자',
  email = 'admin@ebeautything.com';

-- Verify the admin user was created
SELECT
  id,
  email,
  name,
  user_role,
  user_status,
  created_at
FROM users
WHERE email = 'admin@ebeautything.com';
