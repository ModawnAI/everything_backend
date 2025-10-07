# Actual Analytics & Dashboard API Specification

## What the Backend Actually Returns

This document specifies ALL analytics and dashboard endpoints for both admin and shop owners.

---

## Admin Analytics Endpoints

### 1. GET `/api/admin/analytics/dashboard`

**Comprehensive Dashboard Metrics**

#### Response Format (Before Auto-Unwrap)
```json
{
  "success": true,
  "message": "대시보드 메트릭을 성공적으로 조회했습니다.",
  "data": DashboardMetrics,
  "timestamp": "2025-10-07T04:00:00Z"
}
```

#### DashboardMetrics Structure (Actual Backend Fields)

```typescript
{
  // User Growth Section
  "userGrowth": {
    "totalUsers": number,
    "activeUsers": number,
    "newUsersThisMonth": number,
    "newUsersThisWeek": number,
    "newUsersToday": number,
    "userGrowthRate": number,           // Percentage
    "userRetentionRate": number,        // Percentage
    "userStatusBreakdown": {
      "active": number,
      "suspended": number,
      "inactive": number
    },
    "topUserCategories": [{
      "category": string,
      "count": number,
      "percentage": number
    }]
  },

  // Revenue Section
  "revenue": {
    "totalRevenue": number,
    "revenueThisMonth": number,
    "revenueThisWeek": number,
    "revenueToday": number,
    "revenueGrowthRate": number,        // Percentage
    "averageOrderValue": number,
    "revenueByCategory": [{
      "category": string,               // "nail", "eyelash", etc.
      "revenue": number,
      "percentage": number,
      "transactionCount": number
    }],
    "revenueTrends": {
      "daily": [{
        "date": string,                 // "2025-10-07"
        "revenue": number,
        "transactions": number
      }],
      "weekly": [{
        "week": string,                 // "2025-W40"
        "revenue": number,
        "transactions": number
      }],
      "monthly": [{
        "month": string,                // "2025-10"
        "revenue": number,
        "transactions": number
      }]
    }
  },

  // Shop Performance Section
  "shopPerformance": {
    "totalShops": number,
    "activeShops": number,
    "pendingApprovals": number,
    "approvedShops": number,
    "suspendedShops": number,
    "topPerformingShops": [{
      "shopId": string,
      "shopName": string,
      "category": string,
      "revenue": number,
      "reservations": number,
      "averageRating": number,
      "completionRate": number
    }],
    "shopCategories": [{
      "category": string,
      "shopCount": number,
      "totalRevenue": number,
      "averageRevenue": number
    }]
  },

  // Reservations Section
  "reservations": {
    "totalReservations": number,
    "activeReservations": number,
    "completedReservations": number,
    "cancelledReservations": number,
    "noShowReservations": number,
    "reservationSuccessRate": number,   // Percentage
    "averageReservationValue": number,
    "reservationsByStatus": {
      "requested": number,
      "confirmed": number,
      "completed": number,
      "cancelled_by_user": number,
      "cancelled_by_shop": number,
      "no_show": number
    },
    "reservationsByCategory": [{
      "category": string,
      "count": number,
      "revenue": number
    }],
    "reservationTrends": {
      "daily": [{
        "date": string,
        "count": number,
        "revenue": number
      }],
      "weekly": [{
        "week": string,
        "count": number,
        "revenue": number
      }],
      "monthly": [{
        "month": string,
        "count": number,
        "revenue": number
      }]
    }
  },

  // Payments Section
  "payments": {
    "totalTransactions": number,
    "successfulTransactions": number,
    "failedTransactions": number,
    "totalRevenue": number,
    "totalRefunds": number,
    "netRevenue": number,
    "conversionRate": number,           // Percentage
    "refundRate": number,               // Percentage
    "averageTransactionValue": number,
    "paymentsByMethod": [{
      "method": string,                 // "card", "cash", "bank_transfer"
      "count": number,
      "amount": number,
      "successRate": number
    }],
    "paymentTrends": {
      "daily": [{
        "date": string,
        "revenue": number,
        "transactions": number
      }],
      "weekly": [{
        "week": string,
        "revenue": number,
        "transactions": number
      }],
      "monthly": [{
        "month": string,
        "revenue": number,
        "transactions": number
      }]
    }
  },

  // Referrals Section
  "referrals": {
    "totalReferrals": number,
    "conversionRate": number,
    "averageBonusAmount": number,
    "totalBonusPaid": number,
    "topReferrers": [{
      "userId": string,
      "name": string,
      "totalReferrals": number,
      "totalBonusEarned": number
    }],
    "monthlyStats": [{
      "month": string,
      "referrals": number,
      "completed": number,
      "bonusPaid": number
    }]
  },

  // System Health Section
  "systemHealth": {
    "activeUsers": number,
    "systemLoad": number,
    "databaseConnections": number,
    "averageResponseTime": number,
    "errorRate": number,
    "uptime": number
  },

  // Business Intelligence Section
  "businessIntelligence": {
    "keyPerformanceIndicators": {
      "customerAcquisitionCost": number,
      "customerLifetimeValue": number,
      "revenuePerUser": number,
      "averageSessionDuration": number,
      "bounceRate": number
    },
    "trends": {
      "userGrowthTrend": "increasing" | "decreasing" | "stable",
      "revenueTrend": "increasing" | "decreasing" | "stable",
      "reservationTrend": "increasing" | "decreasing" | "stable",
      "shopGrowthTrend": "increasing" | "decreasing" | "stable"
    },
    "insights": [{
      "type": "positive" | "negative" | "neutral",
      "title": string,
      "description": string,
      "impact": "high" | "medium" | "low",
      "recommendation": string | undefined
    }]
  },

  // Metadata
  "dateRange": {
    "startDate": string,                // "2025-09-01"
    "endDate": string,                  // "2025-10-07"
    "period": "day" | "week" | "month" | "quarter" | "year"
  },
  "lastUpdated": string,                // ISO 8601 datetime
  "cacheExpiry": string                 // ISO 8601 datetime
}
```

#### Query Parameters
```typescript
{
  startDate?: string,        // YYYY-MM-DD format
  endDate?: string,          // YYYY-MM-DD format
  period?: "day" | "week" | "month" | "quarter" | "year",
  category?: string,         // "nail", "eyelash", etc.
  shopId?: string,           // UUID
  userId?: string,           // UUID
  includeCache?: boolean     // Default: true
}
```

---

### 2. GET `/api/admin/analytics/realtime`

**Real-Time Metrics for Live Dashboard**

#### Response Format
```json
{
  "success": true,
  "message": "실시간 메트릭을 성공적으로 조회했습니다.",
  "data": {
    "activeUsers": number,
    "activeReservations": number,
    "todayRevenue": number,
    "todayTransactions": number,
    "recentActivity": [{
      "type": string,              // "reservation", "payment", "user_signup"
      "timestamp": string,
      "details": object
    }]
  },
  "timestamp": "2025-10-07T04:00:00Z"
}
```

**Note**: Partial DashboardMetrics with only real-time data

---

### 3. GET `/api/admin/analytics/export`

**Export Analytics Data**

#### Query Parameters
```typescript
{
  format?: "csv" | "json" | "excel",  // Default: "csv"
  startDate?: string,
  endDate?: string,
  includeCharts?: boolean,            // Default: false
  includeTrends?: boolean             // Default: false
}
```

#### Response
- **Content-Type**: Varies by format
  - `text/csv; charset=utf-8` (CSV)
  - `application/json` (JSON)
  - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (Excel)
- **Headers**:
  - `Content-Disposition: attachment; filename="analytics_export_2025-10-07.csv"`

**Returns raw file data** (not wrapped in `{success: true, data: ...}`)

---

### 4. GET `/api/admin/analytics/cache/stats`

**Cache Statistics**

#### Response Format
```json
{
  "success": true,
  "message": "캐시 통계를 성공적으로 조회했습니다.",
  "data": {
    "size": number,           // Number of cached items
    "keys": string[]          // Array of cache keys
  },
  "timestamp": "2025-10-07T04:00:00Z"
}
```

---

### 5. POST `/api/admin/analytics/cache/clear`

**Clear Analytics Cache**

#### Response Format
```json
{
  "success": true,
  "message": "분석 캐시를 성공적으로 초기화했습니다.",
  "timestamp": "2025-10-07T04:00:00Z"
}
```

---

### 6. GET `/api/admin/analytics/health`

**Analytics System Health**

#### Response Format
```json
{
  "success": true,
  "message": "Analytics system health status retrieved successfully",
  "data": {
    "status": "healthy" | "degraded" | "unhealthy",
    "timestamp": "2025-10-07T04:00:00Z",
    "metrics": {
      "hasUserData": boolean,
      "hasRevenueData": boolean,
      "hasReservationData": boolean,
      "hasPaymentData": boolean
    },
    "cache": {
      "size": number,
      "isOperational": boolean
    },
    "performance": {
      "responseTime": string,
      "dataFreshness": string
    }
  },
  "timestamp": "2025-10-07T04:00:00Z"
}
```

---

### 7. GET `/api/admin/analytics/shops/:shopId/analytics`

**Shop-Specific Analytics**

#### Response Format
```json
{
  "success": true,
  "message": "샵 분석 데이터를 성공적으로 조회했습니다.",
  "data": {
    "shop": {
      "id": string,
      "name": string,
      "description": string,
      "mainCategory": string,
      "subCategories": string[],
      "status": string,
      "verificationStatus": string,
      "createdAt": string,
      "updatedAt": string,
      "ownerId": string,
      "address": string,
      "location": {
        "latitude": number,
        "longitude": number
      },
      "contact": {
        "phone": string,
        "email": string
      },
      "businessLicense": string,
      "isFeatured": boolean,
      "rating": number,
      "reviewCount": number
    },
    "performance": {
      "reservations": {
        "total": number,
        "completed": number,
        "cancelled": number,
        "noShow": number,
        "completionRate": number,
        "averageValue": number
      },
      "revenue": {
        "total": number,
        "averagePerReservation": number
      },
      "services": {
        "total": number,
        "available": number,
        "categories": string[]
      }
    },
    "registration": {
      "registrationTime": number,     // Days to complete registration
      "approvalTime": number,         // Days to get approved
      "profileCompleteness": number,  // Percentage
      "status": string,
      "verificationStatus": string
    },
    "engagement": {
      "favorites": {
        "total": number,
        "newThisPeriod": number
      },
      "reviews": {
        "total": number,
        "averageRating": number
      },
      "engagement": {
        "totalInteractions": number,
        "engagementRate": number
      }
    },
    "discovery": {
      "searchAppearances": number,
      "profileViews": number,
      "discoverySources": {
        "search": number,
        "recommendations": number,
        "direct": number
      },
      "trendingScore": number
    },
    "period": {
      "startDate": string,
      "endDate": string,
      "period": string
    },
    "generatedAt": string
  },
  "timestamp": "2025-10-07T04:00:00Z"
}
```

#### Query Parameters
```typescript
{
  startDate?: string,        // YYYY-MM-DD
  endDate?: string,          // YYYY-MM-DD
  period?: "day" | "week" | "month" | "quarter" | "year",
  includeCache?: boolean     // Default: true
}
```

---

## Shop Owner Dashboard Endpoints

### 8. GET `/api/shop/dashboard`

**Shop Dashboard Overview**

#### Response Format
```json
{
  "success": true,
  "message": "대시보드 정보를 성공적으로 조회했습니다.",
  "data": {
    "shop_info": {
      "id": string,
      "name": string,
      "status": string,
      "verification_status": string
    },
    "recent_stats": {
      "total_reservations": number,
      "pending_reservations": number,
      "completed_today": number,
      "revenue_today": number
    },
    "quick_actions": [{
      "action": string,
      "title": string,
      "description": string,
      "priority": "high" | "medium" | "low"
    }]
  }
}
```

**⚠️ Uses snake_case** (not camelCase like admin endpoints)

---

### 9. GET `/api/shop/dashboard/analytics`

**Shop Analytics and Performance**

#### Response Format
```json
{
  "success": true,
  "message": "분석 데이터를 성공적으로 조회했습니다.",
  "data": {
    "period": string,              // "day", "week", "month", "year"
    "revenue": {
      "total": number,
      "growth": number,            // Percentage
      "daily_average": number
    },
    "reservations": {
      "total": number,
      "completed": number,
      "cancelled": number,
      "no_show": number,
      "conversion_rate": number    // Percentage
    },
    "services": [{
      "service_id": string,
      "name": string,
      "bookings": number,
      "revenue": number,
      "popularity_score": number
    }]
  }
}
```

#### Query Parameters
```typescript
{
  period?: "day" | "week" | "month" | "year",
  startDate?: string,        // ISO date format
  endDate?: string           // ISO date format
}
```

**⚠️ Uses snake_case**

---

### 10. GET `/api/shop/dashboard/profile/status`

**Shop Profile Completion Status**

#### Response Format
```json
{
  "success": true,
  "message": "프로필 상태를 성공적으로 조회했습니다.",
  "data": {
    "completion_percentage": number,
    "missing_fields": string[],
    "verification_status": string,
    "next_steps": string[]
  }
}
```

**⚠️ Uses snake_case**

---

### 11. GET `/api/admin/dashboard/overview`

**Simple Admin Dashboard Overview**

#### Response Format
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalRevenue": number,
      "revenueGrowth": number,        // Percentage
      "totalCustomers": number,
      "customersGrowth": number,      // Percentage
      "totalProducts": number,
      "newProducts": number,
      "activeOrders": number,
      "ordersGrowth": number          // Percentage
    },
    "recentOrders": [{
      "id": string,
      "customer": string,
      "customerEmail": string,
      "status": "pending" | "processing" | "shipped" | "delivered" | "cancelled",
      "amount": number,
      "createdAt": string
    }],
    "topProducts": [{
      "id": string,
      "name": string,
      "sales": number,
      "revenue": number
    }]
  }
}
```

#### Query Parameters
```typescript
{
  period?: "7d" | "30d" | "90d"  // Default: "30d"
}
```

**✅ Uses camelCase**

---

## Field Naming Conventions Summary

| Endpoint Type | Field Names | Status |
|--------------|-------------|--------|
| **Admin Analytics** (`/api/admin/analytics/*`) | `camelCase` | ✅ |
| **Admin Dashboard** (`/api/admin/dashboard/*`) | `camelCase` | ✅ |
| **Shop Dashboard** (`/api/shop/dashboard/*`) | `snake_case` | ⚠️ |

---

## Frontend Integration

### Admin Analytics Endpoints (camelCase) - No Transform Needed ✅

```typescript
const response = await apiService.get('/api/admin/analytics/dashboard');
const { userGrowth, revenue, shopPerformance, reservations } = response;

// Use directly - already camelCase
console.log(userGrowth.totalUsers);
console.log(revenue.totalRevenue);
console.log(shopPerformance.totalShops);
```

### Shop Dashboard Endpoints (snake_case) - Transform Required ⚠️

```typescript
function transformShopDashboard(data: any) {
  return {
    shopInfo: {
      id: data.shop_info.id,
      name: data.shop_info.name,
      status: data.shop_info.status,
      verificationStatus: data.shop_info.verification_status
    },
    recentStats: {
      totalReservations: data.recent_stats.total_reservations,
      pendingReservations: data.recent_stats.pending_reservations,
      completedToday: data.recent_stats.completed_today,
      revenueToday: data.recent_stats.revenue_today
    },
    quickActions: data.quick_actions
  };
}

const response = await apiService.get('/api/shop/dashboard');
const transformed = transformShopDashboard(response);
```

---

## Testing Commands

### Admin Analytics Dashboard
```bash
curl 'http://localhost:3001/api/admin/analytics/dashboard?period=month' \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Real-time Metrics
```bash
curl 'http://localhost:3001/api/admin/analytics/realtime' \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Shop-Specific Analytics
```bash
curl 'http://localhost:3001/api/admin/analytics/shops/SHOP_UUID/analytics?period=month' \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Shop Dashboard
```bash
curl 'http://localhost:3001/api/shop/dashboard' \
  -H "Authorization: Bearer YOUR_SHOP_OWNER_TOKEN"
```

### Shop Analytics
```bash
curl 'http://localhost:3001/api/shop/dashboard/analytics?period=month' \
  -H "Authorization: Bearer YOUR_SHOP_OWNER_TOKEN"
```

### Admin Dashboard Overview
```bash
curl 'http://localhost:3001/api/admin/dashboard/overview?period=30d' \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## Key Features

### Admin Analytics
- ✅ **Comprehensive Metrics**: User growth, revenue, shops, reservations, payments, referrals
- ✅ **Real-time Updates**: Live dashboard metrics
- ✅ **Trend Analysis**: Daily, weekly, monthly trends
- ✅ **Business Intelligence**: KPIs, insights, recommendations
- ✅ **Caching**: 5-minute cache for performance
- ✅ **Export**: CSV, JSON, Excel formats
- ✅ **System Health**: Monitoring and diagnostics

### Shop Dashboard
- ⚠️ **Quick Overview**: Recent stats and quick actions
- ⚠️ **Performance Analytics**: Revenue, reservations, services
- ⚠️ **Profile Status**: Completion tracking
- ⚠️ **Uses snake_case**: Needs frontend transform

---

**Last Updated**: 2025-10-07
**Backend Version**: 1.0.0
