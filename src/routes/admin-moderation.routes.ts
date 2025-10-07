import { Router } from 'express';
import { adminModerationController } from '../controllers/admin-moderation.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { validateRequestWithSchema } from '../middleware/validation.middleware';
import Joi from 'joi';
import { logger } from '../utils/logger';

const router = Router();

// Rate limiting for admin moderation endpoints
const adminRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Maximum 1000 requests per 15 minutes for admin
    message: 'Too many requests, please try again later.',
  }
});

// Validation schemas
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
  status: Joi.string()
    .valid('pending', 'under_review', 'resolved', 'dismissed')
    .optional()
    .messages({
      'any.only': 'Invalid status value'
    }),
  report_type: Joi.string()
    .valid('inappropriate_content', 'spam', 'fake_listing', 'harassment', 'other')
    .optional()
    .messages({
      'any.only': 'Invalid report type'
    }),
  shop_id: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': 'Invalid shop ID format'
    }),
  reporter_id: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': 'Invalid reporter ID format'
    }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit must be at most 100'
    }),
  offset: Joi.number()
    .integer()
    .min(0)
    .optional()
    .messages({
      'number.base': 'Offset must be a number',
      'number.integer': 'Offset must be an integer',
      'number.min': 'Offset must be at least 0'
    }),
  sort_by: Joi.string()
    .valid('created_at', 'updated_at', 'status', 'report_type')
    .optional()
    .messages({
      'any.only': 'Invalid sort field'
    }),
  sort_order: Joi.string()
    .valid('asc', 'desc')
    .optional()
    .messages({
      'any.only': 'Invalid sort order'
    }),
  search: Joi.string()
    .max(100)
    .optional()
    .messages({
      'string.max': 'Search term must be 100 characters or less'
    }),
  date_from: Joi.string()
    .isoDate()
    .optional()
    .messages({
      'string.isoDate': 'Invalid date format for date_from'
    }),
  date_to: Joi.string()
    .isoDate()
    .optional()
    .messages({
      'string.isoDate': 'Invalid date format for date_to'
    })
});

const updateReportSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'under_review', 'resolved', 'dismissed')
    .optional()
    .messages({
      'any.only': 'Invalid status value'
    }),
  admin_notes: Joi.string()
    .max(1000)
    .optional()
    .allow('')
    .messages({
      'string.max': 'Admin notes must be 1000 characters or less'
    }),
  action_type: Joi.string()
    .valid('block', 'flag', 'warn', 'approve', 'reject', 'dismiss')
    .optional()
    .messages({
      'any.only': 'Invalid action type'
    }),
  reason: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Reason must be 500 characters or less'
    })
});

const bulkActionSchema = Joi.object({
  report_ids: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one report ID is required',
      'array.max': 'Maximum 100 report IDs allowed',
      'any.required': 'Report IDs array is required'
    }),
  action_type: Joi.string()
    .valid('block', 'flag', 'warn', 'approve', 'reject', 'dismiss')
    .required()
    .messages({
      'any.only': 'Invalid action type',
      'any.required': 'Action type is required'
    }),
  reason: Joi.string()
    .min(5)
    .max(500)
    .required()
    .messages({
      'string.min': 'Reason must be at least 5 characters long',
      'string.max': 'Reason must be 500 characters or less',
      'any.required': 'Reason is required'
    })
});

/**
 * @swagger
 * components:
 *   schemas:
 *     ShopReportWithDetails:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the report
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *         shop_id:
 *           type: string
 *           format: uuid
 *           description: ID of the reported shop
 *         reporter_id:
 *           type: string
 *           format: uuid
 *           description: ID of the user who reported
 *         report_type:
 *           type: string
 *           enum: [inappropriate_content, spam, fake_listing, harassment, other]
 *           description: Type of report
 *         title:
 *           type: string
 *           description: Report title
 *         description:
 *           type: string
 *           description: Detailed description of the issue
 *         evidence_urls:
 *           type: array
 *           items:
 *             type: string
 *             format: uri
 *           description: URLs to evidence supporting the report
 *         status:
 *           type: string
 *           enum: [pending, under_review, resolved, dismissed]
 *           description: Current status of the report
 *         admin_notes:
 *           type: string
 *           description: Admin notes on the report
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: When the report was created
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: When the report was last updated
 *         shops:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             name:
 *               type: string
 *             description:
 *               type: string
 *             status:
 *               type: string
 *         users:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             email:
 *               type: string
 *             username:
 *               type: string
 *     
 *     ModerationStats:
 *       type: object
 *       properties:
 *         reports:
 *           type: object
 *           properties:
 *             total:
 *               type: number
 *               description: Total number of reports
 *             status_breakdown:
 *               type: object
 *               properties:
 *                 pending:
 *                   type: number
 *                 under_review:
 *                   type: number
 *                 resolved:
 *                   type: number
 *                 dismissed:
 *                   type: number
 *             type_breakdown:
 *               type: object
 *               properties:
 *                 inappropriate_content:
 *                   type: number
 *                 spam:
 *                   type: number
 *                 fake_listing:
 *                   type: number
 *                 harassment:
 *                   type: number
 *                 other:
 *                   type: number
 *         actions:
 *           type: object
 *           properties:
 *             total:
 *               type: number
 *               description: Total number of moderation actions
 *             type_breakdown:
 *               type: object
 *               properties:
 *                 auto_block:
 *                   type: number
 *                 auto_flag:
 *                   type: number
 *                 manual_review:
 *                   type: number
 *                 approve:
 *                   type: number
 *                 reject:
 *                   type: number
 *                 warning:
 *                   type: number
 */

/**
 * @swagger
 * /api/admin/shop-reports:
 *   get:
 *     summary: all shop reports with filtering and pagination 조회
 *     description: Retrieve a paginated list of shop reports with filtering options for admin review
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags:
 *       - Admin Moderation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, under_review, resolved, dismissed]
 *         description: Filter by report status
 *       - in: query
 *         name: report_type
 *         schema:
 *           type: string
 *           enum: [inappropriate_content, spam, fake_listing, harassment, other]
 *         description: Filter by report type
 *       - in: query
 *         name: shop_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by shop ID
 *       - in: query
 *         name: reporter_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by reporter ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of reports to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of reports to skip
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, status, report_type]
 *           default: created_at
 *         description: Field to sort by
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 100
 *         description: Search in report title and description
 *     responses:
 *       200:
 *         description: Reports retrieved successfully
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
 *                     reports:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ShopReportWithDetails'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         limit:
 *                           type: number
 *                         offset:
 *                           type: number
 *                         total:
 *                           type: number
 *                         hasMore:
 *                           type: boolean
 *                     filters:
 *                       type: object
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Admin access required
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
  '/shop-reports',
  authenticateToken,
  adminRateLimit,
  validateRequestWithSchema(queryParamsSchema, 'query'),
  async (req, res) => {
    await adminModerationController.getShopReports(req as any, res);
  }
);

/**
 * @swagger
 * /api/admin/shop-reports/{reportId}:
 *   get:
 *     summary: a specific shop report by ID 조회
 *     description: Retrieve detailed information about a specific shop report
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags:
 *       - Admin Moderation
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
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     report:
 *                       $ref: '#/components/schemas/ShopReportWithDetails'
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
  '/shop-reports/:reportId',
  authenticateToken,
  adminRateLimit,
  validateRequestWithSchema(reportIdSchema, 'params'),
  async (req, res) => {
    await adminModerationController.getShopReportById(req as any, res);
  }
);

/**
 * @swagger
 * /api/admin/shop-reports/{reportId}:
 *   put:
 *     summary: shop report status and resolution 수정
 *     description: Update a shop report's status and take moderation actions
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags:
 *       - Admin Moderation
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
 *               status:
 *                 type: string
 *                 enum: [pending, under_review, resolved, dismissed]
 *                 description: New status for the report
 *               admin_notes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Admin notes on the report
 *               action_type:
 *                 type: string
 *                 enum: [block, flag, warn, approve, reject, dismiss]
 *                 description: Moderation action to take
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for the moderation action
 *     responses:
 *       200:
 *         description: Report updated successfully
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
 *                     report:
 *                       $ref: '#/components/schemas/ShopReportWithDetails'
 *                 message:
 *                   type: string
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
  '/shop-reports/:reportId',
  authenticateToken,
  adminRateLimit,
  validateRequestWithSchema(reportIdSchema, 'params'),
  validateRequestWithSchema(updateReportSchema, 'body'),
  async (req, res) => {
    await adminModerationController.updateShopReport(req as any, res);
  }
);

/**
 * @swagger
 * /api/admin/shops/{shopId}/moderation-history:
 *   get:
 *     summary: moderation history for a specific shop 조회
 *     description: Retrieve complete moderation history including reports and actions for a shop
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags:
 *       - Admin Moderation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the shop to get moderation history for
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of items to skip
 *     responses:
 *       200:
 *         description: Moderation history retrieved successfully
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
 *                     shop_id:
 *                       type: string
 *                       format: uuid
 *                     moderation_status:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         moderation_score:
 *                           type: number
 *                         last_moderated:
 *                           type: string
 *                           format: date-time
 *                         violation_count:
 *                           type: number
 *                         warning_count:
 *                           type: number
 *                     moderation_actions:
 *                       type: array
 *                       items:
 *                         type: object
 *                     reports:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
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
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  '/shops/:shopId/moderation-history',
  authenticateToken,
  adminRateLimit,
  async (req, res) => {
    await adminModerationController.getShopModerationHistory(req as any, res);
  }
);

/**
 * @swagger
 * /api/admin/shop-reports/bulk-action:
 *   post:
 *     summary: Execute bulk actions on multiple reports (Execute bulk actions on multiple reports)
 *     description: Apply the same moderation action to multiple shop reports at once
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags:
 *       - Admin Moderation
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - report_ids
 *               - action_type
 *               - reason
 *             properties:
 *               report_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 minItems: 1
 *                 maxItems: 100
 *                 description: Array of report IDs to process
 *               action_type:
 *                 type: string
 *                 enum: [block, flag, warn, approve, reject, dismiss]
 *                 description: Moderation action to apply to all reports
 *               reason:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 500
 *                 description: Reason for the bulk action
 *     responses:
 *       200:
 *         description: Bulk action completed successfully
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
 *                     results:
 *                       type: object
 *                       properties:
 *                         successful:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               report_id:
 *                                 type: string
 *                                 format: uuid
 *                               action_id:
 *                                 type: string
 *                                 format: uuid
 *                         failed:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               report_id:
 *                                 type: string
 *                                 format: uuid
 *                               error:
 *                                 type: string
 *                         total:
 *                           type: number
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         successful:
 *                           type: number
 *                         failed:
 *                           type: number
 *                         success_rate:
 *                           type: string
 *                 message:
 *                   type: string
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
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/shop-reports/bulk-action',
  authenticateToken,
  adminRateLimit,
  validateRequestWithSchema(bulkActionSchema, 'body'),
  async (req, res) => {
    await adminModerationController.executeBulkAction(req as any, res);
  }
);

/**
 * @swagger
 * /api/admin/moderation/stats:
 *   get:
 *     summary: moderation statistics and analytics 조회
 *     description: Retrieve comprehensive statistics about reports and moderation actions
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags:
 *       - Admin Moderation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for statistics (ISO 8601 format)
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for statistics (ISO 8601 format)
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
 *                 data:
 *                   $ref: '#/components/schemas/ModerationStats'
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
  '/moderation/stats',
  authenticateToken,
  adminRateLimit,
  validateRequestWithSchema(queryParamsSchema, 'query'),
  async (req, res) => {
    await adminModerationController.getModerationStats(req as any, res);
  }
);

/**
 * @swagger
 * /api/admin/shops/{shopId}/analyze-content:
 *   post:
 *     summary: Analyze shop content for moderation (Analyze shop content for moderation)
 *     description: Perform automated content analysis on a shop's content
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags:
 *       - Admin Moderation
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the shop to analyze
 *     responses:
 *       200:
 *         description: Content analysis completed successfully
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
 *                     shop_id:
 *                       type: string
 *                       format: uuid
 *                     analysis:
 *                       type: object
 *                       properties:
 *                         overall_result:
 *                           type: object
 *                           properties:
 *                             is_appropriate:
 *                               type: boolean
 *                             severity:
 *                               type: string
 *                               enum: [low, medium, high, critical]
 *                             score:
 *                               type: number
 *                             violations:
 *                               type: array
 *                             suggested_action:
 *                               type: string
 *                               enum: [allow, flag, block, review]
 *                             confidence:
 *                               type: number
 *                         individual_results:
 *                           type: object
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
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  '/shops/:shopId/analyze-content',
  authenticateToken,
  adminRateLimit,
  validateRequestWithSchema(shopIdSchema, 'params'),
  async (req, res) => {
    await adminModerationController.analyzeShopContent(req as any, res);
  }
);

// Feed Content Moderation Endpoints

/**
 * @swagger
 * /api/admin/content/reported:
 *   get:
 *     summary: reported feed posts for admin review 조회
 *     description: Retrieve a list of reported feed posts that require admin moderation
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Admin Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, under_review, resolved, dismissed]
 *         description: Filter by report status
 *       - in: query
 *         name: reason
 *         schema:
 *           type: string
 *           enum: [spam, harassment, inappropriate_content, fake_information, violence, hate_speech, copyright_violation, impersonation, scam, adult_content, other]
 *         description: Filter by report reason
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of reported posts retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  '/content/reported',
  authenticateToken,
  adminRateLimit,
  validateRequestWithSchema(Joi.object({
    status: Joi.string().valid('pending', 'under_review', 'resolved', 'dismissed').optional(),
    reason: Joi.string().valid('spam', 'harassment', 'inappropriate_content', 'fake_information', 'violence', 'hate_speech', 'copyright_violation', 'impersonation', 'scam', 'adult_content', 'other').optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }), 'query'),
  async (req, res) => {
    await adminModerationController.getReportedContent(req as any, res);
  }
);

/**
 * @swagger
 * /api/admin/content/{contentId}/moderate:
 *   put:
 *     summary: Moderate a reported feed post (Moderate a reported feed post)
 *     description: Take moderation action on a reported feed post
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Admin Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contentId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: ID of the content to moderate
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, hide, remove, warn_user, ban_user]
 *                 description: Moderation action to take
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for the moderation action
 *               notify_user:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to notify the user of the action
 *     responses:
 *       200:
 *         description: Moderation action completed successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Content not found
 *       500:
 *         description: Internal server error
 */
router.put(
  '/content/:contentId/moderate',
  authenticateToken,
  adminRateLimit,
  validateRequestWithSchema(Joi.object({
    action: Joi.string().valid('approve', 'hide', 'remove', 'warn_user', 'ban_user').required(),
    reason: Joi.string().max(500).optional(),
    notify_user: Joi.boolean().default(true)
  }), 'body'),
  async (req, res) => {
    await adminModerationController.moderateContent(req as any, res);
  }
);

/**
 * @swagger
 * /api/admin/content/moderation-queue:
 *   get:
 *     summary: content moderation queue 조회
 *     description: Retrieve posts that need immediate admin attention based on automatic flagging
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Admin Moderation]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [high, medium, low]
 *         description: Filter by priority level
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Moderation queue retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get(
  '/content/moderation-queue',
  authenticateToken,
  adminRateLimit,
  validateRequestWithSchema(Joi.object({
    priority: Joi.string().valid('high', 'medium', 'low').optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(20)
  }), 'query'),
  async (req, res) => {
    await adminModerationController.getModerationQueue(req as any, res);
  }
);

export default router;
