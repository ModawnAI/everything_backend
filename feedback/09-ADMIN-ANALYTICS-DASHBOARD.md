# Implementation Plan: Admin Analytics Dashboard

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 - Medium |
| **Estimated Effort** | 16-24 hours |
| **Risk Level** | Low |
| **Components Affected** | Backend + Admin Panel |
| **Dependencies** | Recharts (already installed) |

## Problem Statement

The Admin Analytics Dashboard has placeholder data instead of real calculations:

```typescript
// Backend: src/controllers/admin-service-details.controller.ts
revenue: 0, // TODO: Calculate actual revenue from database
noShowCount: 0, // TODO: Calculate no-shows
```

**Current State:**
- Analytics service exists (`src/services/admin-analytics.service.ts`)
- Admin routes exist but return placeholder data
- Frontend charts exist but show mock data
- No real-time data aggregation

---

## Required Analytics Features

### 1. Platform Overview (Super Admin)

| Metric | Source | Calculation |
|--------|--------|-------------|
| Total Revenue | payments | SUM(amount) WHERE status='fully_paid' |
| Total Bookings | reservations | COUNT(*) |
| Active Users | users | COUNT(*) WHERE status='active' |
| Active Shops | shops | COUNT(*) WHERE status='active' |
| Conversion Rate | reservations/visits | confirmed / page_views |
| Average Order Value | payments | AVG(amount) |

### 2. Time-based Analytics

| Period | Aggregation |
|--------|-------------|
| Today | Hourly breakdown |
| This Week | Daily breakdown |
| This Month | Daily breakdown |
| This Year | Monthly breakdown |
| Custom Range | Auto-select appropriate interval |

### 3. Shop Performance

| Metric | Description |
|--------|-------------|
| Revenue by Shop | Total revenue per shop |
| Booking Count | Reservations per shop |
| Completion Rate | completed / total |
| No-Show Rate | no_show / total |
| Average Rating | From reviews |
| Customer Retention | Repeat customers % |

### 4. Service Analytics

| Metric | Description |
|--------|-------------|
| Popular Services | By booking count |
| Revenue by Service | Total revenue per service category |
| Service Duration | Average time per category |
| Peak Hours | Most booked time slots |

---

## Implementation Steps

### Step 1: Create Analytics Types

**File:** `src/types/analytics.types.ts`

```typescript
/**
 * Analytics type definitions
 */

// Time period enum
export type AnalyticsPeriod = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

// Metric aggregation interval
export type AggregationInterval = 'hour' | 'day' | 'week' | 'month';

// Platform overview metrics
export interface PlatformOverview {
  totalRevenue: number;
  revenueChange: number; // % change from previous period
  totalBookings: number;
  bookingsChange: number;
  activeUsers: number;
  usersChange: number;
  activeShops: number;
  shopsChange: number;
  averageOrderValue: number;
  aovChange: number;
  conversionRate: number;
  conversionChange: number;
  period: AnalyticsPeriod;
  generatedAt: string;
}

// Time series data point
export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

// Revenue analytics
export interface RevenueAnalytics {
  total: number;
  byPaymentMethod: Record<string, number>;
  byCategory: Record<string, number>;
  timeSeries: TimeSeriesDataPoint[];
  previousPeriodTotal: number;
  growth: number;
}

// Booking analytics
export interface BookingAnalytics {
  total: number;
  byStatus: {
    requested: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };
  completionRate: number;
  cancellationRate: number;
  noShowRate: number;
  averageLeadTime: number; // Days between booking and service
  timeSeries: TimeSeriesDataPoint[];
}

// User analytics
export interface UserAnalytics {
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
  byRole: Record<string, number>;
  byStatus: Record<string, number>;
  retentionRate: number;
  churnRate: number;
  averageSessionDuration: number;
  timeSeries: TimeSeriesDataPoint[];
}

// Shop analytics
export interface ShopAnalytics {
  totalShops: number;
  activeShops: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  averageRating: number;
  topPerformers: ShopPerformance[];
  bottomPerformers: ShopPerformance[];
}

// Individual shop performance
export interface ShopPerformance {
  shopId: string;
  shopName: string;
  category: string;
  totalRevenue: number;
  totalBookings: number;
  completionRate: number;
  noShowRate: number;
  averageRating: number;
  reviewCount: number;
}

// Service category analytics
export interface ServiceAnalytics {
  byCategory: {
    category: string;
    bookingCount: number;
    revenue: number;
    averagePrice: number;
    popularServices: string[];
  }[];
  peakHours: {
    hour: number;
    bookingCount: number;
  }[];
  peakDays: {
    day: string;
    bookingCount: number;
  }[];
}

// Points and referral analytics
export interface PointsAnalytics {
  totalPointsIssued: number;
  totalPointsUsed: number;
  totalPointsExpired: number;
  activePointsBalance: number;
  averagePointsPerUser: number;
  redemptionRate: number;
}

export interface ReferralAnalytics {
  totalReferrals: number;
  successfulReferrals: number;
  totalReferralEarnings: number;
  topReferrers: {
    userId: string;
    userName: string;
    referralCount: number;
    earnings: number;
  }[];
  conversionRate: number;
}

// Analytics query params
export interface AnalyticsQueryParams {
  period?: AnalyticsPeriod;
  startDate?: string;
  endDate?: string;
  shopId?: string;
  category?: string;
  groupBy?: AggregationInterval;
}

// Dashboard summary
export interface DashboardSummary {
  overview: PlatformOverview;
  revenueChart: TimeSeriesDataPoint[];
  bookingChart: TimeSeriesDataPoint[];
  topShops: ShopPerformance[];
  recentActivity: {
    type: string;
    description: string;
    timestamp: string;
  }[];
}
```

### Step 2: Update Analytics Service

**File:** `src/services/admin-analytics.service.ts`

```typescript
/**
 * Admin Analytics Service
 * Real-time analytics calculations from database
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import {
  PlatformOverview,
  RevenueAnalytics,
  BookingAnalytics,
  UserAnalytics,
  ShopAnalytics,
  ShopPerformance,
  ServiceAnalytics,
  PointsAnalytics,
  ReferralAnalytics,
  AnalyticsQueryParams,
  DashboardSummary,
  TimeSeriesDataPoint,
  AnalyticsPeriod,
} from '../types/analytics.types';
import { format, subDays, subWeeks, subMonths, subYears, startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear } from 'date-fns';

export class AdminAnalyticsService {
  private supabase = getSupabaseClient();

  /**
   * Get platform overview metrics
   */
  async getPlatformOverview(period: AnalyticsPeriod = 'month'): Promise<PlatformOverview> {
    const { currentStart, currentEnd, previousStart, previousEnd } = this.getPeriodDates(period);

    // Current period metrics
    const [
      currentRevenue,
      currentBookings,
      currentUsers,
      currentShops,
    ] = await Promise.all([
      this.getRevenueForPeriod(currentStart, currentEnd),
      this.getBookingsForPeriod(currentStart, currentEnd),
      this.getActiveUsersCount(),
      this.getActiveShopsCount(),
    ]);

    // Previous period metrics for comparison
    const [
      previousRevenue,
      previousBookings,
    ] = await Promise.all([
      this.getRevenueForPeriod(previousStart, previousEnd),
      this.getBookingsForPeriod(previousStart, previousEnd),
    ]);

    // Calculate changes
    const revenueChange = previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : 0;

    const bookingsChange = previousBookings > 0
      ? ((currentBookings - previousBookings) / previousBookings) * 100
      : 0;

    return {
      totalRevenue: currentRevenue,
      revenueChange: Math.round(revenueChange * 10) / 10,
      totalBookings: currentBookings,
      bookingsChange: Math.round(bookingsChange * 10) / 10,
      activeUsers: currentUsers,
      usersChange: 0, // Calculate if needed
      activeShops: currentShops,
      shopsChange: 0,
      averageOrderValue: currentBookings > 0 ? currentRevenue / currentBookings : 0,
      aovChange: 0,
      conversionRate: 0, // Requires page view tracking
      conversionChange: 0,
      period,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(params: AnalyticsQueryParams): Promise<RevenueAnalytics> {
    const { startDate, endDate } = this.getDateRange(params);

    // Total revenue
    const { data: revenueData } = await this.supabase
      .from('payments')
      .select('amount, payment_method, created_at')
      .in('status', ['fully_paid', 'deposit_paid'])
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const total = revenueData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    // By payment method
    const byPaymentMethod: Record<string, number> = {};
    revenueData?.forEach(p => {
      const method = p.payment_method || 'unknown';
      byPaymentMethod[method] = (byPaymentMethod[method] || 0) + (p.amount || 0);
    });

    // Revenue by category
    const { data: categoryRevenue } = await this.supabase
      .from('reservations')
      .select(`
        total_amount,
        shop:shops(main_category)
      `)
      .in('status', ['completed', 'confirmed'])
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const byCategory: Record<string, number> = {};
    categoryRevenue?.forEach(r => {
      const category = (r.shop as any)?.main_category || 'unknown';
      byCategory[category] = (byCategory[category] || 0) + (r.total_amount || 0);
    });

    // Time series
    const timeSeries = await this.getRevenueTimeSeries(startDate, endDate, params.groupBy || 'day');

    // Previous period for growth calculation
    const periodLength = new Date(endDate).getTime() - new Date(startDate).getTime();
    const previousStart = new Date(new Date(startDate).getTime() - periodLength).toISOString();
    const previousEnd = startDate;
    const previousPeriodTotal = await this.getRevenueForPeriod(previousStart, previousEnd);

    const growth = previousPeriodTotal > 0
      ? ((total - previousPeriodTotal) / previousPeriodTotal) * 100
      : 0;

    return {
      total,
      byPaymentMethod,
      byCategory,
      timeSeries,
      previousPeriodTotal,
      growth: Math.round(growth * 10) / 10,
    };
  }

  /**
   * Get booking analytics
   */
  async getBookingAnalytics(params: AnalyticsQueryParams): Promise<BookingAnalytics> {
    const { startDate, endDate } = this.getDateRange(params);

    const { data: bookings, count } = await this.supabase
      .from('reservations')
      .select('status, created_at, reservation_date', { count: 'exact' })
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const total = count || 0;
    const byStatus = {
      requested: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
    };

    bookings?.forEach(b => {
      if (b.status === 'requested') byStatus.requested++;
      else if (b.status === 'confirmed') byStatus.confirmed++;
      else if (b.status === 'completed') byStatus.completed++;
      else if (b.status === 'cancelled_by_user' || b.status === 'cancelled_by_shop') byStatus.cancelled++;
      else if (b.status === 'no_show') byStatus.noShow++;
    });

    const completionRate = total > 0 ? (byStatus.completed / total) * 100 : 0;
    const cancellationRate = total > 0 ? (byStatus.cancelled / total) * 100 : 0;
    const noShowRate = total > 0 ? (byStatus.noShow / total) * 100 : 0;

    // Calculate average lead time
    let totalLeadDays = 0;
    let leadTimeCount = 0;
    bookings?.forEach(b => {
      if (b.reservation_date && b.created_at) {
        const created = new Date(b.created_at);
        const reserved = new Date(b.reservation_date);
        const days = Math.ceil((reserved.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        if (days >= 0) {
          totalLeadDays += days;
          leadTimeCount++;
        }
      }
    });
    const averageLeadTime = leadTimeCount > 0 ? totalLeadDays / leadTimeCount : 0;

    // Time series
    const timeSeries = await this.getBookingTimeSeries(startDate, endDate, params.groupBy || 'day');

    return {
      total,
      byStatus,
      completionRate: Math.round(completionRate * 10) / 10,
      cancellationRate: Math.round(cancellationRate * 10) / 10,
      noShowRate: Math.round(noShowRate * 10) / 10,
      averageLeadTime: Math.round(averageLeadTime * 10) / 10,
      timeSeries,
    };
  }

  /**
   * Get top performing shops
   */
  async getTopShops(limit: number = 10): Promise<ShopPerformance[]> {
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

    const { data: shops } = await this.supabase
      .from('shops')
      .select(`
        id,
        name,
        main_category,
        reservations!inner(
          id,
          status,
          total_amount
        )
      `)
      .eq('shop_status', 'active')
      .gte('reservations.created_at', thirtyDaysAgo);

    if (!shops) return [];

    const shopPerformance: ShopPerformance[] = shops.map(shop => {
      const reservations = (shop as any).reservations || [];
      const totalRevenue = reservations
        .filter((r: any) => ['completed', 'confirmed'].includes(r.status))
        .reduce((sum: number, r: any) => sum + (r.total_amount || 0), 0);

      const totalBookings = reservations.length;
      const completed = reservations.filter((r: any) => r.status === 'completed').length;
      const noShows = reservations.filter((r: any) => r.status === 'no_show').length;

      return {
        shopId: shop.id,
        shopName: shop.name,
        category: shop.main_category,
        totalRevenue,
        totalBookings,
        completionRate: totalBookings > 0 ? (completed / totalBookings) * 100 : 0,
        noShowRate: totalBookings > 0 ? (noShows / totalBookings) * 100 : 0,
        averageRating: 0, // From reviews
        reviewCount: 0,
      };
    });

    // Sort by revenue and return top N
    return shopPerformance
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);
  }

  /**
   * Get dashboard summary
   */
  async getDashboardSummary(): Promise<DashboardSummary> {
    const [overview, revenueChart, bookingChart, topShops] = await Promise.all([
      this.getPlatformOverview('month'),
      this.getRevenueTimeSeries(
        subDays(new Date(), 30).toISOString(),
        new Date().toISOString(),
        'day'
      ),
      this.getBookingTimeSeries(
        subDays(new Date(), 30).toISOString(),
        new Date().toISOString(),
        'day'
      ),
      this.getTopShops(5),
    ]);

    // Get recent activity
    const { data: recentReservations } = await this.supabase
      .from('reservations')
      .select('id, status, created_at, shop:shops(name)')
      .order('created_at', { ascending: false })
      .limit(10);

    const recentActivity = (recentReservations || []).map(r => ({
      type: 'reservation',
      description: `${(r.shop as any)?.name || 'Unknown shop'} - ${r.status}`,
      timestamp: r.created_at,
    }));

    return {
      overview,
      revenueChart,
      bookingChart,
      topShops,
      recentActivity,
    };
  }

  // ===== Helper Methods =====

  private getPeriodDates(period: AnalyticsPeriod) {
    const now = new Date();
    let currentStart: Date;
    let previousStart: Date;
    let previousEnd: Date;

    switch (period) {
      case 'today':
        currentStart = startOfDay(now);
        previousStart = startOfDay(subDays(now, 1));
        previousEnd = endOfDay(subDays(now, 1));
        break;
      case 'week':
        currentStart = startOfWeek(now);
        previousStart = startOfWeek(subWeeks(now, 1));
        previousEnd = subDays(currentStart, 1);
        break;
      case 'month':
        currentStart = startOfMonth(now);
        previousStart = startOfMonth(subMonths(now, 1));
        previousEnd = subDays(currentStart, 1);
        break;
      case 'year':
        currentStart = startOfYear(now);
        previousStart = startOfYear(subYears(now, 1));
        previousEnd = subDays(currentStart, 1);
        break;
      default:
        currentStart = startOfMonth(now);
        previousStart = startOfMonth(subMonths(now, 1));
        previousEnd = subDays(currentStart, 1);
    }

    return {
      currentStart: currentStart.toISOString(),
      currentEnd: now.toISOString(),
      previousStart: previousStart.toISOString(),
      previousEnd: previousEnd.toISOString(),
    };
  }

  private getDateRange(params: AnalyticsQueryParams) {
    if (params.startDate && params.endDate) {
      return {
        startDate: params.startDate,
        endDate: params.endDate,
      };
    }

    const { currentStart, currentEnd } = this.getPeriodDates(params.period || 'month');
    return {
      startDate: currentStart,
      endDate: currentEnd,
    };
  }

  private async getRevenueForPeriod(startDate: string, endDate: string): Promise<number> {
    const { data } = await this.supabase
      .from('payments')
      .select('amount')
      .in('status', ['fully_paid', 'deposit_paid'])
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    return data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
  }

  private async getBookingsForPeriod(startDate: string, endDate: string): Promise<number> {
    const { count } = await this.supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    return count || 0;
  }

  private async getActiveUsersCount(): Promise<number> {
    const { count } = await this.supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('user_status', 'active');

    return count || 0;
  }

  private async getActiveShopsCount(): Promise<number> {
    const { count } = await this.supabase
      .from('shops')
      .select('id', { count: 'exact', head: true })
      .eq('shop_status', 'active');

    return count || 0;
  }

  private async getRevenueTimeSeries(
    startDate: string,
    endDate: string,
    interval: string
  ): Promise<TimeSeriesDataPoint[]> {
    // Use database aggregation for performance
    const { data } = await this.supabase.rpc('get_revenue_time_series', {
      start_date: startDate,
      end_date: endDate,
      time_interval: interval,
    });

    return data || [];
  }

  private async getBookingTimeSeries(
    startDate: string,
    endDate: string,
    interval: string
  ): Promise<TimeSeriesDataPoint[]> {
    const { data } = await this.supabase.rpc('get_booking_time_series', {
      start_date: startDate,
      end_date: endDate,
      time_interval: interval,
    });

    return data || [];
  }
}

export const adminAnalyticsService = new AdminAnalyticsService();
export default adminAnalyticsService;
```

### Step 3: Create Database Functions

**File:** `src/migrations/XXX_analytics_functions.sql`

```sql
-- Time series aggregation functions for analytics

-- Revenue time series
CREATE OR REPLACE FUNCTION get_revenue_time_series(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  time_interval TEXT DEFAULT 'day'
)
RETURNS TABLE (
  timestamp TIMESTAMPTZ,
  value NUMERIC,
  label TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    date_trunc(time_interval, p.created_at) AS timestamp,
    COALESCE(SUM(p.amount), 0)::NUMERIC AS value,
    to_char(date_trunc(time_interval, p.created_at), 'YYYY-MM-DD') AS label
  FROM payments p
  WHERE p.created_at >= start_date
    AND p.created_at <= end_date
    AND p.status IN ('fully_paid', 'deposit_paid')
  GROUP BY date_trunc(time_interval, p.created_at)
  ORDER BY timestamp;
END;
$$ LANGUAGE plpgsql;

-- Booking time series
CREATE OR REPLACE FUNCTION get_booking_time_series(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  time_interval TEXT DEFAULT 'day'
)
RETURNS TABLE (
  timestamp TIMESTAMPTZ,
  value BIGINT,
  label TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    date_trunc(time_interval, r.created_at) AS timestamp,
    COUNT(*)::BIGINT AS value,
    to_char(date_trunc(time_interval, r.created_at), 'YYYY-MM-DD') AS label
  FROM reservations r
  WHERE r.created_at >= start_date
    AND r.created_at <= end_date
  GROUP BY date_trunc(time_interval, r.created_at)
  ORDER BY timestamp;
END;
$$ LANGUAGE plpgsql;
```

---

## Admin Panel Components

### Step 4: Update Admin Dashboard

**File:** `src/components/dashboard/platform-admin-dashboard.tsx`

Update to use real analytics data:

```tsx
// Use the analytics API instead of mock data
const { data: summary, isLoading } = useQuery({
  queryKey: ['admin-dashboard-summary'],
  queryFn: () => AdminAPI.getDashboardSummary(),
  refetchInterval: 60000, // Refresh every minute
});
```

---

## API Endpoints

### Admin Analytics Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/analytics/overview` | Platform overview |
| GET | `/api/admin/analytics/revenue` | Revenue analytics |
| GET | `/api/admin/analytics/bookings` | Booking analytics |
| GET | `/api/admin/analytics/users` | User analytics |
| GET | `/api/admin/analytics/shops` | Shop analytics |
| GET | `/api/admin/analytics/dashboard` | Dashboard summary |

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/types/analytics.types.ts` | **CREATE** | Analytics type definitions |
| `src/services/admin-analytics.service.ts` | **MODIFY** | Real analytics calculations |
| `src/controllers/admin-analytics.controller.ts` | **MODIFY** | API endpoints |
| `src/migrations/XXX_analytics_functions.sql` | **CREATE** | Database functions |
| Admin panel dashboard components | **MODIFY** | Use real data |

---

## Testing Plan

- [ ] Overview metrics accurate
- [ ] Revenue calculations correct
- [ ] Booking stats match database
- [ ] Time series data renders
- [ ] Date range filters work
- [ ] Shop performance accurate
- [ ] Charts display correctly
- [ ] Auto-refresh working

---

## Deployment Checklist

- [ ] Create analytics types
- [ ] Update analytics service
- [ ] Run database migration
- [ ] Update API endpoints
- [ ] Update admin panel
- [ ] Test calculations
- [ ] Performance test
- [ ] Deploy to staging
- [ ] Verify data accuracy
- [ ] Deploy to production

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Data accuracy | 100% |
| Dashboard load time | <2s |
| Query performance | <500ms |
| Auto-refresh reliability | 100% |
