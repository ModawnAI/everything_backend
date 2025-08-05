-- Migration: 003_create_core_tables.sql
-- Description: Create all core database tables
-- Author: Task Master AI
-- Created: 2025-07-28

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE,
  phone_number VARCHAR(20) UNIQUE,
  phone_verified BOOLEAN DEFAULT FALSE,
  name VARCHAR(100) NOT NULL,
  nickname VARCHAR(50),
  gender user_gender,
  birth_date DATE,
  profile_image_url TEXT,
  user_role user_role DEFAULT 'user',
  user_status user_status DEFAULT 'active',
  is_influencer BOOLEAN DEFAULT FALSE,
  influencer_qualified_at TIMESTAMPTZ,
  social_provider social_provider,
  social_provider_id VARCHAR(255),
  referral_code VARCHAR(20) UNIQUE,
  referred_by_code VARCHAR(20),
  total_points INTEGER DEFAULT 0,
  available_points INTEGER DEFAULT 0,
  total_referrals INTEGER DEFAULT 0,
  successful_referrals INTEGER DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  terms_accepted_at TIMESTAMPTZ,
  privacy_accepted_at TIMESTAMPTZ,
  marketing_consent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Settings table
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  push_notifications_enabled BOOLEAN DEFAULT TRUE,
  reservation_notifications BOOLEAN DEFAULT TRUE,
  event_notifications BOOLEAN DEFAULT TRUE,
  marketing_notifications BOOLEAN DEFAULT FALSE,
  location_tracking_enabled BOOLEAN DEFAULT TRUE,
  language_preference VARCHAR(10) DEFAULT 'ko',
  currency_preference VARCHAR(3) DEFAULT 'KRW',
  theme_preference VARCHAR(20) DEFAULT 'light',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Shops table
CREATE TABLE public.shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  phone_number VARCHAR(20),
  email VARCHAR(255),
  address TEXT NOT NULL,
  detailed_address TEXT,
  postal_code VARCHAR(10),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location GEOGRAPHY(POINT, 4326),
  shop_type shop_type DEFAULT 'non_partnered',
  shop_status shop_status DEFAULT 'pending_approval',
  verification_status shop_verification_status DEFAULT 'pending',
  business_license_number VARCHAR(50),
  business_license_image_url TEXT,
  main_category service_category NOT NULL,
  sub_categories service_category[],
  operating_hours JSONB,
  payment_methods payment_method[],
  kakao_channel_url TEXT,
  total_bookings INTEGER DEFAULT 0,
  partnership_started_at TIMESTAMPTZ,
  featured_until TIMESTAMPTZ,
  is_featured BOOLEAN DEFAULT FALSE,
  commission_rate DECIMAL(5,2) DEFAULT 10.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shop Images table
CREATE TABLE public.shop_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text VARCHAR(255),
  is_primary BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shop Services table
CREATE TABLE public.shop_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category service_category NOT NULL,
  price_min INTEGER,
  price_max INTEGER,
  duration_minutes INTEGER,
  deposit_amount INTEGER,
  deposit_percentage DECIMAL(5,2),
  is_available BOOLEAN DEFAULT TRUE,
  booking_advance_days INTEGER DEFAULT 30,
  cancellation_hours INTEGER DEFAULT 24,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service Images table
CREATE TABLE public.service_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES public.shop_services(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text VARCHAR(255),
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for core tables
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_phone ON public.users(phone_number);
CREATE INDEX idx_users_role ON public.users(user_role);
CREATE INDEX idx_users_status ON public.users(user_status);
CREATE INDEX idx_users_referral_code ON public.users(referral_code);
CREATE INDEX idx_user_settings_user_id ON public.user_settings(user_id);

CREATE INDEX idx_shops_owner_id ON public.shops(owner_id);
CREATE INDEX idx_shops_status ON public.shops(shop_status);
CREATE INDEX idx_shops_type ON public.shops(shop_type);
CREATE INDEX idx_shops_category ON public.shops(main_category);
CREATE INDEX idx_shops_location ON public.shops USING GIST(location);
CREATE INDEX idx_shops_featured ON public.shops(is_featured, featured_until);

CREATE INDEX idx_shop_images_shop_id ON public.shop_images(shop_id);
CREATE INDEX idx_shop_images_primary ON public.shop_images(shop_id, is_primary);

CREATE INDEX idx_shop_services_shop_id ON public.shop_services(shop_id);
CREATE INDEX idx_shop_services_category ON public.shop_services(category);
CREATE INDEX idx_shop_services_available ON public.shop_services(is_available);

CREATE INDEX idx_service_images_service_id ON public.service_images(service_id);

-- Add table comments for documentation
COMMENT ON TABLE public.users IS 'User profiles extending Supabase auth with business logic';
COMMENT ON TABLE public.user_settings IS 'User preferences and notification settings';
COMMENT ON TABLE public.shops IS 'Beauty shops and service providers';
COMMENT ON TABLE public.shop_images IS 'Shop photos and gallery images';
COMMENT ON TABLE public.shop_services IS 'Services offered by shops';
COMMENT ON TABLE public.service_images IS 'Service portfolio and example images'; 