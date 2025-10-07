# Refund and Points API - Frontend Integration Guide

## Overview
This guide details the exact data structures, query parameters, and response formats for the refund and point management endpoints.

---

## 🔄 Refund Management API

### Endpoint
```
GET /api/admin/financial/refunds
```

### Authentication
**Required**: Admin JWT token in Authorization header
```typescript
headers: {
  'Authorization': `Bearer ${adminToken}`
}
```

### Query Parameters
All parameters are **optional**:

| Parameter | Type | Description | Example | Valid Values |
|-----------|------|-------------|---------|--------------|
| `status` | string | Filter by refund status | `?status=pending` | `pending`, `approved`, `processing`, `completed`, `failed`, `cancelled` |
| `startDate` | string | Start date (ISO 8601) | `?startDate=2025-01-01` | ISO 8601 date string |
| `endDate` | string | End date (ISO 8601) | `?endDate=2025-12-31` | ISO 8601 date string |
| `shopId` | string | Filter by shop UUID | `?shopId=abc-123-def` | UUID |

**Default date range**: Last 30 days if not specified

### Request Example
```typescript
// TypeScript/JavaScript
const token = localStorage.getItem('adminToken');

const response = await fetch(
  'http://localhost:3001/api/admin/financial/refunds?status=pending&startDate=2025-01-01&endDate=2025-12-31',
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);

const data = await response.json();
```

### Response Structure

#### Success Response (200)
```typescript
{
  success: true,
  data: {
    summary: {
      totalRefunds: number;              // Total number of refunds
      totalRefundAmount: number;         // Sum of all refunded amounts
      averageRefundAmount: number;       // Average refund amount
      refundsByStatus: {                 // Grouped by status
        [status: string]: {
          count: number;                 // Number of refunds in this status
          totalAmount: number;           // Total amount for this status
        }
      }
    },
    pendingRefunds: Array<{             // Refunds needing admin attention
      id: string;                        // Refund UUID
      reservationId: string;             // Related reservation UUID
      userId: string;                    // User UUID who requested refund
      userName: string;                  // User's name (or 'Unknown')
      shopId: string;                    // Shop UUID
      shopName: string;                  // Shop name (or 'Unknown')
      requestedAmount: number;           // Amount requested for refund
      refundReason: string;              // Reason provided by user
      createdAt: string;                 // ISO 8601 timestamp
    }>,
    allRefunds: Array<{                 // All refunds matching filters
      id: string;                        // Refund UUID
      reservationId: string;             // Related reservation UUID
      userId: string;                    // User UUID
      userName: string;                  // User's name (or 'Unknown')
      shopId: string;                    // Shop UUID
      shopName: string;                  // Shop name (or 'Unknown')
      refundType: string;                // Type: 'full' | 'partial' | 'points_only'
      refundReason: string;              // Reason for refund
      requestedAmount: number;           // Amount originally requested
      refundedAmount: number;            // Actual amount refunded
      refundStatus: string;              // Status (see valid values above)
      triggeredBy: string;               // Who initiated: 'user' | 'admin' | 'system'
      createdAt: string;                 // ISO 8601 timestamp
      processedAt: string | null;        // ISO 8601 timestamp or null
    }>
  },
  timestamp: string;                     // Response timestamp
  requestId: string;                     // Unique request ID
}
```

#### Error Response (403)
```typescript
{
  success: false,
  error: {
    code: 'FORBIDDEN',
    message: 'Admin access required'
  },
  timestamp: string;
  requestId: string;
}
```

#### Error Response (500)
```typescript
{
  success: false,
  data: {
    error: 'Failed to fetch refund management data',
    message: string;                     // Specific error message
  },
  timestamp: string;
  requestId: string;
}
```

### Frontend Display Examples

#### 1. Display Refund Summary Card
```typescript
// React example
function RefundSummaryCard({ data }) {
  const { summary } = data;

  return (
    <div className="summary-card">
      <h3>Refund Overview</h3>
      <div>Total Refunds: {summary.totalRefunds}</div>
      <div>Total Amount: ₩{summary.totalRefundAmount.toLocaleString()}</div>
      <div>Average: ₩{summary.averageRefundAmount.toLocaleString()}</div>

      <h4>By Status:</h4>
      {Object.entries(summary.refundsByStatus).map(([status, stats]) => (
        <div key={status}>
          {status}: {stats.count} refunds (₩{stats.totalAmount.toLocaleString()})
        </div>
      ))}
    </div>
  );
}
```

#### 2. Display Pending Refunds List (Needs Admin Attention)
```typescript
function PendingRefundsList({ data }) {
  const { pendingRefunds } = data;

  return (
    <div className="pending-refunds">
      <h3>⚠️ Pending Refunds ({pendingRefunds.length})</h3>
      {pendingRefunds.map(refund => (
        <div key={refund.id} className="refund-item urgent">
          <div>User: {refund.userName}</div>
          <div>Shop: {refund.shopName}</div>
          <div>Amount: ₩{refund.requestedAmount.toLocaleString()}</div>
          <div>Reason: {refund.refundReason}</div>
          <div>Date: {new Date(refund.createdAt).toLocaleDateString()}</div>
          <button onClick={() => handleApprove(refund.id)}>Approve</button>
          <button onClick={() => handleReject(refund.id)}>Reject</button>
        </div>
      ))}
    </div>
  );
}
```

#### 3. Display All Refunds Table
```typescript
function RefundsTable({ data }) {
  const { allRefunds } = data;

  return (
    <table className="refunds-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Shop</th>
          <th>Type</th>
          <th>Requested</th>
          <th>Refunded</th>
          <th>Status</th>
          <th>Date</th>
          <th>Processed</th>
        </tr>
      </thead>
      <tbody>
        {allRefunds.map(refund => (
          <tr key={refund.id} className={`status-${refund.refundStatus}`}>
            <td>{refund.userName}</td>
            <td>{refund.shopName}</td>
            <td>{refund.refundType}</td>
            <td>₩{refund.requestedAmount.toLocaleString()}</td>
            <td>₩{refund.refundedAmount.toLocaleString()}</td>
            <td>
              <span className={`badge badge-${refund.refundStatus}`}>
                {refund.refundStatus}
              </span>
            </td>
            <td>{new Date(refund.createdAt).toLocaleDateString()}</td>
            <td>
              {refund.processedAt
                ? new Date(refund.processedAt).toLocaleDateString()
                : 'Not processed'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## 💰 Point System API

### Endpoint
```
GET /api/admin/financial/points
```

### Authentication
**Required**: Admin JWT token in Authorization header
```typescript
headers: {
  'Authorization': `Bearer ${adminToken}`
}
```

### Query Parameters
All parameters are **optional**:

| Parameter | Type | Description | Example | Default |
|-----------|------|-------------|---------|---------|
| `startDate` | string | Start date (ISO 8601) | `?startDate=2025-01-01` | 30 days ago |
| `endDate` | string | End date (ISO 8601) | `?endDate=2025-12-31` | Today |
| `userId` | string | Filter by specific user UUID | `?userId=abc-123` | None (all users) |

### Request Example
```typescript
// TypeScript/JavaScript
const token = localStorage.getItem('adminToken');

const response = await fetch(
  'http://localhost:3001/api/admin/financial/points?startDate=2025-01-01&endDate=2025-12-31',
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);

const data = await response.json();
```

### Response Structure

#### Success Response (200)
```typescript
{
  success: true,
  data: {
    summary: {
      totalPointsIssued: number;         // Total points given to users
      totalPointsUsed: number;           // Total points spent by users
      totalPointsExpired: number;        // Total points that expired
      activePointBalance: number;        // Current total active points in system
      totalUsers: number;                // Number of users with points > 0
      averagePointsPerUser: number;      // Average points per user
    },
    recentTransactions: Array<{         // Last 20 transactions
      id: string;                        // Transaction UUID
      userId: string;                    // User UUID
      userName: string;                  // User's name (or 'Unknown')
      transactionType: string;           // Type of transaction (see below)
      amount: number;                    // Points amount (positive = earned, negative = spent)
      description: string;               // Human-readable description
      status: string;                    // 'active' | 'used' | 'expired' | 'cancelled'
      createdAt: string;                 // ISO 8601 timestamp
    }>,
    pointDistribution: {
      byTransactionType: {               // Grouped by type
        [type: string]: {
          count: number;                 // Number of transactions
          totalAmount: number;           // Total points for this type
          percentage: number;            // Percentage of all transactions
        }
      },
      byStatus: {                        // Grouped by status
        [status: string]: {
          count: number;                 // Number of transactions
          totalAmount: number;           // Total points in this status
          percentage: number;            // Percentage of all transactions
        }
      }
    },
    trends: {
      daily: Array<{                     // Daily breakdown
        date: string;                    // Date in YYYY-MM-DD format
        issued: number;                  // Points issued on this day
        used: number;                    // Points used on this day
        expired: number;                 // Points expired on this day
      }>,
      monthly: Array<{                   // Monthly breakdown
        month: string;                   // Month in YYYY-MM format
        issued: number;                  // Points issued in this month
        used: number;                    // Points used in this month
        expired: number;                 // Points expired in this month
      }>
    }
  },
  timestamp: string;
  requestId: string;
}
```

### Transaction Types

Common `transactionType` values:
- `signup_bonus` - Welcome bonus for new users
- `referral_reward` - Points earned from referrals
- `reservation_payment` - Points spent on reservation
- `reservation_cancel_refund` - Points refunded from cancelled reservation
- `admin_adjustment` - Manual adjustment by admin
- `promotion` - Promotional points
- `review_reward` - Points earned from writing review
- `expired` - Points that expired

### Frontend Display Examples

#### 1. Display Points Summary Dashboard
```typescript
function PointsSummaryDashboard({ data }) {
  const { summary } = data;

  return (
    <div className="points-dashboard">
      <h2>Point System Overview</h2>

      <div className="summary-grid">
        <div className="stat-card positive">
          <h3>Points Issued</h3>
          <div className="value">{summary.totalPointsIssued.toLocaleString()}</div>
        </div>

        <div className="stat-card negative">
          <h3>Points Used</h3>
          <div className="value">{summary.totalPointsUsed.toLocaleString()}</div>
        </div>

        <div className="stat-card warning">
          <h3>Points Expired</h3>
          <div className="value">{summary.totalPointsExpired.toLocaleString()}</div>
        </div>

        <div className="stat-card info">
          <h3>Active Balance</h3>
          <div className="value">{summary.activePointBalance.toLocaleString()}</div>
        </div>

        <div className="stat-card">
          <h3>Total Users</h3>
          <div className="value">{summary.totalUsers.toLocaleString()}</div>
        </div>

        <div className="stat-card">
          <h3>Average per User</h3>
          <div className="value">{Math.round(summary.averagePointsPerUser).toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}
```

#### 2. Display Recent Transactions List
```typescript
function RecentTransactionsList({ data }) {
  const { recentTransactions } = data;

  return (
    <div className="recent-transactions">
      <h3>Recent Point Transactions</h3>
      {recentTransactions.map(transaction => (
        <div key={transaction.id} className="transaction-item">
          <div className="transaction-user">
            <strong>{transaction.userName}</strong>
          </div>
          <div className="transaction-type">
            <span className={`badge badge-${transaction.transactionType}`}>
              {transaction.transactionType.replace('_', ' ')}
            </span>
          </div>
          <div className={`transaction-amount ${transaction.amount > 0 ? 'positive' : 'negative'}`}>
            {transaction.amount > 0 ? '+' : ''}{transaction.amount.toLocaleString()}
          </div>
          <div className="transaction-description">
            {transaction.description}
          </div>
          <div className="transaction-status">
            <span className={`badge badge-${transaction.status}`}>
              {transaction.status}
            </span>
          </div>
          <div className="transaction-date">
            {new Date(transaction.createdAt).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
```

#### 3. Display Point Distribution Charts
```typescript
function PointDistributionCharts({ data }) {
  const { pointDistribution } = data;

  return (
    <div className="distribution-charts">
      <div className="chart-section">
        <h3>Distribution by Transaction Type</h3>
        {Object.entries(pointDistribution.byTransactionType).map(([type, stats]) => (
          <div key={type} className="distribution-item">
            <div className="distribution-label">{type.replace('_', ' ')}</div>
            <div className="distribution-bar">
              <div
                className="distribution-fill"
                style={{ width: `${stats.percentage}%` }}
              />
            </div>
            <div className="distribution-stats">
              {stats.count} transactions | {stats.totalAmount.toLocaleString()} points | {stats.percentage.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>

      <div className="chart-section">
        <h3>Distribution by Status</h3>
        {Object.entries(pointDistribution.byStatus).map(([status, stats]) => (
          <div key={status} className="distribution-item">
            <div className="distribution-label">{status}</div>
            <div className="distribution-bar">
              <div
                className="distribution-fill"
                style={{ width: `${stats.percentage}%` }}
              />
            </div>
            <div className="distribution-stats">
              {stats.count} transactions | {stats.totalAmount.toLocaleString()} points | {stats.percentage.toFixed(1)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### 4. Display Trend Charts (Daily/Monthly)
```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

function PointTrendsChart({ data }) {
  const { trends } = data;

  return (
    <div className="trends-charts">
      <div className="chart-section">
        <h3>Daily Point Trends (Last 30 Days)</h3>
        <LineChart width={800} height={400} data={trends.daily}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="issued" stroke="#82ca9d" name="Issued" />
          <Line type="monotone" dataKey="used" stroke="#8884d8" name="Used" />
          <Line type="monotone" dataKey="expired" stroke="#ffc658" name="Expired" />
        </LineChart>
      </div>

      <div className="chart-section">
        <h3>Monthly Point Trends</h3>
        <LineChart width={800} height={400} data={trends.monthly}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="issued" stroke="#82ca9d" name="Issued" />
          <Line type="monotone" dataKey="used" stroke="#8884d8" name="Used" />
          <Line type="monotone" dataKey="expired" stroke="#ffc658" name="Expired" />
        </LineChart>
      </div>
    </div>
  );
}
```

---

## 🔧 Error Handling Best Practices

### 1. Network Error Handling
```typescript
async function fetchRefunds(params: RefundParams) {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(
      `${API_BASE_URL}/api/admin/financial/refunds?${queryString}`,
      {
        headers: {
          'Authorization': `Bearer ${getAdminToken()}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired - redirect to login
        redirectToLogin();
        throw new Error('Authentication expired');
      }

      if (response.status === 403) {
        // Not an admin
        throw new Error('Admin access required');
      }

      const errorData = await response.json();
      throw new Error(errorData.data?.message || 'Failed to fetch refunds');
    }

    const data = await response.json();
    return data.data; // Return the nested data object

  } catch (error) {
    console.error('Error fetching refunds:', error);
    showErrorNotification(error.message);
    throw error;
  }
}
```

### 2. Loading States
```typescript
function RefundManagementPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const refundData = await fetchRefunds({ status: 'pending' });
        setData(refundData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return <NoDataMessage />;

  return <RefundDashboard data={data} />;
}
```

### 3. Empty State Handling
```typescript
function RefundsTable({ data }) {
  const { allRefunds } = data;

  if (allRefunds.length === 0) {
    return (
      <div className="empty-state">
        <p>No refunds found for the selected filters.</p>
        <p>Try adjusting your date range or status filter.</p>
      </div>
    );
  }

  return (
    <table>
      {/* Table content */}
    </table>
  );
}
```

---

## 📊 Complete Integration Example

### Full React Component with Both Endpoints
```typescript
import { useState, useEffect } from 'react';

interface RefundData {
  summary: any;
  pendingRefunds: any[];
  allRefunds: any[];
}

interface PointData {
  summary: any;
  recentTransactions: any[];
  pointDistribution: any;
  trends: any;
}

function FinancialDashboard() {
  const [refundData, setRefundData] = useState<RefundData | null>(null);
  const [pointData, setPointData] = useState<PointData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: '2025-01-01',
    endDate: '2025-12-31'
  });

  useEffect(() => {
    loadFinancialData();
  }, [dateRange]);

  async function loadFinancialData() {
    try {
      setLoading(true);
      const token = localStorage.getItem('adminToken');

      // Fetch both endpoints in parallel
      const [refundsResponse, pointsResponse] = await Promise.all([
        fetch(
          `http://localhost:3001/api/admin/financial/refunds?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
          { headers: { 'Authorization': `Bearer ${token}` }}
        ),
        fetch(
          `http://localhost:3001/api/admin/financial/points?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
          { headers: { 'Authorization': `Bearer ${token}` }}
        )
      ]);

      const refundsData = await refundsResponse.json();
      const pointsData = await pointsResponse.json();

      setRefundData(refundsData.data);
      setPointData(pointsData.data);

    } catch (error) {
      console.error('Failed to load financial data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>Loading financial data...</div>;

  return (
    <div className="financial-dashboard">
      <h1>Financial Management Dashboard</h1>

      {/* Date Range Picker */}
      <DateRangePicker
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
        onChange={setDateRange}
      />

      {/* Refunds Section */}
      <section>
        <h2>Refund Management</h2>
        {refundData && (
          <>
            <RefundSummaryCard data={refundData} />
            <PendingRefundsList data={refundData} />
            <RefundsTable data={refundData} />
          </>
        )}
      </section>

      {/* Points Section */}
      <section>
        <h2>Point System Overview</h2>
        {pointData && (
          <>
            <PointsSummaryDashboard data={pointData} />
            <RecentTransactionsList data={pointData} />
            <PointDistributionCharts data={pointData} />
            <PointTrendsChart data={pointData} />
          </>
        )}
      </section>
    </div>
  );
}

export default FinancialDashboard;
```

---

## 🎯 Key Points for Frontend Developers

### Refunds Endpoint
1. **Use `pendingRefunds` array** for urgent admin notifications/badges
2. **Use `summary.refundsByStatus`** for status distribution charts
3. **Use `allRefunds` array** for the main refunds table
4. **Filter by status** using query param to create "Pending", "Completed", "Failed" tabs
5. **Empty arrays** mean no data (not an error) - show appropriate empty state

### Points Endpoint
1. **`summary` object** provides high-level KPIs for dashboard cards
2. **`recentTransactions`** limited to 20 most recent - good for activity feed
3. **`pointDistribution`** includes pre-calculated percentages - use for pie/bar charts
4. **`trends.daily`** has last 30 days - use for short-term line charts
5. **`trends.monthly`** has historical data - use for long-term trend analysis

### Date Handling
- Backend defaults to **last 30 days** if no dates provided
- Always use **ISO 8601 format** (`YYYY-MM-DD` or full timestamp)
- Backend automatically converts to UTC and applies start/end of day

### Authentication
- **401 Unauthorized** = Token invalid/expired → Redirect to login
- **403 Forbidden** = Valid token but not admin → Show permission error
- Always include token in **Authorization header** as `Bearer ${token}`

### Performance Tips
- Fetch both endpoints in parallel using `Promise.all()`
- Cache responses for 30-60 seconds to reduce API calls
- Use loading skeletons instead of spinners for better UX
- Implement infinite scroll or pagination if data grows large

---

## 📝 TypeScript Type Definitions

```typescript
// Refund Types
interface RefundSummary {
  totalRefunds: number;
  totalRefundAmount: number;
  averageRefundAmount: number;
  refundsByStatus: Record<string, {
    count: number;
    totalAmount: number;
  }>;
}

interface PendingRefund {
  id: string;
  reservationId: string;
  userId: string;
  userName: string;
  shopId: string;
  shopName: string;
  requestedAmount: number;
  refundReason: string;
  createdAt: string;
}

interface Refund extends PendingRefund {
  refundType: 'full' | 'partial' | 'points_only';
  refundedAmount: number;
  refundStatus: 'pending' | 'approved' | 'processing' | 'completed' | 'failed' | 'cancelled';
  triggeredBy: 'user' | 'admin' | 'system';
  processedAt: string | null;
}

interface RefundResponse {
  summary: RefundSummary;
  pendingRefunds: PendingRefund[];
  allRefunds: Refund[];
}

// Point Types
interface PointSummary {
  totalPointsIssued: number;
  totalPointsUsed: number;
  totalPointsExpired: number;
  activePointBalance: number;
  totalUsers: number;
  averagePointsPerUser: number;
}

interface PointTransaction {
  id: string;
  userId: string;
  userName: string;
  transactionType: string;
  amount: number;
  description: string;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  createdAt: string;
}

interface PointDistribution {
  byTransactionType: Record<string, {
    count: number;
    totalAmount: number;
    percentage: number;
  }>;
  byStatus: Record<string, {
    count: number;
    totalAmount: number;
    percentage: number;
  }>;
}

interface PointTrends {
  daily: Array<{
    date: string;
    issued: number;
    used: number;
    expired: number;
  }>;
  monthly: Array<{
    month: string;
    issued: number;
    used: number;
    expired: number;
  }>;
}

interface PointResponse {
  summary: PointSummary;
  recentTransactions: PointTransaction[];
  pointDistribution: PointDistribution;
  trends: PointTrends;
}
```

---

## ✅ Testing the Endpoints

### Using cURL
```bash
# Get admin token first
TOKEN=$(curl -s 'http://localhost:3001/api/admin/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"password"}' \
  | jq -r '.data.token')

# Test refunds endpoint
curl -s "http://localhost:3001/api/admin/financial/refunds?status=pending" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Test points endpoint
curl -s "http://localhost:3001/api/admin/financial/points?startDate=2025-01-01" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### Using Postman
1. **POST** to `/api/admin/auth/login` with admin credentials
2. Copy the `token` from response
3. **GET** to `/api/admin/financial/refunds` with header:
   - `Authorization: Bearer YOUR_TOKEN_HERE`
4. **GET** to `/api/admin/financial/points` with same header

---

**Last Updated**: 2025-10-07
**Backend Version**: 1.0.0
**API Base URL**: `http://localhost:3001`
