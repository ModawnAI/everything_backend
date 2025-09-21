import { Router } from 'express';
import { referralCodeController } from '../controllers/referral-code.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/auth.middleware';
import { validateRequestBody, validateQueryParams } from '../middleware/validation.middleware';
import Joi from 'joi';

const router = Router();

// Validation schemas
const generateReferralCodeSchema = Joi.object({
  length: Joi.number().min(4).max(12).optional(),
  excludeSimilar: Joi.boolean().optional(),
  excludeProfanity: Joi.boolean().optional()
});

const batchGenerateSchema = Joi.object({
  count: Joi.number().min(1).max(100).optional(),
  options: Joi.object({
    length: Joi.number().min(4).max(12).optional(),
    prefix: Joi.string().max(4).optional(),
    suffix: Joi.string().max(4).optional(),
    excludeSimilar: Joi.boolean().optional(),
    excludeProfanity: Joi.boolean().optional(),
    maxAttempts: Joi.number().min(10).max(100).optional(),
    cacheSize: Joi.number().min(10).max(1000).optional()
  }).optional()
});

const validateReferralCodeSchema = Joi.object({
  code: Joi.string().min(4).max(12).pattern(/^[A-Z0-9]+$/).required()
});

/**
 * @route POST /api/referral-codes/generate
 * @desc Generate a new referral code for the authenticated user
 * @access Private
 */
router.post('/generate',
  authenticateJWT(),
  referralCodeController.referralCodeRateLimit,
  validateRequestBody(generateReferralCodeSchema),
  referralCodeController.generateReferralCode
);

/**
 * @route GET /api/referral-codes/validate/:code
 * @desc Validate a referral code
 * @access Public
 */
router.get('/validate/:code',
  referralCodeController.referralCodeRateLimit,
  validateQueryParams(validateReferralCodeSchema),
  referralCodeController.validateReferralCode
);

/**
 * @route POST /api/referral-codes/batch-generate
 * @desc Batch generate referral codes (admin only)
 * @access Admin
 */
router.post('/batch-generate',
  authenticateJWT(),
  requireRole('admin'),
  referralCodeController.referralCodeRateLimit,
  validateRequestBody(batchGenerateSchema),
  referralCodeController.batchGenerateReferralCodes
);

/**
 * @route GET /api/referral-codes/stats
 * @desc Get referral code statistics (admin only)
 * @access Admin
 */
router.get('/stats',
  authenticateJWT(),
  requireRole('admin'),
  referralCodeController.referralCodeRateLimit,
  referralCodeController.getReferralCodeStats
);

/**
 * @route DELETE /api/referral-codes/cache
 * @desc Clear referral code cache (admin only)
 * @access Admin
 */
router.delete('/cache',
  authenticateJWT(),
  requireRole('admin'),
  referralCodeController.referralCodeRateLimit,
  referralCodeController.clearReferralCodeCache
);

/**
 * @route DELETE /api/referral-codes/stats
 * @desc Reset referral code generation statistics (admin only)
 * @access Admin
 */
router.delete('/stats',
  authenticateJWT(),
  requireRole('admin'),
  referralCodeController.referralCodeRateLimit,
  referralCodeController.resetReferralCodeStats
);

export default router;
