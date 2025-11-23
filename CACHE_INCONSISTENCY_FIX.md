# Cache Inconsistency Fix - "Cannot favorite inactive shops" Error

## Problem Summary

Users were getting **"Cannot favorite inactive shops"** error even when trying to favorite **active shops**.

## Root Cause

**Cache inconsistency between `removeFavorite` and `addFavorite` methods.**

Both methods used the same cache key `qc:shop:v1:shop:{shopId}` but selected **different database fields**:

### Before Fix

**removeFavorite (line 227):**
```typescript
.select('name')  // ❌ Only selects name field
```

**addFavorite (line 148):**
```typescript
.select('id, name, shop_status')  // ✅ Needs shop_status for validation
```

### Problem Flow

1. **User removes a favorite:**
   - `removeFavorite` runs
   - Query: `SELECT name FROM shops WHERE id = ?`
   - Cache stores: `{"name": "엘레강스 헤어살롱"}` ← Missing `shop_status`

2. **User tries to add the same shop as favorite:**
   - `addFavorite` runs
   - Reads from cache: `{"name": "엘레강스 헤어살롱"}`
   - Validation check: `if (!shop || shop.shop_status !== 'active')`
   - `shop.shop_status` is `undefined` → Validation fails
   - Returns error: **"Cannot favorite inactive shops"**

## Technical Details

### Cache Key Format
```
qc:shop:v1:shop:{shopId}
```

Example:
```
qc:shop:v1:shop:22222222-2222-2222-2222-222222222222
```

### Cached Data (Before Fix)
```json
{"name":"엘레강스 헤어살롱"}
```

**Missing fields:** `id`, `shop_status`

### Cached Data (After Fix)
```json
{
  "id": "22222222-2222-2222-2222-222222222222",
  "name": "엘레강스 헤어살롱",
  "shop_status": "active"
}
```

**All required fields present** ✅

## Fix Applied

### File: `src/services/favorites.service.ts`

**Line 227:** Changed from selecting only `name` to selecting all required fields.

```diff
- .select('name')
+ .select('id, name, shop_status')
```

**Full context (lines 221-242):**
```typescript
// Get shop data from cache for real-time update
// IMPORTANT: Select same fields as addFavoriteFallback to avoid cache inconsistency
const shop = await queryCacheService.getCachedQuery(
  `shop:${shopId}`,
  async () => {
    const { data, error } = await this.supabase
      .from('shops')
      .select('id, name, shop_status')  // ✅ Now consistent
      .eq('id', shopId)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  },
  {
    namespace: 'shop',
    ttl: 1800, // 30 minutes
  }
);
```

## Verification

### Before Fix
```bash
curl -X PUT https://api.e-beautything.com/api/shops/22222222-2222-2222-2222-222222222222/favorite
# Response: 400 Bad Request
# {"success": false, "code": "BUSINESS_3001", "message": "Cannot favorite inactive shops"}
```

### After Fix
```bash
curl -X PUT https://api.e-beautything.com/api/shops/22222222-2222-2222-2222-222222222222/favorite
# Response: 200 OK
# {"success": true, "isFavorite": true}
```

### Backend Logs
```
✅ PUT /api/shops/22222222-2222-2222-2222-222222222222/favorite 200 - 553.197ms
```

## Cache Cleared

All stale shop cache entries were cleared:
```bash
/opt/bitnami/redis/bin/redis-cli --scan --pattern "qc:shop:*" | xargs -r /opt/bitnami/redis/bin/redis-cli DEL
# Output: 1 (cleared 1 stale entry)
```

## Key Learnings

### 1. Cache Key Consistency
**Problem:** Multiple methods using the same cache key with different data structures.

**Solution:** Ensure all methods using the same cache key select **identical fields**.

### 2. Explicit Field Selection
**Problem:** Selecting only needed fields can create cache inconsistency.

**Solution:** When using shared cache keys, always select **all required fields** for that entity.

### 3. Cache Documentation
Add comments explaining cache requirements:
```typescript
// IMPORTANT: Select same fields as addFavoriteFallback to avoid cache inconsistency
```

## Related Files

### Source Code
- **Main fix:** `/home/bitnami/everything_backend/src/services/favorites.service.ts:227`
- **Validation logic:** `/home/bitnami/everything_backend/src/services/favorites.service.ts:160`

### Documentation
- **Cache robustness:** `/home/bitnami/everything_backend/REDIS_CACHE_ROBUSTNESS.md`
- **Browser caching:** `/home/bitnami/everything_backend/BROWSER_CACHE_CLEARING_GUIDE.md`
- **This document:** `/home/bitnami/everything_backend/CACHE_INCONSISTENCY_FIX.md`

## Preventing Future Issues

### Recommended Changes (from REDIS_CACHE_ROBUSTNESS.md)

1. **Schema Validation**
   - Validate cached data structure before use
   - Ensure required fields are present

2. **Automatic Cache Invalidation**
   - Invalidate cache when shop data changes
   - Implement shop update hooks

3. **Reduce Cache TTL**
   - Current: 1800s (30 minutes)
   - Recommended: 300s (5 minutes)
   - Reduces window for stale data

4. **Unified Cache Keys**
   - Create helper methods for shop data caching
   - Centralize field selection logic

### Example: Centralized Shop Caching
```typescript
// Proposed helper method
async getCachedShop(shopId: string): Promise<ShopCacheData> {
  return queryCacheService.getCachedQuery(
    `shop:${shopId}`,
    async () => {
      const { data, error } = await this.supabase
        .from('shops')
        .select('id, name, shop_status')  // Always same fields
        .eq('id', shopId)
        .single();

      if (error || !data) {
        throw new Error('Shop not found');
      }
      return data;
    },
    { namespace: 'shop', ttl: 300 }
  );
}
```

**Usage in both methods:**
```typescript
// In addFavorite
const shop = await this.getCachedShop(shopId);

// In removeFavorite
const shop = await this.getCachedShop(shopId);
```

**Benefits:**
- ✅ Single source of truth for shop caching
- ✅ Guaranteed field consistency
- ✅ Easier to update cache logic
- ✅ Type safety with return type

## Testing Recommendations

### Unit Tests
```typescript
describe('FavoritesService Cache Consistency', () => {
  it('should cache same fields in addFavorite and removeFavorite', async () => {
    // 1. Add favorite
    await favoritesService.addFavorite(userId, shopId);
    const cacheAfterAdd = await redis.get(`qc:shop:v1:shop:${shopId}`);

    // 2. Remove favorite
    await favoritesService.removeFavorite(userId, shopId);
    const cacheAfterRemove = await redis.get(`qc:shop:v1:shop:${shopId}`);

    // 3. Verify cache structure is identical
    expect(Object.keys(cacheAfterAdd)).toEqual(Object.keys(cacheAfterRemove));
    expect(cacheAfterRemove).toHaveProperty('shop_status');
  });
});
```

### Integration Tests
```typescript
describe('Favorite Operations E2E', () => {
  it('should allow re-favoriting after unfavoriting', async () => {
    // 1. Unfavorite shop (caches shop data)
    const unfavoriteRes = await request(app)
      .delete(`/api/shops/${shopId}/favorite`)
      .set('Authorization', `Bearer ${token}`);

    expect(unfavoriteRes.status).toBe(200);

    // 2. Re-favorite shop (uses cached shop data)
    const favoriteRes = await request(app)
      .put(`/api/shops/${shopId}/favorite`)
      .set('Authorization', `Bearer ${token}`);

    expect(favoriteRes.status).toBe(200);  // Should succeed
    expect(favoriteRes.body.success).toBe(true);
  });
});
```

## Status

✅ **FIXED AND DEPLOYED**
- Backend restarted with fix
- Cache cleared
- Tested and verified working
- Changes committed to git

## Impact

**Before:** Users could not favorite shops after unfavoriting them (cached data missing required fields)

**After:** Users can favorite/unfavorite shops without errors (cache data includes all required fields)

**User Experience:** Seamless favorite toggling functionality restored ✨
