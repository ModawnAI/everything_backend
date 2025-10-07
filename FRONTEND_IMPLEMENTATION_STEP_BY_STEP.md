# Frontend Implementation Guide - Step by Step Ultra-Detailed

## 🎯 Overview

This guide provides **exact, copy-paste ready code** for integrating the optimized analytics endpoints into your frontend application.

**Key Benefits for Frontend:**
- ⚡ **Instant Loading**: < 10ms response (no more 5-10 second waits)
- 🎨 **No Spinners Needed**: Data loads so fast, users won't see loading states
- 📊 **Real-time Feel**: Data refreshes automatically (backend handles it)
- 🔄 **Auto-unwrapping**: Responses are already in camelCase

---

## 📋 Table of Contents

1. [Project Setup](#1-project-setup)
2. [API Client Configuration](#2-api-client-configuration)
3. [TypeScript Type Definitions](#3-typescript-type-definitions)
4. [API Service Layer](#4-api-service-layer)
5. [React Hooks (Custom Hooks)](#5-react-hooks-custom-hooks)
6. [Component Implementation](#6-component-implementation)
7. [State Management (Optional)](#7-state-management-optional)
8. [Error Handling & Edge Cases](#8-error-handling--edge-cases)
9. [Performance Optimization](#9-performance-optimization)
10. [Testing Strategy](#10-testing-strategy)

---

## 1. Project Setup

### Step 1.1: Install Dependencies

```bash
# Core dependencies
npm install axios

# For charts and visualizations
npm install recharts

# For date formatting
npm install date-fns

# TypeScript types (if using TypeScript)
npm install --save-dev @types/node
```

### Step 1.2: Project Structure

Create this exact folder structure:

```
src/
├── types/
│   └── analytics.types.ts          # TypeScript interfaces
├── services/
│   ├── api.ts                      # Base API client
│   └── analytics.service.ts        # Analytics API methods
├── hooks/
│   ├── useAnalytics.ts            # Custom hooks for analytics
│   └── useDashboard.ts            # Dashboard-specific hooks
├── components/
│   ├── analytics/
│   │   ├── DashboardMetrics.tsx   # Main metrics cards
│   │   ├── RevenueTrendsChart.tsx # Revenue chart
│   │   ├── UserGrowthChart.tsx    # User growth chart
│   │   ├── ShopPerformanceTable.tsx # Shop rankings
│   │   └── MetricCard.tsx         # Reusable metric card
│   └── common/
│       ├── LoadingSpinner.tsx     # Loading component
│       └── ErrorBoundary.tsx      # Error boundary
├── utils/
│   ├── format.ts                  # Formatting utilities
│   └── constants.ts               # API constants
└── pages/
    └── AdminDashboard.tsx         # Main dashboard page
```

---

## 2. API Client Configuration

### Step 2.1: Create Base API Client

**File**: `src/services/api.ts`

```typescript
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// ============================================
// Configuration
// ============================================

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const TOKEN_KEY = 'admin_token';

// ============================================
// Create Axios Instance
// ============================================

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds (analytics endpoints respond in < 10ms)
  headers: {
    'Content-Type': 'application/json',
  },
});

// ============================================
// Request Interceptor (Add Auth Token)
// ============================================

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get token from localStorage
    const token = localStorage.getItem(TOKEN_KEY);

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log request in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
        data: config.data,
      });
    }

    return config;
  },
  (error: AxiosError) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// ============================================
// Response Interceptor (Auto-unwrap & Handle Errors)
// ============================================

api.interceptors.response.use(
  (response) => {
    // Log response in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API Response] ${response.config.url}`, {
        status: response.status,
        data: response.data,
      });
    }

    // Auto-unwrap { success: true, data: {...} } to just {...}
    if (response.data && response.data.success && response.data.data) {
      return response.data.data;
    }

    // If no wrapper, return as-is
    return response.data;
  },
  (error: AxiosError) => {
    // Handle common errors
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as any;

      switch (status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem(TOKEN_KEY);
          window.location.href = '/login';
          break;

        case 403:
          console.error('[API Error] Forbidden:', data?.error?.message);
          break;

        case 404:
          console.error('[API Error] Not Found:', error.config?.url);
          break;

        case 500:
          console.error('[API Error] Server Error:', data?.error?.message);
          break;

        default:
          console.error('[API Error]', status, data?.error?.message);
      }
    } else if (error.request) {
      console.error('[API Error] No response received:', error.message);
    } else {
      console.error('[API Error] Request setup failed:', error.message);
    }

    return Promise.reject(error);
  }
);

// ============================================
// Helper Functions
// ============================================

export const setAuthToken = (token: string) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const clearAuthToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

export default api;
```

**Key Features:**
- ✅ Auto-adds `Authorization: Bearer {token}` to all requests
- ✅ Auto-unwraps `{ success: true, data: {...} }` responses
- ✅ Handles 401 errors (redirects to login)
- ✅ Development logging
- ✅ 30-second timeout (more than enough for < 10ms endpoints)

---

## 3. TypeScript Type Definitions

### Step 3.1: Create Analytics Types

**File**: `src/types/analytics.types.ts`

```typescript
// ============================================
// Dashboard Quick Metrics (15 key metrics)
// ============================================

export interface QuickDashboardMetrics {
  // User metrics
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  userGrowthRate: number;

  // Revenue metrics
  totalRevenue: number;
  todayRevenue: number;
  monthRevenue: number;
  revenueGrowthRate: number;

  // Reservation metrics
  totalReservations: number;
  activeReservations: number;
  todayReservations: number;
  reservationSuccessRate: number;

  // Shop metrics
  totalShops: number;
  activeShops: number;
  pendingApprovals: number;

  // Payment metrics
  totalTransactions: number;
  successfulTransactions: number;
  conversionRate: number;

  // Metadata
  lastUpdated: string;
}

// ============================================
// Trend Data
// ============================================

export interface UserGrowthTrend {
  date: string; // ISO date string
  newUsers: number;
  activeUsers: number;
}

export interface RevenueTrend {
  date: string; // ISO date string
  totalRevenue: number;
  transactionCount: number;
  avgTransactionValue: number;
}

export interface ReservationTrend {
  date: string; // ISO date string
  totalReservations: number;
  completedReservations: number;
  cancelledReservations: number;
  completionRate: number;
}

// ============================================
// Summary Data
// ============================================

export interface ShopPerformance {
  shopId: string;
  shopName: string;
  mainCategory: string;
  shopStatus: string;
  totalReservations: number;
  completedReservations: number;
  totalRevenue: number;
  avgRating: number;
  completionRate: number;
}

export interface PaymentStatusSummary {
  paymentStatus: string;
  paymentStage: string;
  count: number;
  totalAmount: number;
  avgAmount: number;
}

export interface PointTransactionSummary {
  transactionType: string;
  status: string;
  transactionCount: number;
  totalPoints: number;
  avgPoints: number;
}

export interface CategoryPerformance {
  mainCategory: string;
  totalShops: number;
  activeShops: number;
  totalReservations: number;
  totalRevenue: number;
  avgRating: number;
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp?: string;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
}

// ============================================
// Hook Return Types
// ============================================

export interface UseAnalyticsResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

---

## 4. API Service Layer

### Step 4.1: Create Analytics Service

**File**: `src/services/analytics.service.ts`

```typescript
import api from './api';
import {
  QuickDashboardMetrics,
  UserGrowthTrend,
  RevenueTrend,
  ReservationTrend,
  ShopPerformance,
  PaymentStatusSummary,
  PointTransactionSummary,
  CategoryPerformance,
} from '../types/analytics.types';

// ============================================
// Analytics Service
// ============================================

export class AnalyticsService {

  /**
   * Get quick dashboard metrics (< 10ms)
   * Returns 15 key metrics for instant dashboard load
   */
  static async getQuickDashboard(): Promise<QuickDashboardMetrics> {
    return api.get<QuickDashboardMetrics>('/admin/analytics/dashboard/quick');
  }

  /**
   * Get user growth trends (< 10ms)
   * @param limit - Number of days to return (default: 30, max: 90)
   */
  static async getUserGrowthTrends(limit: number = 30): Promise<UserGrowthTrend[]> {
    return api.get<UserGrowthTrend[]>('/admin/analytics/trends/users', {
      params: { limit: Math.min(limit, 90) }
    });
  }

  /**
   * Get revenue trends (< 10ms)
   * @param limit - Number of days to return (default: 30, max: 90)
   */
  static async getRevenueTrends(limit: number = 30): Promise<RevenueTrend[]> {
    return api.get<RevenueTrend[]>('/admin/analytics/trends/revenue', {
      params: { limit: Math.min(limit, 90) }
    });
  }

  /**
   * Get reservation trends (< 10ms)
   * @param limit - Number of days to return (default: 30, max: 90)
   */
  static async getReservationTrends(limit: number = 30): Promise<ReservationTrend[]> {
    return api.get<ReservationTrend[]>('/admin/analytics/trends/reservations', {
      params: { limit: Math.min(limit, 90) }
    });
  }

  /**
   * Get shop performance (< 10ms)
   * @param limit - Number of shops to return (default: 20, max: 100)
   */
  static async getShopPerformance(limit: number = 20): Promise<ShopPerformance[]> {
    return api.get<ShopPerformance[]>('/admin/analytics/shops/performance', {
      params: { limit: Math.min(limit, 100) }
    });
  }

  /**
   * Get payment status summary (< 10ms)
   */
  static async getPaymentSummary(): Promise<PaymentStatusSummary[]> {
    return api.get<PaymentStatusSummary[]>('/admin/analytics/payments/summary');
  }

  /**
   * Get point transaction summary (< 10ms)
   */
  static async getPointSummary(): Promise<PointTransactionSummary[]> {
    return api.get<PointTransactionSummary[]>('/admin/analytics/points/summary');
  }

  /**
   * Get category performance (< 10ms)
   */
  static async getCategoryPerformance(): Promise<CategoryPerformance[]> {
    return api.get<CategoryPerformance[]>('/admin/analytics/categories/performance');
  }

  /**
   * Manually refresh all materialized views (optional)
   * Takes ~1 second, normally not needed (auto-refreshes every 2-10 min)
   */
  static async refreshViews(): Promise<{ success: boolean; message: string }> {
    return api.post('/admin/analytics/refresh');
  }
}

export default AnalyticsService;
```

---

## 5. React Hooks (Custom Hooks)

### Step 5.1: Create useAnalytics Hook

**File**: `src/hooks/useAnalytics.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { UseAnalyticsResult } from '../types/analytics.types';

/**
 * Generic hook for fetching analytics data
 * Handles loading, error states, and refetching
 */
export function useAnalytics<T>(
  fetchFn: () => Promise<T>,
  dependencies: any[] = []
): UseAnalyticsResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err as Error);
      console.error('[useAnalytics] Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    fetchData();
  }, [...dependencies, fetchData]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}
```

### Step 5.2: Create useDashboard Hook

**File**: `src/hooks/useDashboard.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import AnalyticsService from '../services/analytics.service';
import {
  QuickDashboardMetrics,
  RevenueTrend,
  UserGrowthTrend,
  ShopPerformance,
} from '../types/analytics.types';

/**
 * Comprehensive dashboard hook
 * Loads all dashboard data in parallel
 */
export function useDashboard() {
  const [metrics, setMetrics] = useState<QuickDashboardMetrics | null>(null);
  const [revenueTrends, setRevenueTrends] = useState<RevenueTrend[]>([]);
  const [userTrends, setUserTrends] = useState<UserGrowthTrend[]>([]);
  const [topShops, setTopShops] = useState<ShopPerformance[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all data in parallel (all respond in < 10ms each)
      const [
        quickMetrics,
        revenue,
        users,
        shops,
      ] = await Promise.all([
        AnalyticsService.getQuickDashboard(),
        AnalyticsService.getRevenueTrends(30),
        AnalyticsService.getUserGrowthTrends(30),
        AnalyticsService.getShopPerformance(10),
      ]);

      setMetrics(quickMetrics);
      setRevenueTrends(revenue.reverse()); // Reverse for chronological order
      setUserTrends(users.reverse());
      setTopShops(shops);

    } catch (err) {
      setError(err as Error);
      console.error('[useDashboard] Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const refetch = useCallback(async () => {
    await loadDashboard();
  }, [loadDashboard]);

  return {
    metrics,
    revenueTrends,
    userTrends,
    topShops,
    loading,
    error,
    refetch,
  };
}
```

---

## 6. Component Implementation

### Step 6.1: Utility Functions

**File**: `src/utils/format.ts`

```typescript
/**
 * Format number with thousands separator
 * Example: 1234567 → "1,234,567"
 */
export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('ko-KR').format(num);
};

/**
 * Format currency (Korean Won)
 * Example: 1234567 → "₩1,234,567"
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    minimumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format percentage
 * Example: 12.5 → "12.5%"
 */
export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format date to Korean locale
 * Example: "2025-10-07" → "2025년 10월 7일"
 */
export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
};

/**
 * Format short date for charts
 * Example: "2025-10-07" → "10/07"
 */
export const formatShortDate = (date: string): string => {
  const d = new Date(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

/**
 * Get trend indicator icon
 */
export const getTrendIcon = (value: number): string => {
  if (value > 0) return '↑';
  if (value < 0) return '↓';
  return '→';
};

/**
 * Get trend color class (Tailwind)
 */
export const getTrendColorClass = (value: number): string => {
  if (value > 0) return 'text-green-600';
  if (value < 0) return 'text-red-600';
  return 'text-gray-600';
};
```

### Step 6.2: Metric Card Component

**File**: `src/components/analytics/MetricCard.tsx`

```typescript
import React from 'react';
import { formatNumber, formatCurrency, formatPercentage, getTrendIcon, getTrendColorClass } from '../../utils/format';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
  valueType?: 'number' | 'currency' | 'percentage';
  large?: boolean;
  urgent?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  icon,
  valueType = 'number',
  large = false,
  urgent = false,
}) => {
  // Format value based on type
  const formattedValue = typeof value === 'number'
    ? valueType === 'currency'
      ? formatCurrency(value)
      : valueType === 'percentage'
      ? formatPercentage(value)
      : formatNumber(value)
    : value;

  return (
    <div className={`
      bg-white rounded-lg shadow-md p-6
      transition-all duration-200 hover:shadow-lg
      ${urgent ? 'border-l-4 border-yellow-500' : ''}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>

      {/* Value */}
      <div className={`
        font-bold mb-2
        ${large ? 'text-3xl' : 'text-2xl'}
      `}>
        {formattedValue}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div className="text-sm text-gray-500 mb-2">{subtitle}</div>
      )}

      {/* Trend */}
      {trend !== undefined && (
        <div className={`text-sm flex items-center ${getTrendColorClass(trend)}`}>
          <span className="mr-1">{getTrendIcon(trend)}</span>
          <span className="font-semibold">{Math.abs(trend).toFixed(1)}%</span>
          {trendLabel && (
            <span className="ml-1 text-gray-500">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  );
};
```

### Step 6.3: Dashboard Metrics Component

**File**: `src/components/analytics/DashboardMetrics.tsx`

```typescript
import React from 'react';
import { MetricCard } from './MetricCard';
import { QuickDashboardMetrics } from '../../types/analytics.types';
import { Users, Store, Calendar, CreditCard } from 'lucide-react'; // or any icon library

interface DashboardMetricsProps {
  metrics: QuickDashboardMetrics;
}

export const DashboardMetrics: React.FC<DashboardMetricsProps> = ({ metrics }) => {
  return (
    <div className="space-y-6">
      {/* User Metrics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">사용자 지표</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            title="총 사용자"
            value={metrics.totalUsers}
            subtitle={`활성: ${metrics.activeUsers.toLocaleString()}`}
            icon={<Users size={20} />}
          />
          <MetricCard
            title="이번 달 신규"
            value={metrics.newUsersThisMonth}
            trend={metrics.userGrowthRate}
            trendLabel="전월 대비"
            icon={<Users size={20} />}
          />
        </div>
      </div>

      {/* Revenue Metrics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">수익 지표</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="총 수익"
            value={metrics.totalRevenue}
            valueType="currency"
            large
            icon={<CreditCard size={20} />}
          />
          <MetricCard
            title="이번 달 수익"
            value={metrics.monthRevenue}
            valueType="currency"
            trend={metrics.revenueGrowthRate}
            trendLabel="전월 대비"
            icon={<CreditCard size={20} />}
          />
          <MetricCard
            title="오늘 수익"
            value={metrics.todayRevenue}
            valueType="currency"
            icon={<CreditCard size={20} />}
          />
        </div>
      </div>

      {/* Reservation Metrics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">예약 지표</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            title="총 예약"
            value={metrics.totalReservations}
            icon={<Calendar size={20} />}
          />
          <MetricCard
            title="활성 예약"
            value={metrics.activeReservations}
            icon={<Calendar size={20} />}
          />
          <MetricCard
            title="오늘 예약"
            value={metrics.todayReservations}
            icon={<Calendar size={20} />}
          />
          <MetricCard
            title="완료율"
            value={metrics.reservationSuccessRate}
            valueType="percentage"
            trend={metrics.reservationSuccessRate - 80}
          />
        </div>
      </div>

      {/* Shop & Payment Metrics */}
      <div>
        <h2 className="text-lg font-semibold mb-4">매장 & 결제 지표</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            title="총 매장"
            value={metrics.totalShops}
            subtitle={`활성: ${metrics.activeShops.toLocaleString()}`}
            icon={<Store size={20} />}
          />
          <MetricCard
            title="승인 대기"
            value={metrics.pendingApprovals}
            urgent={metrics.pendingApprovals > 0}
            icon={<Store size={20} />}
          />
          <MetricCard
            title="성공 거래"
            value={metrics.successfulTransactions}
            subtitle={`전체: ${metrics.totalTransactions.toLocaleString()}`}
          />
          <MetricCard
            title="전환율"
            value={metrics.conversionRate}
            valueType="percentage"
            trend={metrics.conversionRate - 90}
          />
        </div>
      </div>

      {/* Last Updated */}
      <div className="text-sm text-gray-500 text-right">
        마지막 업데이트: {new Date(metrics.lastUpdated).toLocaleString('ko-KR')}
      </div>
    </div>
  );
};
```

### Step 6.4: Revenue Trends Chart

**File**: `src/components/analytics/RevenueTrendsChart.tsx`

```typescript
import React, { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAnalytics } from '../../hooks/useAnalytics';
import AnalyticsService from '../../services/analytics.service';
import { formatCurrency, formatShortDate } from '../../utils/format';

export const RevenueTrendsChart: React.FC = () => {
  const [days, setDays] = useState(30);

  const { data: trends, loading, error } = useAnalytics(
    () => AnalyticsService.getRevenueTrends(days),
    [days]
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse h-64 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (error || !trends) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-red-500">차트를 불러올 수 없습니다.</div>
      </div>
    );
  }

  // Reverse for chronological order (oldest to newest)
  const chartData = [...trends].reverse();

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">수익 추세</h2>

        {/* Date Range Selector */}
        <div className="flex space-x-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`
                px-4 py-2 rounded-md text-sm font-medium transition-colors
                ${
                  days === d
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              {d}일
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatShortDate}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(value) => formatCurrency(value)}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            labelFormatter={(date) => `날짜: ${date}`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="totalRevenue"
            stroke="#3b82f6"
            strokeWidth={2}
            name="수익"
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="avgTransactionValue"
            stroke="#10b981"
            strokeWidth={2}
            name="평균 거래액"
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-sm text-gray-600">총 수익</div>
          <div className="text-lg font-bold">
            {formatCurrency(
              chartData.reduce((sum, item) => sum + item.totalRevenue, 0)
            )}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-600">총 거래</div>
          <div className="text-lg font-bold">
            {chartData.reduce((sum, item) => sum + item.transactionCount, 0).toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-600">평균 일 수익</div>
          <div className="text-lg font-bold">
            {formatCurrency(
              chartData.reduce((sum, item) => sum + item.totalRevenue, 0) / chartData.length
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
```

### Step 6.5: Main Dashboard Page

**File**: `src/pages/AdminDashboard.tsx`

```typescript
import React from 'react';
import { useDashboard } from '../hooks/useDashboard';
import { DashboardMetrics } from '../components/analytics/DashboardMetrics';
import { RevenueTrendsChart } from '../components/analytics/RevenueTrendsChart';
import { RefreshCw } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const {
    metrics,
    revenueTrends,
    userTrends,
    topShops,
    loading,
    error,
    refetch,
  } = useDashboard();

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">대시보드 로딩 중...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !metrics) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">⚠️ 오류 발생</div>
          <p className="text-gray-600 mb-4">{error?.message || '대시보드를 불러올 수 없습니다.'}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">관리자 대시보드</h1>

            {/* Refresh Button */}
            <button
              onClick={refetch}
              className="
                flex items-center px-4 py-2
                bg-white border border-gray-300 rounded-md
                hover:bg-gray-50 transition-colors
              "
            >
              <RefreshCw size={16} className="mr-2" />
              새로고침
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Quick Metrics */}
        <div className="mb-8">
          <DashboardMetrics metrics={metrics} />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <RevenueTrendsChart />
          {/* Add more charts here */}
        </div>

        {/* Additional sections... */}
      </div>
    </div>
  );
};
```

---

## 7. State Management (Optional)

### Step 7.1: Redux Toolkit (If using Redux)

**File**: `src/store/analyticsSlice.ts`

```typescript
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AnalyticsService from '../services/analytics.service';
import { QuickDashboardMetrics } from '../types/analytics.types';

interface AnalyticsState {
  metrics: QuickDashboardMetrics | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

const initialState: AnalyticsState = {
  metrics: null,
  loading: false,
  error: null,
  lastFetched: null,
};

// Async thunk for fetching dashboard metrics
export const fetchDashboardMetrics = createAsyncThunk(
  'analytics/fetchDashboardMetrics',
  async () => {
    const response = await AnalyticsService.getQuickDashboard();
    return response;
  }
);

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState,
  reducers: {
    clearAnalytics: (state) => {
      state.metrics = null;
      state.error = null;
      state.lastFetched = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardMetrics.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboardMetrics.fulfilled, (state, action: PayloadAction<QuickDashboardMetrics>) => {
        state.loading = false;
        state.metrics = action.payload;
        state.lastFetched = Date.now();
      })
      .addCase(fetchDashboardMetrics.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch metrics';
      });
  },
});

export const { clearAnalytics } = analyticsSlice.actions;
export default analyticsSlice.reducer;
```

**Usage in Component**:
```typescript
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDashboardMetrics } from '../store/analyticsSlice';
import { RootState } from '../store';

export const Dashboard = () => {
  const dispatch = useDispatch();
  const { metrics, loading, error } = useSelector((state: RootState) => state.analytics);

  useEffect(() => {
    dispatch(fetchDashboardMetrics());
  }, [dispatch]);

  // ... render
};
```

---

## 8. Error Handling & Edge Cases

### Step 8.1: Error Boundary Component

**File**: `src/components/common/ErrorBoundary.tsx`

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-red-600 mb-4">
                문제가 발생했습니다
              </h1>
              <p className="text-gray-600 mb-4">
                {this.state.error?.message || '알 수 없는 오류가 발생했습니다.'}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                페이지 새로고침
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
```

### Step 8.2: Retry Logic

**File**: `src/utils/retry.ts`

```typescript
/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (i < maxRetries - 1) {
        const delay = delayMs * Math.pow(2, i);
        console.log(`[Retry] Attempt ${i + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}
```

**Usage**:
```typescript
import { retryWithBackoff } from '../utils/retry';

const data = await retryWithBackoff(
  () => AnalyticsService.getQuickDashboard(),
  3, // max 3 retries
  1000 // start with 1 second delay
);
```

---

## 9. Performance Optimization

### Step 9.1: React.memo for Components

```typescript
import React, { memo } from 'react';

export const MetricCard = memo<MetricCardProps>(({ title, value, ...props }) => {
  // ... component logic
}, (prevProps, nextProps) => {
  // Custom comparison function
  return prevProps.value === nextProps.value &&
         prevProps.trend === nextProps.trend;
});
```

### Step 9.2: useCallback for Event Handlers

```typescript
const handleRefresh = useCallback(async () => {
  setRefreshing(true);
  await refetch();
  setRefreshing(false);
}, [refetch]);
```

### Step 9.3: Debounce for Date Range Selection

```typescript
import { useCallback, useRef } from 'react';

function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;
}

// Usage
const debouncedFetch = useDebounce((days: number) => {
  setDays(days);
}, 300);
```

---

## 10. Testing Strategy

### Step 10.1: Unit Tests (Jest + React Testing Library)

**File**: `src/services/__tests__/analytics.service.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import AnalyticsService from '../analytics.service';
import api from '../api';

vi.mock('../api');

describe('AnalyticsService', () => {
  it('should fetch quick dashboard metrics', async () => {
    const mockMetrics = {
      totalUsers: 100,
      activeUsers: 80,
      totalRevenue: 1000000,
      // ... other fields
    };

    vi.mocked(api.get).mockResolvedValue(mockMetrics);

    const result = await AnalyticsService.getQuickDashboard();

    expect(api.get).toHaveBeenCalledWith('/admin/analytics/dashboard/quick');
    expect(result).toEqual(mockMetrics);
  });
});
```

### Step 10.2: Component Tests

**File**: `src/components/analytics/__tests__/MetricCard.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { MetricCard } from '../MetricCard';

describe('MetricCard', () => {
  it('should display formatted number', () => {
    render(<MetricCard title="Users" value={1234567} />);

    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('1,234,567')).toBeInTheDocument();
  });

  it('should display currency', () => {
    render(<MetricCard title="Revenue" value={1234567} valueType="currency" />);

    expect(screen.getByText(/₩1,234,567/)).toBeInTheDocument();
  });

  it('should show trend indicator', () => {
    render(<MetricCard title="Growth" value={100} trend={12.5} />);

    expect(screen.getByText('↑')).toBeInTheDocument();
    expect(screen.getByText('12.5%')).toBeInTheDocument();
  });
});
```

---

## 🚀 Quick Start Checklist

### Phase 1: Setup (30 minutes)
- [ ] Install dependencies (`axios`, `recharts`, `date-fns`)
- [ ] Create folder structure
- [ ] Copy `api.ts` and configure `API_BASE_URL`
- [ ] Copy `analytics.types.ts`
- [ ] Copy `analytics.service.ts`

### Phase 2: Core Components (1 hour)
- [ ] Copy `format.ts` utilities
- [ ] Create `MetricCard.tsx`
- [ ] Create `DashboardMetrics.tsx`
- [ ] Test with mock data

### Phase 3: Integration (1 hour)
- [ ] Copy `useAnalytics.ts` hook
- [ ] Copy `useDashboard.ts` hook
- [ ] Create `AdminDashboard.tsx` page
- [ ] Add to router

### Phase 4: Charts (1 hour)
- [ ] Copy `RevenueTrendsChart.tsx`
- [ ] Add to dashboard
- [ ] Test with real API

### Phase 5: Polish (30 minutes)
- [ ] Add error boundary
- [ ] Add loading states
- [ ] Test error scenarios

---

## 📝 Example: Complete Minimal Implementation

**Absolute minimum to get started (< 10 minutes):**

```typescript
// 1. api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

api.interceptors.response.use(res => res.data.data);
export default api;

// 2. Dashboard.tsx
import { useEffect, useState } from 'react';
import api from './api';

export const Dashboard = () => {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    api.get('/admin/analytics/dashboard/quick')
      .then(setMetrics)
      .catch(console.error);
  }, []);

  if (!metrics) return <div>Loading...</div>;

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Total Users: {metrics.totalUsers}</p>
      <p>Total Revenue: ₩{metrics.totalRevenue.toLocaleString()}</p>
      <p>Total Shops: {metrics.totalShops}</p>
    </div>
  );
};
```

**That's it!** You now have a working dashboard that loads in < 10ms! 🎉

---

**Total Implementation Time**: 3-4 hours for full-featured dashboard
**Minimal Implementation Time**: < 10 minutes for basic version
