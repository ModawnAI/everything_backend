-- Migration: 036_create_moderation_rules_table.sql
-- Description: Create table for automated content moderation rules
-- Author: Task Master AI - Phase 3 Shop System
-- Created: 2025-01-20
-- Task: #12.1 - Create Shop Report Database Schema and Migration

-- Create an ENUM type for rule types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_rule_type') THEN
        CREATE TYPE public.moderation_rule_type AS ENUM (
            'keyword_filter',
            'image_content_filter',
            'spam_detection',
            'duplicate_content',
            'inappropriate_language',
            'fake_shop_detection',
            'copyright_violation',
            'custom_regex',
            'ml_content_analysis',
            'user_behavior_pattern'
        );
    END IF;
END
$$;

-- Create an ENUM type for rule actions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_rule_action') THEN
        CREATE TYPE public.moderation_rule_action AS ENUM (
            'flag_for_review',
            'auto_reject',
            'auto_approve',
            'send_warning',
            'suspend_shop',
            'send_notification',
            'escalate_to_admin',
            'log_incident',
            'custom_action'
        );
    END IF;
END
$$;

-- Create an ENUM type for rule status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_rule_status') THEN
        CREATE TYPE public.moderation_rule_status AS ENUM (
            'active',
            'inactive',
            'testing',
            'deprecated'
        );
    END IF;
END
$$;

-- Create the moderation_rules table
CREATE TABLE public.moderation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type moderation_rule_type NOT NULL,
    rule_action moderation_rule_action NOT NULL,
    rule_config JSONB NOT NULL, -- Configuration for the rule (patterns, thresholds, etc.)
    priority INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high, 4=critical
    status moderation_rule_status DEFAULT 'active',
    is_automated BOOLEAN DEFAULT TRUE,
    trigger_conditions JSONB, -- Conditions that must be met for the rule to trigger
    action_config JSONB, -- Configuration for the action to be taken
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_triggered_at TIMESTAMPTZ,
    trigger_count INTEGER DEFAULT 0,
    false_positive_count INTEGER DEFAULT 0,
    accuracy_score DECIMAL(5,4) -- Accuracy score (0.0000 to 1.0000)
);

-- Add comments for documentation
COMMENT ON TABLE public.moderation_rules IS 'Stores automated moderation rules for content filtering and spam detection.';
COMMENT ON COLUMN public.moderation_rules.id IS 'Unique identifier for the moderation rule.';
COMMENT ON COLUMN public.moderation_rules.name IS 'Human-readable name for the rule.';
COMMENT ON COLUMN public.moderation_rules.description IS 'Detailed description of what the rule does.';
COMMENT ON COLUMN public.moderation_rules.rule_type IS 'Type of moderation rule (keyword_filter, spam_detection, etc.).';
COMMENT ON COLUMN public.moderation_rules.rule_action IS 'Action to take when the rule is triggered.';
COMMENT ON COLUMN public.moderation_rules.rule_config IS 'JSON configuration for the rule (patterns, keywords, thresholds).';
COMMENT ON COLUMN public.moderation_rules.priority IS 'Priority level of the rule (1=low, 2=medium, 3=high, 4=critical).';
COMMENT ON COLUMN public.moderation_rules.status IS 'Current status of the rule (active, inactive, testing, deprecated).';
COMMENT ON COLUMN public.moderation_rules.is_automated IS 'Whether this rule runs automatically or requires manual review.';
COMMENT ON COLUMN public.moderation_rules.trigger_conditions IS 'Additional conditions that must be met for the rule to trigger.';
COMMENT ON COLUMN public.moderation_rules.action_config IS 'Configuration for the action to be taken when triggered.';
COMMENT ON COLUMN public.moderation_rules.created_by IS 'Foreign key to users table - who created the rule.';
COMMENT ON COLUMN public.moderation_rules.created_at IS 'Timestamp when the rule was created.';
COMMENT ON COLUMN public.moderation_rules.updated_at IS 'Timestamp when the rule was last updated.';
COMMENT ON COLUMN public.moderation_rules.last_triggered_at IS 'Timestamp when the rule was last triggered.';
COMMENT ON COLUMN public.moderation_rules.trigger_count IS 'Total number of times this rule has been triggered.';
COMMENT ON COLUMN public.moderation_rules.false_positive_count IS 'Number of false positives this rule has generated.';
COMMENT ON COLUMN public.moderation_rules.accuracy_score IS 'Accuracy score of the rule (0.0000 to 1.0000).';

-- Create indexes for efficient querying
CREATE INDEX idx_moderation_rules_type ON public.moderation_rules(rule_type);
CREATE INDEX idx_moderation_rules_status ON public.moderation_rules(status);
CREATE INDEX idx_moderation_rules_priority ON public.moderation_rules(priority DESC);
CREATE INDEX idx_moderation_rules_automated ON public.moderation_rules(is_automated);
CREATE INDEX idx_moderation_rules_created_by ON public.moderation_rules(created_by);
CREATE INDEX idx_moderation_rules_active ON public.moderation_rules(status, priority DESC) WHERE status = 'active';
CREATE INDEX idx_moderation_rules_accuracy ON public.moderation_rules(accuracy_score DESC);

-- Add RLS policies for moderation_rules
ALTER TABLE public.moderation_rules ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to view active rules (for transparency)
CREATE POLICY "Authenticated users can view active moderation rules"
ON public.moderation_rules FOR SELECT
TO authenticated
USING (status = 'active');

-- Policy for moderators/admins to view all rules
CREATE POLICY "Moderators can view all moderation rules"
ON public.moderation_rules FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('admin', 'moderator')
    )
);

-- Policy for admins to manage rules
CREATE POLICY "Admins can manage moderation rules"
ON public.moderation_rules FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role = 'admin'
    )
);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_moderation_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_moderation_rules_updated_at
    BEFORE UPDATE ON public.moderation_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_moderation_rules_updated_at();

-- Create a function to update rule statistics when triggered
CREATE OR REPLACE FUNCTION update_rule_stats_on_trigger(rule_id UUID, is_false_positive BOOLEAN DEFAULT FALSE)
RETURNS VOID AS $$
BEGIN
    UPDATE public.moderation_rules 
    SET 
        last_triggered_at = NOW(),
        trigger_count = trigger_count + 1,
        false_positive_count = CASE 
            WHEN is_false_positive THEN false_positive_count + 1 
            ELSE false_positive_count 
        END,
        accuracy_score = CASE 
            WHEN trigger_count > 0 THEN 
                GREATEST(0, (trigger_count::DECIMAL - false_positive_count::DECIMAL) / trigger_count::DECIMAL)
            ELSE accuracy_score
        END
    WHERE id = rule_id;
END;
$$ LANGUAGE plpgsql;

-- Insert some default moderation rules
INSERT INTO public.moderation_rules (name, description, rule_type, rule_action, rule_config, priority, created_by) VALUES
(
    'Spam Keyword Detection',
    'Detects common spam keywords in shop descriptions and names',
    'keyword_filter',
    'flag_for_review',
    '{"keywords": ["spam", "scam", "fake", "click here", "free money", "get rich quick"], "case_sensitive": false, "match_type": "contains"}',
    2,
    (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1)
),
(
    'Inappropriate Language Filter',
    'Detects inappropriate language in shop content',
    'inappropriate_language',
    'flag_for_review',
    '{"severity_threshold": 0.7, "categories": ["profanity", "hate_speech", "harassment"]}',
    3,
    (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1)
),
(
    'Duplicate Content Detection',
    'Detects duplicate shop descriptions or suspiciously similar content',
    'duplicate_content',
    'flag_for_review',
    '{"similarity_threshold": 0.85, "check_fields": ["description", "name"]}',
    2,
    (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1)
),
(
    'Suspicious Contact Information',
    'Detects suspicious or fake contact information patterns',
    'custom_regex',
    'flag_for_review',
    '{"patterns": ["^(\\+?1?[-.\\(\\)\\s]?)?(\\d{3}[-.\\(\\)\\s]?)?\\d{3}[-.\\(\\)\\s]?\\d{4}$", "test@.*\\.com", "fake@.*\\.com"], "description": "Phone numbers and suspicious email patterns"}',
    2,
    (SELECT id FROM public.users WHERE role = 'admin' LIMIT 1)
);
