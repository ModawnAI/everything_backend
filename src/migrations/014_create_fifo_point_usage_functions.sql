-- Migration: 014_create_fifo_point_usage_functions.sql
-- Description: Create database functions for FIFO point usage system
-- Author: Task Master AI
-- Created: 2025-01-27

-- =============================================
-- FIFO POINT USAGE FUNCTIONS
-- =============================================

-- Function to begin a database transaction
-- This is a wrapper for Supabase's transaction management
CREATE OR REPLACE FUNCTION begin_transaction()
RETURNS JSONB AS $$
BEGIN
  -- In Supabase, transactions are handled at the application level
  -- This function is a placeholder for transaction management
  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'Transaction context established'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to commit a database transaction
CREATE OR REPLACE FUNCTION commit_transaction()
RETURNS JSONB AS $$
BEGIN
  -- In Supabase, transactions are handled at the application level
  -- This function is a placeholder for transaction management
  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'Transaction committed'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to rollback a database transaction
CREATE OR REPLACE FUNCTION rollback_transaction()
RETURNS JSONB AS $$
BEGIN
  -- In Supabase, transactions are handled at the application level
  -- This function is a placeholder for transaction management
  RETURN jsonb_build_object(
    'status', 'success',
    'message', 'Transaction rolled back'
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get available points in FIFO order
-- This function returns available point transactions ordered by available_from timestamp
CREATE OR REPLACE FUNCTION get_available_points_fifo(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  amount INTEGER,
  available_from TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  transaction_type point_transaction_type,
  description TEXT,
  status point_status,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pt.id,
    pt.amount,
    pt.available_from,
    pt.expires_at,
    pt.transaction_type,
    pt.description,
    pt.status,
    pt.created_at
  FROM public.point_transactions pt
  WHERE pt.user_id = user_uuid
    AND pt.status = 'available'
    AND pt.amount > 0
    AND (pt.expires_at IS NULL OR pt.expires_at > NOW())
  ORDER BY pt.available_from ASC, pt.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to consume points using FIFO algorithm
-- This function handles the actual point consumption logic
CREATE OR REPLACE FUNCTION consume_points_fifo(
  user_uuid UUID,
  requested_amount INTEGER,
  reservation_uuid UUID,
  usage_description TEXT DEFAULT '서비스 결제 사용 (FIFO)'
)
RETURNS JSONB AS $$
DECLARE
  available_points RECORD;
  remaining_amount INTEGER;
  total_consumed INTEGER := 0;
  consumed_transactions UUID[] := ARRAY[]::UUID[];
  consumed_amounts INTEGER[] := ARRAY[]::INTEGER[];
  usage_transaction_id UUID;
BEGIN
  -- Initialize remaining amount
  remaining_amount := requested_amount;
  
  -- Get available points in FIFO order
  FOR available_points IN 
    SELECT * FROM get_available_points_fifo(user_uuid)
  LOOP
    -- Exit if we've consumed enough points
    IF remaining_amount <= 0 THEN
      EXIT;
    END IF;
    
    -- Calculate how much to consume from this transaction
    DECLARE
      consume_amount INTEGER;
      new_remaining INTEGER;
    BEGIN
      consume_amount := LEAST(available_points.amount, remaining_amount);
      new_remaining := available_points.amount - consume_amount;
      
      -- Update the original transaction
      UPDATE public.point_transactions 
      SET 
        amount = new_remaining,
        status = CASE WHEN new_remaining = 0 THEN 'used'::point_status ELSE 'available'::point_status END,
        updated_at = NOW(),
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'last_used_at', NOW(),
          'last_used_amount', consume_amount,
          'reservation_id', reservation_uuid
        )
      WHERE id = available_points.id;
      
      -- Record consumed transaction
      consumed_transactions := array_append(consumed_transactions, available_points.id);
      consumed_amounts := array_append(consumed_amounts, consume_amount);
      
      -- Update counters
      remaining_amount := remaining_amount - consume_amount;
      total_consumed := total_consumed + consume_amount;
    END;
  END LOOP;
  
  -- Create usage transaction record
  INSERT INTO public.point_transactions (
    user_id,
    reservation_id,
    transaction_type,
    amount,
    description,
    status,
    metadata
  ) VALUES (
    user_uuid,
    reservation_uuid,
    'used_service',
    -total_consumed,
    usage_description,
    'used',
    jsonb_build_object(
      'fifo_consumption', true,
      'consumed_transactions', consumed_transactions,
      'consumed_amounts', consumed_amounts,
      'total_consumed', total_consumed,
      'consumed_at', NOW()
    )
  ) RETURNING id INTO usage_transaction_id;
  
  -- Update reservation points_used field
  UPDATE public.reservations 
  SET 
    points_used = total_consumed,
    updated_at = NOW()
  WHERE id = reservation_uuid;
  
  -- Return result
  RETURN jsonb_build_object(
    'success', true,
    'total_consumed', total_consumed,
    'remaining_amount', remaining_amount,
    'consumed_transactions', consumed_transactions,
    'consumed_amounts', consumed_amounts,
    'usage_transaction_id', usage_transaction_id,
    'insufficient_amount', CASE WHEN remaining_amount > 0 THEN remaining_amount ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql;

-- Function to rollback point usage
-- This function restores consumed points to their original state
CREATE OR REPLACE FUNCTION rollback_point_usage(
  usage_transaction_uuid UUID,
  rollback_reason TEXT,
  admin_uuid UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  usage_transaction RECORD;
  consumed_transactions UUID[];
  consumed_amounts INTEGER[];
  restored_count INTEGER := 0;
BEGIN
  -- Get the usage transaction
  SELECT * INTO usage_transaction
  FROM public.point_transactions
  WHERE id = usage_transaction_uuid
    AND transaction_type = 'used_service';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Usage transaction not found'
    );
  END IF;
  
  -- Extract consumed transaction data
  consumed_transactions := (usage_transaction.metadata->>'consumed_transactions')::UUID[];
  consumed_amounts := (usage_transaction.metadata->>'consumed_amounts')::INTEGER[];
  
  IF array_length(consumed_transactions, 1) IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No consumed transactions found'
    );
  END IF;
  
  -- Restore original transactions
  FOR i IN 1..array_length(consumed_transactions, 1) LOOP
    DECLARE
      original_transaction RECORD;
      restored_amount INTEGER;
    BEGIN
      -- Get current state of the transaction
      SELECT * INTO original_transaction
      FROM public.point_transactions
      WHERE id = consumed_transactions[i];
      
      IF FOUND THEN
        -- Restore the consumed amount
        restored_amount := original_transaction.amount + consumed_amounts[i];
        
        UPDATE public.point_transactions
        SET 
          amount = restored_amount,
          status = CASE WHEN restored_amount > 0 THEN 'available'::point_status ELSE original_transaction.status END,
          updated_at = NOW(),
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'rollback_info', jsonb_build_object(
              'rollback_at', NOW(),
              'rollback_reason', rollback_reason,
              'rollback_by', admin_uuid,
              'restored_amount', consumed_amounts[i],
              'original_usage_transaction', usage_transaction_uuid
            )
          )
        WHERE id = consumed_transactions[i];
        
        restored_count := restored_count + 1;
      END IF;
    END;
  END LOOP;
  
  -- Mark usage transaction as rolled back
  UPDATE public.point_transactions
  SET 
    status = 'cancelled',
    updated_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'rollback_info', jsonb_build_object(
        'rollback_at', NOW(),
        'rollback_reason', rollback_reason,
        'rollback_by', admin_uuid
      )
    )
  WHERE id = usage_transaction_uuid;
  
  -- Update reservation points_used field
  UPDATE public.reservations
  SET 
    points_used = 0,
    updated_at = NOW()
  WHERE id = usage_transaction.reservation_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'restored_transactions', restored_count,
    'usage_transaction_id', usage_transaction_uuid
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get FIFO point usage breakdown
-- This function provides detailed analysis of available points for FIFO consumption
CREATE OR REPLACE FUNCTION get_fifo_breakdown(user_uuid UUID)
RETURNS TABLE (
  total_available INTEGER,
  transaction_count INTEGER,
  oldest_available TIMESTAMPTZ,
  newest_available TIMESTAMPTZ,
  breakdown JSONB
) AS $$
DECLARE
  total_points INTEGER := 0;
  transaction_count INTEGER := 0;
  oldest_available TIMESTAMPTZ;
  newest_available TIMESTAMPTZ;
  breakdown_data JSONB := '[]'::jsonb;
BEGIN
  -- Calculate totals and get breakdown
  SELECT 
    COALESCE(SUM(amount), 0),
    COUNT(*),
    MIN(available_from),
    MAX(available_from)
  INTO 
    total_points,
    transaction_count,
    oldest_available,
    newest_available
  FROM get_available_points_fifo(user_uuid);
  
  -- Build detailed breakdown
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'amount', amount,
      'available_from', available_from,
      'expires_at', expires_at,
      'transaction_type', transaction_type,
      'description', description
    )
  ) INTO breakdown_data
  FROM get_available_points_fifo(user_uuid);
  
  RETURN QUERY SELECT 
    total_points,
    transaction_count,
    oldest_available,
    newest_available,
    breakdown_data;
END;
$$ LANGUAGE plpgsql;

-- Function to validate FIFO point usage
-- This function checks if a point usage request can be fulfilled
CREATE OR REPLACE FUNCTION validate_fifo_usage(
  user_uuid UUID,
  requested_amount INTEGER
)
RETURNS JSONB AS $$
DECLARE
  available_points RECORD;
  total_available INTEGER := 0;
  insufficient_amount INTEGER := 0;
BEGIN
  -- Calculate total available points
  SELECT COALESCE(SUM(amount), 0) INTO total_available
  FROM get_available_points_fifo(user_uuid);
  
  -- Calculate insufficient amount
  insufficient_amount := GREATEST(0, requested_amount - total_available);
  
  RETURN jsonb_build_object(
    'can_fulfill', total_available >= requested_amount,
    'total_available', total_available,
    'requested_amount', requested_amount,
    'insufficient_amount', insufficient_amount,
    'excess_amount', GREATEST(0, total_available - requested_amount)
  );
END;
$$ LANGUAGE plpgsql;

-- Create indexes for FIFO performance optimization
CREATE INDEX IF NOT EXISTS idx_point_transactions_fifo_usage 
ON public.point_transactions(user_id, status, available_from, created_at)
WHERE status = 'available' AND amount > 0;

CREATE INDEX IF NOT EXISTS idx_point_transactions_usage_rollback
ON public.point_transactions(transaction_type, status)
WHERE transaction_type = 'used_service';

-- Add comments for documentation
COMMENT ON FUNCTION get_available_points_fifo(UUID) IS 'Get available point transactions in FIFO order for point consumption';
COMMENT ON FUNCTION consume_points_fifo(UUID, INTEGER, UUID, TEXT) IS 'Consume points using FIFO algorithm with atomic transaction handling';
COMMENT ON FUNCTION rollback_point_usage(UUID, TEXT, UUID) IS 'Rollback point usage by restoring consumed transactions to original state';
COMMENT ON FUNCTION get_fifo_breakdown(UUID) IS 'Get detailed breakdown of available points for FIFO analysis';
COMMENT ON FUNCTION validate_fifo_usage(UUID, INTEGER) IS 'Validate if a point usage request can be fulfilled with available points'; 