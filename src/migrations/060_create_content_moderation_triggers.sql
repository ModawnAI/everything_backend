-- Migration: Create database triggers for automatic content hiding
-- Description: Implements automatic content moderation triggers based on report thresholds
-- Author: AI Assistant
-- Date: 2025-01-27
-- Prerequisites: Requires post_reports and comment_reports tables (created in migration 058)

-- Create function to handle automatic post hiding based on report count
CREATE OR REPLACE FUNCTION auto_hide_reported_content()
RETURNS TRIGGER AS $$
DECLARE
    report_count INTEGER;
    hide_threshold INTEGER := 5; -- Default threshold
    remove_threshold INTEGER := 10; -- Default removal threshold
    post_author_id UUID;
BEGIN
    -- Get the current report count for this post
    SELECT COUNT(*) INTO report_count
    FROM post_reports 
    WHERE post_id = NEW.post_id 
    AND status = 'pending';

    -- Get the post author for notifications
    SELECT author_id INTO post_author_id
    FROM feed_posts 
    WHERE id = NEW.post_id;

    -- Auto-hide if threshold reached
    IF report_count >= hide_threshold AND report_count < remove_threshold THEN
        UPDATE feed_posts 
        SET 
            is_hidden = true,
            moderation_status = 'auto_hidden',
            hidden_at = NOW(),
            report_count = report_count
        WHERE id = NEW.post_id;

        -- Log the auto-hide action
        INSERT INTO moderation_log (
            content_id,
            content_type,
            action,
            reason,
            automated,
            report_count,
            created_at
        ) VALUES (
            NEW.post_id,
            'post',
            'auto_hide',
            'Automatically hidden due to ' || report_count || ' reports',
            true,
            report_count,
            NOW()
        );

        -- Create notification for post author
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            metadata,
            created_at
        ) VALUES (
            post_author_id,
            'content_moderation',
            'Post Hidden Due to Reports',
            'Your post has been automatically hidden due to multiple reports. It will be reviewed by our moderation team.',
            jsonb_build_object(
                'post_id', NEW.post_id,
                'action', 'auto_hide',
                'report_count', report_count,
                'threshold', hide_threshold
            ),
            NOW()
        );

    -- Auto-remove if removal threshold reached
    ELSIF report_count >= remove_threshold THEN
        UPDATE feed_posts 
        SET 
            is_hidden = true,
            moderation_status = 'auto_removed',
            hidden_at = NOW(),
            report_count = report_count
        WHERE id = NEW.post_id;

        -- Log the auto-remove action
        INSERT INTO moderation_log (
            content_id,
            content_type,
            action,
            reason,
            automated,
            report_count,
            created_at
        ) VALUES (
            NEW.post_id,
            'post',
            'auto_remove',
            'Automatically removed due to ' || report_count || ' reports',
            true,
            report_count,
            NOW()
        );

        -- Create notification for post author
        INSERT INTO notifications (
            user_id,
            type,
            title,
            message,
            metadata,
            created_at
        ) VALUES (
            post_author_id,
            'content_moderation',
            'Post Removed Due to Reports',
            'Your post has been automatically removed due to excessive reports. Please review our community guidelines.',
            jsonb_build_object(
                'post_id', NEW.post_id,
                'action', 'auto_remove',
                'report_count', report_count,
                'threshold', remove_threshold
            ),
            NOW()
        );

    -- Update report count for posts below thresholds
    ELSE
        UPDATE feed_posts 
        SET report_count = report_count
        WHERE id = NEW.post_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic content hiding on new reports
DROP TRIGGER IF EXISTS trigger_auto_hide_content ON post_reports;
CREATE TRIGGER trigger_auto_hide_content
    AFTER INSERT ON post_reports
    FOR EACH ROW
    EXECUTE FUNCTION auto_hide_reported_content();

-- Create function to handle comment auto-moderation
CREATE OR REPLACE FUNCTION auto_moderate_reported_comments()
RETURNS TRIGGER AS $$
DECLARE
    report_count INTEGER;
    hide_threshold INTEGER := 3; -- Lower threshold for comments
    remove_threshold INTEGER := 5; -- Lower removal threshold for comments
    comment_author_id UUID;
    post_id UUID;
BEGIN
    -- Get the current report count for this comment
    SELECT COUNT(*) INTO report_count
    FROM comment_reports 
    WHERE comment_id = NEW.comment_id 
    AND status = 'pending';

    -- Get the comment author and post for notifications
    SELECT author_id, post_id INTO comment_author_id, post_id
    FROM post_comments 
    WHERE id = NEW.comment_id;

    -- Auto-hide if threshold reached
    IF report_count >= hide_threshold AND report_count < remove_threshold THEN
        UPDATE post_comments 
        SET 
            is_hidden = true,
            moderation_status = 'auto_hidden',
            hidden_at = NOW(),
            report_count = report_count
        WHERE id = NEW.comment_id;

        -- Log the auto-hide action
        INSERT INTO moderation_log (
            content_id,
            content_type,
            action,
            reason,
            automated,
            report_count,
            created_at
        ) VALUES (
            NEW.comment_id,
            'comment',
            'auto_hide',
            'Automatically hidden due to ' || report_count || ' reports',
            true,
            report_count,
            NOW()
        );

    -- Auto-remove if removal threshold reached
    ELSIF report_count >= remove_threshold THEN
        UPDATE post_comments 
        SET 
            is_hidden = true,
            moderation_status = 'auto_removed',
            hidden_at = NOW(),
            report_count = report_count
        WHERE id = NEW.comment_id;

        -- Log the auto-remove action
        INSERT INTO moderation_log (
            content_id,
            content_type,
            action,
            reason,
            automated,
            report_count,
            created_at
        ) VALUES (
            NEW.comment_id,
            'comment',
            'auto_remove',
            'Automatically removed due to ' || report_count || ' reports',
            true,
            report_count,
            NOW()
        );

    -- Update report count for comments below thresholds
    ELSE
        UPDATE post_comments 
        SET report_count = report_count
        WHERE id = NEW.comment_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic comment moderation (if comment_reports table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comment_reports') THEN
        DROP TRIGGER IF EXISTS trigger_auto_moderate_comments ON comment_reports;
        CREATE TRIGGER trigger_auto_moderate_comments
            AFTER INSERT ON comment_reports
            FOR EACH ROW
            EXECUTE FUNCTION auto_moderate_reported_comments();
    END IF;
END $$;

-- Create function to update post report counts
CREATE OR REPLACE FUNCTION update_post_report_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the report count in the feed_posts table
    UPDATE feed_posts 
    SET report_count = (
        SELECT COUNT(*) 
        FROM post_reports 
        WHERE post_id = COALESCE(NEW.post_id, OLD.post_id)
        AND status = 'pending'
    )
    WHERE id = COALESCE(NEW.post_id, OLD.post_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for report count updates
DROP TRIGGER IF EXISTS trigger_update_report_count_insert ON post_reports;
CREATE TRIGGER trigger_update_report_count_insert
    AFTER INSERT ON post_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_post_report_count();

DROP TRIGGER IF EXISTS trigger_update_report_count_update ON post_reports;
CREATE TRIGGER trigger_update_report_count_update
    AFTER UPDATE ON post_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_post_report_count();

DROP TRIGGER IF EXISTS trigger_update_report_count_delete ON post_reports;
CREATE TRIGGER trigger_update_report_count_delete
    AFTER DELETE ON post_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_post_report_count();

-- Create function to prevent duplicate reports
CREATE OR REPLACE FUNCTION prevent_duplicate_reports()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if user has already reported this post
    IF EXISTS (
        SELECT 1 FROM post_reports 
        WHERE post_id = NEW.post_id 
        AND reporter_id = NEW.reporter_id
        AND status = 'pending'
    ) THEN
        RAISE EXCEPTION 'User has already reported this post';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent duplicate reports
DROP TRIGGER IF EXISTS trigger_prevent_duplicate_reports ON post_reports;
CREATE TRIGGER trigger_prevent_duplicate_reports
    BEFORE INSERT ON post_reports
    FOR EACH ROW
    EXECUTE FUNCTION prevent_duplicate_reports();

-- Note: moderation_log table is created in migration 054_fix_content_moderation_tables.sql

-- Create function to clean up old resolved reports (optional maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_reports()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete resolved reports older than 90 days
    DELETE FROM post_reports 
    WHERE status = 'resolved' 
    AND updated_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup
    INSERT INTO moderation_log (
        content_id,
        content_type,
        action,
        reason,
        automated,
        created_at
    ) VALUES (
        uuid_generate_v4(), -- Dummy content_id for system actions
        'post',
        'cleanup',
        'Cleaned up ' || deleted_count || ' old resolved reports',
        true,
        NOW()
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION auto_hide_reported_content() IS 'Automatically hides or removes posts based on report count thresholds';
COMMENT ON FUNCTION auto_moderate_reported_comments() IS 'Automatically moderates comments based on report count thresholds';
COMMENT ON FUNCTION update_post_report_count() IS 'Maintains accurate report counts in the posts table';
COMMENT ON FUNCTION prevent_duplicate_reports() IS 'Prevents users from reporting the same content multiple times';
COMMENT ON FUNCTION cleanup_old_reports() IS 'Maintenance function to clean up old resolved reports';
COMMENT ON TABLE moderation_log IS 'Audit log for all moderation actions, both automated and manual';

-- Grant necessary permissions (adjust as needed for your user roles)
-- GRANT EXECUTE ON FUNCTION auto_hide_reported_content() TO authenticated;
-- GRANT EXECUTE ON FUNCTION auto_moderate_reported_comments() TO authenticated;
-- GRANT EXECUTE ON FUNCTION update_post_report_count() TO authenticated;
-- GRANT EXECUTE ON FUNCTION prevent_duplicate_reports() TO authenticated;
-- GRANT SELECT, INSERT ON moderation_log TO authenticated;
