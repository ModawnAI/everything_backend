-- Create notification tables for FCM push notifications

-- Device tokens table for storing Firebase device tokens
CREATE TABLE IF NOT EXISTS device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    device_type TEXT NOT NULL CHECK (device_type IN ('android', 'ios', 'web')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(is_active);

-- Notification history table for tracking sent notifications
CREATE TABLE IF NOT EXISTS notification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for notification history
CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_status ON notification_history(status);
CREATE INDEX IF NOT EXISTS idx_notification_history_created_at ON notification_history(created_at DESC);

-- Notification settings table for user preferences
CREATE TABLE IF NOT EXISTS notification_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    push_enabled BOOLEAN NOT NULL DEFAULT true,
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    sms_enabled BOOLEAN NOT NULL DEFAULT false,
    reservation_updates BOOLEAN NOT NULL DEFAULT true,
    payment_notifications BOOLEAN NOT NULL DEFAULT true,
    promotional_messages BOOLEAN NOT NULL DEFAULT false,
    system_alerts BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create index for notification settings
CREATE INDEX IF NOT EXISTS idx_notification_settings_updated_at ON notification_settings(updated_at);

-- Add RLS policies for device_tokens table
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only see their own device tokens
CREATE POLICY "Users can view own device tokens" ON device_tokens
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own device tokens
CREATE POLICY "Users can insert own device tokens" ON device_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own device tokens
CREATE POLICY "Users can update own device tokens" ON device_tokens
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own device tokens
CREATE POLICY "Users can delete own device tokens" ON device_tokens
    FOR DELETE USING (auth.uid() = user_id);

-- Add RLS policies for notification_history table
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notification history
CREATE POLICY "Users can view own notification history" ON notification_history
    FOR SELECT USING (auth.uid() = user_id);

-- System can insert notification history (no user check needed for system operations)
CREATE POLICY "System can insert notification history" ON notification_history
    FOR INSERT WITH CHECK (true);

-- Add RLS policies for notification_settings table
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notification settings
CREATE POLICY "Users can view own notification settings" ON notification_settings
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own notification settings
CREATE POLICY "Users can insert own notification settings" ON notification_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own notification settings
CREATE POLICY "Users can update own notification settings" ON notification_settings
    FOR UPDATE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_device_tokens_updated_at 
    BEFORE UPDATE ON device_tokens 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_settings_updated_at 
    BEFORE UPDATE ON notification_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to cleanup old notification history
CREATE OR REPLACE FUNCTION cleanup_old_notification_history()
RETURNS void AS $$
BEGIN
    -- Delete notification history older than 90 days
    DELETE FROM notification_history 
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ language 'plpgsql';

-- Create function to cleanup invalid device tokens
CREATE OR REPLACE FUNCTION cleanup_invalid_device_tokens()
RETURNS void AS $$
BEGIN
    -- Mark device tokens as inactive if not updated in 30 days
    UPDATE device_tokens 
    SET is_active = false 
    WHERE updated_at < NOW() - INTERVAL '30 days' 
    AND is_active = true;
END;
$$ language 'plpgsql';

-- Create scheduled jobs for cleanup (if using pg_cron extension)
-- Note: These would need to be set up separately in production
-- SELECT cron.schedule('cleanup-notification-history', '0 2 * * *', 'SELECT cleanup_old_notification_history();');
-- SELECT cron.schedule('cleanup-invalid-tokens', '0 3 * * *', 'SELECT cleanup_invalid_device_tokens();');

-- Insert default notification settings for existing users
INSERT INTO notification_settings (user_id, push_enabled, email_enabled, sms_enabled, reservation_updates, payment_notifications, promotional_messages, system_alerts)
SELECT 
    id as user_id,
    true as push_enabled,
    true as email_enabled,
    false as sms_enabled,
    true as reservation_updates,
    true as payment_notifications,
    false as promotional_messages,
    true as system_alerts
FROM users
WHERE id NOT IN (SELECT user_id FROM notification_settings)
ON CONFLICT (user_id) DO NOTHING; 