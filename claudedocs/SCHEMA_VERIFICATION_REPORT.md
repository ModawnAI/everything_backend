# Schema Verification Report: USER_API_COMPREHENSIVE_GUIDE.md vs Supabase Database

**Date**: 2025-01-25
**Verified By**: Claude Code with Supabase MCP
**Database**: ysrudwzwnzxrrwjtpuoh.supabase.co
**Client Type**: Node.js (NOT Flutter - doc has Flutter examples)

---

## ❌ Critical Issues

### 1. **Missing Table: `service_catalog`**
**Status**: ❌ DOES NOT EXIST IN DATABASE

The documentation (lines 2002-2030) describes a complete `service_catalog` table, but **this table does not exist in the Supabase database**.

**Doc Schema** (lines 2002-2030):
- 23 columns defined including id, name, description, category, pricing fields, etc.
- Referenced in API endpoints: `/api/service-catalog`, `/api/service-catalog/search`, etc.

**Impact**: HIGH - All service catalog endpoints will fail if they attempt to query this non-existent table.

**Recommendation**: Either create the table or remove all service catalog documentation.

---

## 🔴 Major Discrepancies

### 2. **`feed_posts` Table - Field Name Mismatches**

| Doc Field (line) | DB Field | Status |
|------------------|----------|--------|
| `shop_id` (1938) | `tagged_shop_id` | ❌ MISMATCH |
| `likes_count` (1942) | `like_count` | ❌ MISMATCH |
| `comments_count` (1943) | `comment_count` | ❌ MISMATCH |
| `views_count` (1944) | `view_count` | ❌ MISMATCH |

**Missing in Doc (DB has these)**:
- `location_tag` TEXT
- `hashtags` TEXT[]
- `report_count` INTEGER
- `moderation_status` VARCHAR
- `is_hidden` BOOLEAN
- `hidden_at` TIMESTAMPTZ

**Impact**: HIGH - API responses will have different field names than documented.

---

### 3. **`post_comments` Table - Field Name Mismatches**

| Doc Field (line) | DB Field | Status |
|------------------|----------|--------|
| `author_id` (1989) | `user_id` | ❌ MISMATCH |
| `likes_count` (1992) | `like_count` | ❌ MISMATCH |

**Missing in Doc (DB has these)**:
- `parent_comment_id` UUID (for nested comments)
- `moderation_status` VARCHAR
- `is_hidden` BOOLEAN
- `hidden_at` TIMESTAMPTZ
- `report_count` INTEGER

**Impact**: MEDIUM - Comment nesting and moderation features not documented.

---

### 4. **`reservations` Table - Significant Differences**

| Doc Field (line) | DB Field | Status |
|------------------|----------|--------|
| `service_id` (1887) | NOT IN DB | ❌ MISSING IN DB |
| `total_price` DECIMAL (1894) | `total_amount` INTEGER | ❌ TYPE & NAME MISMATCH |
| `deposit_amount` DECIMAL (1895) | `deposit_amount` INTEGER | ❌ TYPE MISMATCH |
| `remaining_amount` DECIMAL (1896) | `remaining_amount` INTEGER | ❌ TYPE MISMATCH |
| `final_amount` DECIMAL (1898) | NOT IN DB | ❌ MISSING IN DB |
| `notes` (1901) | `special_requests` | ❌ NAME MISMATCH |
| `transaction_id` (1900) | NOT IN DB | ❌ MISSING IN DB |
| `duration` (1891) | NOT IN DB | ❌ MISSING IN DB |
| `payment_method` (1899) | NOT IN DB | ❌ MISSING IN DB |

**Missing in Doc (DB has these)**:
- `reservation_datetime` TIMESTAMPTZ (computed field)
- `points_earned` INTEGER
- `shop_notes` TEXT
- `confirmed_at` TIMESTAMPTZ
- `no_show_reason` TEXT
- `version` INTEGER (optimistic locking)

**Impact**: HIGH - Price calculations will be wrong (INTEGER vs DECIMAL). Service tracking missing.

---

### 5. **`notifications` Table - Field Mismatches**

| Doc Field (line) | DB Field | Status |
|------------------|----------|--------|
| `type` (2042) | `notification_type` | ❌ NAME MISMATCH |
| `status` (2043) | `status` | ✅ MATCH (but different enum in DB) |
| `data` JSONB (2046) | NOT IN DB | ❌ MISSING IN DB |

**Missing in Doc (DB has these)**:
- `scheduled_for` TIMESTAMPTZ (for scheduled notifications)
- `sent_at` TIMESTAMPTZ

**Impact**: MEDIUM - Notification data storage different than documented.

---

## 🟡 Minor Discrepancies

### 6. **`users` Table - Additional Fields in DB**

**Missing in Doc (DB has these)**:
- `last_qualification_check` TIMESTAMPTZ
- `referral_rewards_earned` INTEGER
- `is_locked` BOOLEAN
- `locked_at` TIMESTAMPTZ
- `last_login_ip` INET
- `shop_id` UUID
- `shop_name` TEXT

**Impact**: LOW - Extra fields available but not documented.

---

### 7. **`shop_images` Table - Extensive Additional Fields in DB**

**Missing in Doc (DB has these)**:
- `file_size` BIGINT
- `width` INTEGER
- `height` INTEGER
- `format` VARCHAR
- `compression_ratio` NUMERIC
- `metadata` JSONB
- `is_optimized` BOOLEAN
- `optimization_date` TIMESTAMPTZ
- `last_accessed` TIMESTAMPTZ
- `access_count` INTEGER
- `is_archived` BOOLEAN
- `archived_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

**Impact**: LOW - Image optimization features exist but not documented.

---

## ✅ Tables That Match Well

### 8. **`user_settings` Table**
**Status**: ✅ GOOD MATCH
All fields align between doc and database.

### 9. **`shops` Table**
**Status**: ✅ GOOD MATCH
Core fields align well between doc and database.

### 10. **`user_favorites` Table**
**Status**: ✅ GOOD MATCH
Simple structure matches between doc and database.

### 11. **`post_likes` Table**
**Status**: ✅ GOOD MATCH
Structure matches between doc and database.

### 12. **`post_images` Table**
**Status**: ✅ MOSTLY GOOD
Core fields match, only missing `thumbnail_url` in documentation example (but it exists in DB).

---

## 📊 Summary Statistics

| Category | Count | Percentage |
|----------|-------|------------|
| Tables Checked | 12 | 100% |
| Perfect Matches | 4 | 33% |
| Minor Issues | 2 | 17% |
| Major Issues | 5 | 42% |
| Missing Tables | 1 | 8% |

**Overall Schema Accuracy**: 58% ⚠️

---

## 🔧 Recommended Actions

### Priority 1: CRITICAL (Do Immediately)
1. **Create `service_catalog` table** OR remove all service catalog documentation
2. **Fix `reservations` table schema**:
   - Change price fields from DECIMAL to INTEGER (or update DB to DECIMAL)
   - Add missing `service_id` column to DB or document alternative approach
   - Rename `notes` to `special_requests` in code/docs
3. **Fix `feed_posts` field names**:
   - Change `shop_id` → `tagged_shop_id`
   - Change `*_count` → singular form in docs
4. **Fix `post_comments` field names**:
   - Change `author_id` → `user_id`
   - Change `likes_count` → `like_count`

### Priority 2: IMPORTANT (Do Soon)
5. Document moderation fields (`moderation_status`, `is_hidden`, `report_count`)
6. Document `parent_comment_id` for nested comments
7. Update notification schema to use `notification_type` instead of `type`
8. Document `reservation_datetime` computed field

### Priority 3: NICE TO HAVE (Can Wait)
9. Document shop image optimization fields
10. Document user locking mechanism (`is_locked`, `locked_at`)
11. Document shop ownership fields in users table

---

## 📝 Node.js vs Flutter Note

**Important**: The documentation contains Flutter/Dart code examples throughout, but the client is actually **Node.js**.

**Lines with Flutter Examples**:
- Lines 119-140: Flutter social login
- Lines 399-418: Flutter profile image upload
- Lines 702-729: Flutter nearby shops
- Lines 2222-2509: Extensive Flutter integration patterns

**Recommendation**: Replace all Flutter examples with Node.js/JavaScript examples using `axios` or `fetch`.

---

## 🔍 Verification Method

This report was generated by:
1. Reading the complete USER_API_COMPREHENSIVE_GUIDE.md documentation
2. Querying Supabase database schema via MCP
3. Comparing each table structure field-by-field
4. Verifying enum types and default values
5. Checking for missing/extra fields in both directions

**Supabase MCP Connection**: ✅ Verified
**Database**: ysrudwzwnzxrrwjtpuoh.supabase.co
**Schema**: public
**Verification Date**: 2025-01-25

---

## ⚠️ Impact on API Development

### High Priority Issues That Will Cause Runtime Errors:
1. ❌ Service catalog queries will fail (table doesn't exist)
2. ❌ Reservation price calculations may be wrong (type mismatch)
3. ❌ Feed post responses will have mismatched field names
4. ❌ Comment responses will have mismatched field names

### Medium Priority Issues:
5. ⚠️ Notification data storage won't work as documented
6. ⚠️ Service tracking in reservations missing
7. ⚠️ Nested comments feature exists but not documented

### Recommendations for Frontend Team:
- **DO NOT** trust field names in documentation without verification
- **DO** test each endpoint response structure
- **DO** handle both `snake_case` and `camelCase` field names
- **DO** verify enum values match database enums
- **REPLACE** all Flutter examples with Node.js examples

---

**End of Report**
