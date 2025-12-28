# Run PortOne Payment Methods Migration

## Status
❌ **Migration needs to be run manually in Supabase**

The `user_payment_methods` table does not exist yet in your Supabase database.

---

## Option 1: Supabase Dashboard (Recommended)

1. Open Supabase SQL Editor:
   🔗 **https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh/sql/new**

2. Copy the entire SQL from this file:
   ```
   supabase/migrations/20251112190100_user_payment_methods.sql
   ```

3. Paste into SQL Editor

4. Click "Run" button

5. Verify success:
   - You should see "Success. No rows returned"
   - Check Tables → user_payment_methods should appear

---

## Option 2: Command Line (If you have database password)

```bash
# Replace [PASSWORD] with your actual Supabase database password
psql "postgresql://postgres:[PASSWORD]@db.ysrudwzwnzxrrwjtpuoh.supabase.co:5432/postgres" \
  -f supabase/migrations/20251112190100_user_payment_methods.sql
```

---

## Option 3: Copy SQL Directly

```sql
-- Copy everything below and paste into Supabase SQL Editor:

-- Create user_payment_methods table
CREATE TABLE IF NOT EXISTS public.user_payment_methods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  billing_key TEXT NOT NULL UNIQUE,
  portone_customer_id TEXT,
  issue_id TEXT,
  issue_name TEXT,

  payment_method_type TEXT NOT NULL DEFAULT 'CARD',

  card_company TEXT,
  card_type TEXT,
  card_number_masked TEXT,
  card_number_last4 TEXT,
  card_brand TEXT,

  nickname TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  issued_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  portone_metadata JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT unique_user_billing_key UNIQUE(user_id, billing_key),
  CONSTRAINT check_card_last4_length CHECK (card_number_last4 IS NULL OR length(card_number_last4) = 4)
);

-- Indexes
CREATE INDEX idx_user_payment_methods_user_id ON public.user_payment_methods(user_id) WHERE is_active = true;
CREATE INDEX idx_user_payment_methods_billing_key ON public.user_payment_methods(billing_key) WHERE is_active = true;
CREATE INDEX idx_user_payment_methods_is_default ON public.user_payment_methods(user_id, is_default) WHERE is_default = true AND is_active = true;
CREATE INDEX idx_user_payment_methods_created_at ON public.user_payment_methods(created_at DESC);
CREATE UNIQUE INDEX idx_user_default_payment_method ON public.user_payment_methods(user_id) WHERE is_default = true AND is_active = true;

-- RLS
ALTER TABLE public.user_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payment methods" ON public.user_payment_methods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own payment methods" ON public.user_payment_methods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own payment methods" ON public.user_payment_methods FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete (soft delete) their own payment methods" ON public.user_payment_methods FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all payment methods" ON public.user_payment_methods FOR SELECT USING (EXISTS (SELECT 1 FROM auth.users WHERE auth.users.id = auth.uid() AND auth.users.raw_user_meta_data->>'role' = 'admin'));

-- Triggers
CREATE OR REPLACE FUNCTION update_user_payment_methods_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_payment_methods_updated_at BEFORE UPDATE ON public.user_payment_methods FOR EACH ROW EXECUTE FUNCTION update_user_payment_methods_updated_at();

-- Comments
COMMENT ON TABLE public.user_payment_methods IS 'Stores user payment methods (billing keys) from PortOne for quick checkout';
COMMENT ON COLUMN public.user_payment_methods.billing_key IS 'PortOne billing key - used for subscription/recurring payments';
COMMENT ON COLUMN public.user_payment_methods.card_number_masked IS 'Masked card number for display (e.g., 1234-****-****-5678)';
COMMENT ON COLUMN public.user_payment_methods.is_default IS 'Whether this is the user default payment method (only one per user)';
COMMENT ON COLUMN public.user_payment_methods.usage_count IS 'Number of times this payment method has been used';
```

---

## Verification

After running the migration, verify with this query:

```sql
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'user_payment_methods'
ORDER BY ordinal_position;
```

You should see 22 columns including:
- id
- user_id
- billing_key
- card_company
- card_number_last4
- is_default
- etc.

---

## Testing

After migration, test the endpoint:

```bash
# Should return empty array (no payment methods yet)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/user/payment-methods
```

Expected response:
```json
{
  "success": true,
  "data": {
    "paymentMethods": []
  }
}
```

---

## Additional PortOne-Related Schema Check

The `payments` table should already have these PortOne fields:
- `payment_provider` (VARCHAR)
- `provider_transaction_id` (VARCHAR)
- `provider_order_id` (VARCHAR)
- `is_deposit` (BOOLEAN)
- `payment_stage` (TEXT)

If missing, they should be added to support PortOne integration.
