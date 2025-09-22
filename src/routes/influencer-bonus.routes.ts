/**
 * Influencer Bonus Routes
 * 
 * Routes for influencer bonus system functionality including:
 * - Influencer bonus analytics and reporting
 * - Bonus validation and monitoring
 * - Influencer qualification tracking
 * - Performance metrics and insights
 */

import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { influencerBonusController } from '../controllers/influencer-bonus.controller';
import { validateRequestBody, validateQueryParams } from '../middleware/validation.middleware';
import Joi from 'joi';

const router = Router();

// Validation schemas
const validateInfluencerBonusSchema = Joi.object({
  userId: Joi.string()
    .uuid()
    .required()
    .messages({
      'any.required': '사용자 ID는 필수입니다.',
      'string.guid': '유효한 UUID 형식이어야 합니다.'
    })
});

const checkInfluencerQualificationSchema = Joi.object({
  userId: Joi.string()
    .uuid()
    .required()
    .messages({
      'any.required': '사용자 ID는 필수입니다.',
      'string.guid': '유효한 UUID 형식이어야 합니다.'
    }),
  criteria: Joi.object({
    minimumFollowers: Joi.number()
      .min(0)
      .optional()
      .messages({
        'number.min': '최소 팔로워 수는 0 이상이어야 합니다.'
      }),
    minimumEngagement: Joi.number()
      .min(0)
      .max(100)
      .optional()
      .messages({
        'number.min': '최소 참여도는 0 이상이어야 합니다.',
        'number.max': '최소 참여도는 100 이하여야 합니다.'
      }),
    minimumContentPosts: Joi.number()
      .min(0)
      .optional()
      .messages({
        'number.min': '최소 콘텐츠 게시물 수는 0 이상이어야 합니다.'
      }),
    accountAge: Joi.number()
      .min(0)
      .optional()
      .messages({
        'number.min': '계정 연령은 0 이상이어야 합니다.'
      }),
    verificationStatus: Joi.boolean()
      .optional(),
    contentQuality: Joi.string()
      .valid('high', 'medium', 'low')
      .optional()
      .messages({
        'any.only': '콘텐츠 품질은 high, medium, low 중 하나여야 합니다.'
      })
  }).optional()
});

const influencerBonusStatsQuerySchema = Joi.object({
  startDate: Joi.string()
    .isoDate()
    .optional()
    .messages({
      'string.isoDate': '시작 날짜는 ISO 날짜 형식이어야 합니다.'
    }),
  endDate: Joi.string()
    .isoDate()
    .optional()
    .messages({
      'string.isoDate': '종료 날짜는 ISO 날짜 형식이어야 합니다.'
    })
});

const influencerBonusAnalyticsQuerySchema = Joi.object({
  startDate: Joi.string()
    .isoDate()
    .optional()
    .messages({
      'string.isoDate': '시작 날짜는 ISO 날짜 형식이어야 합니다.'
    }),
  endDate: Joi.string()
    .isoDate()
    .optional()
    .messages({
      'string.isoDate': '종료 날짜는 ISO 날짜 형식이어야 합니다.'
    })
});

// =============================================
// ADMIN INFLUENCER BONUS ENDPOINTS (Admin only)
// =============================================

/**
 * GET /api/admin/influencer-bonus/stats
 * Get influencer bonus statistics for admin dashboard
 * 
 * Rate limited: Standard rate limiting
 * Requires: Authentication + Admin role
 * Returns: Overall influencer bonus statistics and metrics
 */

/**
 * @swagger
 * /admin/influencer-bonus/stats:
 *   get:
 *     summary: /admin/influencer-bonus/stats 조회
 *     description: GET endpoint for /admin/influencer-bonus/stats
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
router.get('/admin/influencer-bonus/stats',
  rateLimit(),
  authenticateJWT(),
  validateQueryParams(influencerBonusStatsQuerySchema),
  influencerBonusController.getInfluencerBonusStats
);

/**
 * GET /api/admin/influencer-bonus/analytics/:influencerId
 * Get detailed analytics for a specific influencer
 * 
 * Rate limited: Standard rate limiting
 * Requires: Authentication + Admin role
 * Returns: Detailed influencer bonus analytics and performance metrics
 */
/**
 * @swagger
 * /admin/influencer-bonus/analytics/:influencerId:
 *   get:
 *     summary: /admin/influencer-bonus/analytics/:influencerId 조회
 *     description: GET endpoint for /admin/influencer-bonus/analytics/:influencerId
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Influencer System]
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

router.get('/admin/influencer-bonus/analytics/:influencerId',
  rateLimit(),
  authenticateJWT(),
  validateQueryParams(influencerBonusAnalyticsQuerySchema),
  influencerBonusController.getInfluencerBonusAnalytics
);

/**
 * POST /api/admin/influencer-bonus/validate/:transactionId
 * Validate influencer bonus calculation for a specific transaction
 * 
 * Rate limited: Standard rate limiting
 * Requires: Authentication + Admin role
 * Returns: Validation results with errors and warnings
 */
/**
 * @swagger
 * /admin/influencer-bonus/validate/:transactionId:
 *   post:
 *     summary: POST /admin/influencer-bonus/validate/:transactionId (POST /admin/influencer-bonus/validate/:transactionId)
 *     description: POST endpoint for /admin/influencer-bonus/validate/:transactionId
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Influencer System]
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

router.post('/admin/influencer-bonus/validate/:transactionId',
  rateLimit(),
  authenticateJWT(),
  validateRequestBody(validateInfluencerBonusSchema),
  influencerBonusController.validateInfluencerBonus
);

/**
 * POST /api/admin/influencer-bonus/check-qualification
 * Check influencer qualification based on criteria
 * 
 * Rate limited: Standard rate limiting
 * Requires: Authentication + Admin role
 * Returns: Qualification check results with recommendations
 */

/**
 * @swagger
 * /admin/influencer-bonus/check-qualification:
 *   post:
 *     summary: POST /admin/influencer-bonus/check-qualification (POST /admin/influencer-bonus/check-qualification)
 *     description: POST endpoint for /admin/influencer-bonus/check-qualification
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
router.post('/admin/influencer-bonus/check-qualification',
  rateLimit(),
  authenticateJWT(),
  validateRequestBody(checkInfluencerQualificationSchema),
  influencerBonusController.checkInfluencerQualification
);

export default router; 