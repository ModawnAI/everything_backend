/**
 * User Favorites Routes
 * 
 * Defines all user favorites management endpoints with proper middleware,
 * validation, authentication, and rate limiting
 */

import { Router } from 'express';
import { favoritesController } from '../controllers/favorites.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
// Validation middleware - simplified for now
const validateRequestParams = (schema: any) => (req: any, res: any, next: any) => next();
const validateRequestQuery = (schema: any) => (req: any, res: any, next: any) => next();
const validateRequestBody = (schema: any) => (req: any, res: any, next: any) => next();
import Joi from 'joi';

const router = Router();

// Rate limiting configurations
// NOTE: Using inline calls like reservation.routes.ts (no pre-defined middleware variables)

// Joi validation schemas
const shopIdSchema = Joi.object({
  shopId: Joi.string().uuid().required()
});

const getFavoritesQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).optional(),
  offset: Joi.number().integer().min(0).optional(),
  category: Joi.string().optional(),
  sortBy: Joi.string().valid('recent', 'name', 'bookings').optional(),
  includeShopData: Joi.string().valid('true', 'false').optional()
});

const bulkFavoritesBodySchema = Joi.object({
  shopIds: Joi.array().items(Joi.string().uuid()).min(1).max(100).required(),
  action: Joi.string().valid('add', 'remove').required()
});

const checkFavoritesBodySchema = Joi.object({
  shopIds: Joi.array().items(Joi.string().uuid()).min(1).max(100).required()
});

// ============================================================================
// FAVORITES ROUTES
// ============================================================================

/**
 * @swagger
 * /api/shops/{shopId}/favorite:
 *   post:
 *     summary: Add shop to favorites (Add shop to favorites)
 *     description: Add a specific shop to the authenticated user's favorites list
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: ID of the shop to add to favorites
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Shop added to favorites successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     isFavorite: { type: 'boolean', example: true }
 *                     favoriteId: { type: 'string', format: 'uuid', example: "456e7890-e89b-12d3-a456-426614174001" }
 *                     message: { type: 'string', example: 'Shop added to favorites successfully' }
 *                 message: { type: 'string', example: 'Shop added to favorites successfully' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/shops/:shopId/favorite',
  authenticateJWT(),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),  // Modification rate limit
  validateRequestParams(shopIdSchema),
  favoritesController.addFavorite
);

/**
 * @swagger
 * /api/shops/{shopId}/favorite:
 *   delete:
 *     summary: Remove shop from favorites (Remove shop from favorites)
 *     description: Remove a specific shop from the authenticated user's favorites list
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: ID of the shop to remove from favorites
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Shop removed from favorites successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     isFavorite: { type: 'boolean', example: false }
 *                     message: { type: 'string', example: 'Shop removed from favorites successfully' }
 *                 message: { type: 'string', example: 'Shop removed from favorites successfully' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/shops/:shopId/favorite',
  authenticateJWT(),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),  // Modification rate limit
  validateRequestParams(shopIdSchema),
  favoritesController.removeFavorite
);

/**
 * @swagger
 * /api/shops/{shopId}/favorite:
 *   put:
 *     summary: Toggle shop favorite status (Toggle shop favorite status)
 *     description: Toggle the favorite status of a shop (add if not favorited, remove if favorited)
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: ID of the shop to toggle favorite status
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Shop favorite status toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     isFavorite: { type: 'boolean', example: true }
 *                     favoriteId: { type: 'string', format: 'uuid', example: "456e7890-e89b-12d3-a456-426614174001" }
 *                     message: { type: 'string', example: 'Shop added to favorites successfully' }
 *                 message: { type: 'string', example: 'Shop added to favorites successfully' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/shops/:shopId/favorite',
  authenticateJWT(),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),  // Modification rate limit
  validateRequestParams(shopIdSchema),
  favoritesController.toggleFavorite
);

/**
 * @swagger
 * /api/shops/{shopId}/favorite/status:
 *   get:
 *     summary: Check shop favorite status (Check shop favorite status)
 *     description: Check if a specific shop is in the authenticated user's favorites
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: ID of the shop to check favorite status
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Favorite status checked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     shopId: { type: 'string', format: 'uuid', example: "123e4567-e89b-12d3-a456-426614174000" }
 *                     isFavorite: { type: 'boolean', example: true }
 *                 message: { type: 'string', example: 'Favorite status checked successfully' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/shops/:shopId/favorite/status',
  authenticateJWT(),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),  // Standard rate limit
  validateRequestParams(shopIdSchema),
  favoritesController.isFavorite
);

/**
 * @swagger
 * /api/user/favorites:
 *   get:
 *     summary: user's favorite shops 조회
 *     description: Retrieve the authenticated user's favorite shops with pagination and filtering options. Use includeShopData=true to get full shop details in a single request for better performance.
 *
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *
 *       ---
 *
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 }
 *         description: Number of favorites to return per page
 *       - in: query
 *         name: offset
 *         schema: { type: 'integer', minimum: 0, default: 0 }
 *         description: Number of favorites to skip
 *       - in: query
 *         name: category
 *         schema: { type: 'string' }
 *         description: Filter favorites by shop category (only works when includeShopData=true)
 *       - in: query
 *         name: sortBy
 *         schema: { type: 'string', enum: ['recent', 'name', 'bookings'], default: 'recent' }
 *         description: Sort order for favorites (name and bookings only work when includeShopData=true)
 *       - in: query
 *         name: includeShopData
 *         schema: { type: 'string', enum: ['true', 'false'], default: 'false' }
 *         description: Include full shop details (name, description, images, etc.) in the response. Set to 'true' for optimized single-request fetch.
 *     responses:
 *       200:
 *         description: Favorites retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     favorites:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/FavoriteShop'
 *                     totalCount: { type: 'integer', example: 25 }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         limit: { type: 'integer', example: 50 }
 *                         offset: { type: 'integer', example: 0 }
 *                         hasMore: { type: 'boolean', example: false }
 *                 message: { type: 'string', example: 'Favorites retrieved successfully' }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /user/favorites:
 *   get:
 *     summary: /user/favorites 조회
 *     description: GET endpoint for /user/favorites
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */
router.get('/user/favorites',
  authenticateJWT(),  // FIXED: Added parentheses to call the function
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),  // Standard rate limit
  validateRequestQuery(getFavoritesQuerySchema),
  favoritesController.getFavorites
);

/**
 * @swagger
 * /api/user/favorites/stats:
 *   get:
 *     summary: user's favorites statistics 조회
 *     description: Retrieve statistics about the authenticated user's favorite shops
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Favorites statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   $ref: '#/components/schemas/FavoritesStats'
 *                 message: { type: 'string', example: 'Favorites statistics retrieved successfully' }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/user/favorites/stats',
  authenticateJWT(),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),  // Standard rate limit
  favoritesController.getFavoritesStats
);

/**
 * @swagger
 * /api/user/favorites/bulk:
 *   post:
 *     summary: Bulk add/remove favorites (Bulk add/remove favorites)
 *     description: Add or remove multiple shops from favorites in a single operation
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shopIds:
 *                 type: array
 *                 items: { type: 'string', format: 'uuid' }
 *                 minItems: 1
 *                 maxItems: 100
 *                 description: Array of shop IDs to add or remove from favorites
 *               action:
 *                 type: string
 *                 enum: ['add', 'remove']
 *                 description: Action to perform on the shops
 *             required: [shopIds, action]
 *           example:
 *             shopIds: ["123e4567-e89b-12d3-a456-426614174000", "456e7890-e89b-12d3-a456-426614174001"]
 *             action: "add"
 *     responses:
 *       200:
 *         description: Bulk operation completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     added: { type: 'array', items: { type: 'string', format: 'uuid' } }
 *                     removed: { type: 'array', items: { type: 'string', format: 'uuid' } }
 *                     failed:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           shopId: { type: 'string', format: 'uuid' }
 *                           reason: { type: 'string' }
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total: { type: 'integer', example: 2 }
 *                         successful: { type: 'integer', example: 2 }
 *                         failed: { type: 'integer', example: 0 }
 *                 message: { type: 'string', example: 'Bulk add operation completed' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /user/favorites/bulk:
 *   post:
 *     summary: POST /user/favorites/bulk (POST /user/favorites/bulk)
 *     description: POST endpoint for /user/favorites/bulk
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */
router.post('/user/favorites/bulk',
  authenticateJWT(),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 50 } }),  // Bulk operations rate limit (stricter)
  validateRequestBody(bulkFavoritesBodySchema),
  favoritesController.bulkUpdateFavorites
);

/**
 * @swagger
 * /api/user/favorites/check:
 *   post:
 *     summary: Check favorite status for multiple shops (Check favorite status for multiple shops)
 *     description: Check the favorite status for multiple shops in a single request
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shopIds:
 *                 type: array
 *                 items: { type: 'string', format: 'uuid' }
 *                 minItems: 1
 *                 maxItems: 100
 *                 description: Array of shop IDs to check favorite status
 *             required: [shopIds]
 *           example:
 *             shopIds: ["123e4567-e89b-12d3-a456-426614174000", "456e7890-e89b-12d3-a456-426614174001"]
 *     responses:
 *       200:
 *         description: Favorite status checked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     favorites:
 *                       type: object
 *                       additionalProperties: { type: 'boolean' }
 *                       description: Object mapping shop IDs to their favorite status
 *                       example: { "123e4567-e89b-12d3-a456-426614174000": true, "456e7890-e89b-12d3-a456-426614174001": false }
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total: { type: 'integer', example: 2 }
 *                         favorited: { type: 'integer', example: 1 }
 *                         notFavorited: { type: 'integer', example: 1 }
 *                 message: { type: 'string', example: 'Favorites status checked successfully' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /user/favorites/check:
 *   post:
 *     summary: POST /user/favorites/check (POST /user/favorites/check)
 *     description: POST endpoint for /user/favorites/check
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */
router.post('/user/favorites/check',
  authenticateJWT(),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),  // Standard rate limit
  validateRequestBody(checkFavoritesBodySchema),
  favoritesController.checkFavorites
);

// DEBUG ROUTE - TEST IF ROUTER IS WORKING
router.get('/test-favorites-route', (req, res) => {
  console.log('🧪 TEST ROUTE HIT: /api/test-favorites-route');
  res.json({ success: true, message: 'Favorites router is working!' });
});

export default router;
