-- Description: Create tables for payment retry functionality
-- This migration adds support for automatic payment retry mechanisms with exponential backoff

-- Payment Retry Queue table
-- Tracks payment retry attempts and scheduling
CREATE TABLE public.payment_retry_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  retry_type retry_type NOT NULL,
  retry_status retry_status DEFAULT 'pending',
  attempt_number INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ NOT NULL,
  last_attempt_at TIMESTAMPTZ,
  last_failure_reason TEXT,
  last_failure_code VARCHAR(50),
  retry_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  total_processing_time INTEGER, -- in milliseconds
  exponential_backoff_multiplier DECIMAL(3,2) DEFAULT 2.0,
  base_retry_delay INTEGER DEFAULT 300, -- in seconds
  max_retry_delay INTEGER DEFAULT 3600, -- in seconds
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure valid attempt numbers
  CONSTRAINT valid_attempt_numbers CHECK (
    attempt_number > 0 AND
    max_attempts > 0 AND
    attempt_number <= max_attempts
  ),
  
  -- Ensure valid delays
  CONSTRAINT valid_retry_delays CHECK (
    base_retry_delay > 0 AND
    max_retry_delay >= base_retry_delay AND
    exponential_backoff_multiplier > 1.0
  )
);

-- Payment Retry History table
-- Tracks detailed history of each retry attempt
CREATE TABLE public.payment_retry_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  retry_queue_id UUID NOT NULL REFERENCES public.payment_retry_queue(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  retry_status retry_status NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  processing_time INTEGER, -- in milliseconds
  failure_reason TEXT,
  failure_code VARCHAR(50),
  provider_response JSONB,
  retry_delay_used INTEGER, -- in seconds
  next_retry_scheduled TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure valid attempt numbers
  CONSTRAINT valid_history_attempt_number CHECK (attempt_number > 0),
  
  -- Ensure valid processing time
  CONSTRAINT valid_processing_time CHECK (
    processing_time IS NULL OR processing_time >= 0
  )
);

-- Payment Retry Configuration table
-- Configurable settings for retry behavior
CREATE TABLE public.payment_retry_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_name VARCHAR(100) NOT NULL UNIQUE,
  retry_type retry_type NOT NULL,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  base_retry_delay INTEGER NOT NULL DEFAULT 300, -- in seconds
  max_retry_delay INTEGER NOT NULL DEFAULT 3600, -- in seconds
  exponential_backoff_multiplier DECIMAL(3,2) NOT NULL DEFAULT 2.0,
  jitter_factor DECIMAL(3,2) DEFAULT 0.1,
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure valid configuration values
  CONSTRAINT valid_retry_config CHECK (
    max_attempts > 0 AND
    base_retry_delay > 0 AND
    max_retry_delay >= base_retry_delay AND
    exponential_backoff_multiplier > 1.0 AND
    jitter_factor >= 0.0 AND jitter_factor <= 1.0
  )
);

-- Payment Retry Notifications table
-- Tracks notifications sent for retry attempts
CREATE TABLE public.payment_retry_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  retry_queue_id UUID NOT NULL REFERENCES public.payment_retry_queue(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  notification_type notification_type NOT NULL,
  notification_status notification_status DEFAULT 'pending',
  attempt_number INTEGER NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure valid attempt numbers
  CONSTRAINT valid_notification_attempt_number CHECK (attempt_number > 0)
);

-- Create indexes for performance
CREATE INDEX idx_payment_retry_queue_payment_id ON public.payment_retry_queue(payment_id);
CREATE INDEX idx_payment_retry_queue_user_id ON public.payment_retry_queue(user_id);
CREATE INDEX idx_payment_retry_queue_status ON public.payment_retry_queue(retry_status);
CREATE INDEX idx_payment_retry_queue_next_retry ON public.payment_retry_queue(next_retry_at);
CREATE INDEX idx_payment_retry_queue_type ON public.payment_retry_queue(retry_type);

CREATE INDEX idx_payment_retry_history_retry_queue_id ON public.payment_retry_history(retry_queue_id);
CREATE INDEX idx_payment_retry_history_payment_id ON public.payment_retry_history(payment_id);
CREATE INDEX idx_payment_retry_history_status ON public.payment_retry_history(retry_status);
CREATE INDEX idx_payment_retry_history_created_at ON public.payment_retry_history(created_at);

CREATE INDEX idx_payment_retry_config_type ON public.payment_retry_config(retry_type);
CREATE INDEX idx_payment_retry_config_active ON public.payment_retry_config(is_active);

CREATE INDEX idx_payment_retry_notifications_retry_queue_id ON public.payment_retry_notifications(retry_queue_id);
CREATE INDEX idx_payment_retry_notifications_user_id ON public.payment_retry_notifications(user_id);
CREATE INDEX idx_payment_retry_notifications_status ON public.payment_retry_notifications(notification_status);

-- Add RLS policies for security
ALTER TABLE public.payment_retry_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_retry_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_retry_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_retry_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_retry_notifications ENABLE ROW LEVEL SECURITY;

-- Payment retry queue policies
CREATE POLICY "Users can view their own retry queue items" ON public.payment_retry_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage retry queue" ON public.payment_retry_queue
  FOR ALL USING (true);

-- Payment retry history policies
CREATE POLICY "Users can view their own retry history" ON public.payment_retry_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.payment_retry_queue 
      WHERE id = retry_queue_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage retry history" ON public.payment_retry_history
  FOR ALL USING (true);

-- Payment retry config policies
CREATE POLICY "All users can view active retry configs" ON public.payment_retry_config
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage retry configs" ON public.payment_retry_config
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Payment retry notifications policies
CREATE POLICY "Users can view their own retry notifications" ON public.payment_retry_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage retry notifications" ON public.payment_retry_notifications
  FOR ALL USING (true);

-- Create triggers for automatic updates
CREATE OR REPLACE FUNCTION update_payment_retry_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payment_retry_queue_updated_at
  BEFORE UPDATE ON public.payment_retry_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_retry_queue_updated_at();

CREATE OR REPLACE FUNCTION update_payment_retry_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payment_retry_config_updated_at
  BEFORE UPDATE ON public.payment_retry_config
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_retry_config_updated_at();

-- Function to calculate next retry delay with exponential backoff
CREATE OR REPLACE FUNCTION calculate_next_retry_delay(
  p_attempt_number INTEGER,
  p_base_delay INTEGER,
  p_max_delay INTEGER,
  p_multiplier DECIMAL(3,2),
  p_jitter_factor DECIMAL(3,2) DEFAULT 0.1
)
RETURNS INTEGER AS $$
DECLARE
  v_delay INTEGER;
  v_jitter INTEGER;
BEGIN
  -- Calculate exponential backoff delay
  v_delay := p_base_delay * POWER(p_multiplier, p_attempt_number - 1);
  
  -- Apply maximum delay limit
  IF v_delay > p_max_delay THEN
    v_delay := p_max_delay;
  END IF;
  
  -- Apply jitter to prevent thundering herd
  v_jitter := FLOOR(v_delay * p_jitter_factor * (RANDOM() - 0.5));
  v_delay := v_delay + v_jitter;
  
  -- Ensure minimum delay
  IF v_delay < 1 THEN
    v_delay := 1;
  END IF;
  
  RETURN v_delay;
END;
$$ LANGUAGE plpgsql;

-- Function to create retry queue item
CREATE OR REPLACE FUNCTION create_payment_retry_queue_item(
  p_payment_id UUID,
  p_retry_type retry_type,
  p_failure_reason TEXT DEFAULT NULL,
  p_failure_code VARCHAR(50) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_payment RECORD;
  v_config RECORD;
  v_retry_queue_id UUID;
  v_next_retry_delay INTEGER;
BEGIN
  -- Get payment details
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id;
  
  IF v_payment IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  
  -- Get retry configuration
  SELECT * INTO v_config
  FROM public.payment_retry_config
  WHERE retry_type = p_retry_type
    AND is_active = true
  LIMIT 1;
  
  -- Use default config if none found
  IF v_config IS NULL THEN
    v_config.max_attempts := 3;
    v_config.base_retry_delay := 300;
    v_config.max_retry_delay := 3600;
    v_config.exponential_backoff_multiplier := 2.0;
    v_config.jitter_factor := 0.1;
  END IF;
  
  -- Calculate next retry delay
  v_next_retry_delay := calculate_next_retry_delay(
    1,
    v_config.base_retry_delay,
    v_config.max_retry_delay,
    v_config.exponential_backoff_multiplier,
    v_config.jitter_factor
  );
  
  -- Create retry queue item
  INSERT INTO public.payment_retry_queue (
    payment_id,
    reservation_id,
    user_id,
    retry_type,
    retry_status,
    attempt_number,
    max_attempts,
    next_retry_at,
    last_failure_reason,
    last_failure_code,
    exponential_backoff_multiplier,
    base_retry_delay,
    max_retry_delay
  ) VALUES (
    p_payment_id,
    v_payment.reservation_id,
    v_payment.user_id,
    p_retry_type,
    'pending',
    1,
    v_config.max_attempts,
    NOW() + (v_next_retry_delay || ' seconds')::INTERVAL,
    p_failure_reason,
    p_failure_code,
    v_config.exponential_backoff_multiplier,
    v_config.base_retry_delay,
    v_config.max_retry_delay
  ) RETURNING id INTO v_retry_queue_id;
  
  RETURN v_retry_queue_id;
END;
$$ LANGUAGE plpgsql;

-- Function to process retry attempt
CREATE OR REPLACE FUNCTION process_payment_retry_attempt(
  p_retry_queue_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_retry_item RECORD;
  v_next_retry_delay INTEGER;
  v_success BOOLEAN := FALSE;
BEGIN
  -- Get retry queue item
  SELECT * INTO v_retry_item
  FROM public.payment_retry_queue
  WHERE id = p_retry_queue_id
    AND retry_status = 'pending'
    AND next_retry_at <= NOW();
  
  IF v_retry_item IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update retry status to processing
  UPDATE public.payment_retry_queue
  SET retry_status = 'processing',
      last_attempt_at = NOW(),
      updated_at = NOW()
  WHERE id = p_retry_queue_id;
  
  -- Record retry attempt in history
  INSERT INTO public.payment_retry_history (
    retry_queue_id,
    payment_id,
    attempt_number,
    retry_status,
    started_at,
    retry_delay_used
  ) VALUES (
    p_retry_queue_id,
    v_retry_item.payment_id,
    v_retry_item.attempt_number,
    'processing',
    NOW(),
    EXTRACT(EPOCH FROM (NOW() - v_retry_item.next_retry_at + (v_retry_item.base_retry_delay || ' seconds')::INTERVAL))
  );
  
  -- Here you would call the actual payment processing logic
  -- For now, we'll simulate success/failure
  v_success := (RANDOM() > 0.3); -- 70% success rate for demo
  
  -- Update retry history with result
  UPDATE public.payment_retry_history
  SET retry_status = CASE WHEN v_success THEN 'success' ELSE 'failed' END,
      completed_at = NOW(),
      processing_time = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
  WHERE retry_queue_id = p_retry_queue_id
    AND attempt_number = v_retry_item.attempt_number;
  
  IF v_success THEN
    -- Mark retry as successful
    UPDATE public.payment_retry_queue
    SET retry_status = 'completed',
        success_count = success_count + 1,
        updated_at = NOW()
    WHERE id = p_retry_queue_id;
    
    RETURN TRUE;
  ELSE
    -- Check if we should retry again
    IF v_retry_item.attempt_number >= v_retry_item.max_attempts THEN
      -- Max attempts reached, mark as failed
      UPDATE public.payment_retry_queue
      SET retry_status = 'failed',
          last_failure_reason = 'Max retry attempts reached',
          updated_at = NOW()
      WHERE id = p_retry_queue_id;
      
      RETURN FALSE;
    ELSE
      -- Schedule next retry
      v_next_retry_delay := calculate_next_retry_delay(
        v_retry_item.attempt_number + 1,
        v_retry_item.base_retry_delay,
        v_retry_item.max_retry_delay,
        v_retry_item.exponential_backoff_multiplier
      );
      
      UPDATE public.payment_retry_queue
      SET retry_status = 'pending',
          attempt_number = attempt_number + 1,
          retry_count = retry_count + 1,
          next_retry_at = NOW() + (v_next_retry_delay || ' seconds')::INTERVAL,
          updated_at = NOW()
      WHERE id = p_retry_queue_id;
      
      RETURN FALSE;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Insert default retry configurations
INSERT INTO public.payment_retry_config (
  config_name,
  retry_type,
  max_attempts,
  base_retry_delay,
  max_retry_delay,
  exponential_backoff_multiplier,
  jitter_factor,
  description
) VALUES 
  ('Standard Payment Retry', 'payment_confirmation', 3, 300, 3600, 2.0, 0.1, 'Standard retry configuration for payment confirmations'),
  ('Webhook Retry', 'webhook_delivery', 5, 60, 1800, 2.0, 0.15, 'Retry configuration for webhook deliveries'),
  ('Refund Retry', 'refund_processing', 3, 600, 7200, 2.5, 0.1, 'Retry configuration for refund processing'),
  ('Split Payment Retry', 'split_payment', 4, 300, 3600, 2.0, 0.1, 'Retry configuration for split payment processing'); 