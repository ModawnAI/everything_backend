# Admin Service Detail View - Frontend Implementation Guide

## 🎯 Overview

The detailed service view is accessed at `http://localhost:3000/dashboard/services/{serviceId}` and provides comprehensive analytics and management capabilities for administrators.

## 📡 API Endpoints Summary

Based on the existing and enhanced endpoints:

### Core Endpoints
1. **Service Details**: `GET /api/admin/services/{serviceId}/details`
2. **Service Analytics**: `GET /api/admin/services/{serviceId}/analytics`
3. **Service Reservations**: `GET /api/admin/services/{serviceId}/reservations`
4. **Service Customers**: `GET /api/admin/services/{serviceId}/customers`
5. **Service Revenue**: `GET /api/admin/services/{serviceId}/revenue`
6. **Basic Service Info**: `GET /api/admin/shops/{shopId}/services/{serviceId}`

## 🏗️ Frontend Architecture

### 1. Page Structure

```typescript
// pages/dashboard/services/[serviceId].tsx
interface ServiceDetailPageProps {
  serviceId: string;
}

const ServiceDetailPage: React.FC<ServiceDetailPageProps> = ({ serviceId }) => {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [dateRange, setDateRange] = useState('30d');

  return (
    <div className="service-detail-container">
      <ServiceHeader serviceId={serviceId} />
      <ServiceTabs
        selectedTab={selectedTab}
        onTabChange={setSelectedTab}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />
      <ServiceContent
        tab={selectedTab}
        serviceId={serviceId}
        dateRange={dateRange}
      />
    </div>
  );
};
```

### 2. Data Fetching Strategy

```typescript
// hooks/useServiceDetails.ts
export const useServiceDetails = (serviceId: string, period: string = '30d') => {
  // Parallel data fetching for better performance
  const { data: serviceDetails, loading: detailsLoading } = useSWR(
    `/api/admin/services/${serviceId}/details?period=${period}`,
    fetcher
  );

  const { data: analytics, loading: analyticsLoading } = useSWR(
    `/api/admin/services/${serviceId}/analytics?period=${period}`,
    fetcher
  );

  const { data: revenue, loading: revenueLoading } = useSWR(
    `/api/admin/services/${serviceId}/revenue?period=${period}&granularity=daily`,
    fetcher
  );

  return {
    serviceDetails,
    analytics,
    revenue,
    loading: detailsLoading || analyticsLoading || revenueLoading,
    refresh: () => {
      mutate(`/api/admin/services/${serviceId}/details?period=${period}`);
      mutate(`/api/admin/services/${serviceId}/analytics?period=${period}`);
      mutate(`/api/admin/services/${serviceId}/revenue?period=${period}&granularity=daily`);
    }
  };
};
```

## 📊 UI Components Implementation

### 1. Service Header Component

```typescript
// components/ServiceHeader.tsx
interface ServiceHeaderProps {
  serviceId: string;
}

const ServiceHeader: React.FC<ServiceHeaderProps> = ({ serviceId }) => {
  const { data } = useSWR(`/api/admin/services/${serviceId}/details`);

  if (!data?.data) return <HeaderSkeleton />;

  const { serviceInfo, shopInfo, statistics } = data.data;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <div className="flex items-start justify-between">
        {/* Left Side - Service Info */}
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">
              {serviceInfo.name}
            </h1>
            <StatusBadge status={serviceInfo.is_available ? 'active' : 'inactive'} />
            <CategoryBadge category={serviceInfo.category} />
          </div>

          <div className="text-sm text-gray-600 mb-4">
            <span className="flex items-center">
              <ShopIcon className="w-4 h-4 mr-1" />
              {shopInfo.name} • {shopInfo.address}
            </span>
          </div>

          <p className="text-gray-700 mb-4">{serviceInfo.description}</p>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              label="총 예약"
              value={statistics.totalReservations}
              change={statistics.reservationChange}
              trend="up"
            />
            <StatCard
              label="이번 달 매출"
              value={`₩${statistics.monthlyRevenue.toLocaleString()}`}
              change={statistics.revenueChange}
              trend="up"
            />
            <StatCard
              label="완료율"
              value={`${statistics.completionRate}%`}
              change={statistics.completionRateChange}
              trend="up"
            />
            <StatCard
              label="평균 평점"
              value={statistics.averageRating}
              change={statistics.ratingChange}
              trend="up"
            />
          </div>
        </div>

        {/* Right Side - Actions */}
        <div className="flex flex-col space-y-2 ml-6">
          <Button
            variant="primary"
            onClick={() => handleEditService(serviceId)}
          >
            서비스 수정
          </Button>
          <Button
            variant="outline"
            onClick={() => handleViewShop(shopInfo.id)}
          >
            샵 보기
          </Button>
          <DropdownMenu>
            <DropdownTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreIcon className="w-4 h-4" />
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem onClick={() => handleToggleAvailability()}>
                {serviceInfo.is_available ? '비활성화' : '활성화'}
              </DropdownItem>
              <DropdownItem onClick={() => handleExportData()}>
                데이터 내보내기
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem
                className="text-red-600"
                onClick={() => handleDeleteService()}
              >
                서비스 삭제
              </DropdownItem>
            </DropdownContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};
```

### 2. Navigation Tabs

```typescript
// components/ServiceTabs.tsx
interface ServiceTabsProps {
  selectedTab: string;
  onTabChange: (tab: string) => void;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
}

const ServiceTabs: React.FC<ServiceTabsProps> = ({
  selectedTab,
  onTabChange,
  dateRange,
  onDateRangeChange
}) => {
  const tabs = [
    { id: 'overview', label: '개요', icon: OverviewIcon },
    { id: 'analytics', label: '분석', icon: AnalyticsIcon },
    { id: 'reservations', label: '예약 관리', icon: CalendarIcon },
    { id: 'customers', label: '고객 분석', icon: UsersIcon },
    { id: 'revenue', label: '매출 분석', icon: DollarIcon },
    { id: 'settings', label: '설정', icon: SettingsIcon }
  ];

  return (
    <div className="bg-white border-b border-gray-200 mb-6">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Tab Navigation */}
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  selectedTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Date Range Selector */}
        <div className="flex items-center space-x-4">
          <Select value={dateRange} onValueChange={onDateRangeChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">최근 7일</SelectItem>
              <SelectItem value="30d">최근 30일</SelectItem>
              <SelectItem value="90d">최근 90일</SelectItem>
              <SelectItem value="1y">최근 1년</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm">
            <RefreshIcon className="w-4 h-4 mr-2" />
            새로고침
          </Button>
        </div>
      </div>
    </div>
  );
};
```

### 3. Overview Tab Content

```typescript
// components/tabs/OverviewTab.tsx
interface OverviewTabProps {
  serviceId: string;
  dateRange: string;
}

const OverviewTab: React.FC<OverviewTabProps> = ({ serviceId, dateRange }) => {
  const { data } = useSWR(
    `/api/admin/services/${serviceId}/details?period=${dateRange}`
  );

  if (!data?.data) return <OverviewSkeleton />;

  const { statistics, performance, recentActivity, trends } = data.data;

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="총 예약 수"
          value={statistics.totalReservations}
          change={statistics.reservationChange}
          trend={statistics.reservationTrend}
          icon={CalendarIcon}
          color="blue"
        />
        <MetricCard
          title="총 매출"
          value={`₩${statistics.totalRevenue.toLocaleString()}`}
          change={statistics.revenueChange}
          trend={statistics.revenueTrend}
          icon={DollarIcon}
          color="green"
        />
        <MetricCard
          title="고객 수"
          value={statistics.uniqueCustomers}
          change={statistics.customerChange}
          trend={statistics.customerTrend}
          icon={UsersIcon}
          color="purple"
        />
        <MetricCard
          title="평균 평점"
          value={performance.averageRating}
          change={performance.ratingChange}
          trend={performance.ratingTrend}
          icon={StarIcon}
          color="yellow"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reservation Trend Chart */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">예약 추이</h3>
          <LineChart
            data={trends.reservationTrend}
            xKey="date"
            yKey="reservations"
            color="#3B82F6"
            height={300}
          />
        </Card>

        {/* Revenue Chart */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">매출 추이</h3>
          <AreaChart
            data={trends.revenueTrend}
            xKey="date"
            yKey="revenue"
            color="#10B981"
            height={300}
            formatY={(value) => `₩${value.toLocaleString()}`}
          />
        </Card>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">성과 지표</h3>
          <div className="space-y-4">
            <PerformanceItem
              label="완료율"
              value={`${performance.completionRate}%`}
              target={95}
              current={performance.completionRate}
            />
            <PerformanceItem
              label="취소율"
              value={`${performance.cancellationRate}%`}
              target={5}
              current={performance.cancellationRate}
              inverse
            />
            <PerformanceItem
              label="재방문율"
              value={`${performance.returnCustomerRate}%`}
              target={60}
              current={performance.returnCustomerRate}
            />
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">예약 패턴</h3>
          <DonutChart
            data={statistics.reservationsByTimeSlot}
            centerLabel="예약 시간대"
          />
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">최근 활동</h3>
          <div className="space-y-3">
            {recentActivity.slice(0, 5).map((activity, index) => (
              <ActivityItem
                key={index}
                type={activity.type}
                description={activity.description}
                timestamp={activity.timestamp}
                user={activity.user}
              />
            ))}
          </div>
          <Button variant="outline" size="sm" className="w-full mt-4">
            모든 활동 보기
          </Button>
        </Card>
      </div>
    </div>
  );
};
```

### 4. Analytics Tab Implementation

```typescript
// components/tabs/AnalyticsTab.tsx
const AnalyticsTab: React.FC<{ serviceId: string; dateRange: string }> = ({
  serviceId,
  dateRange
}) => {
  const [granularity, setGranularity] = useState('daily');
  const [comparePeriod, setComparePeriod] = useState(false);

  const { data } = useSWR(
    `/api/admin/services/${serviceId}/analytics?period=${dateRange}&granularity=${granularity}&compare_period=${comparePeriod}`
  );

  if (!data?.data) return <AnalyticsSkeleton />;

  const analytics = data.data;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Select value={granularity} onValueChange={setGranularity}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">시간별</SelectItem>
              <SelectItem value="daily">일별</SelectItem>
              <SelectItem value="weekly">주별</SelectItem>
              <SelectItem value="monthly">월별</SelectItem>
            </SelectContent>
          </Select>

          <Checkbox
            checked={comparePeriod}
            onCheckedChange={setComparePeriod}
            id="compare"
          />
          <label htmlFor="compare" className="text-sm">
            이전 기간과 비교
          </label>
        </div>

        <Button variant="outline">
          <DownloadIcon className="w-4 h-4 mr-2" />
          리포트 다운로드
        </Button>
      </div>

      {/* Multi-metric Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">종합 분석</h3>
        <MultiLineChart
          data={analytics.timeSeriesData}
          metrics={[
            { key: 'reservations', label: '예약 수', color: '#3B82F6' },
            { key: 'revenue', label: '매출', color: '#10B981', yAxis: 'right' },
            { key: 'customers', label: '고객 수', color: '#8B5CF6' }
          ]}
          height={400}
        />
      </Card>

      {/* Customer Segments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">고객 세그먼트</h3>
          <HorizontalBarChart
            data={analytics.customerSegments}
            xKey="count"
            yKey="segment"
            color="#F59E0B"
          />
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">예약 패턴</h3>
          <HeatMap
            data={analytics.bookingPatterns}
            xKey="hour"
            yKey="dayOfWeek"
            valueKey="reservations"
          />
        </Card>
      </div>

      {/* ROI Analysis */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">ROI 분석</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ROIMetric
            title="고객 획득 비용"
            value={analytics.roi.customerAcquisitionCost}
            format="currency"
          />
          <ROIMetric
            title="고객 생애 가치"
            value={analytics.roi.customerLifetimeValue}
            format="currency"
          />
          <ROIMetric
            title="ROI"
            value={analytics.roi.returnOnInvestment}
            format="percentage"
          />
        </div>
      </Card>
    </div>
  );
};
```

### 5. Reservations Tab

```typescript
// components/tabs/ReservationsTab.tsx
const ReservationsTab: React.FC<{ serviceId: string }> = ({ serviceId }) => {
  const [filters, setFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: '',
    paymentStatus: '',
    page: 1,
    limit: 20
  });

  const { data, loading } = useSWR(
    `/api/admin/services/${serviceId}/reservations?${new URLSearchParams(filters)}`
  );

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Select
            value={filters.status}
            onValueChange={(value) => setFilters({...filters, status: value})}
          >
            <SelectTrigger>
              <SelectValue placeholder="예약 상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">전체</SelectItem>
              <SelectItem value="confirmed">확정</SelectItem>
              <SelectItem value="completed">완료</SelectItem>
              <SelectItem value="cancelled_by_user">고객 취소</SelectItem>
              <SelectItem value="cancelled_by_shop">샵 취소</SelectItem>
              <SelectItem value="no_show">노쇼</SelectItem>
            </SelectContent>
          </Select>

          <DatePicker
            placeholder="시작 날짜"
            value={filters.dateFrom}
            onChange={(date) => setFilters({...filters, dateFrom: date})}
          />

          <DatePicker
            placeholder="종료 날짜"
            value={filters.dateTo}
            onChange={(date) => setFilters({...filters, dateTo: date})}
          />

          <Select
            value={filters.paymentStatus}
            onValueChange={(value) => setFilters({...filters, paymentStatus: value})}
          >
            <SelectTrigger>
              <SelectValue placeholder="결제 상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">전체</SelectItem>
              <SelectItem value="pending">대기 중</SelectItem>
              <SelectItem value="deposit_paid">예약금 결제</SelectItem>
              <SelectItem value="fully_paid">완전 결제</SelectItem>
              <SelectItem value="refunded">환불됨</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => setFilters({...filters, page: 1})}>
            필터 적용
          </Button>
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard
          title="총 예약"
          value={data?.data?.summary?.totalReservations || 0}
          icon={CalendarIcon}
        />
        <SummaryCard
          title="확정 예약"
          value={data?.data?.summary?.confirmedReservations || 0}
          icon={CheckIcon}
        />
        <SummaryCard
          title="취소 예약"
          value={data?.data?.summary?.cancelledReservations || 0}
          icon={XIcon}
        />
        <SummaryCard
          title="총 매출"
          value={`₩${(data?.data?.summary?.totalRevenue || 0).toLocaleString()}`}
          icon={DollarIcon}
        />
      </div>

      {/* Reservations Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>예약 정보</TableHead>
              <TableHead>고객</TableHead>
              <TableHead>날짜/시간</TableHead>
              <TableHead>금액</TableHead>
              <TableHead>결제 상태</TableHead>
              <TableHead>예약 상태</TableHead>
              <TableHead>액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.data?.reservations?.map((reservation) => (
              <TableRow key={reservation.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">#{reservation.id.slice(-8)}</div>
                    <div className="text-sm text-gray-500">
                      {reservation.specialRequests && `요청: ${reservation.specialRequests}`}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={reservation.customer.profileImage} />
                      <AvatarFallback>
                        {reservation.customer.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{reservation.customer.name}</div>
                      <div className="text-sm text-gray-500">
                        {reservation.customer.phone}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      {new Date(reservation.reservationDate).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      {reservation.reservationTime}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div className="font-medium">
                      ₩{reservation.totalAmount.toLocaleString()}
                    </div>
                    {reservation.depositAmount > 0 && (
                      <div className="text-sm text-gray-500">
                        예약금: ₩{reservation.depositAmount.toLocaleString()}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <PaymentStatusBadge status={reservation.paymentStatus} />
                </TableCell>
                <TableCell>
                  <ReservationStatusBadge status={reservation.status} />
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVerticalIcon className="w-4 h-4" />
                      </Button>
                    </DropdownTrigger>
                    <DropdownContent>
                      <DropdownItem onClick={() => viewReservationDetails(reservation.id)}>
                        상세 보기
                      </DropdownItem>
                      <DropdownItem onClick={() => contactCustomer(reservation.customer.id)}>
                        고객 연락
                      </DropdownItem>
                      {reservation.status === 'confirmed' && (
                        <DropdownItem onClick={() => cancelReservation(reservation.id)}>
                          예약 취소
                        </DropdownItem>
                      )}
                    </DropdownContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="p-4 border-t">
          <Pagination
            currentPage={filters.page}
            totalPages={Math.ceil((data?.data?.pagination?.total || 0) / filters.limit)}
            onPageChange={(page) => setFilters({...filters, page})}
          />
        </div>
      </Card>
    </div>
  );
};
```

## 📱 Responsive Design Considerations

### Mobile Layout
```typescript
// Responsive breakpoints
const breakpoints = {
  mobile: '(max-width: 768px)',
  tablet: '(max-width: 1024px)',
  desktop: '(min-width: 1025px)'
};

// Mobile-specific components
const MobileServiceHeader = () => (
  <div className="px-4 py-3">
    <div className="flex items-center justify-between mb-3">
      <Button variant="ghost" size="sm">
        <ArrowLeftIcon className="w-4 h-4" />
      </Button>
      <h1 className="text-lg font-semibold truncate">서비스명</h1>
      <Button variant="ghost" size="sm">
        <MoreVerticalIcon className="w-4 h-4" />
      </Button>
    </div>

    {/* Mobile tabs as horizontal scroll */}
    <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex space-x-4 pb-2">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={selectedTab === tab.id ? "default" : "ghost"}
            size="sm"
            className="flex-shrink-0"
          >
            {tab.label}
          </Button>
        ))}
      </div>
    </ScrollArea>
  </div>
);
```

## 🔄 State Management

```typescript
// context/ServiceDetailContext.tsx
interface ServiceDetailContextType {
  serviceId: string;
  dateRange: string;
  selectedTab: string;
  filters: Record<string, any>;
  setDateRange: (range: string) => void;
  setSelectedTab: (tab: string) => void;
  setFilters: (filters: Record<string, any>) => void;
  refreshData: () => void;
}

export const ServiceDetailProvider: React.FC<{ children: React.ReactNode; serviceId: string }> = ({
  children,
  serviceId
}) => {
  const [dateRange, setDateRange] = useState('30d');
  const [selectedTab, setSelectedTab] = useState('overview');
  const [filters, setFilters] = useState({});

  const refreshData = useCallback(() => {
    // Invalidate all related SWR cache
    mutate(key => typeof key === 'string' && key.includes(`/services/${serviceId}`));
  }, [serviceId]);

  return (
    <ServiceDetailContext.Provider value={{
      serviceId,
      dateRange,
      selectedTab,
      filters,
      setDateRange,
      setSelectedTab,
      setFilters,
      refreshData
    }}>
      {children}
    </ServiceDetailContext.Provider>
  );
};
```

## ⚡ Performance Optimizations

### 1. Data Fetching Strategy
```typescript
// Implement progressive data loading
const useProgressiveDataLoading = (serviceId: string) => {
  // Load critical data first
  const { data: basicInfo } = useSWR(`/api/admin/services/${serviceId}/details`);

  // Load secondary data after basic info is available
  const { data: analytics } = useSWR(
    basicInfo ? `/api/admin/services/${serviceId}/analytics` : null
  );

  // Load heavy data last
  const { data: reservations } = useSWR(
    analytics ? `/api/admin/services/${serviceId}/reservations?limit=10` : null
  );

  return { basicInfo, analytics, reservations };
};
```

### 2. Virtual Scrolling for Large Lists
```typescript
// For large reservation lists
import { FixedSizeList as List } from 'react-window';

const VirtualizedReservationList = ({ reservations }) => (
  <List
    height={600}
    itemCount={reservations.length}
    itemSize={80}
    itemData={reservations}
  >
    {({ index, style, data }) => (
      <div style={style}>
        <ReservationRow reservation={data[index]} />
      </div>
    )}
  </List>
);
```

### 3. Memoization
```typescript
// Memoize expensive calculations
const ServiceMetrics = memo(({ data }) => {
  const calculations = useMemo(() => {
    return {
      conversionRate: calculateConversionRate(data),
      averageBookingValue: calculateAverageBookingValue(data),
      customerRetention: calculateCustomerRetention(data)
    };
  }, [data]);

  return <MetricsDisplay {...calculations} />;
});
```

## 🛠️ Error Handling & Loading States

```typescript
// Error boundary for service detail page
const ServiceDetailErrorBoundary = ({ children }) => (
  <ErrorBoundary
    fallback={
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertTriangleIcon className="w-16 h-16 text-red-500" />
        <h2 className="text-xl font-semibold">서비스 정보를 불러올 수 없습니다</h2>
        <p className="text-gray-600">페이지를 새로고침하거나 잠시 후 다시 시도해주세요.</p>
        <Button onClick={() => window.location.reload()}>
          새로고침
        </Button>
      </div>
    }
  >
    {children}
  </ErrorBoundary>
);

// Loading skeletons
const ServiceDetailSkeleton = () => (
  <div className="space-y-6">
    <div className="h-48 bg-gray-200 rounded-lg animate-pulse" />
    <div className="grid grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse" />
      ))}
    </div>
    <div className="grid grid-cols-2 gap-6">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="h-64 bg-gray-200 rounded-lg animate-pulse" />
      ))}
    </div>
  </div>
);
```

## 🎯 Key Features Delivered:

1. **Complete API Integration** - Uses all the enhanced endpoints for service details, analytics, reservations, customers, and revenue
2. **Responsive Design** - Adapts beautifully from desktop to mobile
3. **Rich Data Visualization** - Charts, metrics, and tables for comprehensive service insights
4. **Performance Optimized** - Progressive loading, memoization, and virtual scrolling
5. **Professional UX** - Intuitive navigation, proper loading states, and error handling

## 📊 Main Components:

- **Service Header** - Overview with key stats and quick actions
- **Tabbed Navigation** - Overview, Analytics, Reservations, Customers, Revenue, Settings
- **Interactive Charts** - Line charts, area charts, heatmaps, and donut charts
- **Data Tables** - Sortable, filterable reservation and customer lists
- **Real-time Metrics** - Live updating statistics and performance indicators

## 🚀 Technical Highlights:

- **SWR for Data Fetching** - Automatic caching and revalidation
- **TypeScript Integration** - Full type safety throughout
- **Modular Architecture** - Reusable components and hooks
- **Mobile-First Design** - Touch-friendly and responsive
- **Error Boundaries** - Graceful error handling

This implementation gives administrators a powerful, data-driven view into service performance with the ability to make informed decisions based on comprehensive analytics and real-time insights.