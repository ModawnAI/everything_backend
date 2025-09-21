-- Add reservation_confirmed notification type for v3.1 flow
-- This notification is sent to customers when shop owners confirm their reservations

ALTER TYPE notification_type ADD VALUE 'reservation_confirmed' AFTER 'payment_completed';

-- Add comment for documentation
COMMENT ON TYPE notification_type IS 'Notification types for the system. Includes reservation_requested (new reservation), payment_completed (payment done), reservation_confirmed (shop confirmed reservation), and other system notifications.';
