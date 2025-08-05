-- Migration: 002_create_enums.sql
-- Description: Create all enum types for the database
-- Author: Task Master AI
-- Created: 2025-07-28

-- User-related enums
CREATE TYPE user_gender AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'deleted');
CREATE TYPE user_role AS ENUM ('user', 'shop_owner', 'admin', 'influencer');
CREATE TYPE social_provider AS ENUM ('kakao', 'apple', 'google', 'email');

-- Shop-related enums
CREATE TYPE shop_status AS ENUM ('active', 'inactive', 'pending_approval', 'suspended', 'deleted');
CREATE TYPE shop_type AS ENUM ('partnered', 'non_partnered');
CREATE TYPE service_category AS ENUM ('nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair');
CREATE TYPE shop_verification_status AS ENUM ('pending', 'verified', 'rejected');

-- Reservation and booking enums
CREATE TYPE reservation_status AS ENUM ('requested', 'confirmed', 'completed', 'cancelled_by_user', 'cancelled_by_shop', 'no_show');

-- Payment-related enums
CREATE TYPE payment_status AS ENUM ('pending', 'deposit_paid', 'fully_paid', 'refunded', 'partially_refunded', 'failed');
CREATE TYPE payment_method AS ENUM ('toss_payments', 'kakao_pay', 'naver_pay', 'card', 'bank_transfer');

-- Points system enums
CREATE TYPE point_transaction_type AS ENUM ('earned_service', 'earned_referral', 'used_service', 'expired', 'adjusted', 'influencer_bonus');
CREATE TYPE point_status AS ENUM ('pending', 'available', 'used', 'expired');

-- Notification enums
CREATE TYPE notification_type AS ENUM ('reservation_confirmed', 'reservation_cancelled', 'point_earned', 'referral_success', 'system');
CREATE TYPE notification_status AS ENUM ('unread', 'read', 'deleted');

-- Reporting and admin enums
CREATE TYPE report_reason AS ENUM ('spam', 'inappropriate_content', 'harassment', 'other');
CREATE TYPE admin_action_type AS ENUM ('user_suspended', 'shop_approved', 'shop_rejected', 'refund_processed', 'points_adjusted');

-- Add comments for documentation
COMMENT ON TYPE user_gender IS 'Gender options for user profiles';
COMMENT ON TYPE user_status IS 'User account status states';
COMMENT ON TYPE user_role IS 'User role permissions (user, shop_owner, admin, influencer)';
COMMENT ON TYPE social_provider IS 'Social login providers supported';
COMMENT ON TYPE shop_status IS 'Shop approval and operational status';
COMMENT ON TYPE shop_type IS 'Shop partnership type (partnered vs non_partnered)';
COMMENT ON TYPE service_category IS 'Beauty service categories offered';
COMMENT ON TYPE shop_verification_status IS 'Business verification status';
COMMENT ON TYPE reservation_status IS 'Reservation booking status states';
COMMENT ON TYPE payment_status IS 'Payment transaction status';
COMMENT ON TYPE payment_method IS 'Supported payment methods';
COMMENT ON TYPE point_transaction_type IS 'Types of point earning/spending transactions';
COMMENT ON TYPE point_status IS 'Point availability status';
COMMENT ON TYPE notification_type IS 'Notification category types';
COMMENT ON TYPE notification_status IS 'Notification read status';
COMMENT ON TYPE report_reason IS 'Content reporting reason categories';
COMMENT ON TYPE admin_action_type IS 'Administrative action types for audit trails'; 