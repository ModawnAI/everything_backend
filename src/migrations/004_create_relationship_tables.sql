-- Migration: 004_create_relationship_tables.sql
-- Description: Create all relationship and transaction tables
-- Author: Task Master AI
-- Created: 2025-07-28

-- Reservations table
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  reservation_datetime TIMESTAMPTZ GENERATED ALWAYS AS (
    (reservation_date || ' ' || reservation_time)::TIMESTAMPTZ
  ) STORED,
  status reservation_status DEFAULT 'requested',
  total_amount INTEGER NOT NULL,
  deposit_amount INTEGER NOT NULL,
  remaining_amount INTEGER,
  points_used INTEGER DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  special_requests TEXT,
  cancellation_reason TEXT,
  no_show_reason TEXT,
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reservation Services table (many-to-many)
CREATE TABLE public.reservation_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.shop_services(id) ON DELETE RESTRICT,
  quantity INTEGER DEFAULT 1,
  unit_price INTEGER NOT NULL,
  total_price INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  payment_method payment_method NOT NULL,
  payment_status payment_status DEFAULT 'pending',
  amount INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'KRW',
  payment_provider VARCHAR(50),
  provider_transaction_id VARCHAR(255),
  provider_order_id VARCHAR(255),
  is_deposit BOOLEAN DEFAULT TRUE,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_amount INTEGER DEFAULT 0,
  failure_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Point Transactions table
CREATE TABLE public.point_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
  transaction_type point_transaction_type NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT,
  status point_status DEFAULT 'pending',
  available_from TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Favorites table
CREATE TABLE public.user_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, shop_id)
);

-- Push Tokens table
CREATE TABLE public.push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR(20) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- Admin Actions table
CREATE TABLE public.admin_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action_type admin_action_type NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for relationship tables
CREATE INDEX idx_reservations_user_id ON public.reservations(user_id);
CREATE INDEX idx_reservations_shop_id ON public.reservations(shop_id);
CREATE INDEX idx_reservations_status ON public.reservations(status);
CREATE INDEX idx_reservations_datetime ON public.reservations(reservation_datetime);
CREATE INDEX idx_reservations_date ON public.reservations(reservation_date);

CREATE INDEX idx_reservation_services_reservation_id ON public.reservation_services(reservation_id);
CREATE INDEX idx_reservation_services_service_id ON public.reservation_services(service_id);

CREATE INDEX idx_payments_reservation_id ON public.payments(reservation_id);
CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_status ON public.payments(payment_status);
CREATE INDEX idx_payments_provider_id ON public.payments(provider_transaction_id);

CREATE INDEX idx_point_transactions_user_id ON public.point_transactions(user_id);
CREATE INDEX idx_point_transactions_reservation_id ON public.point_transactions(reservation_id);
CREATE INDEX idx_point_transactions_type ON public.point_transactions(transaction_type);
CREATE INDEX idx_point_transactions_status ON public.point_transactions(status);
CREATE INDEX idx_point_transactions_available_from ON public.point_transactions(available_from);
CREATE INDEX idx_point_transactions_expires_at ON public.point_transactions(expires_at);

CREATE INDEX idx_user_favorites_user_id ON public.user_favorites(user_id);
CREATE INDEX idx_user_favorites_shop_id ON public.user_favorites(shop_id);

CREATE INDEX idx_push_tokens_user_id ON public.push_tokens(user_id);
CREATE INDEX idx_push_tokens_active ON public.push_tokens(is_active);
CREATE INDEX idx_push_tokens_platform ON public.push_tokens(platform);

CREATE INDEX idx_admin_actions_admin_id ON public.admin_actions(admin_id);
CREATE INDEX idx_admin_actions_type ON public.admin_actions(action_type);
CREATE INDEX idx_admin_actions_target ON public.admin_actions(target_type, target_id);
CREATE INDEX idx_admin_actions_created_at ON public.admin_actions(created_at);

-- Add table comments for documentation
COMMENT ON TABLE public.reservations IS 'User bookings and appointments with shops';
COMMENT ON TABLE public.reservation_services IS 'Services included in each reservation';
COMMENT ON TABLE public.payments IS 'Payment transactions and billing records';
COMMENT ON TABLE public.point_transactions IS 'Point earning, spending, and expiration records';
COMMENT ON TABLE public.user_favorites IS 'User favorite shops for quick access';
COMMENT ON TABLE public.push_tokens IS 'Mobile push notification tokens';
COMMENT ON TABLE public.admin_actions IS 'Administrative actions audit trail'; 