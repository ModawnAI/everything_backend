/**
 * Shop Analytics Routes
 *
 * Defines routes for shop-scoped analytics endpoints.
 * All routes are prefixed with /api/shops/:shopId/analytics
 *
 * Middleware chain:
 * 1. authenticateJWT - Verifies JWT token
 * 2. validateShopAccess - Ensures user has access to the shop
 */

import { Router } from 'express';
import { ShopAnalyticsController } from '../controllers/shop-analytics.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { validateShopAccess } from '../middleware/shop-access.middleware';

const router = Router({ mergeParams: true }); // mergeParams to access :shopId from parent router
const controller = new ShopAnalyticsController();

/**
 * @route   GET /api/shops/:shopId/analytics/dashboard/quick
 * @desc    Get quick dashboard metrics (7d, 30d, 90d)
 * @access  Shop Admin, Platform Admin
 * @query   period - '7d' | '30d' | '90d' (default: '7d')
 */
router.get(
  '/dashboard/quick',
  authenticateJWT,
  validateShopAccess,
  (req, res) => controller.getQuickDashboard(req, res)
);

/**
 * @route   GET /api/shops/:shopId/analytics/revenue
 * @desc    Get detailed revenue analytics
 * @access  Shop Admin, Platform Admin
 * @query   startDate - ISO date string
 * @query   endDate - ISO date string
 * @query   groupBy - 'day' | 'week' | 'month' (default: 'day')
 */
router.get(
  '/revenue',
  authenticateJWT,
  validateShopAccess,
  (req, res) => controller.getRevenueAnalytics(req, res)
);

export default router;
