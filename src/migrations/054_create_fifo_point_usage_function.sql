-- Migration: Create FIFO Point Usage Function
-- Description: Creates a PostgreSQL function to handle FIFO point usage with transaction atomicity
-- Date: 2024-01-22

-- Create the FIFO point usage function
CREATE OR REPLACE FUNCTION use_points_fifo_transaction(
    p_user_id UUID,
    p_amount_to_use INTEGER,
    p_reservation_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT 'Point usage',
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(
    success BOOLEAN,
    total_used INTEGER,
    remaining_balance INTEGER,
    new_transaction_id UUID,
    transactions_used JSONB,
    error_message TEXT
) 
LANGUAGE plpgsql
AS $$
DECLARE
    v_available_points RECORD;
    v_remaining_to_use INTEGER := p_amount_to_use;
    v_total_used INTEGER := 0;
    v_new_transaction_id UUID;
    v_transactions_used JSONB := '[]'::jsonb;
    v_current_balance INTEGER := 0;
    v_usage_detail JSONB;
    v_partial_amount INTEGER;
BEGIN
    -- Validate input parameters
    IF p_user_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 0, NULL::UUID, '[]'::jsonb, 'User ID is required';
        RETURN;
    END IF;
    
    IF p_amount_to_use <= 0 THEN
        RETURN QUERY SELECT FALSE, 0, 0, NULL::UUID, '[]'::jsonb, 'Amount must be positive';
        RETURN;
    END IF;

    -- Check if user exists
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
        RETURN QUERY SELECT FALSE, 0, 0, NULL::UUID, '[]'::jsonb, 'User not found';
        RETURN;
    END IF;

    -- Start transaction (implicit in function)
    
    -- Get available points in FIFO order (available_from ASC, created_at ASC)
    FOR v_available_points IN
        SELECT 
            id,
            amount,
            available_from,
            created_at,
            expires_at,
            description,
            metadata
        FROM public.point_transactions
        WHERE user_id = p_user_id
          AND status = 'available'
          AND amount > 0  -- Only positive amounts (earned points)
          AND available_from <= NOW()  -- Only points that are available now
          AND (expires_at IS NULL OR expires_at > NOW())  -- Not expired
        ORDER BY available_from ASC, created_at ASC
        FOR UPDATE  -- Lock rows for update
    LOOP
        -- Exit if we've used enough points
        EXIT WHEN v_remaining_to_use <= 0;
        
        -- Calculate how much to use from this transaction
        v_partial_amount := LEAST(v_available_points.amount, v_remaining_to_use);
        
        -- Update the original transaction
        IF v_partial_amount = v_available_points.amount THEN
            -- Use all points from this transaction
            UPDATE public.point_transactions
            SET status = 'used',
                metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'used_at', NOW(),
                    'used_for_reservation', p_reservation_id,
                    'fully_used', true
                )
            WHERE id = v_available_points.id;
        ELSE
            -- Partial usage - reduce the amount
            UPDATE public.point_transactions
            SET amount = amount - v_partial_amount,
                metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                    'partial_usage_history', COALESCE(metadata->'partial_usage_history', '[]'::jsonb) || 
                    jsonb_build_array(jsonb_build_object(
                        'used_amount', v_partial_amount,
                        'used_at', NOW(),
                        'used_for_reservation', p_reservation_id
                    ))
                )
            WHERE id = v_available_points.id;
        END IF;
        
        -- Add to usage details
        v_usage_detail := jsonb_build_object(
            'transactionId', v_available_points.id,
            'originalAmount', v_available_points.amount,
            'usedAmount', v_partial_amount,
            'remainingAmount', v_available_points.amount - v_partial_amount,
            'availableFrom', v_available_points.available_from,
            'createdAt', v_available_points.created_at
        );
        
        v_transactions_used := v_transactions_used || jsonb_build_array(v_usage_detail);
        
        -- Update counters
        v_total_used := v_total_used + v_partial_amount;
        v_remaining_to_use := v_remaining_to_use - v_partial_amount;
    END LOOP;
    
    -- Check if we could use the requested amount
    IF v_total_used < p_amount_to_use THEN
        -- Rollback changes (automatic in function if we return error)
        RETURN QUERY SELECT FALSE, 0, 0, NULL::UUID, '[]'::jsonb, 
            FORMAT('Insufficient points. Requested: %s, Available: %s', p_amount_to_use, v_total_used);
        RETURN;
    END IF;
    
    -- Create new usage transaction record
    INSERT INTO public.point_transactions (
        user_id,
        reservation_id,
        transaction_type,
        amount,
        description,
        status,
        available_from,
        expires_at,
        metadata
    ) VALUES (
        p_user_id,
        p_reservation_id,
        'used_service',
        -v_total_used,  -- Negative amount for usage
        p_description,
        'used',
        NOW(),  -- Immediately used
        NULL,   -- Usage transactions don't expire
        p_metadata || jsonb_build_object(
            'fifo_usage', true,
            'transactions_used', v_transactions_used,
            'usage_timestamp', NOW()
        )
    ) RETURNING id INTO v_new_transaction_id;
    
    -- Calculate remaining balance
    SELECT COALESCE(SUM(amount), 0)
    INTO v_current_balance
    FROM public.point_transactions
    WHERE user_id = p_user_id
      AND status = 'available'
      AND amount > 0
      AND available_from <= NOW()
      AND (expires_at IS NULL OR expires_at > NOW());
    
    -- Update user's point balance cache
    INSERT INTO public.point_balances (
        user_id,
        total_earned,
        total_used,
        available_balance,
        pending_balance,
        last_calculated_at
    ) VALUES (
        p_user_id,
        (SELECT COALESCE(SUM(amount), 0) FROM public.point_transactions WHERE user_id = p_user_id AND amount > 0),
        (SELECT COALESCE(ABS(SUM(amount)), 0) FROM public.point_transactions WHERE user_id = p_user_id AND amount < 0),
        v_current_balance,
        (SELECT COALESCE(SUM(amount), 0) FROM public.point_transactions WHERE user_id = p_user_id AND status = 'pending' AND amount > 0),
        NOW()
    ) ON CONFLICT (user_id) DO UPDATE SET
        total_earned = (SELECT COALESCE(SUM(amount), 0) FROM public.point_transactions WHERE user_id = p_user_id AND amount > 0),
        total_used = (SELECT COALESCE(ABS(SUM(amount)), 0) FROM public.point_transactions WHERE user_id = p_user_id AND amount < 0),
        available_balance = v_current_balance,
        pending_balance = (SELECT COALESCE(SUM(amount), 0) FROM public.point_transactions WHERE user_id = p_user_id AND status = 'pending' AND amount > 0),
        last_calculated_at = NOW(),
        updated_at = NOW();
    
    -- Return success result
    RETURN QUERY SELECT 
        TRUE,
        v_total_used,
        v_current_balance,
        v_new_transaction_id,
        v_transactions_used,
        NULL::TEXT;
        
EXCEPTION
    WHEN OTHERS THEN
        -- Return error result
        RETURN QUERY SELECT 
            FALSE, 
            0, 
            0, 
            NULL::UUID, 
            '[]'::jsonb, 
            FORMAT('Database error: %s', SQLERRM);
END;
$$;

-- Grant execute permission to the service role
GRANT EXECUTE ON FUNCTION use_points_fifo_transaction(UUID, INTEGER, UUID, TEXT, JSONB) TO service_role;

-- Create indexes for optimal FIFO query performance
CREATE INDEX IF NOT EXISTS idx_point_transactions_fifo_lookup 
ON public.point_transactions (user_id, status, available_from, created_at) 
WHERE status = 'available' AND amount > 0;

-- Create index for point balance calculations
CREATE INDEX IF NOT EXISTS idx_point_transactions_balance_calc 
ON public.point_transactions (user_id, status, amount) 
WHERE status IN ('available', 'pending');

-- Create index for usage history queries
CREATE INDEX IF NOT EXISTS idx_point_transactions_usage_history 
ON public.point_transactions (user_id, transaction_type, created_at DESC) 
WHERE transaction_type = 'used_service';

-- Add comment to the function
COMMENT ON FUNCTION use_points_fifo_transaction IS 
'Atomically uses points following FIFO (First-In-First-Out) logic. Points are consumed in the order they become available (available_from ASC, created_at ASC). Handles partial point usage and maintains transaction integrity.';

