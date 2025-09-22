/**
 * Shop Categories Routes
 * 
 * Defines API endpoints for shop categories and service catalog management
 */

import { Router } from 'express';
import { shopCategoriesController } from '../controllers/shop-categories.controller';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { validateRequestWithSchema } from '../middleware/validation.middleware';
import Joi from 'joi';

const router = Router();

// Validation schemas
const categoriesQuerySchema = Joi.object({
  includeInactive: Joi.boolean().optional(),
  withServiceTypes: Joi.boolean().optional(),
  category: Joi.string().valid('nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair').optional()
});

const categoryParamsSchema = Joi.object({
  categoryId: Joi.string().valid('nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair').required()
});

const searchQuerySchema = Joi.object({
  q: Joi.string().min(1).max(100).required(),
  type: Joi.string().valid('category', 'service', 'all').optional()
});

const popularServicesQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).optional()
});

const searchQuerySchemaWithLimit = Joi.object({
  q: Joi.string().min(1).max(100).required(),
  limit: Joi.number().integer().min(1).max(50).optional()
});

/**
 * @swagger
 * tags:
 *   name: Shop Categories
 *   description: Shop categories and service catalog management
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 */

/**
 * @swagger
 * /api/shops/categories:
 *   get:
 *     summary: all shop categories 조회
 *     tags: [Shop Categories]
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *         description: Include inactive categories
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *       - in: query
 *         name: withServiceTypes
 *         schema:
 *           type: boolean
 *         description: Include service types for each category
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
 *         description: Filter by specific category
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     categories:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CategoryMetadata'
 *                     total:
 *                       type: number
 *                     metadata:
 *                       type: object
 *       500:
 *         description: Internal server error
 */
router.get(
  '/',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100, strategy: 'fixed_window', scope: 'ip', enableHeaders: true } }), // 100 requests per 15 minutes
  validateRequestWithSchema(categoriesQuerySchema, 'query'),
  shopCategoriesController.getCategories.bind(shopCategoriesController)
);

/**
 * @swagger
 * /api/shops/categories/search:
 *   get:
 *     summary: Search categories and service types (Search categories and service types)
 *     tags: [Shop Categories]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         description: Search query
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [category, service, all]
 *         description: Search type filter
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     query:
 *                       type: string
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           category:
 *                             $ref: '#/components/schemas/CategoryMetadata'
 *                           serviceTypes:
 *                             type: array
 *                             items:
 *                               $ref: '#/components/schemas/ServiceTypeInfo'
 *                           matchType:
 *                             type: string
 *                             enum: [category, service]
 *                     total:
 *                       type: number
 *       400:
 *         description: Bad request - search query required
 *       500:
 *         description: Internal server error
 */
router.get(
  '/search',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 50, strategy: 'fixed_window', scope: 'ip', enableHeaders: true } }), // Lower limit for search
  validateRequestWithSchema(searchQuerySchemaWithLimit, 'query'),
  shopCategoriesController.searchCategories.bind(shopCategoriesController)
);

/**
 * @swagger
 * /api/shops/categories/popular/services:
 *   get:
 *     summary: popular service types across all categories 조회
 *     tags: [Shop Categories]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Maximum number of popular services to return
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     responses:
 *       200:
 *         description: Popular services retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     services:
 *                       type: array
 *                       items:
 *                         allOf:
 *                           - $ref: '#/components/schemas/ServiceTypeInfo'
 *                           - type: object
 *                             properties:
 *                               categoryId:
 *                                 type: string
 *                     total:
 *                       type: number
 *       500:
 *         description: Internal server error
 */
router.get(
  '/popular/services',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100, strategy: 'fixed_window', scope: 'ip', enableHeaders: true } }),
  validateRequestWithSchema(popularServicesQuerySchema, 'query'),
  shopCategoriesController.getPopularServices.bind(shopCategoriesController)
);

/**
 * @swagger
 * /api/shops/categories/stats:
 *   get:
 *     summary: category statistics 조회
 *     tags: [Shop Categories]
 *     responses:
 *       200:
 *         description: Category statistics retrieved successfully
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     stats:
 *                       $ref: '#/components/schemas/CategoryStats'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/stats',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 50, strategy: 'fixed_window', scope: 'ip', enableHeaders: true } }),
  shopCategoriesController.getCategoryStats.bind(shopCategoriesController)
);

/**
 * @swagger
 * /api/shops/categories/hierarchy:
 *   get:
 *     summary: category hierarchy 조회
 *     tags: [Shop Categories]
 *     responses:
 *       200:
 *         description: Category hierarchy retrieved successfully
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     hierarchy:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CategoryMetadata'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/hierarchy',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100, strategy: 'fixed_window', scope: 'ip', enableHeaders: true } }),
  shopCategoriesController.getCategoryHierarchy.bind(shopCategoriesController)
);

/**
 * @swagger
 * /api/shops/categories/{categoryId}:
 *   get:
 *     summary: specific category details 조회
 *     tags: [Shop Categories]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
 *         description: Category ID
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     responses:
 *       200:
 *         description: Category details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     category:
 *                       $ref: '#/components/schemas/CategoryMetadata'
 *       404:
 *         description: Category not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:categoryId',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100, strategy: 'fixed_window', scope: 'ip', enableHeaders: true } }),
  validateRequestWithSchema(categoryParamsSchema, 'params'),
  shopCategoriesController.getCategoryById.bind(shopCategoriesController)
);

/**
 * @swagger
 * /api/shops/categories/{categoryId}/services:
 *   get:
 *     summary: service types for a specific category 조회
 *     tags: [Shop Categories]
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: string
 *           enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
 *         description: Category ID
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     responses:
 *       200:
 *         description: Service types retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     categoryId:
 *                       type: string
 *                     serviceTypes:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ServiceTypeInfo'
 *                     total:
 *                       type: number
 *       404:
 *         description: Category not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:categoryId/services',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100, strategy: 'fixed_window', scope: 'ip', enableHeaders: true } }),
  validateRequestWithSchema(categoryParamsSchema, 'params'),
  shopCategoriesController.getServiceTypes.bind(shopCategoriesController)
);

export default router;
