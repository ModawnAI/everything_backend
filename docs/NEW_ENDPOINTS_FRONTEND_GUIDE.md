# New Endpoints - Frontend Integration Guide

**Version:** 1.0
**Last Updated:** 2025-11-12
**Commit:** dc8bd29

---

## Overview

This document provides frontend integration guidance for the new endpoints added in the latest backend update. These features enhance user experience with refund transparency, improve shop owner management capabilities, and enable real-time analytics.

---

## Table of Contents

1. [Refund Preview Endpoint](#1-refund-preview-endpoint)
2. [Shop Management Endpoints](#2-shop-management-endpoints)
3. [Feed Ranking Analytics](#3-feed-ranking-analytics)
4. [Shop Owner Permissions](#4-shop-owner-permissions)
5. [Integration Examples](#5-integration-examples)
6. [Error Handling](#6-error-handling)
7. [Testing Checklist](#7-testing-checklist)

---

## 1. Refund Preview Endpoint

### Purpose
Allow users to see the exact refund amount **before** confirming a reservation cancellation. This improves transparency and reduces cancellation disputes.

### Endpoint Details

**URL:** `GET /api/reservations/:id/refund-preview`

**Authentication:** Required (JWT)

**Rate Limit:** 30 requests per 15 minutes

**Parameters:**
- `id` (path, required) - Reservation ID
- `cancellation_type` (query, optional) - Type of cancellation. Default: `'user'`
  - Options: `'user'`, `'shop'`, `'admin'`, `'no-show'`

### Request Example

```typescript
// Frontend service method
async getRefundPreview(reservationId: string): Promise<RefundPreview> {
  const response = await fetch(
    `/api/reservations/${reservationId}/refund-preview`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getAccessToken()}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch refund preview');
  }

  const data = await response.json();
  return data.data;
}
```

### Response Structure

```typescript
interface RefundPreviewResponse {
  success: true;
  data: {
    refundAmount: number;        // KRW amount to be refunded (e.g., 45000)
    refundPercentage: number;    // Percentage of deposit (e.g., 90)
    cancellationFee: number;     // Fee percentage (e.g., 10)
    cancellationWindow: string;  // Time window category
    isEligible: boolean;        // Whether cancellation is allowed
    reason: string;             // Explanation of the refund calculation
    message?: string;           // Additional info message
  };
}
```

### Refund Tier Calculation

The refund amount is calculated based on time remaining before the reservation:

| Time Before Reservation | Refund % | Fee % | Window Category |
|------------------------|----------|-------|-----------------|
| > 7 days | 100% | 0% | `very_early` |
| 3-7 days | 90% | 10% | `early` |
| 1-3 days | 80% | 20% | `medium` |
| 12-24 hours | 50% | 50% | `late` |
| < 12 hours | 0% | 100% | `very_late` |

**Note:** All calculations are timezone-aware using Asia/Seoul timezone.

### UI Integration Example

```typescript
// Cancel confirmation dialog component
function CancellationDialog({ reservationId, depositAmount, onCancel, onConfirm }) {
  const [refundPreview, setRefundPreview] = useState<RefundPreview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRefundPreview = async () => {
      setLoading(true);
      try {
        const preview = await getRefundPreview(reservationId);
        setRefundPreview(preview);
      } catch (error) {
        console.error('Failed to fetch refund preview:', error);
        // Show error toast
      } finally {
        setLoading(false);
      }
    };

    fetchRefundPreview();
  }, [reservationId]);

  if (loading) return <Spinner />;

  if (!refundPreview?.isEligible) {
    return (
      <Dialog>
        <DialogTitle>Cancellation Not Allowed</DialogTitle>
        <DialogContent>
          <Alert severity="error">
            {refundPreview?.reason || 'This reservation cannot be cancelled at this time.'}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancel}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog>
      <DialogTitle>Cancel Reservation</DialogTitle>
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          Are you sure you want to cancel this reservation?
        </Typography>

        <Box sx={{ my: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
          <Typography variant="h6" gutterBottom>
            Refund Details
          </Typography>

          <Stack spacing={1}>
            <Box display="flex" justifyContent="space-between">
              <Typography>Original Deposit:</Typography>
              <Typography fontWeight="bold">
                ₩{depositAmount.toLocaleString()}
              </Typography>
            </Box>

            <Box display="flex" justifyContent="space-between">
              <Typography>Cancellation Fee ({refundPreview.cancellationFee}%):</Typography>
              <Typography color="error.main">
                -₩{(depositAmount * refundPreview.cancellationFee / 100).toLocaleString()}
              </Typography>
            </Box>

            <Divider />

            <Box display="flex" justifyContent="space-between">
              <Typography variant="h6">Refund Amount:</Typography>
              <Typography variant="h6" color="success.main">
                ₩{refundPreview.refundAmount.toLocaleString()}
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Alert severity="info" sx={{ mt: 2 }}>
          {refundPreview.reason}
        </Alert>
      </DialogContent>

      <DialogActions>
        <Button onClick={onCancel}>Keep Reservation</Button>
        <Button
          onClick={() => onConfirm(reservationId)}
          color="error"
          variant="contained"
        >
          Confirm Cancellation
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

### Best Practices

1. **Always fetch preview before showing cancel dialog** - Don't rely on cached data
2. **Handle rate limiting** - Implement exponential backoff if you hit rate limits
3. **Show clear refund breakdown** - Display original amount, fee, and net refund
4. **Disable cancel button if not eligible** - Check `isEligible` field
5. **Cache preview for short time** - Only cache for 30 seconds max (refund changes with time)

---

## 2. Shop Management Endpoints

### New Endpoints for Shop Owners

#### 2.1 Get Shop Detail

**URL:** `GET /api/shop-owner/shops/:id`

**Purpose:** Retrieve detailed information about the shop

**Response:**
```typescript
{
  success: true,
  data: {
    id: string;
    name: string;
    description: string;
    address: string;
    phone: string;
    email: string;
    business_hours: string;
    images: string[];
    rating: number;
    review_count: number;
    verification_status: 'pending' | 'verified' | 'rejected';
    created_at: string;
    updated_at: string;
  }
}
```

#### 2.2 Get Operating Hours

**URL:** `GET /api/shop-owner/shops/:id/operating-hours`

**Purpose:** Retrieve shop operating hours for all days of the week

**Response:**
```typescript
{
  success: true,
  data: Array<{
    id: string;
    shop_id: string;
    day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6;  // 0 = Sunday
    open_time: string;  // "09:00"
    close_time: string; // "18:00"
    is_closed: boolean;
  }>
}
```

#### 2.3 Update Operating Hours

**URL:** `PUT /api/shop-owner/shops/:id/operating-hours`

**Purpose:** Bulk update operating hours for all days

**Request Body:**
```typescript
{
  operating_hours: Array<{
    day_of_week: number;
    open_time: string;
    close_time: string;
    is_closed: boolean;
  }>
}
```

**Example:**
```typescript
async updateOperatingHours(shopId: string, hours: OperatingHours[]) {
  const response = await fetch(
    `/api/shop-owner/shops/${shopId}/operating-hours`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getAccessToken()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ operating_hours: hours })
    }
  );

  return response.json();
}
```

#### 2.4 Get Shop Statistics

**URL:** `GET /api/shop-owner/shops/:id/statistics`

**Purpose:** Retrieve aggregated shop performance metrics

**Response:**
```typescript
{
  success: true,
  data: {
    total_reservations: number;
    completed_reservations: number;
    cancelled_reservations: number;
    total_revenue: number;
    average_rating: number;
    total_reviews: number;
    customer_count: number;
    period: {
      start_date: string;
      end_date: string;
    }
  }
}
```

#### 2.5 Get Shop Customers

**URL:** `GET /api/shop-owner/shops/:id/customers`

**Purpose:** List all customers who have booked at the shop

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 20)
- `search` (optional) - Search by name or phone

**Response:**
```typescript
{
  success: true,
  data: {
    customers: Array<{
      id: string;
      name: string;
      email: string;
      phone: string;
      total_reservations: number;
      total_spent: number;
      last_visit: string;
    }>,
    pagination: {
      current_page: number;
      total_pages: number;
      total_items: number;
      items_per_page: number;
    }
  }
}
```

### Security Notes

All shop management endpoints:
- ✅ Require JWT authentication
- ✅ Verify shop ownership (shopId in JWT must match route param)
- ✅ Return 403 if attempting to access another shop's data
- ✅ Rate limited to prevent abuse

---

## 3. Feed Ranking Analytics

### Endpoint

**URL:** `GET /api/feed/analytics/:userId` (or internal service call)

**Purpose:** Retrieve personalized feed ranking score and engagement metrics

### Response Structure

```typescript
interface FeedAnalytics {
  totalPosts: number;
  avgEngagementRate: number;       // Percentage (0-100)
  topCategories: Array<{
    category: string;
    count: number;
  }>;
  engagementTrends: Array<{
    date: string;
    engagement: number;
  }>;
  personalizedScore: number;        // 0-100
  totalLikes: number;
  avgLikes: number;
  totalComments: number;
  avgComments: number;
  totalViews: number;
  avgViews: number;
}
```

### Scoring Algorithm

The personalized score (0-100) is calculated as:

```
score = min(100, round(
  (avgEngagementRate × 50) +    // 50% weight on engagement rate
  (avgLikes / 10) +              // Bonus for likes
  (avgComments / 5) +            // Higher weight on comments
  (totalPosts × 2)               // Bonus for posting frequency
))
```

### UI Integration

```typescript
function UserProfileAnalytics({ userId }) {
  const { data: analytics, isLoading } = useQuery(
    ['feed-analytics', userId],
    () => getFeedAnalytics(userId),
    {
      staleTime: 5 * 60 * 1000,  // Cache for 5 minutes
      cacheTime: 10 * 60 * 1000
    }
  );

  if (isLoading) return <Skeleton />;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6">Feed Performance</Typography>

        <Box sx={{ my: 2 }}>
          <CircularProgressWithLabel
            value={analytics.personalizedScore}
            label="Score"
          />
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Metric
              label="Total Posts"
              value={analytics.totalPosts}
            />
          </Grid>
          <Grid item xs={6}>
            <Metric
              label="Avg Engagement"
              value={`${analytics.avgEngagementRate.toFixed(1)}%`}
            />
          </Grid>
          <Grid item xs={6}>
            <Metric
              label="Total Likes"
              value={analytics.totalLikes}
            />
          </Grid>
          <Grid item xs={6}>
            <Metric
              label="Total Comments"
              value={analytics.totalComments}
            />
          </Grid>
        </Grid>

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
          Top Categories
        </Typography>
        <Stack spacing={1}>
          {analytics.topCategories.map(cat => (
            <Chip
              key={cat.category}
              label={`${cat.category} (${cat.count})`}
              size="small"
            />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
```

---

## 4. Shop Owner Permissions

### New Permission Structure

Shop owner JWT tokens now include a `permissions` array for fine-grained access control:

```typescript
interface ShopOwnerJWT {
  id: string;
  email: string;
  name: string;
  role: 'shop_owner';
  shopId: string;
  permissions: string[];  // ← NEW
}
```

### Available Permissions

```typescript
const SHOP_OWNER_PERMISSIONS = [
  'shop.dashboard.view',      // View dashboard metrics
  'shop.analytics.view',      // Access analytics page
  'shop.operations.manage',   // Manage reservations, services
  'shop.feed.manage',         // Manage social feed posts
  'shop.financial.view',      // View payments and settlements
  'shop.settings.manage'      // Update shop settings
];
```

### Frontend Permission Checking

```typescript
// Permission check utility
function hasPermission(user: ShopOwnerJWT, permission: string): boolean {
  return user.permissions?.includes(permission) ?? false;
}

// React hook
function usePermission(permission: string): boolean {
  const { user } = useAuth();
  return hasPermission(user, permission);
}

// Usage in components
function FinancialReports() {
  const canViewFinancial = usePermission('shop.financial.view');

  if (!canViewFinancial) {
    return <AccessDenied />;
  }

  return <FinancialDashboard />;
}

// Conditional rendering
function ShopNavigation() {
  const canManageOperations = usePermission('shop.operations.manage');
  const canViewAnalytics = usePermission('shop.analytics.view');

  return (
    <Nav>
      <NavItem to="/dashboard">Dashboard</NavItem>
      {canManageOperations && (
        <NavItem to="/reservations">Reservations</NavItem>
      )}
      {canViewAnalytics && (
        <NavItem to="/analytics">Analytics</NavItem>
      )}
    </Nav>
  );
}
```

---

## 5. Integration Examples

### Complete Cancellation Flow with Refund Preview

```typescript
// 1. User clicks "Cancel Reservation" button
async function handleCancelClick(reservationId: string) {
  setShowCancelDialog(true);

  // 2. Fetch refund preview
  try {
    const preview = await getRefundPreview(reservationId);
    setRefundPreview(preview);
  } catch (error) {
    toast.error('Failed to load refund information');
    setShowCancelDialog(false);
  }
}

// 3. User confirms cancellation
async function handleConfirmCancel(reservationId: string) {
  try {
    // Actual cancellation API call
    const result = await cancelReservation(reservationId);

    if (result.success) {
      toast.success(
        `Reservation cancelled. ₩${refundPreview.refundAmount.toLocaleString()} will be refunded.`
      );
      router.push('/my-reservations');
    }
  } catch (error) {
    toast.error('Failed to cancel reservation');
  } finally {
    setShowCancelDialog(false);
  }
}
```

### Shop Owner Dashboard Integration

```typescript
function ShopOwnerDashboard({ shopId }) {
  // Fetch all shop data in parallel
  const { data: shopInfo } = useQuery(['shop', shopId], () =>
    getShopDetail(shopId)
  );

  const { data: stats } = useQuery(['shop-stats', shopId], () =>
    getShopStatistics(shopId)
  );

  const { data: hours } = useQuery(['shop-hours', shopId], () =>
    getOperatingHours(shopId)
  );

  return (
    <Dashboard>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Total Revenue"
            value={`₩${stats?.total_revenue.toLocaleString()}`}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Reservations"
            value={stats?.total_reservations}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatCard
            title="Average Rating"
            value={stats?.average_rating.toFixed(1)}
          />
        </Grid>

        <Grid item xs={12}>
          <OperatingHoursCard
            hours={hours}
            onUpdate={(newHours) => updateOperatingHours(shopId, newHours)}
          />
        </Grid>
      </Grid>
    </Dashboard>
  );
}
```

---

## 6. Error Handling

### Common Error Scenarios

#### 1. Refund Preview - Not Eligible

```typescript
{
  success: false,
  error: {
    code: 'REFUND_NOT_ELIGIBLE',
    message: 'Cancellation not allowed within 12 hours of reservation'
  }
}
```

**Frontend Action:** Show alert explaining why cancellation isn't allowed

#### 2. Shop Ownership Mismatch

```typescript
{
  success: false,
  error: {
    code: 'UNAUTHORIZED_SHOP_ACCESS',
    message: 'You can only access your own shop data'
  }
}
```

**Frontend Action:** Redirect to correct shop or show access denied page

#### 3. Rate Limit Exceeded

```typescript
{
  success: false,
  error: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.'
  }
}
```

**Frontend Action:** Implement exponential backoff, show rate limit message

### Error Handling Pattern

```typescript
async function apiCallWithErrorHandling<T>(
  apiCall: () => Promise<T>
): Promise<T | null> {
  try {
    return await apiCall();
  } catch (error) {
    if (error.response) {
      const { code, message } = error.response.data.error;

      switch (code) {
        case 'UNAUTHORIZED':
          // Redirect to login
          router.push('/login');
          break;

        case 'RATE_LIMIT_EXCEEDED':
          toast.warning('Too many requests. Please wait a moment.');
          break;

        case 'UNAUTHORIZED_SHOP_ACCESS':
          toast.error('You do not have access to this shop.');
          router.push('/dashboard');
          break;

        default:
          toast.error(message || 'An error occurred');
      }
    } else {
      toast.error('Network error. Please check your connection.');
    }

    return null;
  }
}
```

---

## 7. Testing Checklist

### Refund Preview Feature

- [ ] Preview displays correct refund amount for reservation > 7 days away
- [ ] Preview displays correct refund amount for reservation 2 days away
- [ ] Preview displays 0% refund for reservation < 12 hours away
- [ ] "Not eligible" message shows when cancellation not allowed
- [ ] Refund breakdown shows deposit, fee, and net refund clearly
- [ ] Rate limiting works (test 31 requests in 15 minutes)
- [ ] Preview updates when page is refreshed (no stale data)
- [ ] Timezone handling works correctly for Korean business hours

### Shop Management

- [ ] Shop owner can view own shop detail
- [ ] Shop owner CANNOT view other shops' details (403 error)
- [ ] Operating hours display correctly for all days
- [ ] Operating hours update successfully
- [ ] Shop statistics load and display correctly
- [ ] Customer list displays with pagination
- [ ] Customer search works by name and phone
- [ ] All endpoints return 401 if not authenticated

### Feed Ranking Analytics

- [ ] Analytics display correctly for user with posts
- [ ] Analytics show empty state for user with 0 posts
- [ ] Personalized score calculates correctly
- [ ] Top categories sort by frequency
- [ ] 7-day trends show accurate data
- [ ] Analytics cache works (5-minute stale time)

### Permissions

- [ ] Navigation items hide/show based on permissions
- [ ] Protected pages redirect to access denied if no permission
- [ ] Permission check works on initial page load
- [ ] Permission check works after login/token refresh

---

## Support

For questions or issues with these endpoints:
- Backend Issues: Create ticket in backend repository
- Frontend Integration Help: Contact backend team
- API Documentation: See `/api-docs` for Swagger UI

---

**Document Version:** 1.0
**Last Updated:** 2025-11-12
**Endpoints Added in Commit:** dc8bd29
