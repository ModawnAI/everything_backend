# PortOne V2 Migration Instructions

## Overview
This migration adds missing columns and tables required for complete PortOne V2 integration.

## Migration Details

**File**: `supabase/migrations/20251226_portone_v2_enhancements_fixed.sql` ✅ (Use this fixed version)

**Changes**:
1. ✅ Adds 3 columns to `payments` table:
   - `payment_stage` (VARCHAR) - PortOne payment stage tracking
   - `cancelled_amount` (INTEGER) - Total cancelled/refunded amount
   - `cancellable_amount` (INTEGER) - Remaining cancellable amount

2. ✅ Creates `webhook_logs` table for webhook idempotency:
   - Prevents duplicate webhook processing
   - Tracks all webhook events
   - Includes full request/response data for debugging

3. ✅ Creates `billing_keys` table for saved payment methods:
   - Stores PortOne billing keys for recurring payments
   - Masked card information
   - User payment preferences

4. ✅ Adds indexes, constraints, RLS policies, and triggers

## Execution Steps

### Method 1: Supabase SQL Editor (Recommended)

1. Open Supabase SQL Editor:
   ```
   https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh/sql
   ```

2. Copy the entire SQL from:
   ```
   supabase/migrations/20251226_portone_v2_enhancements_fixed.sql
   ```

   ⚠️ **Important**: Use the `_fixed.sql` version, not the original one!

3. Paste into the SQL editor and click **"Run"**

4. Verify success - you should see:
   ```
   Success. No rows returned
   ```

### Method 2: Supabase CLI (Alternative)

If you have Supabase CLI installed:

```bash
supabase db push
```

### Method 3: Direct SQL Execution

```bash
psql "postgresql://postgres.ysrudwzwnzxrrwjtpuoh:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
  -f supabase/migrations/20251226_portone_v2_enhancements.sql
```

## Verification

After running the migration, verify the changes:

```sql
-- Check new columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'payments'
AND column_name IN ('payment_stage', 'cancelled_amount', 'cancellable_amount');

-- Check new tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('webhook_logs', 'billing_keys');

-- Count rows in new tables
SELECT
  (SELECT COUNT(*) FROM webhook_logs) as webhook_count,
  (SELECT COUNT(*) FROM billing_keys) as billing_keys_count;
```

## Rollback (If Needed)

If you need to rollback the migration:

```sql
-- Remove new columns
ALTER TABLE public.payments
  DROP COLUMN IF EXISTS payment_stage,
  DROP COLUMN IF EXISTS cancelled_amount,
  DROP COLUMN IF EXISTS cancellable_amount;

-- Drop new tables
DROP TABLE IF EXISTS public.webhook_logs CASCADE;
DROP TABLE IF EXISTS public.billing_keys CASCADE;
```

## Next Steps

After running this migration:
1. Restart the backend server to ensure code recognizes new schema
2. Test payment initialization with new columns
3. Test webhook delivery with idempotency protection
4. Verify virtual account refunds work correctly

## Notes

- This migration is **safe** and **idempotent** - it uses `IF NOT EXISTS` and `IF EXISTS` checks
- Existing payment data will be automatically backfilled with appropriate values
- All new tables have RLS policies configured for security
- The migration takes approximately **5-10 seconds** to execute
