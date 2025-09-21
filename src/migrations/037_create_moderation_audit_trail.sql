-- Create moderation audit trail table
-- This table tracks all moderation decisions and actions for audit purposes

CREATE TABLE IF NOT EXISTS moderation_audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'suspend', 'activate', 'flag', 'block', 'warn', 'approve', 'reject', 
        'auto_suspend', 'auto_flag', 'auto_block', 'auto_warn'
    )),
    moderator_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    report_id UUID REFERENCES shop_reports(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_moderation_audit_trail_shop_id ON moderation_audit_trail(shop_id);
CREATE INDEX IF NOT EXISTS idx_moderation_audit_trail_action ON moderation_audit_trail(action);
CREATE INDEX IF NOT EXISTS idx_moderation_audit_trail_moderator_id ON moderation_audit_trail(moderator_id);
CREATE INDEX IF NOT EXISTS idx_moderation_audit_trail_created_at ON moderation_audit_trail(created_at);
CREATE INDEX IF NOT EXISTS idx_moderation_audit_trail_shop_action ON moderation_audit_trail(shop_id, action);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_moderation_audit_trail_shop_created ON moderation_audit_trail(shop_id, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE moderation_audit_trail ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy for admins to view all audit trail entries
CREATE POLICY "Admins can view all moderation audit trail entries"
    ON moderation_audit_trail
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Policy for shop owners to view their own shop's audit trail
CREATE POLICY "Shop owners can view their shop's moderation audit trail"
    ON moderation_audit_trail
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM shops 
            WHERE shops.id = moderation_audit_trail.shop_id 
            AND shops.owner_id = auth.uid()
        )
    );

-- Policy for system to insert audit trail entries
CREATE POLICY "System can insert moderation audit trail entries"
    ON moderation_audit_trail
    FOR INSERT
    WITH CHECK (true); -- Allow system inserts

-- Policy for admins to update audit trail entries (for corrections)
CREATE POLICY "Admins can update moderation audit trail entries"
    ON moderation_audit_trail
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Add trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_moderation_audit_trail_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_moderation_audit_trail_updated_at
    BEFORE UPDATE ON moderation_audit_trail
    FOR EACH ROW
    EXECUTE FUNCTION update_moderation_audit_trail_updated_at();

-- Add comments for documentation
COMMENT ON TABLE moderation_audit_trail IS 'Audit trail for all moderation actions taken on shops';
COMMENT ON COLUMN moderation_audit_trail.shop_id IS 'ID of the shop that was moderated';
COMMENT ON COLUMN moderation_audit_trail.action IS 'Type of moderation action taken';
COMMENT ON COLUMN moderation_audit_trail.moderator_id IS 'ID of the user who performed the moderation action';
COMMENT ON COLUMN moderation_audit_trail.reason IS 'Reason for the moderation action';
COMMENT ON COLUMN moderation_audit_trail.details IS 'Additional details about the moderation action in JSON format';
COMMENT ON COLUMN moderation_audit_trail.previous_status IS 'Shop status before the moderation action';
COMMENT ON COLUMN moderation_audit_trail.new_status IS 'Shop status after the moderation action';
COMMENT ON COLUMN moderation_audit_trail.report_id IS 'ID of the report that triggered this moderation action (if applicable)';
COMMENT ON COLUMN moderation_audit_trail.created_at IS 'When the moderation action was taken';
COMMENT ON COLUMN moderation_audit_trail.updated_at IS 'When the audit trail entry was last updated';
