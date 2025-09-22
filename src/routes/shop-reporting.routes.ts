import { Router } from 'express';
import { shopReportingController } from '../controllers/shop-reporting.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { validateRequestWithSchema } from '../middleware/validation.middleware';
import Joi from 'joi';
import { logger } from '../utils/logger';

const router = Router();

// Rate limiting for shop reporting endpoints
const reportRateLimit = rateLimit({
  config: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 5, // Maximum 5 reports per user per day
    message: 'Too many reports submitted. Maximum 5 reports per day.',
    keyGenerator: (req) => {
      // Use user ID for rate limiting if authenticated
      return (req as any).user?.id || req.ip;
    }
  }
});

const generalRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Maximum 100 requests per 15 minutes
    message: 'Too many requests, please try again later.',
  }
});

// Validation schemas
const createReportSchema = Joi.object({
  report_type: Joi.string()
    .valid('inappropriate_content', 'spam', 'fake_listing', 'harassment', 'other')
    .required()
    .messages({
      'any.required': 'Report type is required',
      'any.only': 'Invalid report type'
    }),
  title: Joi.string()
    .trim()
    .min(5)
    .max(200)
    .required()
    .messages({
      'string.min': 'Title must be at least 5 characters long',
      'string.max': 'Title must be 200 characters or less',
      'any.required': 'Title is required'
    }),
  description: Joi.string()
    .trim()
    .min(20)
    .max(1000)
    .required()
    .messages({
      'string.min': 'Description must be at least 20 characters long',
      'string.max': 'Description must be 1000 characters or less',
      'any.required': 'Description is required'
    }),
  evidence_urls: Joi.array()
    .items(
      Joi.string()
        .uri({ scheme: ['http', 'https'] })
        .max(500)
        .messages({
          'string.uri': 'Evidence URL must be a valid HTTP/HTTPS URL',
          'string.max': 'Evidence URL must be 500 characters or less'
        })
    )
    .max(5)
    .optional()
    .messages({
      'array.max': 'Maximum 5 evidence URLs allowed'
    })
});

const updateReportSchema = Joi.object({
  title: Joi.string()
    .trim()
    .min(5)
    .max(200)
    .optional()
    .messages({
      'string.min': 'Title must be at least 5 characters long',
      'string.max': 'Title must be 200 characters or less'
    }),
  description: Joi.string()
    .trim()
    .min(20)
    .max(1000)
    .optional()
    .messages({
      'string.min': 'Description must be at least 20 characters long',
      'string.max': 'Description must be 1000 characters or less'
    }),
  evidence_urls: Joi.array()
    .items(
      Joi.string()
        .uri({ scheme: ['http', 'https'] })
        .max(500)
        .messages({
          'string.uri': 'Evidence URL must be a valid HTTP/HTTPS URL',
          'string.max': 'Evidence URL must be 500 characters or less'
        })
    )
    .max(5)
    .optional()
    .messages({
      'array.max': 'Maximum 5 evidence URLs allowed'
    })
});

const reportIdSchema = Joi.object({
  reportId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid report ID format',
      'any.required': 'Report ID is required'
    })
});

const shopIdSchema = Joi.object({
  shopId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid shop ID format',
      'any.required': 'Shop ID is required'
    })
});

const queryParamsSchema = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(50)
    .optional()
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit must be at most 50'
    }),
  offset: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Offset must be a number',
      'number.integer': 'Offset must be an integer',
      'number.min': 'Offset must be at least 0'
    })
});

/**
 * @swagger
 * components:
 *   schemas:
 *     ShopReport:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the report
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *         shop_id:
 *           type: string
 *           format: uuid
 *           description: ID of the reported shop
 *         report_type:
 *           type: string
 *           enum: [inappropriate_content, spam, fake_listing, harassment, other]
 *           description: Type of report
 *         title:
 *           type: string
 *           maxLength: 200
 *           description: Report title
 *         description:
 *           type: string
 *           maxLength: 1000
 *           description: Detailed description of the issue
 *         evidence_urls:
 *           type: array
 *           items:
 *             type: string
 *             format: uri
 *           maxItems: 5
 *           description: URLs to evidence supporting the report
 *         status:
 *           type: string
 *           enum: [pending, under_review, resolved, dismissed]
 *           description: Current status of the report
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: When the report was created
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: When the report was last updated
 *     
 *     CreateShopReportRequest:
 *       type: object
 *       required:
 *         - report_type
 *         - title
 *         - description
 *       properties:
 *         report_type:
 *           type: string
 *           enum: [inappropriate_content, spam, fake_listing, harassment, other]
 *           description: Type of report
 *         title:
 *           type: string
 *           minLength: 5
 *           maxLength: 200
 *           description: Report title
 *         description:
 *           type: string
 *           minLength: 20
 *           maxLength: 1000
 *           description: Detailed description of the issue
 *         evidence_urls:
 *           type: array
 *           items:
 *             type: string
 *             format: uri
 *           maxItems: 5
 *           description: URLs to evidence supporting the report
 *     
 *     ShopReportResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Whether the request was successful
 *         data:
 *           type: object
 *           properties:
 *             report:
 *               $ref: '#/components/schemas/ShopReport'
 *         message:
 *           type: string
 *           description: Success message
 *     
 *     ShopReportsListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Whether the request was successful
 *         data:
 *           type: object
 *           properties:
 *             reports:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ShopReport'
 *             pagination:
 *               type: object
 *               properties:
 *                 limit:
 *                   type: number
 *                   description: Number of items per page
 *                 offset:
 *                   type: number
 *                   description: Number of items skipped
 *                 total:
 *                   type: number
 *                   description: Total number of reports
 *                 hasMore:
 *                   type: boolean
 *                   description: Whether there are more reports available
 */

/**
 * @swagger
 * /api/shops/{shopId}/report:
 *   post:
 *     summary: Report a shop for inappropriate content or behavior (Report a shop for inappropriate content or behavior)
 *     description: Create a new report for a specific shop. Users can submit up to 5 reports per day.
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags:
 *       - Shop Reporting
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the shop to report
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateShopReportRequest'
 *           examples:
 *             inappropriate_content:
 *               summary: Report inappropriate content
 *               value:
 *                 report_type: inappropriate_content
 *                 title: "Inappropriate images in shop profile"
 *                 description: "The shop has posted inappropriate images that violate community guidelines. The images contain explicit content that is not suitable for this platform."
 *                 evidence_urls:
 *                   - "https://example.com/evidence1.jpg"
 *                   - "https://example.com/evidence2.jpg"
 *             spam:
 *               summary: Report spam
 *               value:
 *                 report_type: spam
 *                 title: "Fake shop posting spam content"
 *                 description: "This shop appears to be fake and is posting spam content. The shop information seems fabricated and they are posting irrelevant promotional content."
 *             harassment:
 *               summary: Report harassment
 *               value:
 *                 report_type: harassment
 *                 title: "Shop owner sending harassing messages"
 *                 description: "The shop owner has been sending harassing and threatening messages to customers who leave negative reviews."
 *     responses:
 *       201:
 *         description: Report created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShopReportResponse'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Shop not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Duplicate report (user has already reported this shop)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       429:
 *         description: Rate limit exceeded (daily report limit reached)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/:shopId/report',
  authenticateToken,
  reportRateLimit,
  validateRequestWithSchema(shopIdSchema, 'params'),
  validateRequestWithSchema(createReportSchema, 'body'),
  async (req, res) => {
    await shopReportingController.createShopReport(req as any, res);
  }
);

/**
 * @swagger
 * /api/shops/reports:
 *   get:
 *     summary: user's shop reports 조회
 *     description: Retrieve a paginated list of reports submitted by the authenticated user
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags:
 *       - Shop Reporting
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Number of reports to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of reports to skip
 *     responses:
 *       200:
 *         description: Reports retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShopReportsListResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/reports',
  authenticateToken,
  generalRateLimit,
  validateRequestWithSchema(queryParamsSchema, 'query'),
  async (req, res) => {
    await shopReportingController.getUserReports(req as any, res);
  }
);

/**
 * @swagger
 * /api/shops/reports/{reportId}:
 *   get:
 *     summary: a specific shop report 조회
 *     description: Retrieve details of a specific report submitted by the authenticated user
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags:
 *       - Shop Reporting
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the report to retrieve
 *     responses:
 *       200:
 *         description: Report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShopReportResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Report not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/reports/:reportId',
  authenticateToken,
  generalRateLimit,
  validateRequestWithSchema(reportIdSchema, 'params'),
  async (req, res) => {
    await shopReportingController.getReportById(req as any, res);
  }
);

/**
 * @swagger
 * /api/shops/reports/{reportId}:
 *   put:
 *     summary: a shop report 수정
 *     description: Update a pending report submitted by the authenticated user. Only pending reports can be updated.
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags:
 *       - Shop Reporting
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the report to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 200
 *                 description: Updated report title
 *               description:
 *                 type: string
 *                 minLength: 20
 *                 maxLength: 1000
 *                 description: Updated report description
 *               evidence_urls:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *                 maxItems: 5
 *                 description: Updated evidence URLs
 *     responses:
 *       200:
 *         description: Report updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShopReportResponse'
 *       400:
 *         description: Invalid request data or report not in pending status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Report not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.put(
  '/reports/:reportId',
  authenticateToken,
  generalRateLimit,
  validateRequestWithSchema(reportIdSchema, 'params'),
  validateRequestWithSchema(updateReportSchema, 'body'),
  async (req, res) => {
    await shopReportingController.updateReport(req as any, res);
  }
);

/**
 * @swagger
 * /api/shops/reports/{reportId}:
 *   delete:
 *     summary: a shop report 삭제
 *     description: Delete a pending report submitted by the authenticated user. Only pending reports can be deleted.
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags:
 *       - Shop Reporting
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the report to delete
 *     responses:
 *       200:
 *         description: Report deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Report not in pending status or cannot be deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Report not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete(
  '/reports/:reportId',
  authenticateToken,
  generalRateLimit,
  validateRequestWithSchema(reportIdSchema, 'params'),
  async (req, res) => {
    await shopReportingController.deleteReport(req as any, res);
  }
);

export default router;
