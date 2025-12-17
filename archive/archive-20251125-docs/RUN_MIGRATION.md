# How to Add booking_preferences Column to Users Table

## ✅ What Was Created

### 1. Migration File
**Location:** `supabase/migrations/20251113_add_booking_preferences.sql`

This SQL file adds a new JSONB column to the `users` table for storing booking preferences.

### 2. TypeScript Types Updated
- ✅ `src/types/database.types.ts` - Added `BookingPreferences` interface and `booking_preferences` to `User`
- ✅ `src/services/user-profile.service.ts` - Added `booking_preferences` to `ProfileUpdateRequest`
- ✅ `src/controllers/user-profile.controller.ts` - Added transformation for `bookingPreferences` → `booking_preferences`

---

## 🚀 How to Run the Migration

### Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard:**
   - Go to https://app.supabase.com
   - Select your project

2. **Navigate to SQL Editor:**
   - Click "SQL Editor" in the left sidebar

3. **Run the Migration:**
   - Copy the contents of `supabase/migrations/20251113_add_booking_preferences.sql`
   - Paste into the SQL Editor
   - Click "Run" button

4. **Verify:**
   ```sql
   -- Check the column was created
   SELECT column_name, data_type
   FROM information_schema.columns
   WHERE table_name = 'users'
   AND column_name = 'booking_preferences';
   ```

### Option 2: Command Line (Using psql)

If you have direct database access:

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/migrations/20251113_add_booking_preferences.sql
```

### Option 3: Supabase CLI

If you have Supabase CLI installed:

```bash
# Link to your project (first time only)
supabase link --project-ref your-project-ref

# Run migration
supabase db push
```

---

## 📋 What the Migration Does

```sql
-- 1. Adds booking_preferences column (JSONB)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS booking_preferences JSONB DEFAULT '{}'::jsonb;

-- 2. Adds helpful comment
COMMENT ON COLUMN users.booking_preferences IS '...structure info...';

-- 3. Creates GIN index for fast JSONB queries
CREATE INDEX IF NOT EXISTS idx_users_booking_preferences_gin
ON users USING gin (booking_preferences);
```

---

## 🧪 After Migration

### 1. Restart Backend Server

```bash
npm run dev
```

### 2. Test Profile Update

The frontend can now send:

```json
{
  "name": "홍길동",
  "birthDate": "1990-01-01",
  "bookingPreferences": {
    "skinType": "oily",
    "allergyInfo": "None",
    "preferredStylist": "김미용사",
    "specialRequests": "Please be gentle"
  }
}
```

### 3. Backend Will Transform:

```javascript
bookingPreferences → booking_preferences
{
  skinType → skinType      // No change (keys inside JSONB stay camelCase)
  allergyInfo → allergyInfo
  ...
}
```

### 4. Verify in Database:

```sql
-- View booking preferences
SELECT
  id,
  name,
  booking_preferences
FROM users
WHERE booking_preferences IS NOT NULL;

-- Query by skin type
SELECT * FROM users
WHERE booking_preferences->>'skinType' = 'oily';

-- Update specific user
UPDATE users
SET booking_preferences = '{"skinType": "dry", "allergyInfo": "sensitive to perfume"}'::jsonb
WHERE id = 'user-uuid';
```

---

## 🎯 Data Structure

**Frontend sends (camelCase):**
```typescript
bookingPreferences: {
  skinType: 'normal' | 'dry' | 'oily' | 'combination' | 'sensitive'
  allergyInfo: string
  preferredStylist: string
  specialRequests: string
}
```

**Database stores (snake_case column, but JSONB content keeps camelCase):**
```sql
booking_preferences = {
  "skinType": "oily",
  "allergyInfo": "None",
  "preferredStylist": "김미용사",
  "specialRequests": "Please be gentle"
}
```

---

## ⚠️ Important Notes

1. **JSONB Content:** The keys INSIDE the JSONB object stay in camelCase (skinType, not skin_type)
2. **Column Name:** The column itself is snake_case (booking_preferences)
3. **Default Value:** New users get `{}` (empty object)
4. **Backward Compatible:** Existing users will have `{}` for booking_preferences

---

## ✅ Summary

- ✅ Migration file created
- ✅ TypeScript types updated
- ✅ Controller transformation added
- ⏳ **Next step:** Run the migration SQL in Supabase Dashboard
- ⏳ **Then:** Restart backend server

**Status:** Ready to migrate! 🚀
