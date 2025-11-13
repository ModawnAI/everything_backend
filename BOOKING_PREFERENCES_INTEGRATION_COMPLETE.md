# Booking Preferences Integration - Complete Implementation

## ✅ What Was Implemented

### User's Requirement:
> "so during making a reservatino make sure these data are included as part of the process. originally people needed to input this information, but i took it out an put it in profile. hence for every reservation we need the info above so make sure you integrate it and it fulfills the condition."

### Summary:
Booking preferences (skinType, allergyInfo, preferredStylist, specialRequests) are now:
1. ✅ Required to be completed in user profile before making a reservation
2. ✅ Stored as a snapshot with each reservation (preserves historical data)
3. ✅ Included in all reservation detail and list responses

---

## 📋 Implementation Details

### 1. Database Migrations

#### Migration for Users Table
**File:** `supabase/migrations/20251113_add_booking_preferences.sql`

```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS booking_preferences JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN users.booking_preferences IS 'User booking preferences...';

CREATE INDEX IF NOT EXISTS idx_users_booking_preferences_gin
ON users USING gin (booking_preferences);
```

#### Migration for Reservations Table
**File:** `supabase/migrations/20251113_add_booking_preferences_to_reservations.sql`

```sql
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS booking_preferences JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN reservations.booking_preferences IS 'Snapshot of user booking preferences at time of reservation...';

CREATE INDEX IF NOT EXISTS idx_reservations_booking_preferences_gin
ON reservations USING gin (booking_preferences);
```

**Status:** ⏳ Both migrations need to be run in Supabase Dashboard

---

### 2. TypeScript Type Definitions

**File:** `src/types/database.types.ts`

Added `BookingPreferences` interface and updated both `User` and `Reservation` interfaces:

```typescript
export interface BookingPreferences {
  skinType?: 'normal' | 'dry' | 'oily' | 'combination' | 'sensitive';
  allergyInfo?: string;
  preferredStylist?: string;
  specialRequests?: string;
}

export interface User {
  // ...
  booking_preferences?: BookingPreferences;
}

export interface Reservation {
  // ...
  booking_preferences?: BookingPreferences; // Snapshot at time of booking
}
```

---

### 3. Profile Update Controller

**File:** `src/controllers/user-profile.controller.ts` (lines 122-155)

Added automatic field transformation from camelCase to snake_case:

```typescript
// Transform bookingPreferences
if ('bookingPreferences' in updates) {
  transformedUpdates.booking_preferences = updates.bookingPreferences;
  delete transformedUpdates.bookingPreferences;
}
```

This allows frontend to send camelCase while database uses snake_case.

---

### 4. Reservation Service - Validation

**File:** `src/services/reservation.service.ts` (lines 116-150)

Added validation in `createReservation` method:

```typescript
// Fetch and validate user's booking preferences (REQUIRED for reservation)
const { data: userData, error: userError } = await this.supabase
  .from('users')
  .select('booking_preferences')
  .eq('id', userId)
  .single();

const bookingPreferences = userData?.booking_preferences || {};

// Validate that user has filled out required booking preferences
if (!bookingPreferences.skinType || !bookingPreferences.allergyInfo) {
  throw new Error('Please complete your profile (skin type and allergy information) before making a reservation');
}
```

**Behavior:**
- Blocks reservation if user hasn't completed `skinType` or `allergyInfo`
- Logs validation result with detailed information
- Returns clear error message to frontend

---

### 5. Reservation Service - Snapshot Storage

**File:** `src/services/reservation.service.ts` (lines 647-669)

After reservation is created, stores snapshot of booking preferences:

```typescript
// Update reservation with booking preferences snapshot
if (bookingPreferences && Object.keys(bookingPreferences).length > 0) {
  const { error: updateError } = await this.supabase
    .from('reservations')
    .update({ booking_preferences: bookingPreferences })
    .eq('id', reservation.id);

  if (updateError) {
    logger.error('Failed to store booking preferences with reservation');
    // Don't fail the reservation, just log the error
  } else {
    logger.info('Booking preferences stored with reservation');
    (reservation as any).booking_preferences = bookingPreferences;
  }
}
```

**Behavior:**
- Stores a snapshot of user's current booking preferences
- Non-blocking: won't fail reservation if snapshot fails to store
- Logs success/failure for debugging
- Updates returned reservation object with preferences

---

### 6. Reservation Retrieval - Detail View

**File:** `src/services/reservation.service.ts` (lines 981-1100)

Updated `getReservationById` method:

**SELECT Query (line 993):**
```sql
SELECT
  id,
  shop_id,
  user_id,
  reservation_date,
  reservation_time,
  status,
  total_amount,
  deposit_amount,
  remaining_amount,
  points_used,
  special_requests,
  booking_preferences,  -- ✅ ADDED
  created_at,
  updated_at,
  shops(...),
  reservation_services(...),
  reservation_payments(...)
```

**Transformation (line 1057):**
```typescript
return {
  id: data.id,
  shopId: data.shop_id,
  userId: data.user_id,
  // ...
  specialRequests: data.special_requests,
  bookingPreferences: data.booking_preferences,  // ✅ ADDED (camelCase)
  createdAt: data.created_at,
  updatedAt: data.updated_at,
  // ...
};
```

---

### 7. Reservation Retrieval - List View

**File:** `src/services/reservation.service.ts` (lines 1148-1249)

Updated `getUserReservations` method:

**SELECT Query (line 1160):**
```sql
SELECT
  id,
  shop_id,
  user_id,
  reservation_date,
  reservation_time,
  status,
  total_amount,
  deposit_amount,
  remaining_amount,
  points_used,
  special_requests,
  booking_preferences,  -- ✅ ADDED
  created_at,
  updated_at
```

**Transformation (line 1246):**
```typescript
const formattedReservations = reservations?.map(reservation => ({
  id: reservation.id,
  shopId: reservation.shop_id,
  // ...
  specialRequests: reservation.special_requests,
  bookingPreferences: reservation.booking_preferences,  // ✅ ADDED (camelCase)
  createdAt: reservation.created_at,
  updatedAt: reservation.updated_at
}));
```

---

## 🚀 How to Deploy

### Step 1: Run Database Migrations

**Option 1: Supabase Dashboard (Recommended)**

1. Go to https://app.supabase.com
2. Select your project
3. Click "SQL Editor"
4. Run migration 1:
   - Copy contents of `supabase/migrations/20251113_add_booking_preferences.sql`
   - Paste and click "Run"
5. Run migration 2:
   - Copy contents of `supabase/migrations/20251113_add_booking_preferences_to_reservations.sql`
   - Paste and click "Run"

**Option 2: Supabase CLI**

```bash
supabase db push
```

**Verification Query:**
```sql
-- Verify both columns were created
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'booking_preferences'
  AND table_name IN ('users', 'reservations');
```

Expected result: 2 rows (one for users table, one for reservations table)

---

### Step 2: Restart Backend Server

```bash
# Stop current server (Ctrl+C)

# Restart
npm run dev
```

---

## 🧪 Testing the Integration

### Test 1: Profile Update with Booking Preferences

**API:** `PUT /api/users/profile`

**Request Body:**
```json
{
  "name": "홍길동",
  "birthDate": "1990-01-01",
  "bookingPreferences": {
    "skinType": "oily",
    "allergyInfo": "Sensitive to perfume",
    "preferredStylist": "김미용사",
    "specialRequests": "Please be gentle"
  }
}
```

**Expected:** 200 OK, profile updated successfully

---

### Test 2: Attempt Reservation WITHOUT Booking Preferences

**API:** `POST /api/reservations`

**Scenario:** User hasn't filled booking preferences in profile

**Expected Response:** 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please complete your profile (skin type and allergy information) before making a reservation"
  }
}
```

---

### Test 3: Create Reservation WITH Booking Preferences

**API:** `POST /api/reservations`

**Scenario:** User has completed booking preferences

**Expected:**
- 201 Created
- Reservation created successfully
- Backend logs show: "Booking preferences stored with reservation"

---

### Test 4: Retrieve Reservation Detail

**API:** `GET /api/reservations/:id`

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "shopId": "shop-uuid",
    "userId": "user-uuid",
    "reservationDate": "2025-11-20",
    "reservationTime": "14:00:00",
    "status": "confirmed",
    "bookingPreferences": {
      "skinType": "oily",
      "allergyInfo": "Sensitive to perfume",
      "preferredStylist": "김미용사",
      "specialRequests": "Please be gentle"
    },
    "shop": { ... },
    "services": [ ... ],
    "payments": [ ... ]
  }
}
```

---

### Test 5: List User Reservations

**API:** `GET /api/user/reservations`

**Expected:** All reservations include `bookingPreferences` field with snapshot data

---

## 📊 Database Queries

### Query 1: Find Users Without Booking Preferences
```sql
SELECT id, name, email
FROM users
WHERE booking_preferences IS NULL
   OR booking_preferences = '{}'::jsonb
   OR booking_preferences->>'skinType' IS NULL
   OR booking_preferences->>'allergyInfo' IS NULL;
```

### Query 2: Get Reservations by Skin Type
```sql
SELECT
  r.id,
  r.reservation_date,
  r.booking_preferences->>'skinType' as skin_type,
  u.name as user_name
FROM reservations r
JOIN users u ON r.user_id = u.id
WHERE r.booking_preferences->>'skinType' = 'oily';
```

### Query 3: Find Reservations with Allergy Information
```sql
SELECT
  r.id,
  r.reservation_date,
  r.booking_preferences->>'allergyInfo' as allergies,
  s.name as shop_name
FROM reservations r
JOIN shops s ON r.shop_id = s.id
WHERE r.booking_preferences->>'allergyInfo' IS NOT NULL
  AND r.booking_preferences->>'allergyInfo' != '';
```

### Query 4: Check Preference Changes Over Time
```sql
-- Compare user's current preferences vs reservation snapshot
SELECT
  r.id,
  r.reservation_date,
  u.booking_preferences as current_preferences,
  r.booking_preferences as snapshot_preferences,
  CASE
    WHEN u.booking_preferences = r.booking_preferences THEN 'Unchanged'
    ELSE 'Changed'
  END as preference_status
FROM reservations r
JOIN users u ON r.user_id = u.id
WHERE r.booking_preferences IS NOT NULL;
```

---

## 🎯 Data Flow Summary

### Before Reservation:
1. User completes profile with booking preferences
2. Frontend sends camelCase `bookingPreferences`
3. Controller transforms to snake_case `booking_preferences`
4. Supabase stores in users table as JSONB

### During Reservation:
1. Backend fetches user's current booking preferences
2. Validates that `skinType` and `allergyInfo` are filled
3. Creates reservation
4. Stores snapshot of preferences with reservation
5. Returns reservation with preferences included

### After Reservation:
1. User can view reservation details with preferences snapshot
2. Even if user changes profile preferences later, reservation keeps original snapshot
3. Shop owners can see customer preferences for each booking

---

## ⚠️ Important Notes

### 1. Snapshot Behavior
- **Purpose:** Preserves what user preferences were at time of booking
- **Benefit:** Historical data integrity - changes to profile don't affect past reservations
- **Use Case:** If user changes skin type from "oily" to "dry", old reservations still show "oily"

### 2. Required Fields
- Only `skinType` and `allergyInfo` are REQUIRED for reservation
- `preferredStylist` and `specialRequests` are optional
- Validation happens at reservation creation time

### 3. Field Naming Convention
- **Database:** snake_case (`booking_preferences`)
- **Frontend:** camelCase (`bookingPreferences`)
- **JSONB Content:** camelCase keys inside JSONB (`skinType`, not `skin_type`)

### 4. Error Handling
- Validation errors return clear message to user
- Snapshot storage failures don't block reservation (non-blocking)
- All failures are logged for debugging

### 5. Caching Consideration
- Reservation queries use cache (queryCacheService)
- Cache TTL: 10 minutes for detail, 5 minutes for list
- Cache will automatically refresh with new data

---

## ✅ Completion Checklist

- [x] Migration files created for both tables
- [x] TypeScript types updated
- [x] Profile controller handles bookingPreferences
- [x] Reservation validation checks preferences
- [x] Snapshot storage implemented
- [x] getReservationById includes preferences
- [x] getUserReservations includes preferences
- [x] Documentation completed

### Next Steps for User:
- [ ] Run both migration files in Supabase Dashboard
- [ ] Restart backend server
- [ ] Test profile update with booking preferences
- [ ] Test reservation creation flow
- [ ] Verify preferences appear in reservation responses

---

## 🎉 Result

**Before:**
- Users had to input booking preferences during each reservation
- No historical record of preferences at booking time
- No validation of profile completion

**After:**
- Users complete preferences once in profile
- Preferences automatically included with every reservation
- Historical snapshot preserved for each booking
- Clear validation prevents incomplete reservations

**User Experience:**
1. User completes profile (one-time setup)
2. User makes reservation (preferences auto-included)
3. User can view past reservations with original preferences
4. Shop owners see customer preferences for each booking

---

**Status:** ✅ Complete - Ready for deployment after migrations are run!
