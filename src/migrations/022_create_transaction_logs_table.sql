-- Migration: 008_create_transaction_logs_table.sql
-- Description: Create transaction logs table for transaction management system
-- Author: Task Master AI
-- Created: 2025-07-29

-- Transaction Logs table for monitoring and debugging
CREATE TABLE public.transaction_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id VARCHAR(255) NOT NULL,
  operation VARCHAR(100) NOT NULL,
  details JSONB,
  timestamp BIGINT NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  session_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_transaction_logs_transaction_id ON public.transaction_logs(transaction_id);
CREATE INDEX idx_transaction_logs_timestamp ON public.transaction_logs(timestamp);
CREATE INDEX idx_transaction_logs_operation ON public.transaction_logs(operation);
CREATE INDEX idx_transaction_logs_user_id ON public.transaction_logs(user_id);

-- RLS Policies for transaction logs
CREATE POLICY transaction_logs_admin_all ON public.transaction_logs 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() 
  AND user_role = 'admin'
)) 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() 
  AND user_role = 'admin'
));

-- Enable RLS
ALTER TABLE public.transaction_logs ENABLE ROW LEVEL SECURITY;

-- Function to clean old transaction logs (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_transaction_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.transaction_logs 
  WHERE timestamp < EXTRACT(EPOCH FROM (NOW() - INTERVAL '30 days')) * 1000;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comment on table and columns
COMMENT ON TABLE public.transaction_logs IS 'Transaction logs for monitoring and debugging transaction management system';
COMMENT ON COLUMN public.transaction_logs.transaction_id IS 'Unique transaction identifier';
COMMENT ON COLUMN public.transaction_logs.operation IS 'Type of operation (BEGIN_TRANSACTION, COMMIT_TRANSACTION, ROLLBACK_TRANSACTION, etc.)';
COMMENT ON COLUMN public.transaction_logs.details IS 'Additional details about the operation in JSON format';
COMMENT ON COLUMN public.transaction_logs.timestamp IS 'Unix timestamp in milliseconds when the operation occurred';
COMMENT ON COLUMN public.transaction_logs.user_id IS 'User who initiated the transaction (if applicable)';
COMMENT ON COLUMN public.transaction_logs.session_id IS 'Session identifier for tracking user sessions'; 