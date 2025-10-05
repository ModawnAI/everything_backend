# 에뷰리띵 어드민 API 통합 명세서
## Admin API Integration Specification

**문서 버전**: v1.0
**작성일**: 2025-09-26
**연관 문서**: [admin-system-comprehensive-prd.md](./admin-system-comprehensive-prd.md)
**대상**: Frontend 개발팀, Backend 통합팀

---

## 📋 개요

이 문서는 에뷰리띵 어드민 시스템의 **프론트엔드와 기존 백엔드 API 간의 구체적인 통합 방법**을 제시합니다. 현재 백엔드에 구현된 12개의 admin API를 효과적으로 활용하여 어드민 대시보드를 구축하는 방법을 상세히 설명합니다.

---

## 🗂️ 기존 백엔드 API 현황

### 📊 구현된 Admin API 목록

| API 파일 | 크기 | 주요 기능 | 상태 |
|---------|------|----------|------|
| `admin-analytics.routes.ts` | 33KB | 비즈니스 분석, 대시보드 메트릭 | ✅ 구현완료 |
| `admin-moderation.routes.ts` | 37KB | 콘텐츠 조정, 사용자 제재 | ✅ 구현완료 |
| `admin-user-management.routes.ts` | 31KB | 사용자 관리, 검색, 필터링 | ✅ 구현완료 |
| `admin-payment.routes.ts` | 27KB | 결제 관리, 환불 처리 | ✅ 구현완료 |
| `admin-reservation.routes.ts` | 19KB | 예약 관리, 상태 업데이트 | ✅ 구현완료 |
| `admin-security-enhanced.routes.ts` | 16KB | 고급 보안 기능 | ✅ 구현완료 |
| `admin-security-events.routes.ts` | 17KB | 보안 이벤트 모니터링 | ✅ 구현완료 |
| `admin-shop-approval.routes.ts` | 14KB | 샵 승인 워크플로우 | ✅ 구현완료 |
| `admin-financial.routes.ts` | 11KB | 재무 관리, 정산 | ✅ 구현완료 |
| `admin-adjustment.routes.ts` | 7KB | 포인트/크레딧 조정 | ✅ 구현완료 |
| `admin-security.routes.ts` | 5KB | 기본 보안 기능 | ✅ 구현완료 |
| `admin-shop.routes.ts` | 5KB | 기본 샵 관리 | ✅ 구현완료 |

**총 242KB의 상세한 API 명세**가 이미 구현되어 있습니다! 🎉

---

## 🎯 Feature-to-API 매핑 매트릭스

### 🏠 슈퍼 어드민 대시보드

#### 📈 대시보드 개요 위젯
```typescript
// 실시간 지표 카드 구현
interface DashboardWidgets {
  // 1. 플랫폼 핵심 지표
  platformMetrics: {
    api: 'GET /api/admin/analytics/dashboard-overview',
    refresh: '30s',
    fallback: 'cached data'
  };

  // 2. 사용자 성장 지표
  userGrowth: {
    api: 'GET /api/admin/analytics/user-growth',
    params: { period: 'month', metrics: ['total', 'active', 'new'] },
    chart: 'line-chart'
  };

  // 3. 매출 지표
  revenue: {
    api: 'GET /api/admin/analytics/revenue-overview',
    params: { period: 'day', includeProjection: true },
    chart: 'revenue-chart'
  };

  // 4. 샵 현황
  shopStatus: {
    api: 'GET /api/admin/shops/approval',
    params: { status: 'pending_approval', limit: 5 },
    action: 'navigate-to-approval'
  };
}

// 실제 구현 예시
const DashboardOverview = () => {
  const { data: metrics } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => adminApi.get('/analytics/dashboard-overview'),
    refetchInterval: 30000 // 30초마다 갱신
  });

  const { data: pendingShops } = useQuery({
    queryKey: ['pending-shops'],
    queryFn: () => adminApi.get('/shops/approval?status=pending_approval&limit=5')
  });

  return (
    <Grid container spacing={3}>
      <MetricCard
        title="총 사용자"
        value={metrics?.totalUsers}
        trend={metrics?.userGrowthRate}
      />
      <MetricCard
        title="승인 대기 샵"
        value={pendingShops?.data?.totalCount}
        action={() => navigate('/admin/shops/approval')}
      />
    </Grid>
  );
};
```

#### 🔄 실시간 업데이트 시스템
```typescript
// WebSocket 연결 및 이벤트 처리
interface RealtimeEvents {
  'dashboard.metrics.updated': DashboardMetrics;
  'shop.registration.new': ShopRegistrationEvent;
  'user.status.changed': UserStatusEvent;
  'payment.failed': PaymentFailureEvent;
}

const useRealtimeDashboard = () => {
  const [socket, setSocket] = useState<Socket>();

  useEffect(() => {
    const ws = io('/admin-dashboard', {
      auth: { token: getAdminToken() },
      query: { adminRole: 'super_admin' }
    });

    ws.on('dashboard.metrics.updated', (metrics) => {
      queryClient.setQueryData(['dashboard-overview'], metrics);
    });

    ws.on('shop.registration.new', (shop) => {
      toast.info(`새로운 샵 등록: ${shop.name}`);
      queryClient.invalidateQueries(['pending-shops']);
    });

    setSocket(ws);
    return () => ws.close();
  }, []);
};
```

### 👥 사용자 관리 시스템

#### 🔍 고급 검색 및 필터링
```typescript
// 사용자 관리 페이지 API 통합
interface UserManagementAPI {
  // 기존 API 활용: GET /api/admin/users
  searchUsers: {
    endpoint: '/api/admin/users',
    params: UserSearchParams,
    features: [
      'advanced-search',    // name, email, phone_number 검색
      'multi-filtering',    // role, status, gender, isInfluencer
      'date-range',         // createdAt, lastLogin 범위
      'points-range',       // minPoints, maxPoints
      'referral-filter',    // hasReferrals
      'pagination',         // page, limit (max 100)
      'sorting'            // sortBy, sortOrder
    ]
  };
}

// 실제 구현
const UserManagement = () => {
  const [searchParams, setSearchParams] = useState<UserSearchParams>({
    page: 1,
    limit: 20,
    sortBy: 'created_at',
    sortOrder: 'desc'
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users', searchParams],
    queryFn: () => adminApi.get('/users', { params: searchParams }),
    keepPreviousData: true
  });

  return (
    <Box>
      {/* 고급 검색 패널 */}
      <UserSearchPanel
        onSearch={setSearchParams}
        currentParams={searchParams}
      />

      {/* 사용자 테이블 */}
      <DataTable
        data={users?.data?.users}
        columns={userColumns}
        totalCount={users?.data?.totalCount}
        pagination={searchParams}
        onPaginationChange={setSearchParams}
        loading={isLoading}
      />
    </Box>
  );
};
```

#### 👤 사용자 상세 프로필 및 액션
```typescript
// 사용자 상세 정보 API 통합
interface UserDetailAPI {
  // 다중 API 조합으로 완전한 사용자 프로필 구성
  getUserProfile: {
    primary: 'GET /api/admin/users/:id',
    secondary: [
      'GET /api/admin/users/:id/reservations',   // 예약 내역
      'GET /api/admin/users/:id/points-history', // 포인트 내역
      'GET /api/admin/users/:id/referrals',      // 추천인 트리
      'GET /api/admin/audit-trail?userId=:id'    // 활동 로그
    ]
  };

  // 사용자 액션
  updateUserStatus: 'PUT /api/admin/users/:id/status',
  adjustPoints: 'POST /api/admin/adjustment/points',
  sendNotification: 'POST /api/admin/users/:id/notify'
}

// 사용자 상세 모달 구현
const UserDetailModal = ({ userId, onClose }: Props) => {
  // 병렬 데이터 로딩
  const userQueries = useQueries({
    queries: [
      {
        queryKey: ['user-profile', userId],
        queryFn: () => adminApi.get(`/users/${userId}`)
      },
      {
        queryKey: ['user-reservations', userId],
        queryFn: () => adminApi.get(`/users/${userId}/reservations`)
      },
      {
        queryKey: ['user-points', userId],
        queryFn: () => adminApi.get(`/users/${userId}/points-history`)
      },
      {
        queryKey: ['user-referrals', userId],
        queryFn: () => adminApi.get(`/users/${userId}/referrals`)
      }
    ]
  });

  const [profile, reservations, points, referrals] = userQueries;

  const updateStatus = useMutation({
    mutationFn: (status: UserStatus) =>
      adminApi.put(`/users/${userId}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-users']);
      toast.success('사용자 상태가 업데이트되었습니다');
    }
  });

  return (
    <Modal open onClose={onClose} maxWidth="lg">
      <TabContext value={activeTab}>
        <TabList>
          <Tab label="기본 정보" value="profile" />
          <Tab label="예약 내역" value="reservations" />
          <Tab label="포인트 내역" value="points" />
          <Tab label="추천인 트리" value="referrals" />
        </TabList>

        <TabPanel value="profile">
          <UserProfileForm
            data={profile.data}
            onStatusUpdate={updateStatus.mutate}
          />
        </TabPanel>

        <TabPanel value="reservations">
          <UserReservationList data={reservations.data} />
        </TabPanel>

        {/* 기타 탭들... */}
      </TabContext>
    </Modal>
  );
};
```

### 🏪 샵 승인 시스템

#### 📋 승인 대기열 및 워크플로우
```typescript
// 샵 승인 API 통합 (기존 admin-shop-approval.routes.ts 활용)
interface ShopApprovalAPI {
  // 승인 대기열 조회
  getApprovalQueue: {
    endpoint: 'GET /api/admin/shops/approval',
    params: {
      status: 'pending_approval',
      verificationStatus: 'pending',
      sortBy: 'created_at',
      sortOrder: 'asc'
    },
    features: [
      'business-license-validation',
      'document-review',
      'owner-verification',
      'urgency-flagging'
    ]
  };

  // 개별 샵 승인/거절
  approveShop: 'POST /api/admin/shops/:id/approve',
  rejectShop: 'POST /api/admin/shops/:id/reject',

  // 벌크 액션
  bulkApprove: 'POST /api/admin/shops/bulk-approve',
  bulkReject: 'POST /api/admin/shops/bulk-reject'
}

// 샵 승인 대시보드 구현
const ShopApprovalDashboard = () => {
  const [selectedShops, setSelectedShops] = useState<string[]>([]);

  const { data: pendingShops } = useQuery({
    queryKey: ['pending-shop-approvals'],
    queryFn: () => adminApi.get('/shops/approval', {
      params: {
        status: 'pending_approval',
        verificationStatus: 'pending',
        sortBy: 'urgency,created_at',
        sortOrder: 'desc,asc'
      }
    }),
    refetchInterval: 60000 // 1분마다 갱신
  });

  const approveMutation = useMutation({
    mutationFn: ({ shopId, reason }: ApprovalAction) =>
      adminApi.post(`/shops/${shopId}/approve`, { reason }),
    onSuccess: (_, { shopId }) => {
      queryClient.invalidateQueries(['pending-shop-approvals']);
      toast.success('샵이 승인되었습니다');
      // 실시간 알림
      socket.emit('shop-approved', { shopId });
    }
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (shopIds: string[]) =>
      adminApi.post('/shops/bulk-approve', { shopIds }),
    onSuccess: () => {
      queryClient.invalidateQueries(['pending-shop-approvals']);
      setSelectedShops([]);
      toast.success(`${selectedShops.length}개 샵이 일괄 승인되었습니다`);
    }
  });

  return (
    <Box>
      {/* 승인 통계 카드 */}
      <Grid container spacing={2} mb={3}>
        <StatCard
          title="승인 대기"
          value={pendingShops?.data?.totalCount}
          color="warning"
        />
        <StatCard
          title="긴급 검토"
          value={pendingShops?.data?.shops?.filter(s => s.isUrgent).length}
          color="error"
        />
      </Grid>

      {/* 벌크 액션 툴바 */}
      {selectedShops.length > 0 && (
        <BulkActionToolbar>
          <Button
            variant="contained"
            color="success"
            onClick={() => bulkApproveMutation.mutate(selectedShops)}
          >
            선택된 {selectedShops.length}개 샵 승인
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => setBulkRejectModalOpen(true)}
          >
            선택된 샵 거절
          </Button>
        </BulkActionToolbar>
      )}

      {/* 승인 대기열 테이블 */}
      <DataTable
        data={pendingShops?.data?.shops}
        columns={shopApprovalColumns}
        selectable
        selectedRows={selectedShops}
        onSelectionChange={setSelectedShops}
        onRowClick={(shop) => setSelectedShop(shop)}
      />

      {/* 샵 상세 승인 모달 */}
      {selectedShop && (
        <ShopApprovalModal
          shop={selectedShop}
          onApprove={approveMutation.mutate}
          onReject={rejectMutation.mutate}
          onClose={() => setSelectedShop(null)}
        />
      )}
    </Box>
  );
};
```

### 📊 고급 분석 대시보드

#### 📈 비즈니스 인텔리전스 차트
```typescript
// 분석 API 통합 (기존 admin-analytics.routes.ts 활용)
interface AnalyticsAPI {
  // 대시보드 메트릭 (33KB API 활용)
  dashboardMetrics: 'GET /api/admin/analytics/dashboard-overview',
  userGrowth: 'GET /api/admin/analytics/user-growth',
  revenueAnalysis: 'GET /api/admin/analytics/revenue',
  shopPerformance: 'GET /api/admin/analytics/shop-performance',
  reservationTrends: 'GET /api/admin/analytics/reservation-trends',

  // 상세 분석
  cohortAnalysis: 'GET /api/admin/analytics/cohort',
  funnelAnalysis: 'GET /api/admin/analytics/funnel',
  geographicDistribution: 'GET /api/admin/analytics/geographic'
}

// 분석 대시보드 구현
const AnalyticsDashboard = () => {
  const [dateRange, setDateRange] = useState({
    startDate: subDays(new Date(), 30),
    endDate: new Date()
  });

  const analyticsQueries = useQueries({
    queries: [
      {
        queryKey: ['user-growth', dateRange],
        queryFn: () => adminApi.get('/analytics/user-growth', {
          params: dateRange
        })
      },
      {
        queryKey: ['revenue-analysis', dateRange],
        queryFn: () => adminApi.get('/analytics/revenue', {
          params: dateRange
        })
      },
      {
        queryKey: ['shop-performance', dateRange],
        queryFn: () => adminApi.get('/analytics/shop-performance', {
          params: dateRange
        })
      }
    ]
  });

  const [userGrowth, revenue, shopPerformance] = analyticsQueries;

  return (
    <Box>
      {/* 날짜 범위 선택 */}
      <DateRangePicker
        value={dateRange}
        onChange={setDateRange}
        maxDate={new Date()}
      />

      {/* 차트 그리드 */}
      <Grid container spacing={3}>
        {/* 사용자 성장 차트 */}
        <Grid item xs={12} md={6}>
          <ChartCard title="사용자 성장">
            <LineChart
              data={userGrowth.data?.chartData}
              xKey="date"
              yKey="totalUsers"
              loading={userGrowth.isLoading}
            />
          </ChartCard>
        </Grid>

        {/* 매출 분석 차트 */}
        <Grid item xs={12} md={6}>
          <ChartCard title="매출 분석">
            <AreaChart
              data={revenue.data?.chartData}
              xKey="date"
              yKey="revenue"
              loading={revenue.isLoading}
            />
          </ChartCard>
        </Grid>

        {/* 샵 성과 랭킹 */}
        <Grid item xs={12}>
          <ChartCard title="Top 샵 성과">
            <BarChart
              data={shopPerformance.data?.topShops}
              xKey="shopName"
              yKey="revenue"
              loading={shopPerformance.isLoading}
            />
          </ChartCard>
        </Grid>
      </Grid>

      {/* 상세 분석 섹션 */}
      <Accordion>
        <AccordionSummary>
          <Typography variant="h6">고급 분석</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <CohortAnalysisChart />
          <FunnelAnalysisChart />
          <GeographicHeatMap />
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};
```

---

## 🏪 샵 어드민 포털 API 통합

### 🏠 샵 대시보드

#### 📊 샵별 범위 제한 데이터 액세스
```typescript
// 샵 어드민은 자신의 샵 ID로 범위가 제한됨
interface ShopScopedAPI {
  // 인증 토큰에서 shopId 자동 추출
  authMiddleware: {
    extractShopId: 'JWT payload에서 shopId 추출',
    validateScope: '모든 API 호출에 shopId 필터 자동 적용',
    auditTrail: '샵 어드민 활동 로그 자동 기록'
  };

  // 샵 대시보드 메트릭 (범위 제한됨)
  shopDashboard: {
    endpoint: 'GET /api/admin/shops/:shopId/dashboard',
    autoScope: true, // JWT에서 shopId 자동 적용
    metrics: [
      'todayReservations',
      'weeklyRevenue',
      'customerReviews',
      'servicePopularity'
    ]
  };
}

// 샵 어드민 컨텍스트
const ShopAdminProvider = ({ children }: Props) => {
  const { shopId, permissions } = useShopAuth();

  // 모든 API 호출에 shopId 스코프 자동 적용
  const shopScopedApi = useMemo(() => {
    const api = axios.create({
      baseURL: '/api/admin/shop',
      headers: {
        Authorization: `Bearer ${getShopAdminToken()}`
      }
    });

    // 요청 인터셉터: shopId 자동 추가
    api.interceptors.request.use((config) => {
      if (config.url && !config.url.includes(':shopId')) {
        config.url = config.url.replace(/^\//, `/${shopId}/`);
      }
      return config;
    });

    return api;
  }, [shopId]);

  return (
    <ShopAdminContext.Provider value={{ shopId, permissions, api: shopScopedApi }}>
      {children}
    </ShopAdminContext.Provider>
  );
};

// 샵 대시보드 구현
const ShopDashboard = () => {
  const { shopScopedApi } = useShopAdmin();

  const { data: dashboardData } = useQuery({
    queryKey: ['shop-dashboard'],
    queryFn: () => shopScopedApi.get('/dashboard'), // 자동으로 /shopId/dashboard가 됨
    refetchInterval: 60000
  });

  return (
    <Grid container spacing={3}>
      {/* 오늘의 예약 */}
      <Grid item xs={12} md={3}>
        <MetricCard
          title="오늘 예약"
          value={dashboardData?.todayReservations}
          icon={<CalendarIcon />}
          trend={dashboardData?.reservationTrend}
        />
      </Grid>

      {/* 이번 주 매출 */}
      <Grid item xs={12} md={3}>
        <MetricCard
          title="이번 주 매출"
          value={dashboardData?.weeklyRevenue}
          icon={<RevenueIcon />}
          format="currency"
          trend={dashboardData?.revenueTrend}
        />
      </Grid>

      {/* 고객 리뷰 평점 */}
      <Grid item xs={12} md={3}>
        <MetricCard
          title="평균 평점"
          value={dashboardData?.averageRating}
          icon={<StarIcon />}
          format="rating"
        />
      </Grid>

      {/* 서비스 인기도 */}
      <Grid item xs={12} md={3}>
        <MetricCard
          title="인기 서비스"
          value={dashboardData?.topService?.name}
          subtitle={`${dashboardData?.topService?.bookingCount}회 예약`}
          icon={<ServiceIcon />}
        />
      </Grid>
    </Grid>
  );
};
```

### 📅 예약 관리 시스템

#### 📋 실시간 예약 현황
```typescript
// 샵별 예약 관리 API
interface ShopReservationAPI {
  // 샵 예약 목록 (범위 제한)
  getReservations: {
    endpoint: 'GET /api/admin/reservations',
    autoFilter: { shopId: 'from-jwt' },
    params: {
      date: 'YYYY-MM-DD',
      status: 'confirmed' | 'pending' | 'completed' | 'cancelled',
      staffId: 'optional',
      serviceId: 'optional'
    }
  };

  // 예약 상태 업데이트
  updateStatus: 'PUT /api/admin/reservations/:id/status',

  // 예약 일정 변경
  reschedule: 'PUT /api/admin/reservations/:id/reschedule',

  // 고객 메시지 발송
  sendMessage: 'POST /api/admin/reservations/:id/message'
}

// 예약 관리 캘린더 구현
const ReservationCalendar = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const { shopScopedApi } = useShopAdmin();

  const { data: reservations } = useQuery({
    queryKey: ['shop-reservations', selectedDate, viewMode],
    queryFn: () => shopScopedApi.get('/reservations', {
      params: {
        date: format(selectedDate, 'yyyy-MM-dd'),
        period: viewMode
      }
    }),
    refetchInterval: 30000 // 30초마다 갱신
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ reservationId, status, reason }: UpdateStatusParams) =>
      shopScopedApi.put(`/reservations/${reservationId}/status`, { status, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries(['shop-reservations']);
      toast.success('예약 상태가 업데이트되었습니다');
    }
  });

  // WebSocket으로 실시간 예약 업데이트 수신
  useEffect(() => {
    const socket = io('/shop-admin', {
      auth: { token: getShopAdminToken() }
    });

    socket.on('reservation.created', (reservation) => {
      queryClient.invalidateQueries(['shop-reservations']);
      toast.info(`새로운 예약이 접수되었습니다: ${reservation.customerName}`);
    });

    socket.on('reservation.cancelled', (reservation) => {
      queryClient.invalidateQueries(['shop-reservations']);
      toast.warning(`예약이 취소되었습니다: ${reservation.customerName}`);
    });

    return () => socket.close();
  }, []);

  return (
    <Box>
      {/* 캘린더 헤더 */}
      <CalendarHeader
        date={selectedDate}
        onDateChange={setSelectedDate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* 예약 캘린더 */}
      {viewMode === 'day' ? (
        <DayView
          date={selectedDate}
          reservations={reservations?.data}
          onStatusUpdate={updateStatusMutation.mutate}
          onReschedule={(id, newDate) => rescheduleReservation(id, newDate)}
        />
      ) : (
        <WeekView
          startDate={selectedDate}
          reservations={reservations?.data}
          onStatusUpdate={updateStatusMutation.mutate}
        />
      )}

      {/* 예약 상세 사이드바 */}
      {selectedReservation && (
        <ReservationDetailSidebar
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
          onUpdate={updateStatusMutation.mutate}
        />
      )}
    </Box>
  );
};
```

---

## 🔐 인증/권한 매트릭스

### 🎯 상세 권한 매핑

| API 엔드포인트 | Super Admin | Shop Admin | 추가 검증 |
|---------------|-------------|------------|-----------|
| **사용자 관리** |
| `GET /admin/users` | ✅ 전체 | ❌ | IP 제한 |
| `PUT /admin/users/:id/status` | ✅ | ❌ | MFA 필수 |
| `POST /admin/users/bulk-action` | ✅ | ❌ | 승인 필요 |
| **샵 관리** |
| `GET /admin/shops` | ✅ 전체 | ✅ 자신만 | shopId 스코프 |
| `POST /admin/shops/:id/approve` | ✅ | ❌ | 감사 로그 |
| `PUT /admin/shops/:id` | ✅ | ✅ 자신만 | 변경 승인 |
| **예약 관리** |
| `GET /admin/reservations` | ✅ 전체 | ✅ shopId 필터 | 자동 스코프 |
| `PUT /admin/reservations/:id/status` | ✅ | ✅ 자신 샵만 | 상태 검증 |
| **결제 관리** |
| `GET /admin/payments` | ✅ 전체 | ✅ shopId 필터 | 금액 마스킹 |
| `POST /admin/payments/:id/refund` | ✅ | ❌ | 한도 제한 |
| **분석/리포트** |
| `GET /admin/analytics/*` | ✅ 전체 | ✅ 샵별만 | 데이터 익명화 |
| **시스템 관리** |
| `GET /admin/security/*` | ✅ | ❌ | 높은 보안 |
| `POST /admin/moderation/*` | ✅ | ❌ | 승인 워크플로우 |

### 🔒 권한 검증 미들웨어

```typescript
// JWT 토큰 스키마
interface AdminJWT {
  adminId: string;
  role: 'super_admin' | 'shop_admin';
  shopId?: string; // shop_admin만 필수
  permissions: string[];
  exp: number;
  iat: number;
}

// 권한 검증 미들웨어
const createAuthMiddleware = () => {
  return {
    // Super Admin만 접근 가능
    requireSuperAdmin: (req: Request, res: Response, next: NextFunction) => {
      const token = extractJWT(req);
      if (token.role !== 'super_admin') {
        return res.status(403).json({ error: 'Super Admin 권한이 필요합니다' });
      }
      next();
    },

    // Shop Admin 스코프 적용
    applyShopScope: (req: Request, res: Response, next: NextFunction) => {
      const token = extractJWT(req);
      if (token.role === 'shop_admin') {
        // 모든 쿼리에 shopId 필터 자동 적용
        req.query.shopId = token.shopId;
        req.scopedShopId = token.shopId;
      }
      next();
    },

    // 권한별 데이터 필터링
    filterByPermission: (resource: string) => (req: Request, res: Response, next: NextFunction) => {
      const token = extractJWT(req);

      if (token.role === 'shop_admin') {
        // Shop Admin은 자신의 샵 데이터만 접근
        req.dataFilters = {
          shopId: token.shopId,
          anonymize: ['customerEmail', 'customerPhone'], // PII 마스킹
          exclude: ['adminNotes', 'internalComments']     // 내부 정보 제외
        };
      }

      next();
    }
  };
};

// 프론트엔드 권한 확인 훅
const useAdminAuth = () => {
  const [token, setToken] = useState<AdminJWT | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem('adminToken');
    if (storedToken) {
      const decoded = jwt.decode(storedToken) as AdminJWT;
      setToken(decoded);
    }
  }, []);

  const hasPermission = (permission: string): boolean => {
    return token?.permissions.includes(permission) ?? false;
  };

  const isSuperAdmin = (): boolean => {
    return token?.role === 'super_admin';
  };

  const isShopAdmin = (): boolean => {
    return token?.role === 'shop_admin';
  };

  const getShopId = (): string | null => {
    return token?.shopId ?? null;
  };

  return {
    token,
    hasPermission,
    isSuperAdmin,
    isShopAdmin,
    getShopId,
    logout: () => {
      localStorage.removeItem('adminToken');
      setToken(null);
    }
  };
};
```

---

## 🌐 실시간 시스템 이벤트 명세

### 📡 WebSocket 이벤트 스키마

#### 🏠 슈퍼 어드민 이벤트
```typescript
// 슈퍼 어드민 전용 실시간 이벤트
interface SuperAdminEvents {
  // 플랫폼 전반 이벤트
  'platform.metrics.updated': {
    totalUsers: number;
    activeUsers: number;
    totalShops: number;
    dailyRevenue: number;
    timestamp: string;
  };

  // 샵 관리 이벤트
  'shop.registration.new': {
    shopId: string;
    shopName: string;
    ownerName: string;
    category: string;
    submittedAt: string;
    urgency: 'low' | 'medium' | 'high';
    businessLicense: boolean;
  };

  'shop.status.changed': {
    shopId: string;
    shopName: string;
    oldStatus: string;
    newStatus: string;
    changedBy: string;
    reason?: string;
  };

  // 사용자 관리 이벤트
  'user.registration.new': {
    userId: string;
    userName: string;
    email: string;
    socialProvider: string;
    referralCode?: string;
    registeredAt: string;
  };

  'user.status.critical': {
    userId: string;
    userName: string;
    issue: 'suspended' | 'payment_failed' | 'fraud_detected';
    severity: 'medium' | 'high' | 'critical';
    details: Record<string, any>;
  };

  // 시스템 알림
  'system.alert.critical': {
    alertId: string;
    type: 'database' | 'api' | 'payment' | 'security';
    message: string;
    severity: 'warning' | 'error' | 'critical';
    metadata: Record<string, any>;
    timestamp: string;
  };

  // 결제 시스템 이벤트
  'payment.failure.detected': {
    paymentId: string;
    userId: string;
    shopId: string;
    amount: number;
    failureReason: string;
    retryCount: number;
    timestamp: string;
  };

  // 보안 이벤트
  'security.suspicious.activity': {
    userId?: string;
    ipAddress: string;
    activityType: 'multiple_login_attempts' | 'unusual_access_pattern' | 'data_scraping';
    riskLevel: 'low' | 'medium' | 'high';
    details: Record<string, any>;
  };
}

// 슈퍼 어드민 WebSocket 연결
const useSuperAdminWebSocket = () => {
  const [socket, setSocket] = useState<Socket>();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const ws = io('/admin/super', {
      auth: { token: getAdminToken() },
      query: { role: 'super_admin' }
    });

    // 플랫폼 메트릭 실시간 업데이트
    ws.on('platform.metrics.updated', (metrics) => {
      queryClient.setQueryData(['dashboard-overview'], (old) => ({
        ...old,
        ...metrics
      }));
    });

    // 신규 샵 등록 알림
    ws.on('shop.registration.new', (shop) => {
      addNotification({
        type: 'info',
        title: '신규 샵 등록',
        message: `${shop.shopName}이 승인을 요청했습니다`,
        action: () => navigate(`/admin/shops/approval?highlight=${shop.shopId}`)
      });

      // 승인 대기열 업데이트
      queryClient.invalidateQueries(['pending-shop-approvals']);
    });

    // 중요한 사용자 이슈
    ws.on('user.status.critical', (user) => {
      addNotification({
        type: 'error',
        title: '사용자 이슈 발생',
        message: `${user.userName}: ${user.issue}`,
        priority: 'high',
        action: () => navigate(`/admin/users/${user.userId}`)
      });
    });

    // 시스템 크리티컬 알림
    ws.on('system.alert.critical', (alert) => {
      addNotification({
        type: 'error',
        title: 'System Alert',
        message: alert.message,
        priority: 'critical',
        persistent: true // 수동으로 닫기 전까지 유지
      });
    });

    setSocket(ws);
    return () => ws.close();
  }, []);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date().toISOString()
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 49)]); // 최대 50개 유지

    // 브라우저 알림 (권한이 있는 경우)
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/admin-icon.png'
      });
    }
  };

  return { socket, notifications, addNotification };
};
```

#### 🏪 샵 어드민 이벤트
```typescript
// 샵 어드민 전용 실시간 이벤트 (shopId로 필터링됨)
interface ShopAdminEvents {
  // 예약 관련 이벤트
  'reservation.created': {
    reservationId: string;
    customerName: string;
    customerPhone: string;
    serviceName: string;
    scheduledAt: string;
    amount: number;
    status: 'pending';
  };

  'reservation.cancelled': {
    reservationId: string;
    customerName: string;
    serviceName: string;
    scheduledAt: string;
    cancellationReason: string;
    refundAmount?: number;
  };

  'reservation.rescheduled': {
    reservationId: string;
    customerName: string;
    oldDateTime: string;
    newDateTime: string;
    reason?: string;
  };

  // 고객 소통 이벤트
  'customer.message.received': {
    messageId: string;
    customerId: string;
    customerName: string;
    message: string;
    urgency: 'low' | 'medium' | 'high';
    timestamp: string;
  };

  'review.posted': {
    reviewId: string;
    customerId: string;
    customerName: string;
    rating: number;
    comment: string;
    serviceName: string;
    isPublic: boolean;
  };

  // 결제 이벤트
  'payment.completed': {
    paymentId: string;
    reservationId: string;
    amount: number;
    method: string;
    timestamp: string;
  };

  'payment.failed': {
    paymentId: string;
    reservationId: string;
    amount: number;
    failureReason: string;
    customerNotified: boolean;
  };

  // 샵 상태 이벤트
  'shop.settings.updated': {
    updatedBy: 'admin' | 'owner';
    changes: Record<string, { old: any; new: any }>;
    reason?: string;
  };

  'shop.promotion.activated': {
    promotionId: string;
    promotionName: string;
    discount: number;
    validUntil: string;
  };
}

// 샵 어드민 WebSocket 연결
const useShopAdminWebSocket = () => {
  const { shopId } = useShopAdmin();
  const [socket, setSocket] = useState<Socket>();

  useEffect(() => {
    const ws = io('/admin/shop', {
      auth: { token: getShopAdminToken() },
      query: { role: 'shop_admin', shopId }
    });

    // 신규 예약 알림
    ws.on('reservation.created', (reservation) => {
      toast.success(`새로운 예약: ${reservation.customerName}`);

      // 예약 캘린더 업데이트
      queryClient.invalidateQueries(['shop-reservations']);

      // 대시보드 메트릭 업데이트
      queryClient.invalidateQueries(['shop-dashboard']);
    });

    // 예약 취소 알림
    ws.on('reservation.cancelled', (reservation) => {
      toast.warning(`예약 취소: ${reservation.customerName} - ${reservation.serviceName}`);
      queryClient.invalidateQueries(['shop-reservations']);
    });

    // 고객 메시지 수신
    ws.on('customer.message.received', (message) => {
      toast.info(`새 메시지: ${message.customerName}`);

      // 메시지 카운터 업데이트
      queryClient.setQueryData(['unread-messages'], (old: number = 0) => old + 1);

      // 긴급 메시지인 경우 브라우저 알림
      if (message.urgency === 'high' && Notification.permission === 'granted') {
        new Notification('긴급 고객 메시지', {
          body: `${message.customerName}: ${message.message.substring(0, 50)}...`,
          icon: '/shop-icon.png'
        });
      }
    });

    // 리뷰 등록 알림
    ws.on('review.posted', (review) => {
      const message = review.rating >= 4
        ? `새 리뷰 (⭐${review.rating}): ${review.customerName}`
        : `새 리뷰 (⭐${review.rating}): 확인 필요 - ${review.customerName}`;

      toast.info(message);
      queryClient.invalidateQueries(['shop-reviews']);
      queryClient.invalidateQueries(['shop-dashboard']); // 평점 업데이트
    });

    // 결제 완료 알림
    ws.on('payment.completed', (payment) => {
      toast.success(`결제 완료: ${payment.amount.toLocaleString()}원`);
      queryClient.invalidateQueries(['shop-dashboard']);
      queryClient.invalidateQueries(['shop-payments']);
    });

    setSocket(ws);
    return () => ws.close();
  }, [shopId]);

  return { socket };
};
```

---

## 🔧 에러 처리 및 사용자 경험 가이드

### ⚠️ API 에러 처리 전략

#### 📡 HTTP 에러 코드 매핑
```typescript
// 에러 처리 표준화
interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  userMessage?: string; // 사용자에게 표시할 메시지
  recovery?: 'retry' | 'refresh' | 'navigate' | 'contact_support';
}

const errorHandling = {
  // 인증/권한 에러
  401: {
    code: 'UNAUTHORIZED',
    userMessage: '로그인이 만료되었습니다. 다시 로그인해주세요.',
    recovery: 'navigate' as const,
    action: () => navigate('/admin/login')
  },

  403: {
    code: 'FORBIDDEN',
    userMessage: '접근 권한이 없습니다.',
    recovery: 'contact_support' as const
  },

  // 요청 에러
  400: {
    code: 'BAD_REQUEST',
    userMessage: '잘못된 요청입니다. 입력 내용을 확인해주세요.',
    recovery: 'retry' as const
  },

  422: {
    code: 'VALIDATION_ERROR',
    userMessage: '입력 정보가 올바르지 않습니다.',
    recovery: 'retry' as const,
    showDetails: true // 상세 검증 오류 표시
  },

  // 서버 에러
  429: {
    code: 'RATE_LIMIT_EXCEEDED',
    userMessage: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    recovery: 'retry' as const,
    retryAfter: 60000 // 1분 후 재시도
  },

  500: {
    code: 'INTERNAL_SERVER_ERROR',
    userMessage: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    recovery: 'refresh' as const
  },

  503: {
    code: 'SERVICE_UNAVAILABLE',
    userMessage: '서비스가 일시적으로 사용할 수 없습니다.',
    recovery: 'refresh' as const
  }
};

// 글로벌 에러 처리기
const useGlobalErrorHandler = () => {
  const queryClient = useQueryClient();

  const handleAPIError = useCallback((error: AxiosError) => {
    const status = error.response?.status;
    const errorData = error.response?.data as APIError;
    const errorConfig = errorHandling[status as keyof typeof errorHandling];

    if (!errorConfig) {
      toast.error('알 수 없는 오류가 발생했습니다.');
      return;
    }

    // 사용자 친화적 메시지 표시
    const userMessage = errorData?.userMessage || errorConfig.userMessage;
    toast.error(userMessage);

    // 상세 검증 오류 표시
    if (errorConfig.showDetails && errorData?.details) {
      Object.entries(errorData.details).forEach(([field, message]) => {
        toast.error(`${field}: ${message}`);
      });
    }

    // 복구 액션 실행
    switch (errorConfig.recovery) {
      case 'retry':
        // 자동 재시도는 React Query가 처리
        break;

      case 'refresh':
        setTimeout(() => window.location.reload(), 2000);
        break;

      case 'navigate':
        if (errorConfig.action) {
          setTimeout(errorConfig.action, 1000);
        }
        break;

      case 'contact_support':
        // 지원 팀 연락 모달 또는 페이지로 이동
        openSupportModal();
        break;
    }

    // 인증 오류 시 쿼리 캐시 클리어
    if (status === 401) {
      queryClient.clear();
      localStorage.removeItem('adminToken');
    }

  }, [queryClient]);

  // Axios 인터셉터에 에러 핸들러 등록
  useEffect(() => {
    const interceptor = adminApi.interceptors.response.use(
      (response) => response,
      (error) => {
        handleAPIError(error);
        return Promise.reject(error);
      }
    );

    return () => adminApi.interceptors.response.eject(interceptor);
  }, [handleAPIError]);

  return { handleAPIError };
};
```

#### 🔄 로딩 상태 및 스켈레톤 UI

```typescript
// 로딩 상태 표준화
const LoadingStates = {
  // 대시보드 스켈레톤
  DashboardSkeleton: () => (
    <Grid container spacing={3}>
      {[1, 2, 3, 4].map((item) => (
        <Grid item xs={12} md={3} key={item}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="text" width="60%" height={32} />
              <Skeleton variant="text" width="30%" />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  ),

  // 테이블 스켈레톤
  TableSkeleton: ({ rows = 5, columns = 6 }) => (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            {Array.from({ length: columns }).map((_, i) => (
              <TableCell key={i}>
                <Skeleton variant="text" />
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: columns }).map((_, j) => (
                <TableCell key={j}>
                  <Skeleton variant="text" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  ),

  // 차트 스켈레톤
  ChartSkeleton: () => (
    <Card>
      <CardHeader>
        <Skeleton variant="text" width="30%" />
      </CardHeader>
      <CardContent>
        <Skeleton variant="rectangular" height={300} />
      </CardContent>
    </Card>
  )
};

// 로딩 상태 훅
const useLoadingState = () => {
  const [globalLoading, setGlobalLoading] = useState(false);
  const [loadingOperations, setLoadingOperations] = useState<Set<string>>(new Set());

  const startLoading = (operation: string) => {
    setLoadingOperations(prev => new Set([...prev, operation]));
    setGlobalLoading(true);
  };

  const stopLoading = (operation: string) => {
    setLoadingOperations(prev => {
      const next = new Set(prev);
      next.delete(operation);
      setGlobalLoading(next.size > 0);
      return next;
    });
  };

  return {
    globalLoading,
    loadingOperations,
    startLoading,
    stopLoading,
    isLoading: (operation: string) => loadingOperations.has(operation)
  };
};
```

---

## 🚀 성능 최적화 가이드

### ⚡ API 호출 최적화

```typescript
// React Query 설정 최적화
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 캐싱 전략
      staleTime: 5 * 60 * 1000, // 5분 동안 fresh 상태 유지
      cacheTime: 30 * 60 * 1000, // 30분 동안 캐시 보관

      // 에러 처리
      retry: (failureCount, error) => {
        // 클라이언트 에러는 재시도 하지 않음
        if (error.response?.status >= 400 && error.response?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },

      // 백그라운드 리페치 비활성화 (성능 개선)
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true
    },

    mutations: {
      // 뮤테이션 성공 시 관련 쿼리 무효화
      onSuccess: (data, variables, context) => {
        // 낙관적 업데이트 롤백 방지
        if (context?.optimisticUpdate) {
          return;
        }
      }
    }
  }
});

// 배치 API 호출
const useBatchQueries = (queryConfigs: QueryConfig[]) => {
  return useQueries({
    queries: queryConfigs.map(config => ({
      ...config,
      // 병렬 실행 최적화
      enabled: true,
      suspense: false
    }))
  });
};

// 무한 스크롤 최적화
const useInfiniteAdminData = <T>(
  endpoint: string,
  params: Record<string, any> = {}
) => {
  return useInfiniteQuery({
    queryKey: [endpoint, params],
    queryFn: ({ pageParam = 1 }) =>
      adminApi.get(endpoint, {
        params: { ...params, page: pageParam, limit: 50 }
      }),
    getNextPageParam: (lastPage) => {
      const { currentPage, totalPages } = lastPage.data;
      return currentPage < totalPages ? currentPage + 1 : undefined;
    },
    // 성능 최적화
    staleTime: 2 * 60 * 1000, // 2분
    cacheTime: 10 * 60 * 1000 // 10분
  });
};
```

---

## 📖 개발팀 온보딩 가이드

### 🎯 프로젝트 시작 체크리스트

#### ✅ Phase 1 개발 시작 전 확인사항

```markdown
## 환경 설정
- [ ] Node.js 18+ 설치 확인
- [ ] 백엔드 서버 로컬 실행 (http://localhost:3001)
- [ ] 기존 12개 admin API 엔드포인트 테스트
- [ ] Supabase 데이터베이스 연결 확인
- [ ] Redis 서버 실행 확인

## API 테스트
- [ ] GET /api/admin/users 응답 확인
- [ ] GET /api/admin/shops/approval 응답 확인
- [ ] GET /api/admin/analytics/dashboard-overview 응답 확인
- [ ] JWT 토큰 생성 및 인증 테스트

## 프론트엔드 설정
- [ ] Next.js 13+ 프로젝트 생성
- [ ] TypeScript 설정 완료
- [ ] Material-UI 또는 Ant Design 설치
- [ ] React Query 설정 완료
- [ ] Socket.io 클라이언트 설정

## 개발 도구
- [ ] ESLint + Prettier 설정
- [ ] VS Code 확장 프로그램 설치
- [ ] API 테스트 도구 (Postman/Thunder Client)
- [ ] 브라우저 개발자 도구 Redux DevTools
```

#### 🎓 주요 개발 패턴

```typescript
// 1. API 호출 표준 패턴
const useAdminData = <T>(endpoint: string, params?: any) => {
  return useQuery({
    queryKey: [endpoint, params],
    queryFn: () => adminApi.get(endpoint, { params }),
    // 에러 바운더리와 함께 사용
    useErrorBoundary: true
  });
};

// 2. 뮤테이션 표준 패턴
const useAdminMutation = <T, V>(
  endpoint: string,
  method: 'POST' | 'PUT' | 'DELETE' = 'POST'
) => {
  return useMutation({
    mutationFn: (data: V) => adminApi[method.toLowerCase()](endpoint, data),
    onSuccess: () => {
      // 성공 토스트
      toast.success('작업이 완료되었습니다');
      // 관련 쿼리 무효화
      queryClient.invalidateQueries([endpoint.split('/')[0]]);
    },
    onError: (error) => {
      // 에러는 글로벌 핸들러가 처리
      console.error('Mutation error:', error);
    }
  });
};

// 3. 컴포넌트 작성 패턴
const AdminComponent = () => {
  // 1. 상태 정의
  const [filters, setFilters] = useState({});

  // 2. API 호출
  const { data, isLoading, error } = useAdminData('/users', filters);

  // 3. 뮤테이션
  const updateUser = useAdminMutation('/users', 'PUT');

  // 4. 이벤트 핸들러
  const handleUpdate = useCallback((userId: string, data: any) => {
    updateUser.mutate({ userId, ...data });
  }, [updateUser]);

  // 5. 조기 반환 (에러/로딩)
  if (error) return <ErrorComponent error={error} />;
  if (isLoading) return <LoadingSkeleton />;

  // 6. 메인 렌더링
  return (
    <Container>
      <FilterPanel onFilterChange={setFilters} />
      <DataTable data={data?.users} onUpdate={handleUpdate} />
    </Container>
  );
};
```

---

## 🎉 결론

이 API 통합 명세서를 통해 개발팀은:

### ✅ **즉시 시작 가능**
- 기존 12개 admin API의 정확한 활용 방법
- 프론트엔드-백엔드 통합 시나리오
- 구체적인 코드 예시와 패턴

### 🔧 **효율적인 개발**
- Feature-to-API 매핑으로 혼선 제거
- 표준화된 에러 처리 및 로딩 상태
- 성능 최적화 가이드라인

### 🛡️ **안정적인 시스템**
- 상세한 권한 매트릭스
- 실시간 이벤트 스키마
- 포괄적인 에러 복구 전략

### 🚀 **확장 가능한 아키텍처**
- React Query 기반 상태 관리
- WebSocket 실시간 업데이트
- 모듈화된 컴포넌트 구조

**기존의 훌륭한 백엔드 인프라를 최대한 활용하여 현대적이고 효율적인 어드민 시스템을 구축할 수 있습니다!** 🎯💻✨