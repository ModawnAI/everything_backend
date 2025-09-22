/**
 * Shop Search Routes
 * 
 * Advanced shop search and filtering endpoints including:
 * - Full-text search with PostgreSQL optimization
 * - Location-based search with PostGIS integration
 * - Advanced filtering by category, type, price, rating
 * - Search suggestions and autocomplete
 * - Popular searches and trending data
 */

import { Router } from 'express';
import { shopSearchController } from '../controllers/shop-search.controller';
import { validateRequestBody, validateRequestWithSchema } from '../middleware/validation.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { logger } from '../utils/logger';
import {
  shopSearchSchema,
  searchSuggestionsSchema,
  popularSearchesSchema,
  enhancedShopSearchSchema,
  enhancedSearchSuggestionsSchema
} from '../validators/shop-search.validators';

const router = Router();

// Rate limiting for search endpoints
const searchRateLimit = rateLimit({
  config: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: '검색 요청이 너무 많습니다.',
        details: '1분 후 다시 시도해주세요.'
      }
    },
    enableHeaders: true
  }
});

const suggestionsRateLimit = rateLimit({
  config: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 120, // 120 requests per minute (higher for autocomplete)
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: '검색 제안 요청이 너무 많습니다.',
        details: '잠시 후 다시 시도해주세요.'
      }
    },
    enableHeaders: true
  }
});

/**
 * @swagger
 * tags:
 *   - name: Shop Search
 *     description: Advanced shop search and filtering operations
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 */

/**
 * @swagger
 * /api/shops/search:
 *   get:
 *     summary: Advanced shop search with full-text search and filtering (Advanced shop search with full-text search and filtering)
 *     description: |
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Comprehensive shop search endpoint supporting:
 *       - Full-text search across shop names, descriptions, and addresses
 *       - Location-based search with PostGIS optimization and Seoul boundary validation
 *       - Bounds-based search for map views with rectangular area filtering
 *       - Advanced filtering by category, type, price range, rating, operating hours
 *       - Multiple selection filters for categories, payment methods, services
 *       - Business license and image requirements filtering
 *       - Date range filtering for creation and partnership dates
 *       - Multiple sorting options including relevance, distance, rating, bookings
 *       - Redis-based caching for improved performance
 *       - Comprehensive pagination and result limiting
 *       
 *       **Usage Examples:**
 *       - Text search: `?q=네일아트`
 *       - Location search: `?latitude=37.5665&longitude=126.9780&radius=5`
 *       - Bounds search: `?neLat=37.52&neLng=127.05&swLat=37.49&swLng=127.02`
 *       - Category filter: `?categories=nail,eyelash&onlyFeatured=true`
 *       - Advanced filter: `?paymentMethods=card,mobile_pay&hasImages=true&minImages=3`
 *       - Operating hours: `?openOn=monday&openAt=14:30`
 *       - Business filter: `?hasBusinessLicense=true&bookingMin=100`
 *     tags: [Shop Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         description: Search query text
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *         example: "네일아트"
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *         description: Alternative search query parameter
 *         example: "속눈썹 연장"
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
 *         description: Filter by service category
 *         example: "nail"
 *       - in: query
 *         name: shopType
 *         schema:
 *           type: string
 *           enum: [partnered, non_partnered]
 *         description: Filter by shop type
 *         example: "partnered"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, pending_approval, suspended, deleted]
 *           default: active
 *         description: Filter by shop status
 *         example: "active"
 *       - in: query
 *         name: onlyFeatured
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Show only featured shops
 *         example: false
 *       - in: query
 *         name: onlyOpen
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Show only currently open shops
 *         example: false
 *       - in: query
 *         name: priceMin
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 1000000
 *         description: Minimum price filter
 *         example: 10000
 *       - in: query
 *         name: priceMax
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 1000000
 *         description: Maximum price filter
 *         example: 50000
 *       - in: query
 *         name: ratingMin
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *         description: Minimum rating filter
 *         example: 4.0
 *       - in: query
 *         name: latitude
 *         schema:
 *           type: number
 *           minimum: -90
 *           maximum: 90
 *         description: User latitude for location-based search
 *         example: 37.5665
 *       - in: query
 *         name: longitude
 *         schema:
 *           type: number
 *           minimum: -180
 *           maximum: 180
 *         description: User longitude for location-based search
 *         example: 126.9780
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           minimum: 0.1
 *           maximum: 50
 *           default: 10
 *         description: Search radius in kilometers
 *         example: 5
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [relevance, distance, rating, price, name, created_at]
 *           default: relevance
 *         description: Sort results by
 *         example: "relevance"
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *         example: "desc"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Maximum number of results per page
 *         example: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of results to skip (for pagination)
 *         example: 0
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number (alternative to offset)
 *         example: 1
 *       - in: query
 *         name: categories
 *         schema:
 *           type: string
 *         description: Multiple categories (comma-separated)
 *         example: "nail,eyelash"
 *       - in: query
 *         name: subCategories
 *         schema:
 *           type: string
 *         description: Sub-categories filter (comma-separated)
 *         example: "nail,hair"
 *       - in: query
 *         name: shopTypes
 *         schema:
 *           type: string
 *         description: Multiple shop types (comma-separated)
 *         example: "partnered,non_partnered"
 *       - in: query
 *         name: statuses
 *         schema:
 *           type: string
 *         description: Multiple statuses (comma-separated)
 *         example: "active,pending_approval"
 *       - in: query
 *         name: openOn
 *         schema:
 *           type: string
 *           enum: [monday, tuesday, wednesday, thursday, friday, saturday, sunday]
 *         description: Filter shops open on specific day
 *         example: "monday"
 *       - in: query
 *         name: openAt
 *         schema:
 *           type: string
 *           pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
 *         description: Filter shops open at specific time (HH:mm)
 *         example: "14:30"
 *       - in: query
 *         name: neLat
 *         schema:
 *           type: number
 *           minimum: -90
 *           maximum: 90
 *         description: Northeast latitude for bounds search
 *         example: 37.52
 *       - in: query
 *         name: neLng
 *         schema:
 *           type: number
 *           minimum: -180
 *           maximum: 180
 *         description: Northeast longitude for bounds search
 *         example: 127.05
 *       - in: query
 *         name: swLat
 *         schema:
 *           type: number
 *           minimum: -90
 *           maximum: 90
 *         description: Southwest latitude for bounds search
 *         example: 37.49
 *       - in: query
 *         name: swLng
 *         schema:
 *           type: number
 *           minimum: -180
 *           maximum: 180
 *         description: Southwest longitude for bounds search
 *         example: 127.02
 *       - in: query
 *         name: paymentMethods
 *         schema:
 *           type: string
 *         description: Payment methods filter (comma-separated)
 *         example: "card,mobile_pay"
 *       - in: query
 *         name: hasServices
 *         schema:
 *           type: string
 *         description: Required services filter (comma-separated)
 *         example: "nail,eyelash"
 *       - in: query
 *         name: serviceNames
 *         schema:
 *           type: string
 *         description: Specific service names (comma-separated)
 *         example: "젤네일,속눈썹연장"
 *       - in: query
 *         name: bookingMin
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Minimum total bookings
 *         example: 100
 *       - in: query
 *         name: bookingMax
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Maximum total bookings
 *         example: 5000
 *       - in: query
 *         name: commissionMin
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *         description: Minimum commission rate
 *         example: 5.0
 *       - in: query
 *         name: commissionMax
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *         description: Maximum commission rate
 *         example: 15.0
 *       - in: query
 *         name: createdAfter
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter shops created after date
 *         example: "2024-01-01"
 *       - in: query
 *         name: createdBefore
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter shops created before date
 *         example: "2024-12-31"
 *       - in: query
 *         name: partnershipAfter
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter partnerships started after date
 *         example: "2024-01-01"
 *       - in: query
 *         name: partnershipBefore
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter partnerships started before date
 *         example: "2024-12-31"
 *       - in: query
 *         name: hasBusinessLicense
 *         schema:
 *           type: boolean
 *         description: Filter shops with business license
 *         example: true
 *       - in: query
 *         name: hasImages
 *         schema:
 *           type: boolean
 *         description: Filter shops with images
 *         example: true
 *       - in: query
 *         name: minImages
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Minimum number of images
 *         example: 3
 *       - in: query
 *         name: excludeIds
 *         schema:
 *           type: string
 *         description: Shop IDs to exclude (comma-separated)
 *         example: "uuid1,uuid2"
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include inactive shops in results
 *         example: false
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
 *                     shops:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ShopSearchResult'
 *                     totalCount:
 *                       type: integer
 *                       example: 45
 *                     hasMore:
 *                       type: boolean
 *                       example: true
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     totalPages:
 *                       type: integer
 *                       example: 3
 *                     searchMetadata:
 *                       $ref: '#/components/schemas/ShopSearchMetadata'
 *                 message:
 *                   type: string
 *                   example: "네일아트 검색 결과 45개를 찾았습니다."
 *       400:
 *         description: Bad request - Invalid parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many requests
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: / 조회
 *     description: GET endpoint for /
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Shops]
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
  searchRateLimit,
  validateRequestWithSchema(enhancedShopSearchSchema, 'query'),
  async (req, res) => {
    try {
      await shopSearchController.searchShops(req, res);
    } catch (error) {
      logger.error('Error in shop search route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '검색 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/shops/search/suggestions:
 *   get:
 *     summary: search suggestions for autocomplete 조회
 *     description: |
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Provides search suggestions based on partial query input for autocomplete functionality.
 *       Returns popular shop names and categories that match the query.
 *     tags: [Shop Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *           maxLength: 50
 *         description: Partial search query for suggestions
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *         example: "네일"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 10
 *           default: 5
 *         description: Maximum number of suggestions to return
 *         example: 5
 *     responses:
 *       200:
 *         description: Search suggestions retrieved successfully
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
 *                     query:
 *                       type: string
 *                       example: "네일"
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["네일아트", "네일케어", "네일샵"]
 *                     count:
 *                       type: integer
 *                       example: 3
 *                 message:
 *                   type: string
 *                   example: "3개의 검색 제안을 찾았습니다."
 *       400:
 *         description: Bad request - Missing or invalid query
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many requests
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /suggestions:
 *   get:
 *     summary: /suggestions 조회
 *     description: GET endpoint for /suggestions
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Shops]
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
router.get('/suggestions',
  suggestionsRateLimit,
  validateRequestBody(enhancedSearchSuggestionsSchema),
  async (req, res) => {
    try {
      await shopSearchController.getSearchSuggestions(req, res);
    } catch (error) {
      logger.error('Error in search suggestions route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '검색 제안을 가져오는 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/shops/search/popular:
 *   get:
 *     summary: popular search terms and trending categories 조회
 *     description: |
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Returns popular search terms and trending categories based on user search patterns.
 *       Useful for displaying popular searches on the search page.
 *     tags: [Shop Search]
 *     responses:
 *       200:
 *         description: Popular searches retrieved successfully
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
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     popularSearches:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["네일아트", "속눈썹 연장", "왁싱"]
 *                     trendingCategories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           category:
 *                             type: string
 *                             example: "nail"
 *                           name:
 *                             type: string
 *                             example: "네일"
 *                           count:
 *                             type: integer
 *                             example: 1250
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00Z"
 *                 message:
 *                   type: string
 *                   example: "인기 검색어를 조회했습니다."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /popular:
 *   get:
 *     summary: /popular 조회
 *     description: GET endpoint for /popular
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Shops]
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
  validateRequestBody(popularSearchesSchema),
  async (req, res) => {
    try {
      await shopSearchController.getPopularSearches(req, res);
    } catch (error) {
      logger.error('Error in popular searches route', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '인기 검색어를 가져오는 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

export default router;
