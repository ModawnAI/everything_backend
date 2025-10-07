# Frontend Analytics Integration Guide

## Overview

This document shows **EXACTLY** what data structure the backend returns and how the frontend should display it.

---

## 1. Quick Dashboard Metrics (Main Dashboard)

### API Endpoint
```
GET /api/admin/analytics/dashboard/quick
Authorization: Bearer <admin-token>
```

### Response Structure

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

    "lastUpdated": "2025-01-07T11:15:00.000Z"
  },
  "timestamp": "2025-01-07T11:15:05.123Z"
}
```

### Frontend Display

```typescript
// React/TypeScript Example
interface QuickDashboardMetrics {
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  userGrowthRate: number;
  totalRevenue: number;
  todayRevenue: number;
  monthRevenue: number;
  revenueGrowthRate: number;
  totalReservations: number;
  activeReservations: number;
  todayReservations: number;
  reservationSuccessRate: number;
  totalShops: number;
  activeShops: number;
  pendingApprovals: number;
  totalTransactions: number;
  successfulTransactions: number;
  conversionRate: number;
  lastUpdated: string;
}

const DashboardPage = () => {
  const [metrics, setMetrics] = useState<QuickDashboardMetrics | null>(null);

  useEffect(() => {
    fetchMetrics();
    // Poll every 30 seconds (data refreshes every 2 minutes)
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    const response = await fetch('/api/admin/analytics/dashboard/quick', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    if (result.success) {
      setMetrics(result.data);
    }
  };

  return (
    <div className="dashboard">
      {/* User Metrics Card */}
      <div className="card">
        <h3>사용자 현황</h3>
        <div className="stat">
          <span className="label">전체 사용자</span>
          <span className="value">{metrics?.totalUsers.toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="label">활성 사용자</span>
          <span className="value">{metrics?.activeUsers.toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="label">이번 달 신규</span>
          <span className="value">{metrics?.newUsersThisMonth.toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="label">성장률</span>
          <span className="value positive">
            {metrics?.userGrowthRate.toFixed(1)}% ↑
          </span>
        </div>
      </div>

      {/* Revenue Metrics Card */}
      <div className="card">
        <h3>매출 현황</h3>
        <div className="stat">
          <span className="label">전체 매출</span>
          <span className="value">
            ₩{metrics?.totalRevenue.toLocaleString()}
          </span>
        </div>
        <div className="stat">
          <span className="label">오늘 매출</span>
          <span className="value">
            ₩{metrics?.todayRevenue.toLocaleString()}
          </span>
        </div>
        <div className="stat">
          <span className="label">이번 달 매출</span>
          <span className="value">
            ₩{metrics?.monthRevenue.toLocaleString()}
          </span>
        </div>
        <div className="stat">
          <span className="label">매출 성장률</span>
          <span className="value positive">
            {metrics?.revenueGrowthRate.toFixed(1)}% ↑
          </span>
        </div>
      </div>

      {/* Reservation Metrics Card */}
      <div className="card">
        <h3>예약 현황</h3>
        <div className="stat">
          <span className="label">전체 예약</span>
          <span className="value">{metrics?.totalReservations.toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="label">진행 중</span>
          <span className="value">{metrics?.activeReservations.toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="label">오늘 예약</span>
          <span className="value">{metrics?.todayReservations.toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="label">성공률</span>
          <span className="value">
            {metrics?.reservationSuccessRate.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Shop Metrics Card */}
      <div className="card">
        <h3>매장 현황</h3>
        <div className="stat">
          <span className="label">전체 매장</span>
          <span className="value">{metrics?.totalShops.toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="label">활성 매장</span>
          <span className="value">{metrics?.activeShops.toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="label">승인 대기</span>
          <span className="value warning">
            {metrics?.pendingApprovals.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Payment Metrics Card */}
      <div className="card">
        <h3>결제 현황</h3>
        <div className="stat">
          <span className="label">전체 거래</span>
          <span className="value">{metrics?.totalTransactions.toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="label">성공 거래</span>
          <span className="value">{metrics?.successfulTransactions.toLocaleString()}</span>
        </div>
        <div className="stat">
          <span className="label">전환율</span>
          <span className="value">
            {metrics?.conversionRate.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Last Updated */}
      <div className="update-time">
        마지막 업데이트: {new Date(metrics?.lastUpdated).toLocaleString('ko-KR')}
      </div>
    </div>
  );
};
```

---

## 2. User Growth Trends (Chart Data)

### API Endpoint
```
GET /api/admin/analytics/trends/users?limit=30
Authorization: Bearer <admin-token>
```

### Response Structure

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
    // ... up to 30 days
  ],
  "timestamp": "2025-01-07T11:15:05.123Z"
}
```

### Frontend Display (Chart)

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const UserGrowthChart = () => {
  const [trends, setTrends] = useState([]);

  useEffect(() => {
    fetchTrends();
  }, []);

  const fetchTrends = async () => {
    const response = await fetch('/api/admin/analytics/trends/users?limit=30', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    if (result.success) {
      setTrends(result.data.reverse()); // Oldest to newest for chart
    }
  };

  return (
    <div className="chart-container">
      <h3>사용자 증가 추세 (최근 30일)</h3>
      <LineChart width={800} height={400} data={trends}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={(date) => new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
        />
        <YAxis />
        <Tooltip
          labelFormatter={(date) => new Date(date).toLocaleDateString('ko-KR')}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="newUsers"
          stroke="#8884d8"
          name="신규 사용자"
        />
        <Line
          type="monotone"
          dataKey="activeUsers"
          stroke="#82ca9d"
          name="활성 사용자"
        />
      </LineChart>
    </div>
  );
};
```

---

## 3. Revenue Trends (Chart Data)

### API Endpoint
```
GET /api/admin/analytics/trends/revenue?limit=30
Authorization: Bearer <admin-token>
```

### Response Structure

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
    // ... up to 30 days
  ],
  "timestamp": "2025-01-07T11:15:05.123Z"
}
```

### Frontend Display (Chart)

```typescript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const RevenueChart = () => {
  const [trends, setTrends] = useState([]);

  const fetchTrends = async () => {
    const response = await fetch('/api/admin/analytics/trends/revenue?limit=30', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    if (result.success) {
      setTrends(result.data.reverse());
    }
  };

  return (
    <div className="chart-container">
      <h3>매출 추세 (최근 30일)</h3>
      <BarChart width={800} height={400} data={trends}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={(date) => new Date(date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
        />
        <YAxis
          tickFormatter={(value) => `₩${(value / 1000).toFixed(0)}K`}
        />
        <Tooltip
          formatter={(value) => `₩${value.toLocaleString()}`}
          labelFormatter={(date) => new Date(date).toLocaleDateString('ko-KR')}
        />
        <Legend />
        <Bar
          dataKey="totalRevenue"
          fill="#8884d8"
          name="일일 매출"
        />
      </BarChart>

      {/* Summary Stats */}
      <div className="stats-summary">
        <div className="stat">
          <span>평균 일일 매출</span>
          <span>
            ₩{(trends.reduce((sum, t) => sum + t.totalRevenue, 0) / trends.length).toLocaleString()}
          </span>
        </div>
        <div className="stat">
          <span>평균 거래액</span>
          <span>
            ₩{(trends.reduce((sum, t) => sum + t.avgTransactionValue, 0) / trends.length).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};
```

---

## 4. Reservation Trends (Chart Data)

### API Endpoint
```
GET /api/admin/analytics/trends/reservations?limit=30
Authorization: Bearer <admin-token>
```

### Response Structure

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
    // ... up to 30 days
  ],
  "timestamp": "2025-01-07T11:15:05.123Z"
}
```

### Frontend Display

```typescript
const ReservationChart = () => {
  const [trends, setTrends] = useState([]);

  return (
    <div className="chart-container">
      <h3>예약 추세 (최근 30일)</h3>

      {/* Stacked Bar Chart */}
      <BarChart width={800} height={400} data={trends}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="completedReservations" stackId="a" fill="#82ca9d" name="완료" />
        <Bar dataKey="cancelledReservations" stackId="a" fill="#ff7c7c" name="취소" />
      </BarChart>

      {/* Completion Rate Line */}
      <LineChart width={800} height={200} data={trends}>
        <XAxis dataKey="date" />
        <YAxis domain={[0, 100]} />
        <Tooltip formatter={(value) => `${value}%`} />
        <Line
          type="monotone"
          dataKey="completionRate"
          stroke="#8884d8"
          name="완료율"
        />
      </LineChart>
    </div>
  );
};
```

---

## 5. Shop Performance (Table Data)

### API Endpoint
```
GET /api/admin/analytics/shops/performance?limit=20
Authorization: Bearer <admin-token>
```

### Response Structure

```json
{
  "success": true,
  "message": "매장 성과를 성공적으로 조회했습니다.",
  "data": [
    {
      "shopId": "abc-123",
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
      "shopId": "def-456",
      "shopName": "헤어샵 신촌",
      "mainCategory": "hair",
      "shopStatus": "active",
      "totalReservations": 32,
      "completedReservations": 28,
      "totalRevenue": 2800000,
      "avgRating": 4.7,
      "completionRate": 87.5
    }
    // ... up to 20 shops
  ],
  "timestamp": "2025-01-07T11:15:05.123Z"
}
```

### Frontend Display (Table)

```typescript
const ShopPerformanceTable = () => {
  const [shops, setShops] = useState([]);

  return (
    <div className="table-container">
      <h3>매장 성과 (Top 20)</h3>
      <table className="performance-table">
        <thead>
          <tr>
            <th>순위</th>
            <th>매장명</th>
            <th>카테고리</th>
            <th>총 예약</th>
            <th>완료</th>
            <th>매출</th>
            <th>평점</th>
            <th>완료율</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          {shops.map((shop, index) => (
            <tr key={shop.shopId}>
              <td>{index + 1}</td>
              <td>
                <a href={`/admin/shops/${shop.shopId}`}>
                  {shop.shopName}
                </a>
              </td>
              <td>{getCategoryLabel(shop.mainCategory)}</td>
              <td>{shop.totalReservations}</td>
              <td>{shop.completedReservations}</td>
              <td>₩{shop.totalRevenue.toLocaleString()}</td>
              <td>
                <span className="rating">
                  ⭐ {shop.avgRating.toFixed(1)}
                </span>
              </td>
              <td>
                <span className={shop.completionRate >= 80 ? 'high' : 'medium'}>
                  {shop.completionRate.toFixed(1)}%
                </span>
              </td>
              <td>
                <span className={`status ${shop.shopStatus}`}>
                  {getStatusLabel(shop.shopStatus)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const getCategoryLabel = (category: string) => {
  const labels = {
    'nail': '네일',
    'hair': '헤어',
    'eyelash': '속눈썹',
    'waxing': '왁싱',
    'eyebrow_tattoo': '눈썹문신'
  };
  return labels[category] || category;
};

const getStatusLabel = (status: string) => {
  const labels = {
    'active': '활성',
    'inactive': '비활성',
    'pending_approval': '승인대기',
    'suspended': '정지'
  };
  return labels[status] || status;
};
```

---

## 6. Category Performance (Chart/Cards)

### API Endpoint
```
GET /api/admin/analytics/categories/performance
Authorization: Bearer <admin-token>
```

### Response Structure

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
    }
    // ... all categories
  ],
  "timestamp": "2025-01-07T11:15:05.123Z"
}
```

### Frontend Display

```typescript
const CategoryPerformance = () => {
  const [categories, setCategories] = useState([]);

  return (
    <div className="categories-grid">
      {categories.map((category) => (
        <div key={category.mainCategory} className="category-card">
          <div className="category-header">
            <span className="category-icon">
              {getCategoryIcon(category.mainCategory)}
            </span>
            <h4>{getCategoryLabel(category.mainCategory)}</h4>
          </div>

          <div className="category-stats">
            <div className="stat">
              <span className="label">매장 수</span>
              <span className="value">
                {category.activeShops} / {category.totalShops}
              </span>
            </div>

            <div className="stat">
              <span className="label">예약 수</span>
              <span className="value">
                {category.totalReservations.toLocaleString()}
              </span>
            </div>

            <div className="stat">
              <span className="label">매출</span>
              <span className="value">
                ₩{(category.totalRevenue / 1000000).toFixed(1)}M
              </span>
            </div>

            <div className="stat">
              <span className="label">평균 평점</span>
              <span className="value">
                ⭐ {category.avgRating.toFixed(1)}
              </span>
            </div>
          </div>

          <div className="category-chart">
            {/* Small pie chart showing active vs total shops */}
            <PieChart width={100} height={100}>
              <Pie
                data={[
                  { name: '활성', value: category.activeShops },
                  { name: '비활성', value: category.totalShops - category.activeShops }
                ]}
                dataKey="value"
                cx={50}
                cy={50}
                innerRadius={25}
                outerRadius={40}
              />
            </PieChart>
          </div>
        </div>
      ))}
    </div>
  );
};
```

---

## Complete Dashboard Layout Example

```typescript
const AdminDashboard = () => {
  return (
    <div className="admin-dashboard">
      <header>
        <h1>관리자 대시보드</h1>
        <button onClick={() => manualRefresh()}>
          새로고침
        </button>
      </header>

      {/* Top: Quick Metrics Cards */}
      <section className="quick-metrics">
        <QuickDashboardMetrics />
      </section>

      {/* Middle: Trend Charts */}
      <section className="trends">
        <div className="chart-row">
          <UserGrowthChart />
          <RevenueChart />
        </div>
        <div className="chart-row">
          <ReservationChart />
        </div>
      </section>

      {/* Bottom: Tables and Details */}
      <section className="details">
        <div className="detail-row">
          <ShopPerformanceTable />
        </div>
        <div className="detail-row">
          <CategoryPerformance />
        </div>
      </section>
    </div>
  );
};
```

---

## Summary

### All API Endpoints:

| Endpoint | Response Time | Use For |
|----------|--------------|---------|
| `GET /api/admin/analytics/dashboard/quick` | < 10ms | Main dashboard cards |
| `GET /api/admin/analytics/trends/users?limit=30` | < 10ms | User growth chart |
| `GET /api/admin/analytics/trends/revenue?limit=30` | < 10ms | Revenue chart |
| `GET /api/admin/analytics/trends/reservations?limit=30` | < 10ms | Reservation chart |
| `GET /api/admin/analytics/shops/performance?limit=20` | < 10ms | Top shops table |
| `GET /api/admin/analytics/categories/performance` | < 10ms | Category cards |
| `POST /api/admin/analytics/refresh` | ~1-2s | Manual refresh button |

### Response Format (All Endpoints):

```json
{
  "success": true,
  "message": "Success message in Korean",
  "data": { /* actual data structure */ },
  "timestamp": "2025-01-07T11:15:05.123Z"
}
```

All data is **real, calculated from database**, and **auto-refreshed every 2-10 minutes** by Supabase pg_cron.
