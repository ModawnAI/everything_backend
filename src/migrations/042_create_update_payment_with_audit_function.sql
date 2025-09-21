-- Create update_payment_with_audit function for atomic payment updates
-- This function ensures payment updates are atomic and include audit logging

CREATE OR REPLACE FUNCTION update_payment_with_audit(
    p_payment_id UUID,
    p_payment_status payment_status,
    p_provider_transaction_id VARCHAR(255),
    p_paid_at TIMESTAMP WITH TIME ZONE,
    p_metadata JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated_payment RECORD;
    v_audit_data JSONB;
BEGIN
    -- Update payment record
    UPDATE public.payments 
    SET 
        payment_status = p_payment_status,
        provider_transaction_id = p_provider_transaction_id,
        paid_at = p_paid_at,
        metadata = COALESCE(metadata, '{}') || p_metadata,
        updated_at = NOW()
    WHERE id = p_payment_id
    RETURNING * INTO v_updated_payment;
    
    -- Check if payment was updated
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment not found: %', p_payment_id;
    END IF;
    
    -- Prepare audit data
    v_audit_data := jsonb_build_object(
        'payment_id', p_payment_id,
        'old_status', COALESCE((SELECT payment_status FROM public.payments WHERE id = p_payment_id), 'unknown'),
        'new_status', p_payment_status,
        'provider_transaction_id', p_provider_transaction_id,
        'paid_at', p_paid_at,
        'updated_at', NOW(),
        'action', 'payment_update'
    );
    
    -- Return updated payment data with audit info
    RETURN jsonb_build_object(
        'payment_id', v_updated_payment.id,
        'status', v_updated_payment.payment_status,
        'amount', v_updated_payment.amount,
        'paid_at', v_updated_payment.paid_at,
        'audit_data', v_audit_data
    );
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and re-raise
        RAISE EXCEPTION 'Failed to update payment %: %', p_payment_id, SQLERRM;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION update_payment_with_audit(UUID, payment_status, VARCHAR(255), TIMESTAMP WITH TIME ZONE, JSONB) 
IS 'Atomically updates payment record with audit information. Used by payment confirmation service to ensure data consistency.';
