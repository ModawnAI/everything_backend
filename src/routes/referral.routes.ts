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

/**
 * GET /api/referrals/stats
 * Get referral statistics for authenticated user
 * 
 * Rate limited: Standard rate limiting
 * Requires: Authentication
 * Returns: User's referral statistics and recent referrals
 */
router.get('/stats',
  rateLimit(),
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
router.get('/analytics',
  rateLimit(),
  authenticateJWT(),
  referralController.getReferralAnalytics
);

export default router; 