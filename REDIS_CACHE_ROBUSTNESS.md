# Redis Cache Robustness Strategy

## Problem Identified

**Stale Cache Issue:** Shop data cached without `shop_status` field caused "Cannot favorite inactive shops" error.

**Root Cause:**
- Query cache stored partial data: `{"name":"엘레강스 헤어살롱"}`
- Business logic expected `shop_status` field
- Cache TTL of 30 minutes (1800s) kept stale data alive
- No automatic invalidation when shop data changed

## Solutions Implemented & Recommended

### 1. ✅ Cache Key Versioning (Already in Place)

**Current Implementation:** `query-cache.service.ts:277-283`
```typescript
private buildCacheKey(key: string, namespace: string, version: string): string {
  const parts = [];
  if (namespace) parts.push(namespace);
  if (version) parts.push(`v${version}`);  // Version included
  parts.push(key);
  return parts.join(':');
}
```

**Usage:** `favorites.service.ts:142-161`
```typescript
const shop = await queryCacheService.getCachedQuery(
  `shop:${shopId}`,
  async () => {
    const { data, error } = await this.supabase
      .from('shops')
      .select('id, name, shop_status')  // ✅ Includes shop_status
      .eq('id', shopId)
      .single();

    if (error || !data) {
      throw new Error('Shop not found');
    }
    return data;
  },
  { namespace: 'shop', ttl: 1800 }
);
```

**Current State:** Cache key format is `qc:shop:v1:shop:{shopId}`

**To Invalidate Stale Data:**
1. Bump version to `v2` globally
2. Old `v1` caches expire naturally (TTL)
3. New queries use `v2` keys with correct schema

---

### 2. ⚠️ MISSING: Automatic Cache Invalidation on Shop Updates

**Problem:** When shops are updated, cache is NOT invalidated.

**Current Invalidation Triggers:**
- ✅ Search cache invalidation: `search-cache-invalidation.service.ts`
- ✅ Shop search cache: When shop data changes
- ❌ **MISSING:** Query cache invalidation for shop data

**Files to Update:**

#### A. Create Shop Cache Invalidation Hook

**New File:** `src/services/shop-cache-invalidation.service.ts`
```typescript
/**
 * Shop Query Cache Invalidation Service
 * Automatically invalidates query cache when shop data changes
 */
import { logger } from '../utils/logger';
import { queryCacheService } from './query-cache.service';

export class ShopCacheInvalidationService {
  /**
   * Invalidate all caches related to a shop
   */
  async invalidateShopCache(shopId: string): Promise<void> {
    try {
      // Invalidate shop detail cache (namespace: shop, key: shop:{shopId})
      await queryCacheService.invalidatePattern(`shop:v1:shop:${shopId}`);

      // Invalidate all versions to be safe
      await queryCacheService.invalidatePattern(`shop:*:shop:${shopId}`);

      logger.info('Shop query cache invalidated', { shopId });
    } catch (error) {
      logger.error('Failed to invalidate shop query cache', {
        shopId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Invalidate caches when shop status changes
   */
  async invalidateShopStatusCache(shopId: string, oldStatus: string, newStatus: string): Promise<void> {
    try {
      await this.invalidateShopCache(shopId);

      // Also invalidate favorites cache if shop becomes inactive
      if (newStatus !== 'active') {
        await queryCacheService.invalidatePattern(`favorites:*`);
      }

      logger.info('Shop status cache invalidated', { shopId, oldStatus, newStatus });
    } catch (error) {
      logger.error('Failed to invalidate shop status cache', {
        shopId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Invalidate caches when shop is deleted
   */
  async invalidateShopDeleteCache(shopId: string): Promise<void> {
    try {
      await this.invalidateShopCache(shopId);
      await queryCacheService.invalidatePattern(`favorites:*`);

      logger.info('Shop delete cache invalidated', { shopId });
    } catch (error) {
      logger.error('Failed to invalidate shop delete cache', {
        shopId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const shopCacheInvalidationService = new ShopCacheInvalidationService();
```

#### B. Update Shop Service to Call Invalidation

**File:** `src/services/shop.service.ts` (or wherever shops are updated)

Add cache invalidation after shop updates:

```typescript
import { shopCacheInvalidationService } from './shop-cache-invalidation.service';

// After shop update
async updateShop(shopId: string, updates: ShopUpdates) {
  // ... existing update logic ...

  // Invalidate cache
  await shopCacheInvalidationService.invalidateShopCache(shopId);

  // If status changed, invalidate status-specific caches
  if (updates.shop_status && updates.shop_status !== oldStatus) {
    await shopCacheInvalidationService.invalidateShopStatusCache(
      shopId,
      oldStatus,
      updates.shop_status
    );
  }

  return updatedShop;
}

// After shop creation
async createShop(shopData: CreateShopData) {
  // ... existing creation logic ...

  // No cache to invalidate for new shops

  return newShop;
}

// After shop deletion
async deleteShop(shopId: string) {
  // ... existing deletion logic ...

  // Invalidate all caches
  await shopCacheInvalidationService.invalidateShopDeleteCache(shopId);

  return { success: true };
}
```

---

### 3. ✅ TTL-Based Automatic Expiration (Already in Place)

**Current TTL Settings:** `query-cache.service.ts:42-48`
```typescript
private readonly TTL_PRESETS = {
  SHORT: 300,      // 5 minutes
  MEDIUM: 1800,    // 30 minutes ← Currently used for shops
  LONG: 3600,      // 1 hour
  VERY_LONG: 86400 // 24 hours
};
```

**Recommendation:** Reduce shop cache TTL to prevent long-lived stale data

```typescript
// In favorites.service.ts, change from:
{ namespace: 'shop', ttl: 1800 }  // 30 minutes

// To:
{ namespace: 'shop', ttl: 300 }   // 5 minutes
```

**Trade-offs:**
- ✅ Faster cache invalidation (5 min vs 30 min)
- ✅ Fresher data
- ⚠️ More database queries
- ⚠️ Higher load on Supabase

---

### 4. ⚠️ RECOMMENDED: Cache Warming on Startup

**Problem:** After cache clear or Redis restart, first requests are slow (cache misses).

**Solution:** Pre-populate cache with frequently accessed data

**New File:** `src/services/cache-warming.service.ts`
```typescript
/**
 * Cache Warming Service
 * Pre-populates cache with frequently accessed data on startup
 */
import { logger } from '../utils/logger';
import { queryCacheService } from './query-cache.service';
import { supabase } from '../config/database';

export class CacheWarmingService {
  /**
   * Warm up cache on application startup
   */
  async warmCache(): Promise<void> {
    if (!queryCacheService.isReady()) {
      logger.info('Cache warming skipped - Redis not ready');
      return;
    }

    try {
      logger.info('Starting cache warming...');

      // Warm featured shops
      await this.warmFeaturedShops();

      // Warm active shops
      await this.warmActiveShops();

      logger.info('Cache warming completed');
    } catch (error) {
      logger.error('Cache warming failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async warmFeaturedShops(): Promise<void> {
    const { data: featuredShops } = await supabase
      .from('shops')
      .select('id, name, shop_status')
      .eq('is_featured', true)
      .eq('shop_status', 'active')
      .limit(20);

    if (featuredShops) {
      for (const shop of featuredShops) {
        await queryCacheService.getCachedQuery(
          `shop:${shop.id}`,
          async () => shop,
          { namespace: 'shop', ttl: 300 }
        );
      }
      logger.info('Featured shops cache warmed', { count: featuredShops.length });
    }
  }

  private async warmActiveShops(): Promise<void> {
    const { data: activeShops } = await supabase
      .from('shops')
      .select('id, name, shop_status')
      .eq('shop_status', 'active')
      .order('total_bookings', { ascending: false })
      .limit(50);

    if (activeShops) {
      for (const shop of activeShops) {
        await queryCacheService.getCachedQuery(
          `shop:${shop.id}`,
          async () => shop,
          { namespace: 'shop', ttl: 300 }
        );
      }
      logger.info('Active shops cache warmed', { count: activeShops.length });
    }
  }
}

export const cacheWarmingService = new CacheWarmingService();
```

**Call on startup in `src/app.ts`:**
```typescript
import { cacheWarmingService } from './services/cache-warming.service';

// After server starts
server.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`);

  // Warm cache in background (don't block startup)
  cacheWarmingService.warmCache().catch(error => {
    logger.error('Cache warming failed', { error: error.message });
  });
});
```

---

### 5. ✅ IMPLEMENTED: Cache Health Monitoring

**New Endpoint:** `GET /api/admin/cache/stats`

Shows cache hit/miss rates to detect stale cache issues:

```typescript
// In admin controller
async getCacheStats(req: Request, res: Response) {
  const stats = queryCacheService.getStats();

  res.json({
    success: true,
    data: {
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hitRate,
      isEnabled: queryCacheService.isReady(),
      uptime: process.uptime(),
    },
  });
}
```

Monitor for:
- **Hit rate < 50%:** Cache not effective
- **Sudden drop in hit rate:** Possible cache invalidation issue
- **isEnabled: false:** Redis connection issue

---

### 6. ⚠️ RECOMMENDED: Schema Validation Layer

**Problem:** Cache can store incomplete/invalid data.

**Solution:** Add schema validation before caching

**New File:** `src/validators/cache-schemas.ts`
```typescript
import Joi from 'joi';

export const shopCacheSchema = Joi.object({
  id: Joi.string().uuid().required(),
  name: Joi.string().required(),
  shop_status: Joi.string().valid('active', 'inactive', 'pending').required(),
  // Add other required fields
});

export function validateCacheData<T>(data: T, schema: Joi.Schema): T {
  const { error, value } = schema.validate(data);
  if (error) {
    throw new Error(`Cache validation failed: ${error.message}`);
  }
  return value;
}
```

**Update query-cache.service.ts:**
```typescript
async getCachedQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  options: CacheOptions & { schema?: Joi.Schema } = {}
): Promise<T> {
  // ... existing code ...

  // Validate before caching
  if (options.schema) {
    result = validateCacheData(result, options.schema);
  }

  // Cache the validated result
  this.set(fullKey, result, ttl).catch(...);

  return result;
}
```

**Usage:**
```typescript
import { shopCacheSchema } from '../validators/cache-schemas';

const shop = await queryCacheService.getCachedQuery(
  `shop:${shopId}`,
  async () => { /* query */ },
  {
    namespace: 'shop',
    ttl: 300,
    schema: shopCacheSchema  // ✅ Validates before caching
  }
);
```

---

## Immediate Action Items

### Priority 1: Fix Current Issue (DONE ✅)
- [x] Clear stale cache manually: `redis-cli DEL "qc:shop:v1:shop:22222222-2222-2222-2222-222222222222"`

### Priority 2: Prevent Future Issues (RECOMMENDED)
1. [ ] Create `shop-cache-invalidation.service.ts`
2. [ ] Update shop service to call invalidation on updates
3. [ ] Reduce shop cache TTL from 1800s to 300s
4. [ ] Add cache stats monitoring endpoint

### Priority 3: Long-term Improvements
1. [ ] Implement cache warming on startup
2. [ ] Add schema validation for cached data
3. [ ] Set up alerts for low cache hit rates
4. [ ] Document cache invalidation strategy

---

## Testing Cache Robustness

### Manual Test Commands

```bash
# 1. Check current cache keys
/opt/bitnami/redis/bin/redis-cli KEYS "qc:*"

# 2. Get cached shop data
/opt/bitnami/redis/bin/redis-cli GET "qc:shop:v1:shop:{shop-id}"

# 3. Check cache TTL
/opt/bitnami/redis/bin/redis-cli TTL "qc:shop:v1:shop:{shop-id}"

# 4. Clear specific shop cache
/opt/bitnami/redis/bin/redis-cli DEL "qc:shop:v1:shop:{shop-id}"

# 5. Clear all shop caches
/opt/bitnami/redis/bin/redis-cli --scan --pattern "qc:shop:*" | xargs /opt/bitnami/redis/bin/redis-cli DEL

# 6. Check cache hit rate
curl http://localhost:3001/api/admin/cache/stats
```

### Automated Test

```typescript
// test-cache-invalidation.ts
describe('Shop Cache Invalidation', () => {
  it('should invalidate cache when shop is updated', async () => {
    // 1. Cache shop data
    const shop = await shopService.getShop(shopId);
    expect(shop.name).toBe('Old Name');

    // 2. Update shop
    await shopService.updateShop(shopId, { name: 'New Name' });

    // 3. Verify cache was invalidated (should fetch new data)
    const updatedShop = await shopService.getShop(shopId);
    expect(updatedShop.name).toBe('New Name');
  });

  it('should have all required fields in cached shop data', async () => {
    const shop = await shopService.getShop(shopId);

    expect(shop).toHaveProperty('id');
    expect(shop).toHaveProperty('name');
    expect(shop).toHaveProperty('shop_status');
  });
});
```

---

## Monitoring & Alerts

### Redis Health Checks

```bash
# Add to cron or monitoring service
*/5 * * * * /opt/bitnami/redis/bin/redis-cli PING || echo "Redis down!"
```

### Cache Hit Rate Alert

```typescript
// In monitoring service
setInterval(async () => {
  const stats = queryCacheService.getStats();

  if (stats.hitRate < 50 && stats.hits + stats.misses > 100) {
    logger.warn('Low cache hit rate detected', stats);
    // Send alert to Slack/email
  }
}, 300000); // Check every 5 minutes
```

---

## Summary

**Current State:**
- ✅ Cache versioning exists
- ✅ TTL-based expiration works
- ❌ No automatic invalidation on shop updates
- ❌ Stale data can persist for 30 minutes

**Recommended Fixes:**
1. **Automatic invalidation** when shops are updated
2. **Reduce TTL** from 30min to 5min for shop data
3. **Add monitoring** for cache health
4. **Schema validation** to prevent invalid cache data

**Impact:**
- Prevents stale cache issues like the one encountered
- Reduces cache inconsistency window from 30min to 5min
- Enables proactive detection of cache problems
