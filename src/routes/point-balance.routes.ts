import { Router } from 'express';
import { pointBalanceController } from '../controllers/point-balance.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';

const router = Router();

/**
 * Point Balance Routes
 * 
 * All routes require authentication and user role
 * Users can only access their own point data
 */

// Apply authentication middleware to all routes
router.use(authenticateJWT);

/**
 * GET /api/users/:userId/points/balance
 * Get current point balance for a user
 * 
 * Query Parameters: None
 * Response: PointBalance object with available, pending, total, expired, used, projectedAvailable
 */
router.get('/users/:userId/points/balance', pointBalanceController.getPointBalance);

/**
 * GET /api/users/:userId/points/history
 * Get point transaction history with filtering and pagination
 * 
 * Query Parameters:
 * - startDate (optional): ISO date string for filtering start date
 * - endDate (optional): ISO date string for filtering end date
 * - transactionType (optional): Filter by transaction type
 * - status (optional): Filter by point status
 * - page (optional): Page number for pagination (default: 1)
 * - limit (optional): Number of items per page (default: 20, max: 100)
 * 
 * Response: PointHistoryResponse with transactions array and pagination info
 */
router.get('/users/:userId/points/history', pointBalanceController.getPointHistory);

/**
 * GET /api/users/:userId/points/analytics
 * Get point analytics and insights
 * 
 * Query Parameters:
 * - months (optional): Number of months to analyze (default: 12, max: 60)
 * 
 * Response: PointAnalytics with earning/spending statistics
 */
router.get('/users/:userId/points/analytics', pointBalanceController.getPointAnalytics);

/**
 * GET /api/users/:userId/points/projection
 * Get point projection showing future available points
 * 
 * Query Parameters:
 * - days (optional): Number of days to project (default: 90, max: 365)
 * 
 * Response: PointProjection with future point availability
 */
router.get('/users/:userId/points/projection', pointBalanceController.getPointProjection);

/**
 * GET /api/users/:userId/points/summary
 * Get comprehensive point summary including balance, analytics, and projection
 * 
 * Query Parameters: None
 * Response: Complete summary with balance, analytics, and projection
 */
router.get('/users/:userId/points/summary', pointBalanceController.getPointSummary);

export default router; 