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
router.get('/', 
  validateRequestWithSchema(serviceCatalogSearchSchema, 'query'),
  serviceCatalogController.getServiceCatalogEntries.bind(serviceCatalogController)
);

/**
 * @route GET /api/service-catalog/search
 * @desc Search service catalog entries with advanced filtering
 * @access Public
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
router.get('/stats',
  serviceCatalogController.getServiceCatalogStats.bind(serviceCatalogController)
);

/**
 * @route GET /api/service-catalog/metadata
 * @desc Get service type metadata
 * @access Public
 */
router.get('/metadata',
  serviceCatalogController.getServiceTypeMetadata.bind(serviceCatalogController)
);

/**
 * @route GET /api/service-catalog/popular
 * @desc Get popular services
 * @access Public
 */
router.get('/popular',
  serviceCatalogController.getPopularServices.bind(serviceCatalogController)
);

/**
 * @route GET /api/service-catalog/trending
 * @desc Get trending services
 * @access Public
 */
router.get('/trending',
  serviceCatalogController.getTrendingServices.bind(serviceCatalogController)
);

/**
 * @route GET /api/service-catalog/config
 * @desc Get service catalog configuration
 * @access Public
 */
router.get('/config',
  serviceCatalogController.getServiceCatalogConfig.bind(serviceCatalogController)
);

/**
 * @route GET /api/service-catalog/:serviceId
 * @desc Get a specific service catalog entry by ID
 * @access Public
 */
router.get('/:serviceId',
  serviceCatalogController.getServiceCatalogEntryById.bind(serviceCatalogController)
);

/**
 * @route PUT /api/service-catalog/:serviceId/popularity
 * @desc Update service popularity (internal use)
 * @access Internal
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
router.put('/:serviceId/trending',
  validateRequestWithSchema(markTrendingSchema, 'body'),
  serviceCatalogController.markServiceAsTrending.bind(serviceCatalogController)
);

export default router;

