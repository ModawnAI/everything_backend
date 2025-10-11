import { Router } from 'express';
import { TestDashboardController } from '../controllers/test-dashboard.controller';

/**
 * Test Dashboard Routes
 *
 * Routes for testing dashboard functionality without authentication
 */

const router = Router();
const testDashboardController = new TestDashboardController();

// GET /api/test/dashboard/realtime - Real-time dashboard metrics
router.get('/realtime', testDashboardController.getRealtimeDashboard.bind(testDashboardController));

// GET /api/test/dashboard/materialized - Materialized view dashboard metrics
router.get('/materialized', testDashboardController.getMaterializedDashboard.bind(testDashboardController));

// GET /api/test/dashboard/compare - Compare both approaches
router.get('/compare', testDashboardController.compareDashboards.bind(testDashboardController));

export { router as testDashboardRoutes };