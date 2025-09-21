-- Add payment_completed notification type for v3.1 flow
-- This notification is sent to shop owners when customers complete payments for reservations

ALTER TYPE notification_type ADD VALUE 'payment_completed' AFTER 'reservation_requested';

-- Add comment for documentation
COMMENT ON TYPE notification_type IS 'Notification types for the system. Includes reservation_requested (new reservation), payment_completed (payment done), and other system notifications.';
