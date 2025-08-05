-- Migration: 005_payment_confirmation_tables.sql
-- Description: Create tables for enhanced payment confirmation system
-- Author: Task Master AI
-- Created: 2025-07-28

-- Payment Receipts table
-- Stores detailed payment receipts with service information
CREATE TABLE public.payment_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    receipt_id VARCHAR(255) UNIQUE NOT NULL,
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'KRW',
    payment_method payment_method NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    shop_name VARCHAR(255) NOT NULL,
    service_details JSONB NOT NULL, -- Array of service details
    payment_date TIMESTAMPTZ NOT NULL,
    receipt_url TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Audit Logs table
-- Tracks all payment-related actions for audit and debugging
CREATE TABLE public.payment_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_log_id VARCHAR(255) UNIQUE NOT NULL,
    transaction_id VARCHAR(255) NOT NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- payment_confirmation, payment_refund, etc.
    data JSONB NOT NULL, -- Detailed action data
    timestamp TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) DEFAULT 'completed', -- completed, failed, pending
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
-- Stores customer notifications for payment events
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB, -- Additional notification data
    priority VARCHAR(20) DEFAULT 'normal', -- high, normal, low
    status notification_status DEFAULT 'unread',
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_payment_receipts_payment_id ON public.payment_receipts(payment_id);
CREATE INDEX idx_payment_receipts_reservation_id ON public.payment_receipts(reservation_id);
CREATE INDEX idx_payment_receipts_receipt_id ON public.payment_receipts(receipt_id);

CREATE INDEX idx_payment_audit_logs_payment_id ON public.payment_audit_logs(payment_id);
CREATE INDEX idx_payment_audit_logs_transaction_id ON public.payment_audit_logs(transaction_id);
CREATE INDEX idx_payment_audit_logs_action ON public.payment_audit_logs(action);
CREATE INDEX idx_payment_audit_logs_timestamp ON public.payment_audit_logs(timestamp);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_type ON public.notifications(type);
CREATE INDEX idx_notifications_status ON public.notifications(status);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at);

-- Create function for atomic payment update with audit
CREATE OR REPLACE FUNCTION update_payment_with_audit(
    p_payment_id UUID,
    p_payment_status payment_status,
    p_provider_transaction_id VARCHAR(255),
    p_paid_at TIMESTAMPTZ,
    p_metadata JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_audit_log_id VARCHAR(255);
    v_result JSONB;
BEGIN
    -- Generate audit log ID
    v_audit_log_id := 'audit_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 9);
    
    -- Update payment record
    UPDATE public.payments
    SET 
        payment_status = p_payment_status,
        provider_transaction_id = p_provider_transaction_id,
        paid_at = p_paid_at,
        metadata = p_metadata,
        updated_at = NOW()
    WHERE id = p_payment_id;
    
    -- Create audit log entry
    INSERT INTO public.payment_audit_logs (
        audit_log_id,
        transaction_id,
        payment_id,
        action,
        data,
        timestamp,
        status
    ) VALUES (
        v_audit_log_id,
        p_metadata->>'auditTransactionId',
        p_payment_id,
        'payment_update',
        jsonb_build_object(
            'payment_status', p_payment_status,
            'provider_transaction_id', p_provider_transaction_id,
            'paid_at', p_paid_at,
            'metadata', p_metadata
        ),
        NOW(),
        'completed'
    );
    
    -- Return result
    v_result := jsonb_build_object(
        'success', true,
        'payment_id', p_payment_id,
        'audit_log_id', v_audit_log_id,
        'updated_at', NOW()
    );
    
    RETURN v_result;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error in audit
        INSERT INTO public.payment_audit_logs (
            audit_log_id,
            transaction_id,
            payment_id,
            action,
            data,
            timestamp,
            status,
            error_message
        ) VALUES (
            'audit_' || extract(epoch from now())::bigint || '_' || substr(md5(random()::text), 1, 9),
            p_metadata->>'auditTransactionId',
            p_payment_id,
            'payment_update_failed',
            jsonb_build_object(
                'payment_status', p_payment_status,
                'provider_transaction_id', p_provider_transaction_id,
                'paid_at', p_paid_at,
                'metadata', p_metadata
            ),
            NOW(),
            'failed',
            SQLERRM
        );
        
        RAISE;
END;
$$;

-- Create function to check for duplicate payment confirmations
CREATE OR REPLACE FUNCTION check_duplicate_payment_confirmation(p_payment_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 
        FROM public.payment_audit_logs 
        WHERE payment_id = p_payment_id 
        AND action = 'payment_confirmation' 
        AND status = 'completed'
    ) INTO v_exists;
    
    RETURN v_exists;
END;
$$;

-- Add comments for documentation
COMMENT ON TABLE public.payment_receipts IS 'Stores detailed payment receipts with service information for customer records';
COMMENT ON TABLE public.payment_audit_logs IS 'Tracks all payment-related actions for audit trail and debugging';
COMMENT ON TABLE public.notifications IS 'Stores customer notifications for payment events and system updates';
COMMENT ON FUNCTION update_payment_with_audit IS 'Atomic function to update payment status and create audit log entry';
COMMENT ON FUNCTION check_duplicate_payment_confirmation IS 'Check if payment has already been confirmed to prevent duplicates'; 