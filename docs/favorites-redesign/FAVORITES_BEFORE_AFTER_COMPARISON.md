# Favorites System - Before vs After Comparison

## Visual Architecture Comparison

### BEFORE (Current - Broken)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Mobile App                               │
│                                                                  │
│  ┌───────────────────┐              ┌─────────────────────────┐ │
│  │   Home Page       │              │   Favorites Page        │ │
│  ├───────────────────┤              ├─────────────────────────┤ │
│  │ Load shops        │              │ Load favorites          │ │
│  │       │           │              │       │                 │ │
│  │       ▼           │              │       ▼                 │ │
│  │ Batch Status ───┐ │              │ Full List Query         │ │
│  │   Check (10 IDs)│ │              │   (with shop data)      │ │
│  │       │         │ │              │       │                 │ │
│  │       ▼         │ │              │       ▼                 │ │
│  │ favoriteStatuses│ │              │ shops[]                 │ │
│  │   { id: bool }  │ │              │       │                 │ │
│  │       │         │ │              │       ▼                 │ │
│  │       ▼         │ │              │ <FavoriteButton         │ │
│  │ <ShopCard       │ │              │   shopId={id}           │ │
│  │   isFavorited=  │ │              │   initialFavorite=true />│ │
│  │     {statuses}> │ │              │                         │ │
│  │       │         │ │              │                         │ │
│  │       ▼         │ │              │                         │ │
│  │ <FavoriteButton │ │              │                         │ │
│  │   shopId={id}   │ │              │                         │ │
│  │   initialFavorite│ │              │                         │ │
│  │     ={statuses} │ │              │                         │ │
│  │   />            │ │              │                         │ │
│  │       │         │ │              │                         │ │
│  │   ┌───┴────┐    │ │              │                         │ │
│  │   │ DUAL   │    │ │              │  ┌─────────────────┐    │ │
│  │   │ STATE  │◄───┼─┼──────────────┼─►│ Query State     │    │ │
│  │   │        │    │ │              │  │ (React Query)   │    │ │
│  │   │ Prop   │    │ │              │  └─────────────────┘    │ │
│  │   │ State  │    │ │              │           │              │ │
│  │   └───┬────┘    │ │              │           ▼              │ │
│  │       │         │ │              │    useFavoriteStatus     │ │
│  │       ▼         │ │              │                         │ │
│  │  User clicks ───┼─┼──────────────┼──► API Call             │ │
│  │  heart          │ │              │                         │ │
│  │       │         │ │              │                         │ │
│  │       ▼         │ │              │                         │ │
│  │  Optimistic     │ │              │                         │ │
│  │  Update (local) │ │              │                         │ │
│  │       │         │ │              │                         │ │
│  │       ▼         │ │              │                         │ │
│  │  Query refetch  │ │              │                         │ │
│  │       │         │ │              │                         │ │
│  │       ▼         │ │              │                         │ │
│  │  Parent         │ │              │                         │ │
│  │  re-renders     │ │              │                         │ │
│  │       │         │ │              │                         │ │
│  │       ▼         │ │              │                         │ │
│  │  STALE          │ │              │                         │ │
│  │  favoriteStatuses│ │              │                         │ │
│  │  passed again   │ │              │                         │ │
│  │       │         │ │              │                         │ │
│  │       ▼         │ │              │                         │ │
│  │  initialFavorite│ │              │                         │ │
│  │  =false         │ │              │                         │ │
│  │       │         │ │              │                         │ │
│  │       ▼         │ │              │                         │ │
│  │  ❌ HEART REVERTS!│ │              │                         │ │
│  └───────────────────┘              └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Problems:**
- ❌ Prop state overrides query state
- ❌ Batch check not invalidated on toggle
- ❌ Race condition between local and query state
- ❌ Heart reverts to wrong state

---

### AFTER (New - Fixed)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Mobile App                               │
│                                                                  │
│         ┌───────────────────────────────────────────┐           │
│         │  Global Favorites Store (React Query)     │           │
│         │  queryKey: ['favorites', 'ids']           │           │
│         │  data: Set<string> { "id1", "id2", ... }  │           │
│         │                                            │           │
│         │  ✅ SINGLE SOURCE OF TRUTH                 │           │
│         └───────────────┬───────────────────────────┘           │
│                         │                                        │
│         ┌───────────────┴───────────────────┐                   │
│         │                                   │                   │
│  ┌──────▼───────────┐              ┌───────▼─────────────────┐ │
│  │   Home Page      │              │   Favorites Page        │ │
│  ├──────────────────┤              ├─────────────────────────┤ │
│  │ Load shops       │              │ Load favorites          │ │
│  │       │          │              │       │                 │ │
│  │       ▼          │              │       ▼                 │ │
│  │ <ShopCard>       │              │ Full List Query         │ │
│  │   <FavoriteButton│              │   (with shop data)      │ │
│  │     shopId={id} />│              │       │                 │ │
│  │       │          │              │       ▼                 │ │
│  │       ▼          │              │ <FavoriteButton         │ │
│  │ useIsFavorite(id)│              │   shopId={id} />        │ │
│  │       │          │              │       │                 │ │
│  │       ▼          │              │       ▼                 │ │
│  │ Read from        │              │ useIsFavorite(id)       │ │
│  │ Global Store ────┼──────────────┼────► Read from          │ │
│  │       │          │              │      Global Store       │ │
│  │       ▼          │              │                         │ │
│  │ Display ❤️ or ♡  │              │                         │ │
│  │                  │              │                         │ │
│  │ User clicks ─────┼──────────────┼──► User clicks          │ │
│  │   heart          │              │     heart               │ │
│  │       │          │              │       │                 │ │
│  │       ▼          │              │       ▼                 │ │
│  │ useFavoriteToggle│              │ useFavoriteToggle       │ │
│  │       │          │              │       │                 │ │
│  │       ▼          │              │       ▼                 │ │
│  │ onMutate:        │              │ onMutate:               │ │
│  │ Update Global ───┼──────────────┼────► Update Global      │ │
│  │ Store            │              │      Store              │ │
│  │ INSTANTLY        │              │      INSTANTLY          │ │
│  │       │          │              │       │                 │ │
│  │       ▼          │              │       ▼                 │ │
│  │ ✅ UI UPDATES     │              │ ✅ UI UPDATES            │ │
│  │    (0ms)         │              │    (0ms)                │ │
│  │       │          │              │       │                 │ │
│  │       ▼          │              │       ▼                 │ │
│  │ Background:      │              │ Background:             │ │
│  │ API Call ────────┼──────────────┼────► Refetch Store      │ │
│  │       │          │              │       │                 │ │
│  │       ▼          │              │       ▼                 │ │
│  │ onSuccess:       │              │ ✅ Both pages in sync    │ │
│  │ Invalidate ──────┼──────────────┼────► automatically       │ │
│  │ Global Store     │              │                         │ │
│  │       │          │              │                         │ │
│  │       ▼          │              │                         │ │
│  │ ✅ Both pages     │              │                         │ │
│  │    auto-sync     │              │                         │ │
│  └──────────────────┘              └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- ✅ Single source of truth
- ✅ Instant UI updates (optimistic)
- ✅ Automatic cross-page sync
- ✅ No race conditions

---

## Code Comparison

### FavoriteButton Component

#### BEFORE (~120 lines)

```typescript
interface FavoriteButtonProps {
  shopId: string;
  initialFavorite?: boolean;  // ❌ Prop that causes issues
  // ... other props
}

export function FavoriteButton({
  shopId,
  initialFavorite,  // ❌ Can be stale
  ...
}: FavoriteButtonProps) {
  // ❌ Dual state management
  const [localIsFavorite, setLocalIsFavorite] = useState(initialFavorite ?? false);

  // Query state
  const { isFavorite: queryIsFavorite } = useFavoriteStatus(shopId);

  // ❌ Complex synchronization logic
  useEffect(() => {
    if (initialFavorite === undefined && !isToggling) {
      setLocalIsFavorite(queryIsFavorite);
    }
  }, [queryIsFavorite, isToggling, initialFavorite]);

  useEffect(() => {
    if (initialFavorite !== undefined) {
      setLocalIsFavorite(initialFavorite);  // ❌ Prop overrides query
    }
  }, [initialFavorite]);

  // Uses local state
  const displayIsFavorite = localIsFavorite;

  // ... toggle logic ...
}
```

#### AFTER (~60 lines)

```typescript
interface FavoriteButtonProps {
  shopId: string;
  // ✅ NO initialFavorite prop
  // ... other props
}

export function FavoriteButton({
  shopId,
  ...
}: FavoriteButtonProps) {
  // ✅ Single source of truth - global store
  const isFavorite = useIsFavorite(shopId);
  const toggleFavorite = useFavoriteToggle();

  // ✅ Simple toggle handler
  const handleToggle = () => {
    toggleFavorite.mutate({ shopId, isFavorite });
  };

  // ✅ Use global store value directly
  return (
    <Button onClick={handleToggle}>
      <Heart className={isFavorite ? 'fill-red-500' : 'text-gray-400'} />
    </Button>
  );
}
```

**Difference:** -60 lines, no complexity

---

### Home Page Usage

#### BEFORE

```typescript
function HomePage() {
  // ❌ Batch status check
  const { favoriteStatuses } = useMultipleFavoriteStatus(shopIds);

  return (
    <>
      {shops.map(shop => (
        <ShopCard
          key={shop.id}
          shop={shop}
          isFavorited={favoriteStatuses[shop.id] || false}  // ❌ Stale
        />
      ))}
    </>
  );
}

function ShopCard({ shop, isFavorited }) {
  return (
    <div>
      <FavoriteButton
        shopId={shop.id}
        initialFavorite={isFavorited}  // ❌ Doesn't update on toggle
      />
    </div>
  );
}
```

#### AFTER

```typescript
function HomePage() {
  // ✅ No batch check needed - global store handles it

  return (
    <>
      {shops.map(shop => (
        <ShopCard
          key={shop.id}
          shop={shop}
          // ✅ No isFavorited prop
        />
      ))}
    </>
  );
}

function ShopCard({ shop }) {
  return (
    <div>
      <FavoriteButton
        shopId={shop.id}
        // ✅ Uses global store internally
      />
    </div>
  );
}
```

**Difference:** -30 lines, simpler logic

---

## API Calls Comparison

### Scenario: User Opens App and Toggles 2 Favorites

#### BEFORE

```
1. App Launch
   ├─ GET /api/user/favorites              (~50KB with shop data)
   └─ POST /api/user/favorites/check       (~5KB for 10 shops)

2. User clicks heart on shop A
   ├─ PUT /api/shops/A/favorite            (Toggle)
   └─ Background: Query invalidates
       └─ (But batch check NOT invalidated ❌)

3. User navigates to favorites page
   └─ GET /api/user/favorites              (~50KB with shop data)

4. User clicks heart on shop B
   ├─ DELETE /api/shops/B/favorite         (Toggle)
   └─ GET /api/user/favorites              (Refresh)

Total: 6 API calls, ~110KB transferred
```

#### AFTER

```
1. App Launch
   └─ GET /api/user/favorites/ids          (~1KB, just IDs)

2. User clicks heart on shop A
   ├─ PUT /api/shops/A/favorite            (Toggle)
   └─ Background: Refetch IDs              (Silent, doesn't block UI)

3. User navigates to favorites page
   └─ GET /api/user/favorites?includeShopData=true  (~45KB)

4. User clicks heart on shop B
   ├─ DELETE /api/shops/B/favorite         (Toggle)
   └─ Background: Refetch IDs              (Silent)

Total: 3 API calls, ~46KB transferred
```

**Improvement:**
- 50% fewer API calls (6 → 3)
- 58% less data (110KB → 46KB)

---

## Performance Metrics

### Before

| Metric | Value | Notes |
|--------|-------|-------|
| Initial Load API Calls | 2 | Full list + batch check |
| Initial Load Data | ~55KB | Large payload |
| Toggle Latency | 200-500ms | Network round-trip |
| UI Update After Toggle | ❌ REVERTS | Broken state sync |
| Cross-Page Sync | ❌ NO | Manual refresh needed |
| Code Complexity | HIGH | Dual-state management |

### After

| Metric | Value | Notes |
|--------|-------|-------|
| Initial Load API Calls | 1 | Just IDs |
| Initial Load Data | ~1KB | Minimal payload |
| Toggle Latency | 0ms | Optimistic update |
| UI Update After Toggle | ✅ INSTANT | Optimistic |
| Cross-Page Sync | ✅ AUTO | Global store |
| Code Complexity | LOW | Single source of truth |

---

## User Experience Comparison

### BEFORE - Broken Flow

```
1. User sees shop card with empty heart ♡
2. User clicks heart
3. Heart fills ❤️ (optimistic)
4. API call succeeds
5. Query invalidates
6. Parent re-renders
7. Passes stale initialFavorite={false}
8. Heart empties ♡ ❌ WRONG!
9. User confused - clicks again
10. Same cycle repeats
11. User gives up or refreshes page
```

### AFTER - Perfect Flow

```
1. User sees shop card with empty heart ♡
2. User clicks heart
3. Heart fills ❤️ (instant, 0ms)
4. API call happens in background
5. On success, background refetch
6. Global store updates
7. All pages auto-sync
8. Heart stays filled ✅ CORRECT!
9. User happy 😊
```

---

## Migration Risk Assessment

### Low Risk Changes

✅ **Backend:**
- Adding new endpoints (no breaking changes)
- Existing endpoints unchanged
- Backward compatible

✅ **Frontend:**
- Removing prop (cleanup)
- Simplifying component logic
- Better error handling

### Testing Strategy

1. **Backend:**
   - Unit test new endpoints
   - Integration test batch operations
   - Load test favorites sync

2. **Frontend:**
   - Unit test hooks
   - Component test FavoriteButton
   - E2E test cross-page sync
   - E2E test offline behavior

3. **Rollback Plan:**
   - Keep old endpoints active
   - Feature flag for new implementation
   - Can revert in < 5 minutes

---

## Success Metrics (After 1 Week)

### Quantitative
- [ ] 0 bug reports about "heart reverting"
- [ ] 50% reduction in favorites API calls
- [ ] <100ms perceived toggle latency
- [ ] 100% cross-page sync accuracy

### Qualitative
- [ ] Users report "favorites just work"
- [ ] No confusion about favorite state
- [ ] Smooth, instant interactions
- [ ] Consistent experience everywhere

---

## Next Steps

1. ✅ Review architecture (this document)
2. ✅ Approve design (team decision)
3. 🔲 Create implementation tickets
4. 🔲 Backend: Add endpoints (2-3 hours)
5. 🔲 Frontend: Create hooks (3-4 hours)
6. 🔲 Frontend: Update components (2-3 hours)
7. 🔲 Testing: Full E2E tests (2-3 hours)
8. 🔲 Deploy to staging
9. 🔲 User acceptance testing
10. 🔲 Deploy to production

---

**Ready to implement!** 🚀
