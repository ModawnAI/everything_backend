# Shop-Scoped Routes Implementation Plan

## Overview
Implement shop-scoped API endpoints following the URL pattern `/api/shops/:shopId/*` to enable shop owners and managers to access and manage ONLY their own shop data, while platform admins can access any shop.

## Current State Analysis

### Existing Routes
- `/api/shops` - Public shop discovery (GET all, nearby, bounds)
- `/api/shops/:id` - Public shop details (GET by ID)
- `/api/admin/shops` - Platform admin shop management
- `/api/admin/reservations` - Platform admin reservation management (all shops)
- `/api/admin/users` - Platform admin user management (all shops)
- `/api/admin/payments` - Platform admin payment management (all shops)

### Missing Shop-Scoped Routes (from backend_12.md)
According to the specification, we need these shop-scoped endpoints:

1. **Reservations**: `/api/shops/:shopId/reservations`
2. **Payments**: `/api/shops/:shopId/payments`
3. **Points**: `/api/shops/:shopId/points`
4. **Refunds**: `/api/shops/:shopId/refunds`
5. **Users/Staff**: `/api/shops/:shopId/users`
6. **Services**: `/api/shops/:shopId/services`
7. **Analytics**: `/api/shops/:shopId/analytics`

## Implementation Strategy

### Phase 1: Create Shop-Scoped Route Files

#### 1.1 Reservations Route
**File**: `src/routes/shop-reservations.routes.ts`
**Endpoints**:
- `GET /api/shops/:shopId/reservations` - Get shop reservations with filtering
- `POST /api/shops/:shopId/reservations` - Create reservation for shop
- `PATCH /api/shops/:shopId/reservations/:reservationId` - Update reservation status

**Middleware Chain**:
```typescript
router.use('/:shopId/*', authenticateJWT(), validateShopAccess());
```

#### 1.2 Payments Route
**File**: `src/routes/shop-payments.routes.ts`
**Endpoints**:
- `GET /api/shops/:shopId/payments` - Get shop payments with filtering
- `GET /api/shops/:shopId/payments/:paymentId` - Get payment details

#### 1.3 Points Route
**File**: `src/routes/shop-points.routes.ts`
**Endpoints**:
- `GET /api/shops/:shopId/points` - Get points transactions for shop

#### 1.4 Refunds Route
**File**: `src/routes/shop-refunds.routes.ts`
**Endpoints**:
- `GET /api/shops/:shopId/refunds` - Get refunds for shop

#### 1.5 Users/Staff Route
**File**: `src/routes/shop-users.routes.ts`
**Endpoints**:
- `GET /api/shops/:shopId/users` - Get staff/employees for shop
- `POST /api/shops/:shopId/users` - Add staff member
- `PATCH /api/shops/:shopId/users/:userId` - Update staff member

#### 1.6 Services Route
**File**: `src/routes/shop-services.routes.ts`
**Endpoints**:
- `GET /api/shops/:shopId/services` - Get services for shop
- `POST /api/shops/:shopId/services` - Add service
- `PATCH /api/shops/:shopId/services/:serviceId` - Update service

#### 1.7 Analytics Route
**File**: `src/routes/shop-analytics.routes.ts`
**Endpoints**:
- `GET /api/shops/:shopId/analytics` - Get analytics dashboard data

### Phase 2: Update Controllers

For each route, create or update corresponding controller:

#### 2.1 Shop Reservations Controller
**File**: `src/controllers/shop-reservations.controller.ts`
```typescript
export class ShopReservationsController {
  async getShopReservations(req: ShopAccessRequest, res: Response) {
    const { shopId } = req.params;
    // User's shopId already validated by middleware
    // Query reservations WHERE shop_id = shopId
  }
}
```

#### 2.2 Shop Payments Controller
**File**: `src/controllers/shop-payments.controller.ts`

#### 2.3 Shop Points Controller
**File**: `src/controllers/shop-points.controller.ts`

#### 2.4 Shop Refunds Controller
**File**: `src/controllers/shop-refunds.controller.ts`

#### 2.5 Shop Users Controller
**File**: `src/controllers/shop-users.controller.ts`

#### 2.6 Shop Services Controller
**File**: `src/controllers/shop-services.controller.ts`

#### 2.7 Shop Analytics Controller
**File**: `src/controllers/shop-analytics.controller.ts`

### Phase 3: Register Routes in app.ts

```typescript
// Shop-scoped routes (requires authentication + shop access validation)
import shopReservationsRoutes from './routes/shop-reservations.routes';
import shopPaymentsRoutes from './routes/shop-payments.routes';
import shopPointsRoutes from './routes/shop-points.routes';
import shopRefundsRoutes from './routes/shop-refunds.routes';
import shopUsersRoutes from './routes/shop-users.routes';
import shopServicesRoutes from './routes/shop-services.routes';
import shopAnalyticsRoutes from './routes/shop-analytics.routes';

// Apply shop access validation middleware to ALL shop-scoped routes
app.use('/api/shops/:shopId/reservations', shopReservationsRoutes);
app.use('/api/shops/:shopId/payments', shopPaymentsRoutes);
app.use('/api/shops/:shopId/points', shopPointsRoutes);
app.use('/api/shops/:shopId/refunds', shopRefundsRoutes);
app.use('/api/shops/:shopId/users', shopUsersRoutes);
app.use('/api/shops/:shopId/services', shopServicesRoutes);
app.use('/api/shops/:shopId/analytics', shopAnalyticsRoutes);
```

### Phase 4: Update Admin Routes (Platform Context)

Platform admin routes already exist but may need updates to ensure they:
1. Accept optional `?shopId=` query parameter for filtering
2. Return ALL shops' data by default
3. Include shop information in responses

**Existing Admin Routes to Verify**:
- `/api/admin/reservations` ✅ (already exists)
- `/api/admin/payments` ✅ (already exists)
- `/api/admin/users` ✅ (already exists)
- `/api/admin/shops` ✅ (already exists)

## Middleware Architecture

### Route Protection Stack

```typescript
// For shop-scoped routes
Route Request
  ↓
authenticateJWT() // Verify JWT token, populate req.user
  ↓
validateShopAccess() // Check user can access shopId
  ↓
Controller Handler // Execute business logic
  ↓
Response
```

### Access Control Matrix

| Role | `/api/admin/*` | `/api/shops/:shopId/*` |
|------|----------------|------------------------|
| `super_admin` | ✅ All shops | ✅ Any shopId |
| `admin` | ✅ All shops | ✅ Any shopId |
| `shop_owner` | ❌ | ✅ Own shopId only |
| `shop_manager` | ❌ | ✅ Own shopId only |
| `shop_admin` | ❌ | ✅ Own shopId only |
| `manager` | ❌ | ✅ Own shopId only |
| `user` | ❌ | ❌ |

## Database Query Patterns

### For Shop-Scoped Endpoints
```typescript
// ALWAYS filter by shopId from params
const { shopId } = req.params;

const { data, error } = await supabase
  .from('reservations')
  .select('*')
  .eq('shop_id', shopId) // ✅ CRITICAL: Always filter by shop_id
  .order('created_at', { ascending: false });
```

### For Platform Admin Endpoints
```typescript
// Optional shopId filtering
const { shopId, page = 1, limit = 20 } = req.query;

let query = supabase
  .from('reservations')
  .select('*, shops(id, name)'); // ✅ Include shop info

if (shopId) {
  query = query.eq('shop_id', shopId); // Optional filter
}

const { data, error } = await query
  .order('created_at', { ascending: false })
  .range((page - 1) * limit, page * limit - 1);
```

## Response Format Standards

### Shop-Scoped Responses
```json
{
  "success": true,
  "data": {
    "reservations": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "hasMore": true
    }
  }
}
```

### Platform Admin Responses (with shop context)
```json
{
  "success": true,
  "data": {
    "reservations": [
      {
        "id": "...",
        "shop": {
          "id": "shop-1",
          "name": "Beauty Salon"
        },
        ...
      }
    ],
    "pagination": {...}
  }
}
```

## Security Considerations

### 1. SQL Injection Prevention
- ✅ Use parameterized queries (Supabase client handles this)
- ✅ Validate UUID format for shopId parameter

### 2. Authorization Bypass Prevention
- ✅ `validateShopAccess` middleware runs on EVERY shop-scoped request
- ✅ JWT token validation ensures authenticated user
- ✅ shopId from JWT payload compared with URL shopId param

### 3. Data Leakage Prevention
- ✅ Never return data from other shops in shop-scoped endpoints
- ✅ Always include `shop_id = :shopId` in WHERE clauses
- ✅ Audit logs track unauthorized access attempts

## Testing Checklist

### Unit Tests
- [ ] Shop access middleware validates platform admins
- [ ] Shop access middleware validates shop owners
- [ ] Shop access middleware rejects wrong shop access
- [ ] Controller filters by shopId correctly

### Integration Tests
- [ ] Platform admin can access any shop endpoint
- [ ] Shop owner can access their own shop endpoint
- [ ] Shop owner CANNOT access different shop endpoint
- [ ] Unauthenticated requests return 401
- [ ] Invalid shopId format returns 400

### Security Tests
- [ ] SQL injection attempts are blocked
- [ ] Path traversal attempts are blocked
- [ ] JWT manipulation is detected
- [ ] Concurrent shop access attempts are logged

## Implementation Order

### Priority 1 (Critical)
1. ✅ Create `validateShopAccess` middleware
2. ✅ Update `AuthenticatedRequest` interface
3. ✅ Update JWT token to include shopId
4. Implement shop-reservations routes
5. Implement shop-payments routes

### Priority 2 (High)
6. Implement shop-users routes
7. Implement shop-services routes
8. Update admin routes to include shop context

### Priority 3 (Medium)
9. Implement shop-analytics routes
10. Implement shop-points routes
11. Implement shop-refunds routes

### Priority 4 (Low)
12. Add comprehensive logging
13. Add performance metrics
14. Create admin dashboard for audit logs

## Migration Path

### Step 1: Add New Routes (Non-Breaking)
- Add new shop-scoped routes alongside existing routes
- Existing routes continue to work

### Step 2: Frontend Integration
- Update frontend to use new shop-scoped routes
- Platform admins continue using `/api/admin/*`
- Shop users start using `/api/shops/:shopId/*`

### Step 3: Deprecation (Future)
- Monitor usage of old endpoints
- Add deprecation warnings
- Eventually remove redundant endpoints

## Documentation Updates

### API Documentation
- Update Swagger/OpenAPI specs for all new endpoints
- Document authentication requirements
- Document role-based access rules
- Provide example requests/responses

### Developer Guide
- Update `DASHBOARD_SEPARATION_IMPLEMENTATION.md`
- Create endpoint migration guide for frontend
- Document testing procedures

---

**Status**: ⏳ Ready for Implementation
**Next Step**: Begin Priority 1 tasks (shop-reservations and shop-payments routes)
**Estimated Effort**: 2-3 days for full implementation
