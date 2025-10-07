import { Router } from 'express';
import { AdminAnalyticsOptimizedController } from '../controllers/admin-analytics-optimized.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';

const router = Router();
const controller = new AdminAnalyticsOptimizedController();

/**
 * Optimized Analytics Routes (< 10ms response time)
 *
 * These routes use materialized views for instant responses.
 * All data is pre-calculated by PostgreSQL and auto-refreshed by pg_cron.
 *
 * Performance: 100-1000x faster than on-demand calculation
 * Data Freshness: Auto-refreshed every 2-10 minutes
 */

// Quick dashboard metrics (< 10ms)
router.get(
  '/dashboard/quick',
  authenticateToken,
  requireAdmin,
  controller.getQuickDashboardMetrics.bind(controller)
);

// Trend endpoints (< 10ms each)
router.get(
  '/trends/users',
  authenticateToken,
  requireAdmin,
  controller.getUserGrowthTrends.bind(controller)
);

router.get(
  '/trends/revenue',
  authenticateToken,
  requireAdmin,
  controller.getRevenueTrends.bind(controller)
);

router.get(
  '/trends/reservations',
  authenticateToken,
  requireAdmin,
  controller.getReservationTrends.bind(controller)
);

// Performance and summary endpoints (< 10ms each)
router.get(
  '/shops/performance',
  authenticateToken,
  requireAdmin,
  controller.getShopPerformance.bind(controller)
);

router.get(
  '/payments/summary',
  authenticateToken,
  requireAdmin,
  controller.getPaymentStatusSummary.bind(controller)
);

router.get(
  '/points/summary',
  authenticateToken,
  requireAdmin,
  controller.getPointTransactionSummary.bind(controller)
);

router.get(
  '/categories/performance',
  authenticateToken,
  requireAdmin,
  controller.getCategoryPerformance.bind(controller)
);

// Manual refresh endpoint (optional - pg_cron handles automatic refresh)
router.post(
  '/refresh',
  authenticateToken,
  requireAdmin,
  controller.refreshAllViews.bind(controller)
);

export default router;
