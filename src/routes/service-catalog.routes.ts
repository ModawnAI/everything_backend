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
 * @route GET /api/service-catalog
 * @desc Get all service catalog entries with optional filtering
 * @access Public
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: / 조회
 *     description: GET endpoint for /
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
router.get('/', 
  validateRequestWithSchema(serviceCatalogSearchSchema, 'query'),
  serviceCatalogController.getServiceCatalogEntries.bind(serviceCatalogController)
);

/**
 * @route GET /api/service-catalog/search
 * @desc Search service catalog entries with advanced filtering
 * @access Public
 */
/**
 * @swagger
 * /search:
 *   get:
 *     summary: /search 조회
 *     description: GET endpoint for /search
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Service Catalog]
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

router.get('/search',
  searchRateLimit,
  validateRequestWithSchema(serviceCatalogSearchSchema, 'query'),
  serviceCatalogController.searchServiceCatalog.bind(serviceCatalogController)
);

/**
 * @route GET /api/service-catalog/stats
 * @desc Get service catalog statistics
 * @access Public
 */
/**
 * @swagger
 * /stats:
 *   get:
 *     summary: /stats 조회
 *     description: GET endpoint for /stats
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Service Catalog]
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

router.get('/stats',
  serviceCatalogController.getServiceCatalogStats.bind(serviceCatalogController)
);

/**
 * @route GET /api/service-catalog/metadata
 * @desc Get service type metadata
 * @access Public
 */
/**
 * @swagger
 * /metadata:
 *   get:
 *     summary: /metadata 조회
 *     description: GET endpoint for /metadata
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Service Catalog]
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

router.get('/metadata',
  serviceCatalogController.getServiceTypeMetadata.bind(serviceCatalogController)
);

/**
 * @route GET /api/service-catalog/popular
 * @desc Get popular services
 * @access Public
 */

/**
 * @swagger
 * /popular:
 *   get:
 *     summary: /popular 조회
 *     description: GET endpoint for /popular
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
router.get('/popular',
  serviceCatalogController.getPopularServices.bind(serviceCatalogController)
);

/**
 * @route GET /api/service-catalog/trending
 * @desc Get trending services
 * @access Public
 */
/**
 * @swagger
 * /trending:
 *   get:
 *     summary: /trending 조회
 *     description: GET endpoint for /trending
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Service Catalog]
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

router.get('/trending',
  serviceCatalogController.getTrendingServices.bind(serviceCatalogController)
);

/**
 * @route GET /api/service-catalog/config
 * @desc Get service catalog configuration
 * @access Public
 */
/**
 * @swagger
 * /config:
 *   get:
 *     summary: /config 조회
 *     description: GET endpoint for /config
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Service Catalog]
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

router.get('/config',
  serviceCatalogController.getServiceCatalogConfig.bind(serviceCatalogController)
);

/**
 * @route GET /api/service-catalog/:serviceId
 * @desc Get a specific service catalog entry by ID
 * @access Public
 */
/**
 * @swagger
 * /:serviceId:
 *   get:
 *     summary: /:serviceId 조회
 *     description: GET endpoint for /:serviceId
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Service Catalog]
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

router.get('/:serviceId',
  serviceCatalogController.getServiceCatalogEntryById.bind(serviceCatalogController)
);

/**
 * @route PUT /api/service-catalog/:serviceId/popularity
 * @desc Update service popularity (internal use)
 * @access Internal
 */

/**
 * @swagger
 * /:serviceId/popularity:
 *   put:
 *     summary: PUT /:serviceId/popularity (PUT /:serviceId/popularity)
 *     description: PUT endpoint for /:serviceId/popularity
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
router.put('/:serviceId/popularity',
  validateRequestWithSchema(updatePopularitySchema, 'body'),
  serviceCatalogController.updateServicePopularity.bind(serviceCatalogController)
);

/**
 * @route PUT /api/service-catalog/:serviceId/trending
 * @desc Mark service as trending (internal use)
 * @access Internal
 */
/**
 * @swagger
 * /:serviceId/trending:
 *   put:
 *     summary: PUT /:serviceId/trending (PUT /:serviceId/trending)
 *     description: PUT endpoint for /:serviceId/trending
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Service Catalog]
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

router.put('/:serviceId/trending',
  validateRequestWithSchema(markTrendingSchema, 'body'),
  serviceCatalogController.markServiceAsTrending.bind(serviceCatalogController)
);

export default router;

