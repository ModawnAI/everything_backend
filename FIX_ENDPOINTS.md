# API Endpoint Fixes - Implementation Guide

## Priority 1: Fix Broken Endpoints (30 minutes)

### Step 1: Add missing imports to app.ts

```typescript
// Add after line 56 in src/app.ts
import referralRoutes from './routes/referral.routes';
import auditTrailRoutes from './routes/audit-trail.routes';
import automaticStateProgressionRoutes from './routes/automatic-state-progression.routes';
```

### Step 2: Mount the routes (add after line 395)

```typescript
// Referral system routes (user-facing)
app.use('/api/referrals', referralRoutes);

// Admin audit trail (admin-only)
app.use('/api/admin/audit', auditTrailRoutes);

// Admin automation config (admin-only)
app.use('/api/admin/automation', automaticStateProgressionRoutes);
```

### Step 3: Test the fixes

```bash
# Test referral routes
curl http://localhost:3001/api/referrals/stats

# Test admin audit (with admin token)
curl -H "Authorization: Bearer <admin-token>" http://localhost:3001/api/admin/audit

# Test automation (with admin token)
curl -H "Authorization: Bearer <admin-token>" http://localhost:3001/api/admin/automation/status
```

## Priority 2: Fix Route Ordering (1 hour)

### Current Problem Areas

**Problem 1: `/api` base path (7 routers)**
- favorites, reservation, reservation-rescheduling, conflict-resolution, point-balance, influencer-bonus, admin-adjustment

**Solution:** Reorder in app.ts to put specific paths first:

```typescript
// BEFORE (lines 356-372):
app.use('/api', favoritesRoutes);
app.use('/api', reservationRoutes);
// ... etc

// AFTER - Reorder to:
// 1. Most specific routes first
app.use('/api/reservations/reschedule', reservationReschedulingRoutes);
app.use('/api/reservations/conflicts', conflictResolutionRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/user/favorites', favoritesRoutes);
app.use('/api/users/:userId/points', pointBalanceRoutes);
app.use('/api/influencer/bonus', influencerBonusRoutes);
app.use('/api/admin/adjustments', adminAdjustmentRoutes);
```

**Problem 2: `/api/admin` (3 routers)**
- user-status, admin-moderation, ip-blocking

**Solution:** These should work fine as-is, but verify no route collisions:

```typescript
// Check each file defines unique sub-paths
// user-status.routes.ts: /users/:userId/status, /users/status-stats, etc. ✅
// admin-moderation.routes.ts: /content/*, /shop-reports/*, /moderation/* ✅
// ip-blocking.routes.ts: /ip-blocks/* ✅
// No conflicts! Keep as-is.
```

**Problem 3: `/api/monitoring` (2 routers)**

```typescript
// monitoring.routes.ts has MANY routes
// monitoring-dashboard.routes.ts has fewer specific routes
// Keep order: dashboard first, then general
app.use('/api/monitoring', monitoringDashboardRoutes);  // More specific widgets/sla
app.use('/api/monitoring', monitoringRoutes);           // General monitoring
```

**Problem 4: `/api/shops` (2 routers)**

```typescript
// shop.routes.ts: /, /:id, /bounds, /nearby
// shop-reporting.routes.ts: /reports/*, /:shopId/report
// These are distinct - keep as-is
app.use('/api/shops', shopReportingRoutes);  // /reports/* first
app.use('/api/shops', shopRoutes);           // General CRUD
```

## Priority 3: Update Route Files (Optional - 2 hours)

### Option A: Update route definitions to use specific paths

Instead of mounting at `/api`, update the route files themselves:

**favorites.routes.ts:**
```typescript
// OLD: router.get('/user/favorites', ...)
// NEW: Define routes without /user prefix, mount at /api/user/favorites
router.get('/', getFavorites);           // → /api/user/favorites
router.post('/bulk', bulkAdd);           // → /api/user/favorites/bulk
```

**reservation-rescheduling.routes.ts:**
```typescript
// Mount this at /api/reservations instead of /api
// Routes already use /:reservationId/reschedule pattern ✅
```

### Option B: Merge related route files

**Create: reservation-management.routes.ts**
- Merge: reservation.routes + reservation-rescheduling.routes + conflict-resolution.routes
- Single file, single responsibility: all reservation management

## Priority 4: Add Validation Script (30 minutes)

Create `scripts/validate-routes.js`:

```javascript
const fs = require('fs');
const path = require('path');

// Parse app.ts and check for:
// 1. Unmounted route files
// 2. Path conflicts
// 3. Duplicate mountings

// Run on: npm run validate-routes
// Run in CI/CD before deployment
```

## Testing Checklist

- [ ] All 3 unmounted routes now return 200 (not 404)
- [ ] No duplicate endpoint paths in API_ENDPOINTS.md
- [ ] Swagger docs show all endpoints correctly
- [ ] Integration tests pass
- [ ] No regression in existing endpoints

## Rollback Plan

If issues occur:
1. Git revert the app.ts changes
2. Restart server: `npm run dev`
3. Check logs: `tail -f logs/combined.log`

## Migration Notes for Frontend Team

**New endpoints available:**
- `GET /api/referrals/stats` - User referral statistics
- `GET /api/referrals/history` - User referral history
- `GET /api/admin/audit` - Admin audit trail (requires admin auth)
- `PUT /api/admin/automation/config` - Automation configuration

**Changed endpoints** (if you implement Option A):
- `GET /api/user/favorites` → No change (still works)
- `POST /api/conflicts/:id/resolve` → `POST /api/reservations/conflicts/:id/resolve`

## Next Steps After Implementation

1. Update Swagger/OpenAPI docs
2. Regenerate API_ENDPOINTS.md: `node extract-endpoints-verified.js`
3. Update frontend API client if paths changed
4. Add route validation to pre-commit hooks
5. Document routing conventions in CLAUDE.md

---

**Estimated Total Time:** 4 hours
**Risk Level:** Low (mostly additions, minimal changes)
**Testing Required:** Integration tests, manual API testing
