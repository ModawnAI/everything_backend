/**
 * Shop Users Routes
 *
 * Provides user management endpoints for shops.
 * All endpoints are scoped to a specific shop (/api/shops/:shopId/users)
 *
 * Access Control:
 * - Platform admins (admin): Can access any shop's users
 * - Shop roles (shop_owner): Can only access their own shop's users
 */

import { Router } from 'express';
import { ShopUsersController } from '../controllers/shop-users.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { validateShopAccess } from '../middleware/shop-access.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { logger } from '../utils/logger';

const router = Router({ mergeParams: true }); // mergeParams to access :shopId from parent router
const controller = new ShopUsersController();

// Apply authentication and shop access validation to ALL routes
router.use(authenticateJWT());
router.use(validateShopAccess);

/**
 * @swagger
 * /api/shops/{shopId}/users:
 *   get:
 *     summary: Get shop users
 *     description: Retrieve all users associated with a specific shop
 *     tags: [Shop Management - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: shopId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Shop ID
 *       - name: role
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by user role
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by user status
 *       - name: sortBy
 *         in: query
 *         schema:
 *           type: string
 *           default: created_at
 *         description: Sort field
 *       - name: sortOrder
 *         in: query
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Users retrieved successfully
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
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied - not authorized for this shop
 *       500:
 *         description: Internal server error
 */
router.get('/',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }), // 100 requests per 15 minutes
  async (req, res) => {
    try {
      logger.info('🔍🔍🔍 [ROUTE-DEBUG] Before calling controller.getShopUsers', {
        query: req.query,
        sortBy: req.query.sortBy,
        sortByType: typeof req.query.sortBy
      });
      await controller.getShopUsers(req as any, res);
      logger.info('🔍🔍🔍 [ROUTE-DEBUG] After calling controller.getShopUsers');
    } catch (error) {
      logger.error('Error in shop users route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.shopId,
        query: req.query
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '사용자 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/shops/{shopId}/users/roles:
 *   get:
 *     summary: Get available user roles for shop
 *     description: Retrieve list of user roles that can be assigned in this shop
 *     tags: [Shop Management - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: shopId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Shop ID
 *     responses:
 *       200:
 *         description: Roles retrieved successfully
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
 *                     roles:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           role:
 *                             type: string
 *                           count:
 *                             type: integer
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied - not authorized for this shop
 *       500:
 *         description: Internal server error
 */
router.get('/roles',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  async (req, res) => {
    try {
      await controller.getShopUserRoles(req as any, res);
    } catch (error) {
      logger.error('Error in shop user roles route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.shopId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '역할 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

// Error handling middleware for shop users routes
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error in shop users routes', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    shopId: req.params.shopId,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '사용자 관리 중 오류가 발생했습니다.',
      details: '잠시 후 다시 시도해주세요.'
    }
  });
});

export default router;
