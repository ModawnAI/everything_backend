# EXHAUSTIVE Analytics Data Structure

## Complete Backend Response Formats for All Analytics Endpoints

---

## 1. Main Dashboard Analytics (Legacy - Comprehensive)

### Endpoint
```
GET /api/admin/analytics/dashboard
```

### Complete Response Structure

```typescript
{
  success: boolean;
  message: string;
  data: {
    // ============================================
    // USER GROWTH METRICS
    // ============================================
    userGrowth: {
      totalUsers: number;                    // Total users in system
      activeUsers: number;                   // Users with active status
      newUsersThisMonth: number;             // New registrations this month
      newUsersThisWeek: number;              // New registrations this week
      newUsersToday: number;                 // New registrations today
      userGrowthRate: number;                // % growth from last month
      userRetentionRate: number;             // % users with repeat reservations
      userStatusBreakdown: {                 // Count by status
        [status: string]: number;            // e.g., { "active": 150, "inactive": 20 }
      };
      topUserCategories: Array<{             // User segmentation
        category: string;                    // e.g., "regular", "vip", "influencer"
        count: number;                       // Number of users in category
        percentage: number;                  // % of total users
      }>;
    };

    // ============================================
    // REVENUE METRICS
    // ============================================
    revenue: {
      totalRevenue: number;                  // All-time revenue
      revenueThisMonth: number;              // Current month revenue
      revenueThisWeek: number;               // Current week revenue
      revenueToday: number;                  // Today's revenue
      revenueGrowthRate: number;             // % growth from last month
      averageOrderValue: number;             // Average per transaction

      revenueByCategory: Array<{             // Revenue breakdown by shop category
        category: string;                    // e.g., "nail", "hair", "eyelash"
        revenue: number;                     // Total revenue for category
        percentage: number;                  // % of total revenue
        transactionCount: number;            // Number of transactions
      }>;

      revenueTrends: {                       // Historical revenue data
        daily: Array<{                       // Last 30 days
          date: string;                      // ISO date: "2025-01-07"
          revenue: number;                   // Revenue for that day
          transactions: number;              // Transaction count for that day
        }>;
        weekly: Array<{                      // Last 12 weeks
          week: string;                      // ISO week: "2025-W01"
          revenue: number;                   // Revenue for that week
          transactions: number;              // Transaction count for that week
        }>;
        monthly: Array<{                     // Last 12 months
          month: string;                     // ISO month: "2025-01"
          revenue: number;                   // Revenue for that month
          transactions: number;              // Transaction count for that month
        }>;
      };
    };

    // ============================================
    // SHOP PERFORMANCE METRICS
    // ============================================
    shopPerformance: {
      totalShops: number;                    // Total shops in system
      activeShops: number;                   // Shops with active status
      pendingApprovals: number;              // Shops awaiting approval
      approvedShops: number;                 // Approved shops (active + inactive)
      suspendedShops: number;                // Suspended shops

      topPerformingShops: Array<{            // Top 10 shops by revenue
        shopId: string;                      // Shop UUID
        shopName: string;                    // Shop name
        category: string;                    // Main category
        revenue: number;                     // Total revenue
        reservationCount: number;            // Total reservations (FIXED: was 'reservations')
        averageRating: number;               // Avg rating (0-5)
        completionRate: number;              // % completed reservations
      }>;

      shopCategories: Array<{                // Category-level stats
        category: string;                    // e.g., "nail", "hair"
        shopCount: number;                   // Number of shops
        totalRevenue: number;                // Total revenue
        avgRevenue: number;                  // Average revenue per shop (FIXED: was 'averageRevenue')
      }>;
    };

    // ============================================
    // RESERVATION METRICS
    // ============================================
    reservations: {
      totalReservations: number;             // All-time reservations
      activeReservations: number;            // Current active (confirmed, in-progress)
      completedReservations: number;         // Successfully completed
      cancelledReservations: number;         // Cancelled by user or shop
      noShowReservations: number;            // No-show reservations
      reservationSuccessRate: number;        // % completed / total
      averageReservationValue: number;       // Average reservation amount

      reservationsByStatus: {                // Count by status
        [status: string]: number;            // e.g., { "completed": 50, "cancelled": 10 }
      };

      reservationsByCategory: Array<{        // By shop category
        category: string;                    // Shop category
        count: number;                       // Number of reservations
        revenue: number;                     // Revenue from reservations
      }>;

      reservationTrends: {                   // Historical reservation data
        daily: Array<{                       // Last 30 days
          date: string;                      // ISO date
          reservations: number;              // Total reservations
          completed: number;                 // Completed reservations
        }>;
        weekly: Array<{                      // Last 12 weeks
          week: string;                      // ISO week
          reservations: number;              // Total reservations
          completed: number;                 // Completed reservations
        }>;
        monthly: Array<{                     // Last 12 months
          month: string;                     // ISO month
          reservations: number;              // Total reservations
          completed: number;                 // Completed reservations
        }>;
      };
    };

    // ============================================
    // PAYMENT METRICS
    // ============================================
    payments: {
      totalTransactions: number;             // All-time transactions
      successfulTransactions: number;        // Successfully completed payments
      failedTransactions: number;            // Failed payments
      totalRevenue: number;                  // Total revenue from payments
      totalRefunds: number;                  // Total refunded amount
      netRevenue: number;                    // Revenue - refunds
      conversionRate: number;                // % successful / total
      refundRate: number;                    // % refunded / successful
      averageTransactionValue: number;       // Average payment amount

      paymentsByMethod: Array<{              // Breakdown by payment method
        method: string;                      // e.g., "card", "virtual_account", "transfer"
        count: number;                       // Number of transactions
        amount: number;                      // Total amount
        successRate: number;                 // % successful
      }>;

      paymentTrends: {                       // Historical payment data
        daily: Array<{                       // Last 30 days
          date: string;                      // ISO date
          revenue: number;                   // Revenue for that day
          transactions: number;              // Transaction count
        }>;
        weekly: Array<{                      // Last 12 weeks
          week: string;                      // ISO week
          revenue: number;                   // Revenue for that week
          transactions: number;              // Transaction count
        }>;
        monthly: Array<{                     // Last 12 months
          month: string;                     // ISO month
          revenue: number;                   // Revenue for that month
          transactions: number;              // Transaction count
        }>;
      };
    };

    // ============================================
    // REFERRAL METRICS
    // ============================================
    referrals: {
      totalReferrals: number;                // Total referrals made
      conversionRate: number;                // % referrals that completed first reservation
      averageBonusAmount: number;            // Average bonus paid per referral
      totalBonusPaid: number;                // Total bonus points paid out

      topReferrers: Array<{                  // Top referrers by total referrals
        userId: string;                      // User UUID
        name: string;                        // User name
        totalReferrals: number;              // Total referrals made
        totalBonusEarned: number;            // Total bonus points earned
      }>;

      monthlyStats: Array<{                  // Last 12 months
        month: string;                       // ISO month
        referrals: number;                   // Referrals made
        completed: number;                   // Referrals who completed first reservation
        bonusPaid: number;                   // Bonus points paid
      }>;
    };

    // ============================================
    // SYSTEM HEALTH METRICS
    // ============================================
    systemHealth: {
      activeUsers: number;                   // Currently active users (online)
      systemLoad: number;                    // Server load (0-100)
      databaseConnections: number;           // Active DB connections
      averageResponseTime: number;           // Avg API response time (ms)
      errorRate: number;                     // % failed requests
      uptime: number;                        // System uptime (%)
    };

    // ============================================
    // BUSINESS INTELLIGENCE
    // ============================================
    businessIntelligence: {
      keyPerformanceIndicators: {
        customerAcquisitionCost: number;     // Cost to acquire one customer
        customerLifetimeValue: number;       // Average customer lifetime value
        revenuePerUser: number;              // Average revenue per user
        averageSessionDuration: number;      // Avg session length (minutes)
        bounceRate: number;                  // % users who leave immediately
      };

      trends: {
        userGrowthTrend: "increasing" | "decreasing" | "stable";
        revenueTrend: "increasing" | "decreasing" | "stable";
        reservationTrend: "increasing" | "decreasing" | "stable";
        shopGrowthTrend: "increasing" | "decreasing" | "stable";
      };

      insights: Array<{                      // AI-generated insights
        type: "positive" | "negative" | "neutral";
        title: string;                       // Insight title
        description: string;                 // Detailed description
        impact: "high" | "medium" | "low";   // Business impact level
        recommendation?: string;             // Optional action recommendation
      }>;
    };

    // ============================================
    // METADATA
    // ============================================
    dateRange: {
      startDate: string;                     // Filter start date (ISO)
      endDate: string;                       // Filter end date (ISO)
      period: "day" | "week" | "month" | "quarter" | "year";
    };

    lastUpdated: string;                     // When data was calculated (ISO timestamp)
    cacheExpiry: string;                     // When cache expires (ISO timestamp)
  };
  timestamp: string;                         // Response timestamp (ISO)
}
```

### Example Response (Full)

```json
{
  "success": true,
  "message": "대시보드 메트릭을 성공적으로 조회했습니다.",
  "data": {
    "userGrowth": {
      "totalUsers": 1245,
      "activeUsers": 1180,
      "newUsersThisMonth": 87,
      "newUsersThisWeek": 23,
      "newUsersToday": 5,
      "userGrowthRate": 12.5,
      "userRetentionRate": 68.3,
      "userStatusBreakdown": {
        "active": 1180,
        "inactive": 45,
        "suspended": 15,
        "deleted": 5
      },
      "topUserCategories": [
        {
          "category": "regular",
          "count": 980,
          "percentage": 78.7
        },
        {
          "category": "vip",
          "count": 145,
          "percentage": 11.6
        },
        {
          "category": "influencer",
          "count": 120,
          "percentage": 9.6
        }
      ]
    },
    "revenue": {
      "totalRevenue": 125000000,
      "revenueThisMonth": 8500000,
      "revenueThisWeek": 1850000,
      "revenueToday": 320000,
      "revenueGrowthRate": 18.3,
      "averageOrderValue": 85000,
      "revenueByCategory": [
        {
          "category": "nail",
          "revenue": 45000000,
          "percentage": 36.0,
          "transactionCount": 542
        },
        {
          "category": "hair",
          "revenue": 38000000,
          "percentage": 30.4,
          "transactionCount": 456
        },
        {
          "category": "eyelash",
          "revenue": 25000000,
          "percentage": 20.0,
          "transactionCount": 312
        }
      ],
      "revenueTrends": {
        "daily": [
          {
            "date": "2025-01-07",
            "revenue": 320000,
            "transactions": 4
          },
          {
            "date": "2025-01-06",
            "revenue": 450000,
            "transactions": 5
          }
        ],
        "weekly": [
          {
            "week": "2025-W01",
            "revenue": 1850000,
            "transactions": 22
          }
        ],
        "monthly": [
          {
            "month": "2025-01",
            "revenue": 8500000,
            "transactions": 100
          }
        ]
      }
    },
    "shopPerformance": {
      "totalShops": 243,
      "activeShops": 79,
      "pendingApprovals": 133,
      "approvedShops": 98,
      "suspendedShops": 12,
      "topPerformingShops": [
        {
          "shopId": "abc-123-def",
          "shopName": "뷰티살롱 강남점",
          "category": "nail",
          "revenue": 3200000,
          "reservationCount": 45,
          "averageRating": 4.8,
          "completionRate": 91.1
        }
      ],
      "shopCategories": [
        {
          "category": "nail",
          "shopCount": 52,
          "totalRevenue": 45000000,
          "avgRevenue": 865384
        }
      ]
    },
    "reservations": {
      "totalReservations": 1456,
      "activeReservations": 45,
      "completedReservations": 789,
      "cancelledReservations": 112,
      "noShowReservations": 34,
      "reservationSuccessRate": 54.2,
      "averageReservationValue": 85000,
      "reservationsByStatus": {
        "completed": 789,
        "confirmed": 35,
        "requested": 10,
        "cancelled_by_user": 87,
        "cancelled_by_shop": 25,
        "no_show": 34
      },
      "reservationsByCategory": [
        {
          "category": "nail",
          "count": 542,
          "revenue": 45000000
        }
      ],
      "reservationTrends": {
        "daily": [
          {
            "date": "2025-01-07",
            "reservations": 8,
            "completed": 4
          }
        ],
        "weekly": [
          {
            "week": "2025-W01",
            "reservations": 45,
            "completed": 25
          }
        ],
        "monthly": [
          {
            "month": "2025-01",
            "reservations": 156,
            "completed": 89
          }
        ]
      }
    },
    "payments": {
      "totalTransactions": 1470,
      "successfulTransactions": 1398,
      "failedTransactions": 72,
      "totalRevenue": 125000000,
      "totalRefunds": 2500000,
      "netRevenue": 122500000,
      "conversionRate": 95.1,
      "refundRate": 2.0,
      "averageTransactionValue": 85034,
      "paymentsByMethod": [
        {
          "method": "card",
          "count": 987,
          "amount": 84000000,
          "successRate": 96.2
        },
        {
          "method": "virtual_account",
          "count": 345,
          "amount": 29000000,
          "successRate": 94.8
        },
        {
          "method": "transfer",
          "count": 138,
          "amount": 12000000,
          "successRate": 92.0
        }
      ],
      "paymentTrends": {
        "daily": [
          {
            "date": "2025-01-07",
            "revenue": 320000,
            "transactions": 4
          }
        ],
        "weekly": [
          {
            "week": "2025-W01",
            "revenue": 1850000,
            "transactions": 22
          }
        ],
        "monthly": [
          {
            "month": "2025-01",
            "revenue": 8500000,
            "transactions": 100
          }
        ]
      }
    },
    "referrals": {
      "totalReferrals": 234,
      "conversionRate": 68.4,
      "averageBonusAmount": 5000,
      "totalBonusPaid": 800000,
      "topReferrers": [
        {
          "userId": "user-abc-123",
          "name": "김민지",
          "totalReferrals": 23,
          "totalBonusEarned": 115000
        }
      ],
      "monthlyStats": [
        {
          "month": "2025-01",
          "referrals": 18,
          "completed": 12,
          "bonusPaid": 60000
        }
      ]
    },
    "systemHealth": {
      "activeUsers": 142,
      "systemLoad": 35.7,
      "databaseConnections": 12,
      "averageResponseTime": 245,
      "errorRate": 0.3,
      "uptime": 99.97
    },
    "businessIntelligence": {
      "keyPerformanceIndicators": {
        "customerAcquisitionCost": 25000,
        "customerLifetimeValue": 450000,
        "revenuePerUser": 100400,
        "averageSessionDuration": 8.5,
        "bounceRate": 12.3
      },
      "trends": {
        "userGrowthTrend": "increasing",
        "revenueTrend": "increasing",
        "reservationTrend": "stable",
        "shopGrowthTrend": "increasing"
      },
      "insights": [
        {
          "type": "positive",
          "title": "매출 급증",
          "description": "이번 주 매출이 지난 주 대비 23% 증가했습니다.",
          "impact": "high",
          "recommendation": "현재 마케팅 전략을 유지하고 추가 투자를 고려하세요."
        },
        {
          "type": "negative",
          "title": "노쇼율 증가",
          "description": "노쇼 예약이 지난 달 대비 15% 증가했습니다.",
          "impact": "medium",
          "recommendation": "예약 확인 알림을 강화하고 보증금 정책을 검토하세요."
        }
      ]
    },
    "dateRange": {
      "startDate": "2024-12-07T00:00:00.000Z",
      "endDate": "2025-01-07T23:59:59.999Z",
      "period": "month"
    },
    "lastUpdated": "2025-01-07T11:15:30.456Z",
    "cacheExpiry": "2025-01-07T11:20:30.456Z"
  },
  "timestamp": "2025-01-07T11:15:30.500Z"
}
```

---

## 2. Quick Dashboard Metrics (Optimized - Fast < 10ms)

### Endpoint
```
GET /api/admin/analytics/dashboard/quick
```

### Response Structure

```typescript
{
  success: boolean;
  message: string;
  data: {
    // User metrics
    totalUsers: number;                      // Total users in system
    activeUsers: number;                     // Active users count
    newUsersThisMonth: number;               // New users this month
    userGrowthRate: number;                  // % growth from last month

    // Revenue metrics
    totalRevenue: number;                    // All-time revenue
    todayRevenue: number;                    // Today's revenue
    monthRevenue: number;                    // This month's revenue
    revenueGrowthRate: number;               // % growth from last month

    // Reservation metrics
    totalReservations: number;               // All-time reservations
    activeReservations: number;              // Currently active (confirmed)
    todayReservations: number;               // Today's reservations
    reservationSuccessRate: number;          // % completed / total

    // Shop metrics
    totalShops: number;                      // Total shops
    activeShops: number;                     // Active shops
    pendingApprovals: number;                // Awaiting approval

    // Payment metrics
    totalTransactions: number;               // All-time transactions
    successfulTransactions: number;          // Successfully paid
    conversionRate: number;                  // % successful / total

    // Metadata
    lastUpdated: string;                     // When view was last refreshed (ISO)
  };
  timestamp: string;                         // Response timestamp (ISO)
}
```

### Example Response

```json
{
  "success": true,
  "message": "빠른 대시보드 메트릭을 성공적으로 조회했습니다.",
  "data": {
    "totalUsers": 22,
    "activeUsers": 21,
    "newUsersThisMonth": 5,
    "userGrowthRate": 12.5,
    "totalRevenue": 4500000,
    "todayRevenue": 150000,
    "monthRevenue": 2300000,
    "revenueGrowthRate": 18.3,
    "totalReservations": 106,
    "activeReservations": 12,
    "todayReservations": 3,
    "reservationSuccessRate": 52.8,
    "totalShops": 243,
    "activeShops": 79,
    "pendingApprovals": 133,
    "totalTransactions": 56,
    "successfulTransactions": 50,
    "conversionRate": 89.3,
    "lastUpdated": "2025-01-07T11:14:00.000Z"
  },
  "timestamp": "2025-01-07T11:15:05.123Z"
}
```

---

## 3. User Growth Trends (Optimized)

### Endpoint
```
GET /api/admin/analytics/trends/users?limit=30
```

### Query Parameters
- `limit`: Number of days to return (default: 30, max: 90)

### Response Structure

```typescript
{
  success: boolean;
  message: string;
  data: Array<{
    date: string;                            // ISO date: "2025-01-07"
    newUsers: number;                        // New users on that day
    activeUsers: number;                     // Active users on that day
  }>;
  timestamp: string;
}
```

### Example Response

```json
{
  "success": true,
  "message": "사용자 증가 추세를 성공적으로 조회했습니다.",
  "data": [
    {
      "date": "2025-01-07",
      "newUsers": 3,
      "activeUsers": 21
    },
    {
      "date": "2025-01-06",
      "newUsers": 2,
      "activeUsers": 20
    },
    {
      "date": "2025-01-05",
      "newUsers": 1,
      "activeUsers": 19
    }
  ],
  "timestamp": "2025-01-07T11:15:05.123Z"
}
```

---

## 4. Revenue Trends (Optimized)

### Endpoint
```
GET /api/admin/analytics/trends/revenue?limit=30
```

### Query Parameters
- `limit`: Number of days to return (default: 30, max: 90)

### Response Structure

```typescript
{
  success: boolean;
  message: string;
  data: Array<{
    date: string;                            // ISO date: "2025-01-07"
    totalRevenue: number;                    // Revenue on that day
    transactionCount: number;                // Transactions on that day
    avgTransactionValue: number;             // Average transaction value
  }>;
  timestamp: string;
}
```

### Example Response

```json
{
  "success": true,
  "message": "수익 추세를 성공적으로 조회했습니다.",
  "data": [
    {
      "date": "2025-01-07",
      "totalRevenue": 350000,
      "transactionCount": 5,
      "avgTransactionValue": 70000
    },
    {
      "date": "2025-01-06",
      "totalRevenue": 480000,
      "transactionCount": 6,
      "avgTransactionValue": 80000
    }
  ],
  "timestamp": "2025-01-07T11:15:05.123Z"
}
```

---

## 5. Reservation Trends (Optimized)

### Endpoint
```
GET /api/admin/analytics/trends/reservations?limit=30
```

### Query Parameters
- `limit`: Number of days to return (default: 30, max: 90)

### Response Structure

```typescript
{
  success: boolean;
  message: string;
  data: Array<{
    date: string;                            // ISO date: "2025-01-07"
    totalReservations: number;               // Total reservations
    completedReservations: number;           // Completed reservations
    cancelledReservations: number;           // Cancelled reservations
    completionRate: number;                  // % completed
  }>;
  timestamp: string;
}
```

### Example Response

```json
{
  "success": true,
  "message": "예약 추세를 성공적으로 조회했습니다.",
  "data": [
    {
      "date": "2025-01-07",
      "totalReservations": 8,
      "completedReservations": 4,
      "cancelledReservations": 1,
      "completionRate": 50.0
    },
    {
      "date": "2025-01-06",
      "totalReservations": 10,
      "completedReservations": 6,
      "cancelledReservations": 2,
      "completionRate": 60.0
    }
  ],
  "timestamp": "2025-01-07T11:15:05.123Z"
}
```

---

## 6. Shop Performance (Optimized)

### Endpoint
```
GET /api/admin/analytics/shops/performance?limit=20
```

### Query Parameters
- `limit`: Number of shops to return (default: 20, max: 100)

### Response Structure

```typescript
{
  success: boolean;
  message: string;
  data: Array<{
    shopId: string;                          // Shop UUID
    shopName: string;                        // Shop name
    mainCategory: string;                    // Shop category
    shopStatus: string;                      // Shop status
    totalReservations: number;               // Total reservations
    completedReservations: number;           // Completed reservations
    totalRevenue: number;                    // Total revenue
    avgRating: number;                       // Average rating (0-5)
    completionRate: number;                  // % completed
  }>;
  timestamp: string;
}
```

### Example Response

```json
{
  "success": true,
  "message": "매장 성과를 성공적으로 조회했습니다.",
  "data": [
    {
      "shopId": "abc-123-def-456",
      "shopName": "뷰티살롱 강남점",
      "mainCategory": "nail",
      "shopStatus": "active",
      "totalReservations": 45,
      "completedReservations": 38,
      "totalRevenue": 3200000,
      "avgRating": 4.5,
      "completionRate": 84.4
    },
    {
      "shopId": "def-456-ghi-789",
      "shopName": "헤어샵 신촌",
      "mainCategory": "hair",
      "shopStatus": "active",
      "totalReservations": 32,
      "completedReservations": 28,
      "totalRevenue": 2800000,
      "avgRating": 4.7,
      "completionRate": 87.5
    }
  ],
  "timestamp": "2025-01-07T11:15:05.123Z"
}
```

---

## 7. Payment Status Summary (Optimized)

### Endpoint
```
GET /api/admin/analytics/payments/summary
```

### Response Structure

```typescript
{
  success: boolean;
  message: string;
  data: Array<{
    paymentStatus: string;                   // e.g., "fully_paid", "pending"
    paymentStage: string;                    // e.g., "deposit_paid", "final_payment_pending"
    count: number;                           // Number of payments
    totalAmount: number;                     // Total amount
    avgAmount: number;                       // Average amount
  }>;
  timestamp: string;
}
```

### Example Response

```json
{
  "success": true,
  "message": "결제 상태 요약을 성공적으로 조회했습니다.",
  "data": [
    {
      "paymentStatus": "fully_paid",
      "paymentStage": "completed",
      "count": 50,
      "totalAmount": 4250000,
      "avgAmount": 85000
    },
    {
      "paymentStatus": "deposit_paid",
      "paymentStage": "deposit_paid",
      "count": 12,
      "totalAmount": 360000,
      "avgAmount": 30000
    },
    {
      "paymentStatus": "pending",
      "paymentStage": "initial",
      "count": 8,
      "totalAmount": 0,
      "avgAmount": 0
    }
  ],
  "timestamp": "2025-01-07T11:15:05.123Z"
}
```

---

## 8. Point Transaction Summary (Optimized)

### Endpoint
```
GET /api/admin/analytics/points/summary
```

### Response Structure

```typescript
{
  success: boolean;
  message: string;
  data: Array<{
    transactionType: string;                 // e.g., "earned", "spent", "expired"
    status: string;                          // e.g., "completed", "pending"
    transactionCount: number;                // Number of transactions
    totalPoints: number;                     // Total points
    avgPoints: number;                       // Average points per transaction
  }>;
  timestamp: string;
}
```

### Example Response

```json
{
  "success": true,
  "message": "포인트 거래 요약을 성공적으로 조회했습니다.",
  "data": [
    {
      "transactionType": "earned",
      "status": "completed",
      "transactionCount": 234,
      "totalPoints": 1170000,
      "avgPoints": 5000
    },
    {
      "transactionType": "spent",
      "status": "completed",
      "transactionCount": 89,
      "totalPoints": 445000,
      "avgPoints": 5000
    },
    {
      "transactionType": "expired",
      "status": "completed",
      "transactionCount": 12,
      "totalPoints": 60000,
      "avgPoints": 5000
    }
  ],
  "timestamp": "2025-01-07T11:15:05.123Z"
}
```

---

## 9. Category Performance (Optimized)

### Endpoint
```
GET /api/admin/analytics/categories/performance
```

### Response Structure

```typescript
{
  success: boolean;
  message: string;
  data: Array<{
    mainCategory: string;                    // e.g., "nail", "hair", "eyelash"
    totalShops: number;                      // Total shops in category
    activeShops: number;                     // Active shops in category
    totalReservations: number;               // Total reservations
    totalRevenue: number;                    // Total revenue
    avgRating: number;                       // Average rating (placeholder until reviews table)
  }>;
  timestamp: string;
}
```

### Example Response

```json
{
  "success": true,
  "message": "카테고리 성과를 성공적으로 조회했습니다.",
  "data": [
    {
      "mainCategory": "nail",
      "totalShops": 52,
      "activeShops": 35,
      "totalReservations": 280,
      "totalRevenue": 15600000,
      "avgRating": 4.5
    },
    {
      "mainCategory": "eyelash",
      "totalShops": 12,
      "activeShops": 8,
      "totalReservations": 95,
      "totalRevenue": 6200000,
      "avgRating": 4.7
    },
    {
      "mainCategory": "waxing",
      "totalShops": 11,
      "activeShops": 7,
      "totalReservations": 68,
      "totalRevenue": 4100000,
      "avgRating": 4.6
    }
  ],
  "timestamp": "2025-01-07T11:15:05.123Z"
}
```

---

## 10. Manual Refresh (Optimized)

### Endpoint
```
POST /api/admin/analytics/refresh
```

### Response Structure

```typescript
{
  success: boolean;
  message: string;
  data: {
    success: boolean;
    message: string;
    views_refreshed?: string[];              // Array of refreshed view names
    duration_ms?: number;                    // Time taken to refresh (ms)
    refreshed_at?: string;                   // When refresh completed (ISO)
    error?: string;                          // Error message if failed
  };
  timestamp: string;
}
```

### Example Response (Success)

```json
{
  "success": true,
  "message": "Successfully refreshed 8 materialized views",
  "data": {
    "success": true,
    "message": "Successfully refreshed 8 materialized views",
    "views_refreshed": [
      "dashboard_quick_metrics",
      "user_growth_daily_trends",
      "revenue_daily_trends",
      "reservation_daily_trends",
      "shop_performance_summary",
      "payment_status_summary",
      "point_transaction_summary",
      "category_performance_summary"
    ],
    "duration_ms": 1247,
    "refreshed_at": "2025-01-07T11:15:05.123Z"
  },
  "timestamp": "2025-01-07T11:15:05.123Z"
}
```

---

## Error Response Format (All Endpoints)

### Structure

```typescript
{
  success: false;
  error: {
    code: string;                            // Error code (e.g., "UNAUTHORIZED", "VALIDATION_ERROR")
    message: string;                         // User-friendly error message (Korean)
    details?: string;                        // Technical details (for debugging)
    timestamp: string;                       // When error occurred (ISO)
  };
  timestamp: string;
}
```

### Example Error Response

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "관리자 인증이 필요합니다.",
    "timestamp": "2025-01-07T11:15:05.123Z"
  },
  "timestamp": "2025-01-07T11:15:05.123Z"
}
```

---

## Field Type Reference

```typescript
// All numeric fields
number         // Integer or float

// All string fields
string         // Text, dates in ISO format

// All boolean fields
boolean        // true/false

// Date/timestamp format
"2025-01-07T11:15:05.123Z"     // ISO 8601 with milliseconds

// Date-only format
"2025-01-07"                    // ISO date

// Week format
"2025-W01"                      // ISO week

// Month format
"2025-01"                       // ISO month
```

---

## Summary Table

| Endpoint | Performance | Data Source | Auto-Refresh |
|----------|-------------|-------------|--------------|
| `/api/admin/analytics/dashboard` | 1-10s | On-demand calculation | No (cached 5min) |
| `/api/admin/analytics/dashboard/quick` | < 10ms | Materialized view | Every 2 min |
| `/api/admin/analytics/trends/users` | < 10ms | Materialized view | Every 5 min |
| `/api/admin/analytics/trends/revenue` | < 10ms | Materialized view | Every 5 min |
| `/api/admin/analytics/trends/reservations` | < 10ms | Materialized view | Every 5 min |
| `/api/admin/analytics/shops/performance` | < 10ms | Materialized view | Every 10 min |
| `/api/admin/analytics/payments/summary` | < 10ms | Materialized view | Every 10 min |
| `/api/admin/analytics/points/summary` | < 10ms | Materialized view | Every 10 min |
| `/api/admin/analytics/categories/performance` | < 10ms | Materialized view | Every 10 min |
| `POST /api/admin/analytics/refresh` | ~1-2s | Triggers refresh | Manual |

**Recommendation:** Use optimized endpoints (dashboard/quick, trends/*, etc.) for dashboard UI to get < 10ms response times with real, auto-calculated data.
