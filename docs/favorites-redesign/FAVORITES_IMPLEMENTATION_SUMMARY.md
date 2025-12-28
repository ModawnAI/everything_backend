# Favorites Redesign - Quick Implementation Summary

## The Problem

**Current Issue:** Heart icon reverts after toggling on home page.

**Root Cause:** Dual-state management conflict between `initialFavorite` prop and React Query state.

---

## The Solution

### Architecture Change

**Before:**
```
Home Page → Batch Status Check → initialFavorite Prop → FavoriteButton (dual state)
                                                          ↓
                                                    Prop overrides query ❌
```

**After:**
```
App Launch → Global Favorites Store (React Query)
                      ↓
          All Components Read Store ✅
                      ↓
          Optimistic Updates on Toggle ✅
```

---

## Implementation Steps

### 1. Backend (Add 2 new endpoints)

```typescript
// New Endpoint 1: Lightweight favorites sync
GET /api/user/favorites/ids
Response: { favoriteIds: ["id1", "id2"], count: 2 }

// New Endpoint 2: Batch toggle
POST /api/user/favorites/batch
Body: { add: ["id1"], remove: ["id2"] }
Response: { added: [...], removed: [...], favoriteIds: [...] }
```

**Files to modify:**
- `src/controllers/favorites.controller.ts` - Add 2 methods
- `src/services/favorites.service.ts` - Add 1 method
- `src/routes/favorites.routes.ts` - Add 2 routes

**Estimated:** 2-3 hours

---

### 2. Frontend (Create global store)

```typescript
// New File: hooks/use-favorites-store.ts

// 1. Global store
export const useFavoritesStore = () => {
  return useQuery({
    queryKey: ['favorites', 'ids'],
    queryFn: () => api.get('/api/user/favorites/ids'),
    // Syncs on mount, focus, reconnect
  });
};

// 2. Check if favorited
export const useIsFavorite = (shopId: string) => {
  const { data: favorites } = useFavoritesStore();
  return favorites?.has(shopId) ?? false;
};

// 3. Optimistic toggle
export const useFavoriteToggle = () => {
  return useMutation({
    mutationFn: toggleAPI,
    onMutate: optimisticUpdate,  // UI updates instantly
    onError: rollback,            // Reverts on error
    onSuccess: refetch,           // Background sync
  });
};
```

**Estimated:** 3-4 hours

---

### 3. Simplify FavoriteButton

```typescript
// Before: ~120 lines with dual-state logic
export function FavoriteButton({ shopId, initialFavorite, ... }) {
  const [localState, setLocalState] = useState(initialFavorite);
  // Complex sync logic between prop and query...
}

// After: ~60 lines, simple
export function FavoriteButton({ shopId, ... }) {
  const isFavorite = useIsFavorite(shopId);  // Global store
  const toggle = useFavoriteToggle();        // Optimistic
  // That's it!
}
```

**Changes:**
- ❌ Remove `initialFavorite` prop
- ❌ Remove local state
- ❌ Remove sync effects
- ✅ Use `useIsFavorite(shopId)`
- ✅ Use `useFavoriteToggle()`

**Estimated:** 1 hour

---

### 4. Update Pages

**Home Page:**
```typescript
// Before
const { favoriteStatuses } = useMultipleFavoriteStatus(shopIds);
<ShopCard isFavorited={favoriteStatuses[shop.id]} />

// After
// No batch check needed!
<ShopCard shop={shop} />  // FavoriteButton uses global store
```

**Favorites Page:**
```typescript
// Before
<FavoriteButton initialFavorite={true} ... />

// After
<FavoriteButton shopId={shop.id} />  // Uses global store
```

**Estimated:** 2-3 hours

---

## Results

### Before
- ❌ Heart reverts after toggle
- ❌ 4-6 API calls per session
- ❌ 50KB data transfer
- ❌ Complex dual-state logic
- ❌ Different implementations

### After
- ✅ Instant UI updates (0ms)
- ✅ 2-3 API calls (50% fewer)
- ✅ 1KB data transfer (98% smaller)
- ✅ Single source of truth
- ✅ Consistent everywhere

---

## Quick Start Guide

### For Backend Developer

1. **Add favorites IDs endpoint:**
   ```bash
   # File: src/controllers/favorites.controller.ts
   # Add getFavoriteIds() method
   # Returns: { favoriteIds: string[], count: number }
   ```

2. **Add batch toggle endpoint:**
   ```bash
   # File: src/services/favorites.service.ts
   # Add batchToggleFavorites() method
   # Handles: add[] and remove[] arrays
   ```

3. **Add routes:**
   ```bash
   # File: src/routes/favorites.routes.ts
   router.get('/ids', authenticate, favoritesController.getFavoriteIds);
   router.post('/batch', authenticate, favoritesController.batchToggleFavorites);
   ```

**See full code in:** `FAVORITES_REDESIGN_MOBILE_OPTIMIZED.md`

---

### For Frontend Developer

1. **Create global store:**
   ```bash
   # File: hooks/use-favorites-store.ts
   # Create: useFavoritesStore, useIsFavorite, useFavoriteToggle
   ```

2. **Simplify FavoriteButton:**
   ```bash
   # File: components/shop/favorite-button.tsx
   # Remove: initialFavorite prop, local state, sync logic
   # Use: useIsFavorite(shopId), useFavoriteToggle()
   ```

3. **Update pages:**
   ```bash
   # File: app/page.tsx
   # Remove: batch status check, isFavorited prop

   # File: app/favorites/page.tsx
   # Remove: initialFavorite prop
   ```

**See full code in:** `FAVORITES_REDESIGN_MOBILE_OPTIMIZED.md`

---

## Testing Checklist

1. **Immediate Updates:**
   - [ ] Click heart → Fills instantly
   - [ ] Click again → Unfills instantly
   - [ ] No flickering

2. **Cross-Page Sync:**
   - [ ] Favorite on home → Appears on favorites page
   - [ ] Unfavorite on favorites page → Empty on home

3. **Performance:**
   - [ ] App launch: 1 API call
   - [ ] Toggle: Instant UI, background sync
   - [ ] No redundant calls

4. **Edge Cases:**
   - [ ] Rapid clicking (5x fast)
   - [ ] Network error (rollback works)
   - [ ] App background/foreground (syncs)

---

## Timeline

- **Backend:** 2-3 hours
- **Frontend Core:** 3-4 hours
- **Components:** 2-3 hours
- **Testing:** 2-3 hours

**Total:** 11-16 hours

---

## Files Summary

**Backend (modify existing):**
- `src/controllers/favorites.controller.ts` (+80 lines)
- `src/services/favorites.service.ts` (+100 lines)
- `src/routes/favorites.routes.ts` (+2 lines)

**Frontend:**
- `hooks/use-favorites-store.ts` (+150 lines, NEW)
- `components/shop/favorite-button.tsx` (-60 lines, SIMPLIFY)
- `app/page.tsx` (-30 lines, SIMPLIFY)
- `app/favorites/page.tsx` (refactor)

**Total:** +200 backend, +60 frontend = +260 lines net

---

## Success Criteria

✅ Heart icon updates instantly on all pages
✅ No reverting or flickering
✅ Consistent state everywhere
✅ 50% fewer API calls
✅ 98% smaller data transfer
✅ Simpler code (less bugs)

---

**Next Step:** Review `FAVORITES_REDESIGN_MOBILE_OPTIMIZED.md` for complete implementation details.
