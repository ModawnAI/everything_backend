import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';

const router = Router();

/**
 * @swagger
 * /api/admin/dashboard/overview:
 *   get:
 *     summary: Get dashboard overview statistics
 *     tags: [Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 30d
 *         description: Time period for statistics
 *     responses:
 *       200:
 *         description: Dashboard overview retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalRevenue:
 *                           type: number
 *                           example: 12500000
 *                         revenueGrowth:
 *                           type: number
 *                           example: 15.5
 *                         totalCustomers:
 *                           type: number
 *                           example: 450
 *                         customersGrowth:
 *                           type: number
 *                           example: 8.2
 *                         totalProducts:
 *                           type: number
 *                           example: 125
 *                         newProducts:
 *                           type: number
 *                           example: 12
 *                         activeOrders:
 *                           type: number
 *                           example: 34
 *                         ordersGrowth:
 *                           type: number
 *                           example: -2.3
 *                     recentOrders:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "ORD-12345"
 *                           customer:
 *                             type: string
 *                             example: "김민수"
 *                           customerEmail:
 *                             type: string
 *                             example: "kim@example.com"
 *                           status:
 *                             type: string
 *                             enum: [pending, processing, shipped, delivered, cancelled]
 *                             example: "processing"
 *                           amount:
 *                             type: number
 *                             example: 85000
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             example: "2025-01-15T10:30:00Z"
 *                     topProducts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "PROD-001"
 *                           name:
 *                             type: string
 *                             example: "젤 네일 기본"
 *                           sales:
 *                             type: number
 *                             example: 145
 *                           revenue:
 *                             type: number
 *                             example: 7250000
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       400:
 *         description: Bad request - Invalid period parameter
 *       500:
 *         description: Internal server error
 */
router.get('/overview', dashboardController.getDashboardOverview.bind(dashboardController));

export default router;
