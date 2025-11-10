# Frontend Endpoint Integration Guide

## 🎯 Purpose

This guide provides the correct endpoint routing patterns for the frontend to ensure proper data isolation and access control.

## ⚠️ CRITICAL: Bookings Page Endpoint Fix

### ❌ INCORRECT - Current Implementation

```typescript
// DON'T DO THIS - Bookings page using wrong endpoint
const fetchReservations = async () => {
  const response = await fetch('/api/reservations');  // ❌ WRONG
  return response.json();
};
```

**Problem**: Uses generic `/api/reservations` endpoint which doesn't respect shop isolation and admin access patterns.

### ✅ CORRECT - Context-Aware Routing

```typescript
// Frontend should use context-aware endpoint selection
const fetchReservations = async (userContext: UserContext) => {
  let endpoint: string;

  if (userContext.role === 'admin' || userContext.role === 'super_admin') {
    // Platform admins see ALL shops
    endpoint = '/api/admin/reservations';
  } else if (userContext.shopId) {
    // Shop owners/managers see only their shop
    endpoint = `/api/shops/${userContext.shopId}/reservations`;
  } else {
    // Regular users see their own reservations
    endpoint = '/api/reservations';  // User-scoped endpoint
  }

  const response = await fetch(endpoint, {
    headers: {
      'Authorization': `Bearer ${userContext.token}`
    }
  });

  return response.json();
};
```

## 📊 Endpoint Routing Matrix

### Reservations

| User Role | Correct Endpoint | Access Scope |
|-----------|-----------------|--------------|
| **super_admin** | `/api/admin/reservations` | ALL shops |
| **admin** | `/api/admin/reservations` | ALL shops |
| **shop_owner** | `/api/shops/:shopId/reservations` | Own shop only |
| **shop_manager** | `/api/shops/:shopId/reservations` | Own shop only |
| **shop_admin** | `/api/shops/:shopId/reservations` | Own shop only |
| **manager** | `/api/shops/:shopId/reservations` | Own shop only |
| **customer** | `/api/reservations` | Own reservations |

### Payments

| User Role | Correct Endpoint | Access Scope |
|-----------|-----------------|--------------|
| **super_admin** | `/api/admin/payments` | ALL shops |
| **admin** | `/api/admin/payments` | ALL shops |
| **shop_owner** | `/api/shops/:shopId/payments` | Own shop only |
| **shop_manager** | `/api/shops/:shopId/payments` | Own shop only |
| **shop_admin** | `/api/shops/:shopId/payments` | Own shop only |
| **manager** | `/api/shops/:shopId/payments` | Own shop only |
| **customer** | `/api/payments` | Own payments |

## 🏗️ Recommended Frontend Architecture

### Option 1: API Service with Context-Aware Routing (Recommended)

```typescript
// src/services/api/ReservationApiService.ts

export interface UserContext {
  role: 'super_admin' | 'admin' | 'shop_owner' | 'shop_manager' | 'shop_admin' | 'manager' | 'customer';
  shopId?: string;
  token: string;
}

export class ReservationApiService {
  private userContext: UserContext;

  constructor(userContext: UserContext) {
    this.userContext = userContext;
  }

  /**
   * Automatically routes to correct endpoint based on user context
   */
  async getReservations(filters?: ReservationFilters) {
    const endpoint = this.getContextualEndpoint();
    const queryString = filters ? `?${new URLSearchParams(filters as any)}` : '';

    const response = await fetch(`${endpoint}${queryString}`, {
      headers: {
        'Authorization': `Bearer ${this.userContext.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch reservations: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update reservation status (shop or admin)
   */
  async updateReservationStatus(reservationId: string, status: string, notes?: string) {
    const endpoint = this.getContextualEndpoint();

    const response = await fetch(`${endpoint}/${reservationId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.userContext.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status, notes })
    });

    if (!response.ok) {
      throw new Error(`Failed to update reservation: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get correct endpoint based on user context
   */
  private getContextualEndpoint(): string {
    const { role, shopId } = this.userContext;

    // Platform admins use admin endpoint
    if (role === 'super_admin' || role === 'admin') {
      return '/api/admin/reservations';
    }

    // Shop roles use shop-scoped endpoint
    if (['shop_owner', 'shop_manager', 'shop_admin', 'manager'].includes(role)) {
      if (!shopId) {
        throw new Error('Shop ID is required for shop-scoped access');
      }
      return `/api/shops/${shopId}/reservations`;
    }

    // Regular customers use user-scoped endpoint
    return '/api/reservations';
  }
}

// Usage in component
const userContext = useUserContext(); // Hook to get current user context
const reservationApi = new ReservationApiService(userContext);

const reservations = await reservationApi.getReservations({
  status: 'confirmed',
  page: 1,
  limit: 20
});
```

### Option 2: React Hook for Context-Aware API Calls

```typescript
// src/hooks/useReservations.ts

import { useContext } from 'react';
import { UserContext } from '@/contexts/UserContext';

export function useReservations() {
  const { user } = useContext(UserContext);

  const getEndpoint = () => {
    if (!user) throw new Error('User not authenticated');

    if (user.role === 'super_admin' || user.role === 'admin') {
      return '/api/admin/reservations';
    }

    if (user.shopId) {
      return `/api/shops/${user.shopId}/reservations`;
    }

    return '/api/reservations';
  };

  const fetchReservations = async (filters?: any) => {
    const endpoint = getEndpoint();
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    return data.data; // Auto-unwrap { success: true, data: {...} }
  };

  const updateReservation = async (id: string, updates: any) => {
    const endpoint = getEndpoint();
    const response = await fetch(`${endpoint}/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    const data = await response.json();
    return data.data;
  };

  return {
    fetchReservations,
    updateReservation,
    isAdmin: user.role === 'super_admin' || user.role === 'admin',
    isShopUser: !!user.shopId
  };
}

// Usage in component
function BookingsPage() {
  const { fetchReservations, isAdmin, isShopUser } = useReservations();
  const [reservations, setReservations] = useState([]);

  useEffect(() => {
    fetchReservations({ page: 1, limit: 20 })
      .then(setReservations)
      .catch(console.error);
  }, []);

  return (
    <div>
      {isAdmin && <h1>Platform Admin - All Shops</h1>}
      {isShopUser && <h1>Shop Dashboard - My Shop</h1>}
      {/* Render reservations */}
    </div>
  );
}
```

## 📋 Complete API Response Format

All endpoints return data with camelCase fields (automatically transformed):

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  timestamp: string;
  requestId?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasMore?: boolean;
    executionTime?: number;
    version?: string;
  };
}

interface Reservation {
  id: string;
  userId: string;              // ✅ camelCase
  shopId: string;              // ✅ camelCase
  reservationDate: string;     // ✅ camelCase
  reservationTime: string;     // ✅ camelCase
  status: string;
  totalAmount: number;         // ✅ camelCase
  depositAmount: number;       // ✅ camelCase
  pointsUsed: number;          // ✅ camelCase
  specialRequests?: string;    // ✅ camelCase
  // ... more fields
}

// Example response
const response: ApiResponse<{ reservations: Reservation[] }> = {
  success: true,
  data: {
    reservations: [
      {
        id: 'res-123',
        userId: 'user-456',
        shopId: 'shop-789',
        reservationDate: '2025-01-15',
        reservationTime: '14:00:00',
        totalAmount: 50000,
        depositAmount: 10000,
        pointsUsed: 500
      }
    ]
  },
  timestamp: '2025-01-12T10:30:00Z',
  meta: {
    page: 1,
    limit: 20,
    total: 45,
    totalPages: 3,
    hasMore: true
  }
};
```

## 🔐 Security Headers Required

All requests must include:

```typescript
headers: {
  'Authorization': `Bearer ${jwtToken}`,  // ✅ Required
  'Content-Type': 'application/json',     // ✅ Required for POST/PATCH
  'X-Request-ID': uuidv4(),               // ✅ Optional but recommended
}
```

## ✅ Migration Checklist

### For Bookings Page

- [ ] Identify user context (role, shopId)
- [ ] Replace hardcoded `/api/reservations` with context-aware routing
- [ ] Update all reservation API calls to use correct endpoint
- [ ] Test with platform admin user (should see all shops)
- [ ] Test with shop owner user (should see only their shop)
- [ ] Test with customer user (should see only their reservations)

### For Payments Page

- [ ] Identify user context (role, shopId)
- [ ] Replace hardcoded `/api/payments` with context-aware routing
- [ ] Update all payment API calls to use correct endpoint
- [ ] Test with different user roles

### For All Pages

- [ ] Update TypeScript interfaces to use camelCase fields
- [ ] Remove any manual snake_case → camelCase transformations (now automatic)
- [ ] Verify no direct references to snake_case fields
- [ ] Test data rendering with new camelCase fields

## 🧪 Testing Strategy

### Test Case 1: Platform Admin

```typescript
// User: admin@platform.com (role: admin)
const endpoint = '/api/admin/reservations?page=1&limit=10';

// Expected: See reservations from ALL shops
// Response should include: shopId, shopName for each reservation
```

### Test Case 2: Shop Owner

```typescript
// User: owner@shop.com (role: shop_owner, shopId: 'shop-123')
const endpoint = '/api/shops/shop-123/reservations?page=1&limit=10';

// Expected: See reservations ONLY from shop-123
// Attempt to access shop-456 should return 403 Forbidden
```

### Test Case 3: Security Validation

```typescript
// Shop owner trying to access different shop
const endpoint = '/api/shops/shop-456/reservations'; // Not their shop

// Expected: 403 Forbidden
// Response: { success: false, error: { code: 'SHOP_ACCESS_DENIED', ... } }
```

## 📚 Additional Resources

- [Backend Schema Alignment](./BACKEND_FRONTEND_SCHEMA_ALIGNMENT.md)
- [API Transformation Implementation](./API_TRANSFORMATION_IMPLEMENTATION.md)
- [Shop Admin Implementation Summary](./SHOP_ADMIN_IMPLEMENTATION_SUMMARY.md)
- [API Documentation](http://localhost:3001/api-docs)

## 🎉 Summary

**Key Points**:
1. ✅ Use context-aware routing based on user role
2. ✅ Platform admins: `/api/admin/*`
3. ✅ Shop users: `/api/shops/:shopId/*`
4. ✅ Regular users: `/api/*`
5. ✅ All responses use camelCase (automatic transformation)
6. ✅ Security enforced at 4 layers (JWT, middleware, controller, database)

---

**Last Updated**: 2025-10-12
**Document By**: Claude Code AI Assistant
**Status**: Ready for Frontend Integration ✅
