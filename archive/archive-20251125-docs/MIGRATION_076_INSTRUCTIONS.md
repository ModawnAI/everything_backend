# Migration 076: Double Booking Prevention - Installation Instructions

## Overview
This migration adds comprehensive double booking prevention mechanisms to the database.

## Prerequisites
- Supabase project with admin access
- Database connection or access to Supabase SQL Editor

## Installation Methods

### Method 1: Supabase Dashboard (Recommended) ✅

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID
   - Click on "SQL Editor" in the left sidebar

2. **Copy the Migration SQL**
   - Open: `src/migrations/076_add_reservation_double_booking_prevention.sql`
   - Copy the entire contents (Ctrl+A, Ctrl+C)

3. **Run the Migration**
   - In the SQL Editor, click "New Query"
   - Paste the SQL contents
   - Click "Run" or press Ctrl+Enter

4. **Verify Success**
   - Check for green "Success" message
   - If you see errors like "already exists", those can be safely ignored

### Method 2: Using psql CLI

If you have psql installed and access to the database connection string:

```bash
# Set your database URL
export DATABASE_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"

# Run the migration
psql "$DATABASE_URL" -f src/migrations/076_add_reservation_double_booking_prevention.sql
```

### Method 3: Using Node.js Script

We've provided a helper script:

```bash
# Make sure environment variables are set
# SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY

# Run the migration
node scripts/run-migration-076.js
```

## Verification Steps

After running the migration, verify it was successful:

### 1. Check Unique Index

```sql
-- Run in Supabase SQL Editor
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'reservations'
  AND indexname = 'idx_reservations_no_double_booking';
```

**Expected Result**: 1 row showing the unique index

### 2. Check Trigger

```sql
-- Run in Supabase SQL Editor
SELECT
  tgname as trigger_name,
  tgenabled as is_enabled,
  pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid = 'reservations'::regclass
  AND tgname = 'trg_check_reservation_overlap';
```

**Expected Result**: 1 row showing the trigger details

### 3. Check Functions

```sql
-- Run in Supabase SQL Editor
SELECT
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc
WHERE proname IN (
  'check_reservation_overlap',
  'cleanup_stale_requested_reservations'
);
```

**Expected Result**: 2 rows (one for each function)

### 4. Check View

```sql
-- Run in Supabase SQL Editor
SELECT * FROM v_reservation_conflicts;
```

**Expected Result**: 0 rows (empty - no conflicts should exist)

### 5. Test Double Booking Prevention

Create a test reservation, then try to create a duplicate:

```sql
-- 1. Create first reservation (should succeed)
INSERT INTO reservations (
  id,
  shop_id,
  user_id,
  reservation_date,
  reservation_time,
  status,
  total_amount,
  deposit_amount,
  points_used
) VALUES (
  gen_random_uuid(),
  'your-shop-id-here'::uuid,
  'your-user-id-here'::uuid,
  '2024-03-20',
  '10:00',
  'confirmed',
  50000,
  10000,
  0
);

-- 2. Try to create duplicate (should FAIL with unique violation)
INSERT INTO reservations (
  id,
  shop_id,
  user_id,
  reservation_date,
  reservation_time,
  status,
  total_amount,
  deposit_amount,
  points_used
) VALUES (
  gen_random_uuid(),
  'your-shop-id-here'::uuid,
  'your-user-id-here'::uuid,
  '2024-03-20',
  '10:00',
  'confirmed',
  50000,
  10000,
  0
);

-- Expected error: duplicate key value violates unique constraint "idx_reservations_no_double_booking"
```

If you see the error message, **the migration is working correctly!** ✅

### 6. Cleanup Test Data

```sql
-- Delete test reservations
DELETE FROM reservations
WHERE reservation_date = '2024-03-20'
  AND reservation_time = '10:00';
```

## Troubleshooting

### Issue: "relation already exists" errors

**Solution**: This is normal if you're re-running the migration. The migration uses `IF EXISTS` and `IF NOT EXISTS` clauses to be idempotent.

### Issue: "permission denied" errors

**Solution**: Make sure you're using a user with admin/owner privileges. In Supabase, use the service role key or postgres user.

### Issue: Trigger not working

**Solution**: Check that the trigger is enabled:

```sql
ALTER TABLE reservations
ENABLE TRIGGER trg_check_reservation_overlap;
```

### Issue: Performance concerns

**Solution**: The indexes are optimized for performance. If you have millions of reservations, you may want to:

1. Add table partitioning by date
2. Archive old reservations
3. Adjust the stale reservation cleanup frequency

## Migration Contents Summary

This migration adds:

1. **Unique Index**: Prevents exact duplicate bookings
   - `idx_reservations_no_double_booking`

2. **Overlap Detection Trigger**: Checks for time slot overlaps
   - `trg_check_reservation_overlap`
   - `check_reservation_overlap()` function

3. **Performance Indexes**:
   - `idx_reservations_shop_date_time_status`
   - `idx_reservations_status_created_at`

4. **Maintenance Function**: Cleans up stale reservations
   - `cleanup_stale_requested_reservations()`

5. **Monitoring View**: Detects conflicts
   - `v_reservation_conflicts`

6. **Check Constraint**: Validates time format
   - `reservations_time_format_check`

## Rollback Procedure

If you need to rollback this migration:

```sql
-- WARNING: This will remove double booking protection!

-- Drop trigger
DROP TRIGGER IF EXISTS trg_check_reservation_overlap ON reservations;

-- Drop functions
DROP FUNCTION IF EXISTS check_reservation_overlap();
DROP FUNCTION IF EXISTS cleanup_stale_requested_reservations();

-- Drop indexes
DROP INDEX IF EXISTS idx_reservations_no_double_booking;
DROP INDEX IF EXISTS idx_reservations_shop_date_time_status;
DROP INDEX IF EXISTS idx_reservations_status_created_at;

-- Drop constraint
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_time_format_check;

-- Drop view
DROP VIEW IF EXISTS v_reservation_conflicts;
```

## Post-Migration Tasks

### 1. Schedule Cleanup Job (Optional)

To automatically clean up stale 'requested' reservations every 5 minutes:

```sql
-- If you have pg_cron extension enabled
SELECT cron.schedule(
  'cleanup-stale-reservations',
  '*/5 * * * *',
  $$SELECT cleanup_stale_requested_reservations()$$
);
```

Or use Node.js cron in your backend (see DOUBLE_BOOKING_PREVENTION.md).

### 2. Monitor for Conflicts

Set up monitoring to alert if conflicts are detected:

```sql
-- Add this query to your monitoring dashboard
SELECT COUNT(*) as conflict_count
FROM v_reservation_conflicts;
-- Should always be 0
```

### 3. Update Frontend Integration

Make sure your frontend is using the backend availability API:
- `GET /api/shops/{shopId}/available-slots`
- Don't generate time slots on the frontend
- Handle booking errors gracefully

See DOUBLE_BOOKING_PREVENTION.md for full integration guide.

## Support

If you encounter issues:

1. Check the full documentation: `DOUBLE_BOOKING_PREVENTION.md`
2. Review the migration file: `src/migrations/076_add_reservation_double_booking_prevention.sql`
3. Check backend logs for error messages
4. Open an issue with error details

## Success Checklist

- [✓] Migration SQL runs without fatal errors
- [✓] Unique index exists (`idx_reservations_no_double_booking`)
- [✓] Trigger exists and is enabled (`trg_check_reservation_overlap`)
- [✓] Functions exist (`check_reservation_overlap`, `cleanup_stale_requested_reservations`)
- [✓] View exists (`v_reservation_conflicts`)
- [✓] Test: Creating duplicate reservation fails with unique violation
- [✓] Test: Creating overlapping reservation fails with overlap error
- [✓] Backend tests pass
- [✓] Frontend integrated with backend availability API

---

**Migration Version**: 076
**Created**: 2024-03-15
**Database**: PostgreSQL (Supabase)
**Impact**: High (prevents double bookings)
**Rollback**: Possible (see Rollback Procedure above)
