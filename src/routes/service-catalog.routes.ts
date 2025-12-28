/**
 * Service Catalog Routes
 * 
 * Routes for enhanced service catalog operations including:
 * - Service catalog entry management
 * - Advanced search and filtering
 * - Service type metadata management
 * - Popularity and trending calculations
 * - Service statistics and analytics
 */

import { Router } from 'express';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { validateRequestWithSchema } from '../middleware/validation.middleware';
import { serviceCatalogController } from '../controllers/service-catalog.controller';
import Joi from 'joi';

const router = Router();

// Rate limiting for service catalog endpoints
const serviceCatalogRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Maximum 1000 requests per 15 minutes
    message: 'Too many service catalog requests, please try again later.',
  }
});

const searchRateLimit = rateLimit({
  config: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 100, // Maximum 100 search requests per 5 minutes
    message: 'Too many search requests, please try again later.',
  }
});

// Validation schemas
const serviceCatalogSearchSchema = Joi.object({
  q: Joi.string().optional(),
  category: Joi.string().valid('nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair').optional(),
  price_min: Joi.number().min(0).optional(),
  price_max: Joi.number().min(0).optional(),
  duration_min: Joi.number().min(0).optional(),
  duration_max: Joi.number().min(0).optional(),
  service_level: Joi.string().valid('basic', 'premium', 'luxury').optional(),
  difficulty_level: Joi.string().valid('beginner', 'intermediate', 'advanced').optional(),
  featured_only: Joi.boolean().optional(),
  trending_only: Joi.boolean().optional(),
  min_rating: Joi.number().min(0).max(5).optional(),
  tags: Joi.string().optional(),
  page: Joi.number().min(1).optional(),
  limit: Joi.number().min(1).max(100).optional(),
  sort_by: Joi.string().valid('price', 'duration', 'rating', 'popularity', 'distance', 'newest').optional(),
  sort_order: Joi.string().valid('asc', 'desc').optional(),
  include_unavailable: Joi.boolean().optional()
});

const updatePopularitySchema = Joi.object({
  bookingCount: Joi.number().min(0).required(),
  ratingAverage: Joi.number().min(0).max(5).required()
});

const markTrendingSchema = Joi.object({
  isTrending: Joi.boolean().optional()
});

// Apply rate limiting to all routes
router.use(serviceCatalogRateLimit);

/**
 * @swagger
 * /api/service-catalog:
 *   get:
 *     summary: 서비스 카탈로그 조회
 *     description: |
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *
 *       Get all service catalog entries with optional filtering and pagination.
 *
 *       **Features:**
 *       - Advanced search with multiple filter criteria
 *       - Category, price range, and duration filtering
 *       - Service level and difficulty level filtering
 *       - Featured and trending services
 *       - Rating-based filtering
 *       - Tag-based search
 *       - Sorting and pagination support
 *
 *       **Access:** Public - No authentication required
 *     tags: [Service Catalog]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query string
 *         example: "젤 네일"
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
 *         description: Filter by service category
 *         example: "nail"
 *       - in: query
 *         name: price_min
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Minimum price filter
 *         example: 10000
 *       - in: query
 *         name: price_max
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Maximum price filter
 *         example: 100000
 *       - in: query
 *         name: duration_min
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Minimum duration in minutes
 *         example: 30
 *       - in: query
 *         name: duration_max
 *         schema:
 *           type: number
 *           minimum: 0
 *         description: Maximum duration in minutes
 *         example: 120
 *       - in: query
 *         name: service_level
 *         schema:
 *           type: string
 *           enum: [basic, premium, luxury]
 *         description: Filter by service level
 *         example: "premium"
 *       - in: query
 *         name: difficulty_level
 *         schema:
 *           type: string
 *           enum: [beginner, intermediate, advanced]
 *         description: Filter by difficulty level
 *         example: "intermediate"
 *       - in: query
 *         name: featured_only
 *         schema:
 *           type: boolean
 *         description: Show only featured services
 *         example: false
 *       - in: query
 *         name: trending_only
 *         schema:
 *           type: boolean
 *         description: Show only trending services
 *         example: false
 *       - in: query
 *         name: min_rating
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *         description: Minimum rating filter
 *         example: 4.0
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Comma-separated tags
 *         example: "아트,프렌치"
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *         example: 20
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [price, duration, rating, popularity, distance, newest]
 *         description: Sort field
 *         example: "popularity"
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *         example: "desc"
 *       - in: query
 *         name: include_unavailable
 *         schema:
 *           type: boolean
 *         description: Include unavailable services
 *         example: false
 *     responses:
 *       200:
 *         description: Service catalog entries retrieved successfully
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
 *                     services:
 *                       type: array
 *                       items:
 *                         type: object
 *                     totalCount:
 *                       type: integer
 *                       example: 150
 *                     hasMore:
 *                       type: boolean
 *                       example: true
 *                 message:
 *                   type: string
 *                   example: "서비스 카탈로그를 성공적으로 조회했습니다."
 *       400:
 *         description: Bad Request - Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/BadRequest'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/InternalServerError'
 */
router.get('/',
  validateRequestWithSchema(serviceCatalogSearchSchema, 'query'),
  serviceCatalogController.getServiceCatalogEntries.bind(serviceCatalogController)
);

/**
 * @swagger
 * /api/service-catalog/search:
 *   get:
 *     summary: 서비스 카탈로그 고급 검색
 *     description: |
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *
 *       Search service catalog entries with advanced filtering options.
 *       Same filtering capabilities as the main endpoint but with enhanced search relevance.
 *
 *       **Access:** Public - No authentication required
 *     tags: [Service Catalog]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query string
 *         example: "젤 네일"
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
 *         description: Filter by service category
 *       - in: query
 *         name: price_min
 *         schema:
 *           type: number
 *         description: Minimum price
 *       - in: query
 *         name: price_max
 *         schema:
 *           type: number
 *         description: Maximum price
 *       - in: query
 *         name: page
 *         schema:
 *           type: number
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 20
 *           maximum: 100
 *         description: Items per page
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
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                     totalCount:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 *       400:
 *         description: Bad Request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/BadRequest'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/InternalServerError'
 */

router.get('/search',
  searchRateLimit,
  validateRequestWithSchema(serviceCatalogSearchSchema, 'query'),
  serviceCatalogController.searchServiceCatalog.bind(serviceCatalogController)
);

/**
 * @swagger
 * /api/service-catalog/stats:
 *   get:
 *     summary: 서비스 카탈로그 통계
 *     description: |
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *
 *       Get service catalog statistics including total services, categories, and popularity metrics.
 *
 *       **Access:** Public - No authentication required
 *     tags: [Service Catalog]
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
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
 *                     totalServices:
 *                       type: integer
 *                       example: 1500
 *                     categoryCounts:
 *                       type: object
 *                       example: { "nail": 500, "eyelash": 300, "hair": 700 }
 *                     averagePrice:
 *                       type: number
 *                       example: 45000
 *                     averageRating:
 *                       type: number
 *                       example: 4.5
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/InternalServerError'
 */

router.get('/stats',
  serviceCatalogController.getServiceCatalogStats.bind(serviceCatalogController)
);

/**
 * @swagger
 * /api/service-catalog/metadata:
 *   get:
 *     summary: 서비스 타입 메타데이터
 *     description: |
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *
 *       Get service type metadata including available categories, service levels, and tags.
 *
 *       **Access:** Public - No authentication required
 *     tags: [Service Catalog]
 *     responses:
 *       200:
 *         description: Metadata retrieved successfully
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
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["nail", "eyelash", "waxing", "eyebrow_tattoo", "hair"]
 *                     serviceLevels:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["basic", "premium", "luxury"]
 *                     difficultyLevels:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["beginner", "intermediate", "advanced"]
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/InternalServerError'
 */

router.get('/metadata',
  serviceCatalogController.getServiceTypeMetadata.bind(serviceCatalogController)
);

/**
 * @swagger
 * /api/service-catalog/categories:
 *   get:
 *     summary: 서비스 카테고리 목록 (메타데이터 별칭)
 *     description: |
 *       Get service categories. This is an alias for /metadata endpoint.
 *       Returns the same metadata including categories, service levels, and difficulty levels.
 *
 *       **Access:** Public - No authentication required
 *     tags: [Service Catalog]
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
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["nail", "eyelash", "waxing", "eyebrow_tattoo", "hair"]
 *       500:
 *         description: Internal Server Error
 */
router.get('/categories',
  serviceCatalogController.getServiceTypeMetadata.bind(serviceCatalogController)
);

/**
 * @swagger
 * /api/service-catalog/popular:
 *   get:
 *     summary: 인기 서비스 조회
 *     description: |
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *
 *       Get popular services based on booking count and ratings.
 *
 *       **Access:** Public - No authentication required
 *     tags: [Service Catalog]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 10
 *           maximum: 50
 *         description: Number of popular services to return
 *         example: 10
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
 *         description: Filter by category
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
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/InternalServerError'
 */
router.get('/popular',
  serviceCatalogController.getPopularServices.bind(serviceCatalogController)
);

/**
 * @swagger
 * /api/service-catalog/trending:
 *   get:
 *     summary: 트렌딩 서비스 조회
 *     description: |
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *
 *       Get currently trending services marked by administrators.
 *
 *       **Access:** Public - No authentication required
 *     tags: [Service Catalog]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           default: 10
 *           maximum: 50
 *         description: Number of trending services to return
 *         example: 10
 *     responses:
 *       200:
 *         description: Trending services retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/InternalServerError'
 */

router.get('/trending',
  serviceCatalogController.getTrendingServices.bind(serviceCatalogController)
);

/**
 * @swagger
 * /api/service-catalog/config:
 *   get:
 *     summary: 서비스 카탈로그 설정 조회
 *     description: |
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *
 *       Get service catalog configuration including filter options and display settings.
 *
 *       **Access:** Public - No authentication required
 *     tags: [Service Catalog]
 *     responses:
 *       200:
 *         description: Configuration retrieved successfully
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
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: string
 *                     serviceLevels:
 *                       type: array
 *                       items:
 *                         type: string
 *                     priceRange:
 *                       type: object
 *                       properties:
 *                         min:
 *                           type: number
 *                         max:
 *                           type: number
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/InternalServerError'
 */

router.get('/config',
  serviceCatalogController.getServiceCatalogConfig.bind(serviceCatalogController)
);

/**
 * @swagger
 * /api/service-catalog/{serviceId}:
 *   get:
 *     summary: 서비스 카탈로그 상세 조회
 *     description: |
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *
 *       Get a specific service catalog entry by ID with full details.
 *
 *       **Access:** Public - No authentication required
 *     tags: [Service Catalog]
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service catalog entry ID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Service catalog entry retrieved successfully
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
 *                   description: Service catalog entry details
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/NotFound'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/InternalServerError'
 */

router.get('/:serviceId',
  serviceCatalogController.getServiceCatalogEntryById.bind(serviceCatalogController)
);

/**
 * @swagger
 * /api/service-catalog/{serviceId}/popularity:
 *   put:
 *     summary: 서비스 인기도 업데이트 (내부용)
 *     description: |
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *
 *       Update service popularity metrics based on booking count and rating average.
 *       This endpoint is for internal system use only.
 *
 *       **Access:** Internal - System use only
 *     tags: [Service Catalog]
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service catalog entry ID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bookingCount
 *               - ratingAverage
 *             properties:
 *               bookingCount:
 *                 type: number
 *                 minimum: 0
 *                 description: Total booking count
 *                 example: 150
 *               ratingAverage:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 5
 *                 description: Average rating
 *                 example: 4.5
 *     responses:
 *       200:
 *         description: Popularity updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "서비스 인기도가 업데이트되었습니다."
 *       400:
 *         description: Bad Request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/BadRequest'
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/NotFound'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/InternalServerError'
 */
router.put('/:serviceId/popularity',
  validateRequestWithSchema(updatePopularitySchema, 'body'),
  serviceCatalogController.updateServicePopularity.bind(serviceCatalogController)
);

/**
 * @swagger
 * /api/service-catalog/{serviceId}/trending:
 *   put:
 *     summary: 서비스 트렌딩 설정 (내부용)
 *     description: |
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *
 *       Mark or unmark a service as trending.
 *       This endpoint is for internal system use only.
 *
 *       **Access:** Internal - System use only
 *     tags: [Service Catalog]
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service catalog entry ID
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isTrending:
 *                 type: boolean
 *                 description: Set trending status
 *                 example: true
 *     responses:
 *       200:
 *         description: Trending status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "서비스 트렌딩 상태가 업데이트되었습니다."
 *       400:
 *         description: Bad Request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/BadRequest'
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/NotFound'
 *       500:
 *         description: Internal Server Error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/responses/InternalServerError'
 */

router.put('/:serviceId/trending',
  validateRequestWithSchema(markTrendingSchema, 'body'),
  serviceCatalogController.markServiceAsTrending.bind(serviceCatalogController)
);

export default router;

