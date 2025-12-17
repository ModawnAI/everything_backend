# Favorites System Redesign - Mobile Optimized

## Executive Summary

Redesign the favorites system for **immediate UI updates** and **seamless synchronization** across main page and favorites page with minimal API calls and optimal mobile performance.

## Current Problems

### Frontend Issues (from FAVORITE_INCONSISTENCIES_ANALYSIS.md)
- ❌ Dual state management (`initialFavorite` prop + query state)
- ❌ Heart icon reverts after toggling on home page
- ❌ Batch status checks don't auto-update
- ❌ Different implementations across components
- ❌ Race conditions and stale data

### Backend Issues
- ⚠️ No batch toggle endpoint (must call individual APIs)
- ⚠️ No lightweight sync endpoint
- ⚠️ No versioning/timestamps for delta syncs
- ✅ Individual operations work correctly

## Design Goals

1. **Immediate UI Updates**: Heart fills/unfills instantly
2. **Cross-Page Sync**: Changes on main page appear on favorites page
3. **Minimal API Calls**: Use batching and caching
4. **Mobile Optimized**: Low battery, works offline
5. **Single Source of Truth**: No prop/state conflicts

---

## Proposed Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Mobile Frontend                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         Global Favorites Store (React Query)          │  │
│  │  favoriteIds: Set<string>  (Single Source of Truth)   │  │
│  └───────────────────────────────────────────────────────┘  │
│           ▲                    │                             │
│           │                    │                             │
│    ┌──────┴──────┐      ┌─────▼──────┐                      │
│    │  Main Page  │      │  Favorites │                      │
│    │  (Home)     │      │    Page    │                      │
│    └─────────────┘      └────────────┘                      │
│           │                    │                             │
│           └────────┬───────────┘                             │
│                    ▼                                         │
│         Optimistic Updates + Auto-Invalidate                │
│                    │                                         │
└────────────────────┼─────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend API                             │
│  GET  /api/user/favorites/ids        - Lightweight sync     │
│  POST /api/user/favorites/batch      - Batch toggle         │
│  PUT  /api/shops/:id/favorite        - Individual add       │
│  DELETE /api/shops/:id/favorite      - Individual remove    │
│  POST /api/user/favorites/check      - Batch status check   │
└─────────────────────────────────────────────────────────────┘
```

---

## Backend Implementation

### 1. Lightweight Favorites IDs Endpoint

**Purpose:** Fast sync of favorites list without full shop data.

**Endpoint:** `GET /api/user/favorites/ids`

**Response:**
```typescript
{
  success: true,
  data: {
    favoriteIds: [
      "shop-id-1",
      "shop-id-2",
      "shop-id-3"
    ],
    count: 3,
    timestamp: "2025-11-23T19:30:00Z"  // For delta syncs (future)
  }
}
```

**Implementation:**
```typescript
// File: src/controllers/favorites.controller.ts

async getFavoriteIds(req: Request, res: Response) {
  try {
    const userId = req.user!.id;

    const { data, error } = await this.supabase
      .from('user_favorites')
      .select('shop_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Failed to get favorite IDs', { userId, error: error.message });
      return res.status(500).json({
        success: false,
        error: { message: 'Failed to retrieve favorites' }
      });
    }

    const favoriteIds = data?.map(f => f.shop_id) || [];

    res.json({
      success: true,
      data: {
        favoriteIds,
        count: favoriteIds.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Get favorite IDs error', { error });
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
}
```

**Route:**
```typescript
// File: src/routes/favorites.routes.ts
router.get('/ids', authenticate, favoritesController.getFavoriteIds);
```

**Benefits:**
- ⚡ Fast response (only IDs, no joins)
- 📦 Small payload (~50-100 favorites = <5KB)
- 🔄 Easy to cache and sync

---

### 2. Batch Favorite Toggle Endpoint

**Purpose:** Toggle multiple favorites in one request (for offline sync).

**Endpoint:** `POST /api/user/favorites/batch`

**Request:**
```typescript
{
  add: ["shop-id-1", "shop-id-2"],    // Shops to favorite
  remove: ["shop-id-3", "shop-id-4"]  // Shops to unfavorite
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    added: ["shop-id-1", "shop-id-2"],
    removed: ["shop-id-3", "shop-id-4"],
    failed: [],  // Any IDs that failed
    favoriteIds: ["shop-id-1", "shop-id-2", "shop-id-5"],  // Updated full list
    count: 3
  }
}
```

**Implementation:**
```typescript
// File: src/services/favorites.service.ts

async batchToggleFavorites(
  userId: string,
  add: string[],
  remove: string[]
): Promise<BatchToggleResult> {
  const results = {
    added: [] as string[],
    removed: [] as string[],
    failed: [] as Array<{ shopId: string; error: string }>
  };

  // Validate and add favorites
  for (const shopId of add || []) {
    try {
      // Validate shop exists and is active (with caching)
      const shop = await queryCacheService.getCachedQuery(
        `shop:${shopId}`,
        async () => {
          const { data, error } = await this.supabase
            .from('shops')
            .select('id, name, shop_status')
            .eq('id', shopId)
            .single();

          if (error || !data) {
            throw new Error('Shop not found');
          }
          return data;
        },
        { namespace: 'shop', ttl: 300 }
      );

      if (!shop || shop.shop_status !== 'active') {
        results.failed.push({ shopId, error: 'Shop is not active' });
        continue;
      }

      // Add to favorites (upsert to handle duplicates)
      const { error } = await this.supabase
        .from('user_favorites')
        .upsert(
          {
            user_id: userId,
            shop_id: shopId,
            created_at: new Date().toISOString()
          },
          { onConflict: 'user_id,shop_id' }
        );

      if (error) {
        results.failed.push({ shopId, error: error.message });
      } else {
        results.added.push(shopId);
      }
    } catch (error) {
      results.failed.push({
        shopId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Remove favorites
  for (const shopId of remove || []) {
    try {
      const { error } = await this.supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('shop_id', shopId);

      if (error) {
        results.failed.push({ shopId, error: error.message });
      } else {
        results.removed.push(shopId);
      }
    } catch (error) {
      results.failed.push({
        shopId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get updated favorites list
  const { data: updatedFavorites } = await this.supabase
    .from('user_favorites')
    .select('shop_id')
    .eq('user_id', userId);

  return {
    ...results,
    favoriteIds: updatedFavorites?.map(f => f.shop_id) || [],
    count: updatedFavorites?.length || 0
  };
}
```

**Controller:**
```typescript
// File: src/controllers/favorites.controller.ts

async batchToggleFavorites(req: Request, res: Response) {
  try {
    const userId = req.user!.id;
    const { add = [], remove = [] } = req.body;

    // Validate input
    if (!Array.isArray(add) || !Array.isArray(remove)) {
      return res.status(400).json({
        success: false,
        error: { message: 'add and remove must be arrays' }
      });
    }

    const result = await favoritesService.batchToggleFavorites(
      userId,
      add,
      remove
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Batch toggle favorites error', { error });
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error' }
    });
  }
}
```

**Route:**
```typescript
// File: src/routes/favorites.routes.ts
router.post('/batch', authenticate, favoritesController.batchToggleFavorites);
```

**Benefits:**
- 🚀 Offline support (queue operations, sync later)
- 📉 Reduces API calls (1 request vs N requests)
- 🔄 Returns updated state immediately

---

### 3. Enhanced Individual Toggle Endpoints

**Update existing PUT/DELETE to return full state:**

```typescript
// File: src/services/favorites.service.ts

async addFavoriteFallback(userId: string, shopId: string): Promise<FavoriteShopResponse> {
  // ... existing validation logic ...

  // After successful add
  return {
    success: true,
    isFavorite: true,
    shop: {  // ✅ Include shop data
      id: shop.id,
      name: shop.name,
      shop_status: shop.shop_status
    },
    // ✅ Optional: Return updated favorites list for immediate sync
    favoriteIds: await this.getFavoriteIds(userId)
  };
}
```

**Benefits:**
- 🔄 Immediate state sync
- 📦 Reduces follow-up API calls

---

## Mobile Frontend Implementation

### 1. Global Favorites Store (React Query)

**Purpose:** Single source of truth for all favorite IDs.

**File:** `hooks/use-favorites-store.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

// ============================================
// Types
// ============================================

interface FavoritesData {
  favoriteIds: string[];
  count: number;
  timestamp: string;
}

interface BatchToggleInput {
  add?: string[];
  remove?: string[];
}

// ============================================
// Global Favorites Query
// ============================================

export const useFavoritesStore = () => {
  return useQuery({
    queryKey: ['favorites', 'ids'],
    queryFn: async (): Promise<Set<string>> => {
      const response = await api.get<FavoritesData>('/api/user/favorites/ids');
      return new Set(response.favoriteIds);
    },
    staleTime: 5 * 60 * 1000,      // 5 minutes
    gcTime: 10 * 60 * 1000,        // 10 minutes (formerly cacheTime)
    refetchOnMount: 'always',       // Always check on mount
    refetchOnWindowFocus: true,     // Sync when app comes to foreground
    refetchOnReconnect: true,       // Sync when network reconnects
  });
};

// ============================================
// Check if shop is favorited
// ============================================

export const useIsFavorite = (shopId: string): boolean => {
  const { data: favorites } = useFavoritesStore();
  return favorites?.has(shopId) ?? false;
};

// ============================================
// Optimistic Favorite Toggle
// ============================================

export const useFavoriteToggle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ shopId, isFavorite }: { shopId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        // Remove favorite
        await api.delete(`/api/shops/${shopId}/favorite`);
      } else {
        // Add favorite
        await api.put(`/api/shops/${shopId}/favorite`);
      }
    },

    // ============================================
    // Optimistic Update
    // ============================================
    onMutate: async ({ shopId, isFavorite }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['favorites', 'ids'] });

      // Snapshot previous value
      const previousFavorites = queryClient.getQueryData<Set<string>>(['favorites', 'ids']);

      // Optimistically update to new value
      queryClient.setQueryData<Set<string>>(['favorites', 'ids'], (old) => {
        const newSet = new Set(old);
        if (isFavorite) {
          newSet.delete(shopId);  // Remove
        } else {
          newSet.add(shopId);     // Add
        }
        return newSet;
      });

      // Return context with previous value
      return { previousFavorites };
    },

    // ============================================
    // Error Rollback
    // ============================================
    onError: (error, variables, context) => {
      // Rollback to previous value
      if (context?.previousFavorites) {
        queryClient.setQueryData(['favorites', 'ids'], context.previousFavorites);
      }

      console.error('[useFavoriteToggle] Error:', error);
    },

    // ============================================
    // Success - Refetch to ensure sync
    // ============================================
    onSuccess: () => {
      // Refetch in background to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['favorites', 'ids'] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });  // Full list
    },
  });
};

// ============================================
// Batch Toggle (for offline sync)
// ============================================

export const useBatchFavoriteToggle = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BatchToggleInput) => {
      const response = await api.post('/api/user/favorites/batch', input);
      return response.data;
    },

    onSuccess: (data) => {
      // Update cache with server response
      queryClient.setQueryData<Set<string>>(['favorites', 'ids'],
        new Set(data.favoriteIds)
      );

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });
};
```

---

### 2. Simplified FavoriteButton Component

**Purpose:** Use global store, remove all dual-state logic.

**File:** `components/shop/favorite-button.tsx`

```typescript
import { useFavoriteToggle, useIsFavorite } from '@/hooks/use-favorites-store';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface FavoriteButtonProps {
  shopId: string;
  shopName?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  showLabel?: boolean;
  className?: string;
  onToggle?: (isFavorite: boolean) => void;
}

export function FavoriteButton({
  shopId,
  shopName,
  size = 'md',
  variant = 'default',
  showLabel = false,
  className,
  onToggle,
}: FavoriteButtonProps) {
  // ✅ Single source of truth - global favorites store
  const isFavorite = useIsFavorite(shopId);
  const toggleFavorite = useFavoriteToggle();
  const [isAnimating, setIsAnimating] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Trigger animation
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    // Optimistic update
    toggleFavorite.mutate(
      { shopId, isFavorite },
      {
        onSuccess: () => {
          onToggle?.(isFavorite);
        },
        onError: () => {
          // Error already handled in mutation (rollback)
        },
      }
    );
  };

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  return (
    <Button
      variant={variant}
      size="icon"
      className={`${sizeClasses[size]} ${className}`}
      onClick={handleToggle}
      disabled={toggleFavorite.isPending}
      aria-label={isFavorite ? `Remove ${shopName} from favorites` : `Add ${shopName} to favorites`}
    >
      <Heart
        size={iconSizes[size]}
        className={`
          transition-all duration-300
          ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}
          ${isAnimating ? 'scale-125' : 'scale-100'}
        `}
      />
      {showLabel && (
        <span className="ml-2 text-sm">
          {isFavorite ? 'Favorited' : 'Favorite'}
        </span>
      )}
    </Button>
  );
}
```

**Key Changes:**
- ❌ **REMOVED:** `initialFavorite` prop
- ❌ **REMOVED:** Local state management
- ❌ **REMOVED:** Dual-state synchronization logic
- ✅ **USES:** `useIsFavorite(shopId)` - global store
- ✅ **USES:** `useFavoriteToggle()` - optimistic mutation
- ✅ **SIMPLE:** ~60 lines vs previous ~120 lines

---

### 3. Home Page Implementation

**File:** `app/page.tsx`

```typescript
'use client';

import { useFavoritesStore } from '@/hooks/use-favorites-store';
import { FavoriteButton } from '@/components/shop/favorite-button';
import { ShopCard } from '@/components/shop/shop-card';

export default function HomePage() {
  const { data: favorites, isLoading: favoritesLoading } = useFavoritesStore();

  // ... existing shop queries ...

  return (
    <div>
      {/* Nearby Shops */}
      <div className="grid grid-cols-2 gap-4">
        {nearbyShops?.map((shop) => (
          <ShopCard
            key={shop.id}
            shop={shop}
            // ❌ REMOVED: isFavorited prop
            // ✅ FavoriteButton uses global store internally
          />
        ))}
      </div>

      {/* Featured Shops */}
      <div className="grid grid-cols-2 gap-4">
        {featuredShops?.map((shop) => (
          <ShopCard
            key={shop.id}
            shop={shop}
            // ❌ REMOVED: batch status check
            // ✅ Each button checks global store (cached, instant)
          />
        ))}
      </div>
    </div>
  );
}
```

**Key Changes:**
- ❌ **REMOVED:** `useMultipleFavoriteStatus` hook
- ❌ **REMOVED:** Batch status check API call
- ❌ **REMOVED:** `isFavorited` prop passing
- ✅ **USES:** Global favorites store (one API call)
- ✅ **BENEFIT:** Automatic sync across all cards

---

### 4. Favorites Page Implementation

**File:** `app/favorites/page.tsx`

```typescript
'use client';

import { useFavoritesStore } from '@/hooks/use-favorites-store';
import { FavoriteButton } from '@/components/shop/favorite-button';
import { useQuery } from '@tanstack/react-query';

export default function FavoritesPage() {
  const { data: favoriteIds } = useFavoritesStore();

  // Get full shop details for favorited shops
  const { data: favoriteShops, isLoading } = useQuery({
    queryKey: ['favorites', 'shops', favoriteIds],
    queryFn: async () => {
      if (!favoriteIds || favoriteIds.size === 0) return [];

      const response = await api.get('/api/user/favorites', {
        params: { includeShopData: true }
      });
      return response.data;
    },
    enabled: favoriteIds !== undefined && favoriteIds.size > 0,
  });

  return (
    <div>
      <h1>My Favorites ({favoriteIds?.size || 0})</h1>

      {favoriteShops?.map((shop) => (
        <div key={shop.id} className="shop-card">
          <h3>{shop.name}</h3>

          <FavoriteButton
            shopId={shop.id}
            shopName={shop.name}
            // ✅ No props needed - uses global store
            // ✅ Automatically removes from list when unfavorited
          />
        </div>
      ))}
    </div>
  );
}
```

**Key Changes:**
- ✅ **USES:** Global favorites store for IDs
- ✅ **USES:** Separate query for shop details
- ✅ **AUTOMATIC:** List updates when favorites change (query invalidation)

---

## Performance Optimization

### 1. Initial Load Strategy

**First app load:**
```typescript
// Single API call
GET /api/user/favorites/ids
Response: ["shop-1", "shop-2", "shop-3"]  // ~1KB

// Cached in React Query
// All FavoriteButton components use this cached data
// Zero additional API calls for status checks!
```

### 2. Background Sync

**When app comes to foreground:**
```typescript
// Automatic refetch (React Query config)
refetchOnWindowFocus: true

// If data changed on server, all buttons update automatically
```

### 3. Offline Support (Optional Enhancement)

**Queue operations while offline:**
```typescript
const useFavoriteQueue = () => {
  const [queue, setQueue] = useState<BatchToggleInput>({ add: [], remove: [] });
  const batchToggle = useBatchFavoriteToggle();
  const isOnline = useIsOnline();

  // When coming back online
  useEffect(() => {
    if (isOnline && (queue.add?.length || queue.remove?.length)) {
      batchToggle.mutate(queue, {
        onSuccess: () => setQueue({ add: [], remove: [] })
      });
    }
  }, [isOnline]);

  // Queue operations while offline
  const queueToggle = (shopId: string, isFavorite: boolean) => {
    if (!isOnline) {
      setQueue(prev => ({
        add: isFavorite ? prev.add : [...(prev.add || []), shopId],
        remove: isFavorite ? [...(prev.remove || []), shopId] : prev.remove,
      }));
    }
  };
};
```

---

## API Call Comparison

### Before (Current Implementation)

**Home page load:**
```
1. GET /api/user/favorites            (Get full list)
2. POST /api/user/favorites/check     (Batch check for 10 shops)
   Total: 2 API calls
```

**Toggle favorite on home page:**
```
1. PUT /api/shops/:id/favorite        (Toggle)
2. GET /api/user/favorites            (Refresh list)
3. POST /api/user/favorites/check     (Re-check batch) - NOT DONE, causing bug
   Total: 2-3 API calls per toggle
```

**Navigate to favorites page:**
```
1. GET /api/user/favorites            (Get full list with shop data)
   Total: 1 API call
```

**Total for session: 4-6 API calls**

---

### After (New Implementation)

**App launch:**
```
1. GET /api/user/favorites/ids        (Get IDs only, ~1KB)
   Response cached in React Query
   Total: 1 API call
```

**Toggle favorite anywhere:**
```
1. PUT /api/shops/:id/favorite        (Toggle)
   - Optimistic update: UI changes instantly
   - Background refetch: Silent sync
   Total: 1 API call (background refetch doesn't block UI)
```

**Navigate to favorites page:**
```
1. GET /api/user/favorites?includeShopData=true  (Get shop details)
   - Uses cached IDs to avoid redundant status checks
   Total: 1 API call
```

**Total for session: 2-3 API calls**

**Improvement: 50% fewer API calls**

---

## Migration Plan

### Phase 1: Backend Updates (2-3 hours)

1. ✅ Create `GET /api/user/favorites/ids` endpoint
2. ✅ Create `POST /api/user/favorites/batch` endpoint
3. ✅ Enhance individual endpoints to return favoriteIds
4. ✅ Add proper caching headers
5. ✅ Test all new endpoints

### Phase 2: Frontend Core (3-4 hours)

1. ✅ Create `use-favorites-store.ts` hook
2. ✅ Create `useFavoriteToggle` mutation
3. ✅ Create `useIsFavorite` check hook
4. ✅ Test global store functionality

### Phase 3: Component Updates (2-3 hours)

1. ✅ Simplify `FavoriteButton` component
2. ✅ Remove `initialFavorite` prop
3. ✅ Remove dual-state logic
4. ✅ Update all usage sites

### Phase 4: Page Updates (2-3 hours)

1. ✅ Update home page to use global store
2. ✅ Remove batch status check
3. ✅ Update favorites page
4. ✅ Update search results

### Phase 5: Testing (2-3 hours)

1. ✅ Test immediate UI updates
2. ✅ Test cross-page synchronization
3. ✅ Test offline behavior
4. ✅ Test edge cases (rapid toggling, network errors)

**Total Estimated Time: 11-16 hours**

---

## Testing Checklist

### Immediate Updates
- [ ] Click heart on home page → Fills instantly
- [ ] Click filled heart → Unfills instantly
- [ ] No flickering or reverting
- [ ] Animation plays smoothly

### Cross-Page Sync
- [ ] Favorite shop on home page
- [ ] Navigate to favorites page
- [ ] Shop appears in list
- [ ] Unfavorite on favorites page
- [ ] Navigate back to home
- [ ] Heart is empty

### Performance
- [ ] App launch: 1 API call for favorites
- [ ] Toggle favorite: Instant UI update
- [ ] Background refetch doesn't block UI
- [ ] No redundant API calls

### Edge Cases
- [ ] Rapid toggling (click heart 5x fast)
- [ ] Network error during toggle (rollback works)
- [ ] App backgrounded/foregrounded (syncs correctly)
- [ ] Offline mode (queues operations)

---

## Benefits Summary

### User Experience
✅ **Instant Feedback:** Heart fills/unfills immediately
✅ **Consistent State:** Same data everywhere
✅ **No Confusion:** No reverting or flickering
✅ **Smooth UX:** Animations work correctly

### Developer Experience
✅ **Simple Code:** 50% less code in FavoriteButton
✅ **Single Source:** No prop/state conflicts
✅ **Easy Testing:** Predictable behavior
✅ **Less Bugs:** No race conditions

### Performance
✅ **Fewer API Calls:** 50% reduction
✅ **Smaller Payloads:** IDs only (~1KB vs ~50KB)
✅ **Better Caching:** React Query handles it
✅ **Offline Support:** Queue and sync

### Maintainability
✅ **Centralized Logic:** One favorites store
✅ **Reusable Hooks:** Use anywhere
✅ **Type Safety:** TypeScript throughout
✅ **Clear Flow:** Easy to understand

---

## Files to Create/Modify

### Backend

**New Files:**
- None (add to existing controllers/services)

**Modified Files:**
1. `src/controllers/favorites.controller.ts`
   - Add `getFavoriteIds()`
   - Add `batchToggleFavorites()`

2. `src/services/favorites.service.ts`
   - Add `batchToggleFavorites()`
   - Enhance `addFavoriteFallback()` return value

3. `src/routes/favorites.routes.ts`
   - Add `GET /ids`
   - Add `POST /batch`

**Estimated LOC:** +200 lines

---

### Frontend

**New Files:**
1. `hooks/use-favorites-store.ts` (~150 lines)

**Modified Files:**
1. `components/shop/favorite-button.tsx`
   - Remove ~60 lines (dual-state logic)
   - Simplify to ~60 lines total
   - Net: -60 lines

2. `app/page.tsx`
   - Remove batch status check
   - Remove prop passing
   - Net: -30 lines

3. `app/favorites/page.tsx`
   - Use global store
   - Net: ~0 lines (refactor)

4. `components/search/shop-card.tsx`
   - Replace custom implementation
   - Net: -50 lines

**Estimated LOC:** +150 new, -140 removed = +10 net

---

## Success Metrics

### Before Redesign
- ❌ Heart icon reverts after toggle (bug)
- ❌ 4-6 API calls per session
- ❌ ~50KB favorites data transfer
- ❌ Dual-state management complexity
- ❌ Different implementations across pages

### After Redesign
- ✅ Heart icon updates instantly (0ms)
- ✅ 2-3 API calls per session (50% fewer)
- ✅ ~1KB favorites data transfer (98% smaller)
- ✅ Single source of truth
- ✅ Consistent implementation everywhere

---

## Next Steps

1. **Review this document** with team
2. **Approve backend API changes**
3. **Create implementation tickets**
4. **Start with Phase 1** (backend)
5. **Test thoroughly** before deploying

---

**Status:** Ready for Implementation
**Priority:** HIGH (Fixes critical UX bug)
**Estimated Effort:** 11-16 hours
**Risk:** LOW (Well-defined, incremental changes)
