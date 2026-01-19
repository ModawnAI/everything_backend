import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { referralController } from '../controllers/referral.controller';
import { validateRequestBody, validateQueryParams } from '../middleware/validation.middleware';
import Joi from 'joi';

/**
 * Referral Routes
 * 
 * Handles all referral system endpoints:
 * - GET /referrals/stats - Get user's referral statistics
 * - GET /referrals/history - Get user's referral history
 * - PUT /referrals/:referralId/status - Update referral status (admin)
 * - POST /referrals/:referralId/payout - Process bonus payout (admin)
 * - GET /referrals/analytics - Get referral analytics (admin)
 */

const router = Router();

// Validation schemas
const updateReferralStatusSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'completed', 'cancelled', 'expired')
    .required()
    .messages({
      'any.required': '상태는 필수입니다.',
      'any.only': '상태는 pending, completed, cancelled, expired 중 하나여야 합니다.'
    }),
  notes: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': '메모는 최대 500자까지 가능합니다.'
    })
});

const referralPayoutSchema = Joi.object({
  payoutMethod: Joi.string()
    .valid('points', 'cash', 'bank_transfer')
    .required()
    .messages({
      'any.required': '지급 방법은 필수입니다.',
      'any.only': '지급 방법은 points, cash, bank_transfer 중 하나여야 합니다.'
    }),
  payoutDetails: Joi.object({
    accountNumber: Joi.string()
      .pattern(/^[0-9-]+$/)
      .optional()
      .messages({
        'string.pattern.base': '계좌번호는 숫자와 하이픈만 가능합니다.'
      }),
    bankName: Joi.string()
      .max(100)
      .optional()
      .messages({
        'string.max': '은행명은 최대 100자까지 가능합니다.'
      }),
    recipientName: Joi.string()
      .max(100)
      .optional()
      .messages({
        'string.max': '수취인명은 최대 100자까지 가능합니다.'
      })
  }).optional()
});

const referralHistoryQuerySchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.base': '페이지 번호는 숫자여야 합니다.',
      'number.integer': '페이지 번호는 정수여야 합니다.',
      'number.min': '페이지 번호는 1 이상이어야 합니다.'
    }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      'number.base': '페이지 크기는 숫자여야 합니다.',
      'number.integer': '페이지 크기는 정수여야 합니다.',
      'number.min': '페이지 크기는 1 이상이어야 합니다.',
      'number.max': '페이지 크기는 100 이하여야 합니다.'
    })
});

const setReferrerSchema = Joi.object({
  referralCode: Joi.string()
    .trim()
    .min(4)
    .max(12)
    .required()
    .messages({
      'any.required': '추천 코드는 필수입니다.',
      'string.empty': '추천 코드를 입력해주세요.',
      'string.min': '추천 코드는 최소 4자 이상이어야 합니다.',
      'string.max': '추천 코드는 최대 12자까지 가능합니다.'
    })
});

/**
 * GET /api/referrals/stats
 * Get referral statistics for authenticated user
 * 
 * Rate limited: Standard rate limiting
 * Requires: Authentication
 * Returns: User's referral statistics and recent referrals
 */

/**
 * @swagger
 * /stats:
 *   get:
 *     summary: /stats 조회
 *     description: GET endpoint for /stats
 *       
 *       추천 시스템 API입니다. 추천 코드와 리워드 관리를 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Points & Rewards]
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
  // rateLimit(), // 임시 비활성화 - 성능 테스트
  authenticateJWT(),
  referralController.getReferralStats
);

/**
 * GET /api/referrals/history
 * Get referral history for authenticated user
 * 
 * Rate limited: Standard rate limiting
 * Requires: Authentication
 * Query params: page (optional), limit (optional, max 100)
 * Returns: Paginated referral history
 */
/**
 * @swagger
 * /history:
 *   get:
 *     summary: /history 조회
 *     description: GET endpoint for /history
 *       
 *       추천 시스템 API입니다. 추천 코드와 리워드 관리를 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Referral System]
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

router.get('/history',
  rateLimit(),
  authenticateJWT(),
  validateQueryParams(referralHistoryQuerySchema),
  referralController.getReferralHistory
);

/**
 * PUT /api/referrals/:referralId/status
 * Update referral status (admin only)
 * 
 * Rate limited: Standard rate limiting
 * Requires: Authentication + Admin role
 * Body: { status: string, notes?: string }
 * Returns: Updated referral record
 */
/**
 * @swagger
 * /:referralId/status:
 *   put:
 *     summary: PUT /:referralId/status (PUT /:referralId/status)
 *     description: PUT endpoint for /:referralId/status
 *       
 *       추천 시스템 API입니다. 추천 코드와 리워드 관리를 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Referral System]
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

router.put('/:referralId/status',
  rateLimit(),
  authenticateJWT(),
  validateRequestBody(updateReferralStatusSchema),
  referralController.updateReferralStatus
);

/**
 * POST /api/referrals/:referralId/payout
 * Process referral bonus payout (admin only)
 * 
 * Rate limited: Standard rate limiting
 * Requires: Authentication + Admin role
 * Body: { payoutMethod: string, payoutDetails?: object }
 * Returns: Payout transaction details
 */

/**
 * @swagger
 * /:referralId/payout:
 *   post:
 *     summary: POST /:referralId/payout (POST /:referralId/payout)
 *     description: POST endpoint for /:referralId/payout
 *       
 *       추천 시스템 API입니다. 추천 코드와 리워드 관리를 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Points & Rewards]
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
router.post('/:referralId/payout',
  rateLimit(),
  authenticateJWT(),
  validateRequestBody(referralPayoutSchema),
  referralController.processReferralPayout
);

/**
 * GET /api/referrals/analytics
 * Get referral analytics for admin dashboard
 * 
 * Rate limited: Standard rate limiting
 * Requires: Authentication + Admin role
 * Returns: Overall referral analytics and statistics
 */
/**
 * @swagger
 * /analytics:
 *   get:
 *     summary: /analytics 조회
 *     description: GET endpoint for /analytics
 *       
 *       추천 시스템 API입니다. 추천 코드와 리워드 관리를 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Referral System]
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

router.get('/analytics',
  rateLimit(),
  authenticateJWT(),
  referralController.getReferralAnalytics
);

/**
 * GET /api/referrals/my-referrer
 * Get the referrer info for authenticated user (who referred this user)
 *
 * Rate limited: Standard rate limiting
 * Requires: Authentication
 * Returns: Referrer info or null if not set
 */
/**
 * @swagger
 * /my-referrer:
 *   get:
 *     summary: 나를 추천한 친구 정보 조회
 *     description: GET endpoint for /my-referrer
 *
 *       현재 로그인한 사용자를 추천한 친구(추천인) 정보를 조회합니다.
 *
 *       ---
 *
 *     tags: [Referral System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success - returns referrer info or null
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal Server Error
 */
router.get('/my-referrer',
  rateLimit(),
  authenticateJWT(),
  referralController.getMyReferrer
);

/**
 * POST /api/referrals/set-referrer
 * Set referrer using referral code
 *
 * Rate limited: Standard rate limiting
 * Requires: Authentication
 * Body: { referralCode: string }
 * Returns: Success status and referrer info
 */
/**
 * @swagger
 * /set-referrer:
 *   post:
 *     summary: 추천인 설정 (추천 코드 사용)
 *     description: POST endpoint for /set-referrer
 *
 *       추천 코드를 사용하여 추천인을 설정합니다.
 *       추천인은 설정 후 3개월이 지나야 변경할 수 있습니다.
 *
 *       ---
 *
 *     tags: [Referral System]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - referralCode
 *             properties:
 *               referralCode:
 *                 type: string
 *                 description: 추천 코드 (4-12자)
 *                 example: "ABC12345"
 *     responses:
 *       200:
 *         description: Success - referrer set successfully
 *       400:
 *         description: Bad Request - invalid code, self-referral, or change not allowed
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal Server Error
 */
router.post('/set-referrer',
  rateLimit(),
  authenticateJWT(),
  validateRequestBody(setReferrerSchema),
  referralController.setReferrer
);

export default router; 