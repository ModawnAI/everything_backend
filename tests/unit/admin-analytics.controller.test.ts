import request from 'supertest';
import express from 'express';
import AdminAnalyticsController from '../../src/controllers/admin-analytics.controller';

// Mock the AdminAnalyticsService
const mockAnalyticsService = {
  getDashboardMetrics: jest.fn(),
  getRealTimeMetrics: jest.fn(),
  exportAnalytics: jest.fn(),
  getCacheStats: jest.fn(),
  clearCache: jest.fn()
};

jest.mock('../../src/services/admin-analytics.service', () => ({
  AdminAnalyticsService: jest.fn().mockImplementation(() => mockAnalyticsService)
}));

// Mock middleware
jest.mock('../../src/middleware/auth.middleware', () => ({
  authenticateJWT: jest.fn((req, res, next) => {
    req.user = { id: 'admin-123', role: 'admin' };
    next();
  }),
  requireRole: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../../src/middleware/rate-limit.middleware', () => ({
  rateLimit: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

// Import after mocks
import { authenticateJWT, requireRole } from '../../src/middleware/auth.middleware';
import { rateLimit } from '../../src/middleware/rate-limit.middleware';

describe('AdminAnalyticsController', () => {
  let app: express.Application;
  let adminAnalyticsController: AdminAnalyticsController;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create Express app
    app = express();
    app.use(express.json());
    
    // Create controller instance
    adminAnalyticsController = new AdminAnalyticsController();
    
    // Bind controller methods to maintain 'this' context
    app.get('/api/admin/analytics/dashboard',
      authenticateJWT,
      requireRole('admin'),
      rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
      adminAnalyticsController.getDashboardMetrics.bind(adminAnalyticsController)
    );

    app.get('/api/admin/analytics/realtime',
      authenticateJWT,
      requireRole('admin'),
      rateLimit({ config: { windowMs: 5 * 60 * 1000, max: 200 } }),
      adminAnalyticsController.getRealTimeMetrics.bind(adminAnalyticsController)
    );

    app.get('/api/admin/analytics/export',
      authenticateJWT,
      requireRole('admin'),
      rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 20 } }),
      adminAnalyticsController.exportAnalytics.bind(adminAnalyticsController)
    );

    app.get('/api/admin/analytics/cache/stats',
      authenticateJWT,
      requireRole('admin'),
      rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 50 } }),
      adminAnalyticsController.getCacheStats.bind(adminAnalyticsController)
    );

    app.post('/api/admin/analytics/cache/clear',
      authenticateJWT,
      requireRole('admin'),
      rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 10 } }),
      adminAnalyticsController.clearCache.bind(adminAnalyticsController)
    );

    app.get('/api/admin/analytics/health',
      authenticateJWT,
      requireRole('admin'),
      rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
      adminAnalyticsController.getAnalyticsHealth.bind(adminAnalyticsController)
    );
  });

  describe('GET /api/admin/analytics/dashboard', () => {
    it('should return dashboard metrics successfully', async () => {
      const mockMetrics = {
        userGrowth: {
          totalUsers: 1000,
          activeUsers: 800,
          newUsersThisMonth: 50,
          userGrowthRate: 5.2
        },
        revenue: {
          totalRevenue: 50000,
          revenueThisMonth: 5000,
          averageOrderValue: 100
        },
        reservations: {
          totalReservations: 500,
          completedReservations: 450,
          reservationSuccessRate: 90
        },
        payments: {
          totalTransactions: 500,
          successfulTransactions: 480,
          conversionRate: 96
        },
        lastUpdated: new Date().toISOString()
      };

      mockAnalyticsService.getDashboardMetrics.mockResolvedValue(mockMetrics);

      const response = await request(app)
        .get('/api/admin/analytics/dashboard')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          period: 'month'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('대시보드 메트릭을 성공적으로 조회했습니다.');
      expect(response.body.data).toEqual(mockMetrics);
      expect(mockAnalyticsService.getDashboardMetrics).toHaveBeenCalledWith('admin-123', {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        period: 'month',
        category: undefined,
        shopId: undefined,
        userId: undefined,
        includeCache: true
      });
    });

    it('should handle service errors gracefully', async () => {
      const errorMessage = 'Database connection failed';
      mockAnalyticsService.getDashboardMetrics.mockRejectedValue(new Error(errorMessage));

      const response = await request(app)
        .get('/api/admin/analytics/dashboard')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DASHBOARD_METRICS_ERROR');
      expect(response.body.error.message).toBe('대시보드 메트릭 조회 중 오류가 발생했습니다.');
      expect(response.body.error.details).toBe(errorMessage);
    });

    it('should return 401 when user is not authenticated', async () => {
      // Mock authenticateJWT to not set user
      jest.mocked(authenticateJWT).mockImplementationOnce(() => (req, res, next) => {
        req.user = undefined;
        next();
      });

      const response = await request(app)
        .get('/api/admin/analytics/dashboard')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toBe('관리자 인증이 필요합니다.');
    });
  });

  describe('GET /api/admin/analytics/realtime', () => {
    it('should return real-time metrics successfully', async () => {
      const mockRealTimeMetrics = {
        userGrowth: {
          totalUsers: 1000,
          activeUsers: 800
        },
        revenue: {
          totalRevenue: 50000,
          revenueThisMonth: 5000
        },
        lastUpdated: new Date().toISOString()
      };

      mockAnalyticsService.getRealTimeMetrics.mockResolvedValue(mockRealTimeMetrics);

      const response = await request(app)
        .get('/api/admin/analytics/realtime')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('실시간 메트릭을 성공적으로 조회했습니다.');
      expect(response.body.data).toEqual(mockRealTimeMetrics);
      expect(mockAnalyticsService.getRealTimeMetrics).toHaveBeenCalledWith('admin-123');
    });

    it('should handle service errors gracefully', async () => {
      const errorMessage = 'Real-time data unavailable';
      mockAnalyticsService.getRealTimeMetrics.mockRejectedValue(new Error(errorMessage));

      const response = await request(app)
        .get('/api/admin/analytics/realtime')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('REALTIME_METRICS_ERROR');
      expect(response.body.error.message).toBe('실시간 메트릭 조회 중 오류가 발생했습니다.');
    });
  });

  describe('GET /api/admin/analytics/export', () => {
    it('should export CSV data successfully', async () => {
      const mockCsvData = 'Metric,Value,Category,Date\nTotal Users,1000,User Growth,2024-01-01';
      mockAnalyticsService.exportAnalytics.mockResolvedValue(mockCsvData);

      const response = await request(app)
        .get('/api/admin/analytics/export')
        .query({
          format: 'csv',
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        })
        .expect(200);

      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('.csv');
      expect(response.text).toBe(mockCsvData);
    });

    it('should export JSON data successfully', async () => {
      const mockJsonData = JSON.stringify({ users: 1000, revenue: 50000 });
      mockAnalyticsService.exportAnalytics.mockResolvedValue(mockJsonData);

      const response = await request(app)
        .get('/api/admin/analytics/export')
        .query({
          format: 'json',
          includeCharts: 'true'
        })
        .expect(200);

      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.headers['content-disposition']).toContain('.json');
      expect(response.text).toBe(mockJsonData);
    });

    it('should handle export errors gracefully', async () => {
      const errorMessage = 'Export failed';
      mockAnalyticsService.exportAnalytics.mockRejectedValue(new Error(errorMessage));

      const response = await request(app)
        .get('/api/admin/analytics/export')
        .query({ format: 'csv' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EXPORT_ERROR');
      expect(response.body.error.message).toBe('데이터 내보내기 중 오류가 발생했습니다.');
    });
  });

  describe('GET /api/admin/analytics/cache/stats', () => {
    it('should return cache statistics successfully', async () => {
      const mockCacheStats = {
        size: 5,
        keys: ['dashboard_admin-123_1', 'dashboard_admin-123_2']
      };

      mockAnalyticsService.getCacheStats.mockReturnValue(mockCacheStats);

      const response = await request(app)
        .get('/api/admin/analytics/cache/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('캐시 통계를 성공적으로 조회했습니다.');
      expect(response.body.data).toEqual(mockCacheStats);
      expect(mockAnalyticsService.getCacheStats).toHaveBeenCalled();
    });

    it('should handle cache stats errors gracefully', async () => {
      const errorMessage = 'Cache stats unavailable';
      mockAnalyticsService.getCacheStats.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const response = await request(app)
        .get('/api/admin/analytics/cache/stats')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CACHE_STATS_ERROR');
      expect(response.body.error.message).toBe('캐시 통계 조회 중 오류가 발생했습니다.');
    });
  });

  describe('POST /api/admin/analytics/cache/clear', () => {
    it('should clear cache successfully', async () => {
      mockAnalyticsService.clearCache.mockImplementation(() => {
        // Clear cache implementation
      });

      const response = await request(app)
        .post('/api/admin/analytics/cache/clear')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('분석 캐시를 성공적으로 초기화했습니다.');
      expect(mockAnalyticsService.clearCache).toHaveBeenCalled();
    });

    it('should handle cache clear errors gracefully', async () => {
      const errorMessage = 'Cache clear failed';
      mockAnalyticsService.clearCache.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const response = await request(app)
        .post('/api/admin/analytics/cache/clear')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('CACHE_CLEAR_ERROR');
      expect(response.body.error.message).toBe('캐시 초기화 중 오류가 발생했습니다.');
    });
  });

  describe('GET /api/admin/analytics/health', () => {
    it('should return analytics health status successfully', async () => {
      const mockRealTimeMetrics = {
        userGrowth: { totalUsers: 1000 },
        revenue: { totalRevenue: 50000 },
        reservations: { totalReservations: 500 },
        payments: { totalTransactions: 500 }
      };

      const mockCacheStats = {
        size: 5,
        keys: ['dashboard_admin-123_1']
      };

      mockAnalyticsService.getRealTimeMetrics.mockResolvedValue(mockRealTimeMetrics);
      mockAnalyticsService.getCacheStats.mockReturnValue(mockCacheStats);

      const response = await request(app)
        .get('/api/admin/analytics/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('분석 시스템 상태를 성공적으로 조회했습니다.');
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.metrics.hasUserData).toBe(true);
      expect(response.body.data.metrics.hasRevenueData).toBe(true);
      expect(response.body.data.cache.size).toBe(5);
      expect(response.body.data.cache.isOperational).toBe(true);
    });

    it('should handle health check errors gracefully', async () => {
      const errorMessage = 'Health check failed';
      mockAnalyticsService.getRealTimeMetrics.mockRejectedValue(new Error(errorMessage));

      const response = await request(app)
        .get('/api/admin/analytics/health')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ANALYTICS_HEALTH_ERROR');
      expect(response.body.error.message).toBe('분석 시스템 상태 조회 중 오류가 발생했습니다.');
    });
  });

  describe('Query parameter handling', () => {
    it('should handle all query parameters correctly for dashboard', async () => {
      const mockMetrics = { userGrowth: { totalUsers: 1000 } };
      mockAnalyticsService.getDashboardMetrics.mockResolvedValue(mockMetrics);

      await request(app)
        .get('/api/admin/analytics/dashboard')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-12-31',
          period: 'month',
          category: 'beauty',
          shopId: 'shop-123',
          userId: 'user-456',
          includeCache: 'false'
        })
        .expect(200);

      expect(mockAnalyticsService.getDashboardMetrics).toHaveBeenCalledWith('admin-123', {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        period: 'month',
        category: 'beauty',
        shopId: 'shop-123',
        userId: 'user-456',
        includeCache: false
      });
    });

    it('should handle export query parameters correctly', async () => {
      const mockExportData = JSON.stringify({ users: 1000, revenue: 50000 });
      mockAnalyticsService.exportAnalytics.mockResolvedValue(mockExportData);

      await request(app)
        .get('/api/admin/analytics/export')
        .query({
          format: 'json',
          includeCharts: 'true',
          includeTrends: 'false',
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        })
        .expect(200);

      expect(mockAnalyticsService.exportAnalytics).toHaveBeenCalledWith('admin-123', {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        period: undefined,
        category: undefined,
        shopId: undefined,
        userId: undefined,
        includeCache: true
      }, {
        format: 'json',
        includeCharts: true,
        includeTrends: false,
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-12-31'
        }
      });
    });
  });

  describe('Error handling', () => {
    it('should handle missing user authentication', async () => {
      // Mock authenticateJWT to not set user
      jest.mocked(authenticateJWT).mockImplementationOnce(() => (req, res, next) => {
        req.user = undefined;
        next();
      });

      const response = await request(app)
        .get('/api/admin/analytics/dashboard')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
      expect(response.body.error.message).toBe('관리자 인증이 필요합니다.');
    });

    it('should handle unknown errors', async () => {
      mockAnalyticsService.getDashboardMetrics.mockRejectedValue('Unknown error type');

      const response = await request(app)
        .get('/api/admin/analytics/dashboard')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.details).toBe('Unknown error');
    });
  });
}); 