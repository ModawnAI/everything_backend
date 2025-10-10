# Dashboard Endpoints Documentation

This document provides a comprehensive overview of all dashboard endpoints in the EBeautyThing Admin application, including how data is fetched and displayed.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Main Dashboard Endpoints](#main-dashboard-endpoints)
3. [Financial/Payments Dashboard](#financialpayments-dashboard)
4. [Data Fetching Patterns](#data-fetching-patterns)
5. [API Services](#api-services)
6. [Hook Patterns](#hook-patterns)

## Architecture Overview

This is a **Frontend-Only Next.js Application** that communicates with an external backend API. The frontend uses:

- **Next.js 15.5.4** with App Router and Turbopack
- **React Query (TanStack Query)** for server state management
- **Axios** for HTTP client communication
- **External Backend API** via `NEXT_PUBLIC_API_BASE_URL`

### Data Flow Pattern
```
Frontend Component → React Query Hook → API Service → External Backend → Response → Transform → Display
```

## Main Dashboard Endpoints

### 1. `/dashboard` - Main Dashboard Homepage

**File:** `src/app/dashboard/page.tsx`

**Data Sources:**
- **Analytics Service:** `AnalyticsOptimizedService.getQuickDashboard()`
- **API Endpoint:** `GET /api/admin/analytics/dashboard/quick`
- **Update Frequency:** Auto-refreshes every 2 minutes
- **Performance:** < 10ms response time (materialized views)

**Data Displayed:**
- Total users, active users, new users this month, user growth rate
- Total revenue, today revenue, month revenue, revenue growth rate
- Total reservations, active reservations, today reservations, reservation success rate
- Total shops, active shops, pending approvals
- Total transactions, successful transactions, conversion rate

**Key Features:**
- Real-time metrics dashboard
- Performance optimized with materialized views
- Refresh functionality for manual updates

### 2. `/dashboard/users` - User Management

**File:** `src/app/dashboard/users/page.tsx`

**Data Sources:**
- **Hook:** `useUsers()` from `@/hooks/api/useUserManagement`
- **Service:** `UsersService.getUsers()`
- **API Endpoint:** `GET /api/admin/users`

**Data Displayed:**
- User list with pagination (20 users per page)
- User statistics cards (total, active, influencers, suspended)
- Search and filtering capabilities
- Bulk operations (activate, suspend, delete)

**Search/Filter Options:**
- Text search by name/email
- Status filter (active, inactive, suspended, deleted)
- Role filter (admin, shop_owner, influencer, user)
- Gender filter
- Phone verification status
- Influencer status
- Referral status

**User Actions:**
- View user details (`/dashboard/users/[id]`)
- Edit user profile (modal)
- Status management (activate/suspend)
- Role assignment
- Bulk operations
- Export (CSV, XLSX, JSON)

### 3. `/dashboard/users/[id]` - User Detail Page

**File:** `src/app/dashboard/users/[id]/page.tsx`

**Data Sources:**
- **Hook:** `useUserDetail()` from `@/hooks/api/useUserDetail`
- **API Endpoint:** `GET /api/admin/users/{userId}`

**Data Displayed:**
- Complete user profile information
- Activity history and sessions
- Role and permission management
- Status change history
- Security settings

### 4. `/dashboard/system/shops` - Shop Management

**File:** `src/app/dashboard/system/shops/page.tsx`

**Data Sources:**
- **Hook:** `useShops()` from `@/hooks/api/useShops`
- **Service:** `ShopsService.getShops()`
- **API Endpoint:** `GET /api/admin/shops`

**Data Displayed:**
- Shop list with pagination (10 shops per page)
- Shop statistics (total, active, pending approval, suspended)
- Advanced filtering and search
- Shop status management

**Filter Options:**
- Status filter (active, inactive, pending_approval, suspended, deleted)
- Category filter (nail, hair, makeup, skincare, massage, tattoo, piercing, eyebrow, eyelash)
- Shop type (partnered, non_partnered)
- Verification status (pending, verified, rejected)
- Sorting options (created_at, name, category, status)

**Shop Actions:**
- View shop details (`/dashboard/system/shops/[id]`)
- Approve pending shops
- Suspend/activate shops
- Delete shops

### 5. `/dashboard/system/shops/[id]` - Shop Detail Page

**File:** `src/app/dashboard/system/shops/[id]/page.tsx`

**Data Sources:**
- **Hooks:** `useShopDetails()`, `useShopAnalytics()`, `useShopVerificationHistory()`
- **Service:** `ShopService`
- **API Endpoints:**
  - `GET /api/admin/shops/{shopId}`
  - `GET /api/admin/shops/{shopId}/analytics`
  - `GET /api/admin/shops/{shopId}/verification-history`

**Data Displayed:**
- Complete shop information and settings
- Shop analytics and performance metrics
- Verification history and documentation
- Status management and moderation tools

## Financial/Payments Dashboard

### 6. `/dashboard/financial/payments` - PortOne V2 Payments Dashboard

**File:** `src/app/dashboard/financial/payments/page.tsx`

**Data Sources:**
- **Service:** `PortOnePaymentsService`
- **API Endpoints:**
  - `GET /api/admin/payments` - Payment list with filtering
  - `GET /api/admin/payments/{id}` - Payment details
  - `GET /api/admin/payments/analytics/overview` - Payment analytics
  - `GET /api/admin/webhooks` - Webhook logs

**Data Displayed:**
- Payment transactions list with comprehensive filtering
- Payment analytics and statistics
- Webhook management and monitoring
- Payment status management
- PortOne integration status

**Payment Management Features:**
- Filter by status, method, date range, user
- Payment detail view with full transaction history
- Cancellation and refund management
- PortOne sync functionality
- Webhook retry mechanisms
- Failure analytics

**Payment Statuses:**
- pending, deposit_paid, fully_paid, failed
- virtual_account_issued, deposit_refunded
- final_payment_pending, final_payment_refunded
- overdue, partially_refunded, refunded

## Data Fetching Patterns

### 1. React Query Integration

All data fetching uses React Query for:
- **Caching:** Intelligent caching with stale-time and gc-time
- **Background Refetching:** Automatic updates when data becomes stale
- **Error Handling:** Centralized error management
- **Loading States:** Built-in loading and error states
- **Optimistic Updates:** Immediate UI updates with rollback on failure

### 2. API Service Layer

**Base API Client:** `src/services/api.ts`
```typescript
// Axios-based client with interceptors
const apiService = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});
```

**Service Pattern:**
```typescript
export class SomeService {
  static async getData(): Promise<ResponseType> {
    const response = await apiService.get('/endpoint');
    return response.data;
  }
}
```

### 3. Hook Patterns

**Query Hooks:**
```typescript
export function useData(params?: FilterType) {
  return useQuery({
    queryKey: ['data', 'list', params],
    queryFn: () => Service.getData(params),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

**Mutation Hooks:**
```typescript
export function useUpdateData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params) => Service.updateData(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data'] });
    },
  });
}
```

## API Services

### Core Services

1. **AnalyticsOptimizedService** (`src/services/analytics-optimized.service.ts`)
   - Dashboard metrics with materialized views
   - Performance optimized (< 10ms responses)
   - Auto-refresh capabilities

2. **UsersService** (`src/services/users.ts`)
   - User CRUD operations
   - Status and role management
   - Search and filtering
   - Bulk operations and export

3. **ShopsService** (`src/services/shops.ts`)
   - Shop management and verification
   - Status updates and moderation
   - Category and location-based operations

4. **PortOnePaymentsService** (`src/services/portone-payments.service.ts`)
   - Payment transaction management
   - PortOne API integration
   - Webhook handling and analytics
   - Payment status and cancellation management

### Data Transformation

**Backend Response Format:**
```typescript
{
  success: boolean;
  data: T;
  pagination?: PaginationInfo;
  error?: ErrorInfo;
}
```

**Frontend Consumption:**
- Services extract `result.data` from backend responses
- React Query hooks handle loading, error, and success states
- Components receive typed data objects

### Error Handling

**Service Level:**
```typescript
try {
  const response = await apiService.get('/endpoint');
  if (!response.data.success) {
    throw new Error(response.data.error?.message || 'API request failed');
  }
  return response.data.data;
} catch (error) {
  console.error('Service error:', error);
  throw error; // Re-throw for React Query
}
```

**Component Level:**
```typescript
const { data, isLoading, error } = useData();

if (error) {
  return <ErrorDisplay error={error} />;
}
```

## Hook Patterns

### Query Key Strategy

**Hierarchical Keys:**
```typescript
// Users
['users', 'list', filters] // User list with filters
['users', 'detail', userId] // User detail
['users', 'detail', userId, 'activity'] // User activity

// Shops
['shops', 'list', filters] // Shop list
['shops', 'detail', shopId] // Shop detail
['shops', 'categories'] // Shop categories
```

### Cache Management

**Invalidation Patterns:**
```typescript
// After successful mutation
queryClient.invalidateQueries({ queryKey: ['users', 'list'] });

// Update specific cache
queryClient.setQueryData(['users', 'detail', userId], updatedUser);

// Remove from cache
queryClient.removeQueries({ queryKey: ['users', 'detail', userId] });
```

### Optimistic Updates

For critical operations, immediate UI updates with rollback:
```typescript
onMutate: async (newData) => {
  await queryClient.cancelQueries({ queryKey });
  const previousData = queryClient.getQueryData(queryKey);
  queryClient.setQueryData(queryKey, newData);
  return { previousData };
},
onError: (err, newData, context) => {
  if (context?.previousData) {
    queryClient.setQueryData(queryKey, context.previousData);
  }
}
```

## Performance Optimizations

### 1. Analytics Dashboard
- **Materialized Views:** < 10ms response times
- **Auto-refresh:** Every 2-5 minutes for different metrics
- **Background Updates:** Non-blocking data refreshes

### 2. Data Fetching
- **Intelligent Caching:** Different stale times based on data volatility
- **Pagination:** Server-side pagination for large datasets
- **Parallel Queries:** Independent data fetching where possible

### 3. UI Optimizations
- **Dynamic Imports:** Modal components loaded on demand
- **Hydration Prevention:** Client-side only rendering for complex states
- **Skeleton Loading:** Smooth loading experiences

## Security & Validation

### 1. API Security
- **Authentication:** JWT tokens for external backend
- **Authorization:** Role-based access control
- **Input Validation:** Zod schemas for form validation

### 2. Frontend Security
- **XSS Prevention:** DOMPurify for user content
- **Type Safety:** Full TypeScript coverage
- **Error Boundaries:** Graceful error handling

---

**Note:** This is a frontend-only application. All business logic, authentication, and data processing occurs in the external backend service. The frontend focuses on data presentation, user interaction, and state management.