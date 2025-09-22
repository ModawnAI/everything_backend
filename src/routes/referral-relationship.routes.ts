import { Router } from 'express';
import { referralRelationshipController } from '../controllers/referral-relationship.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/auth.middleware';
import { validateRequestBody, validateQueryParams } from '../middleware/validation.middleware';
import Joi from 'joi';

const router = Router();

// Validation schemas
const createReferralRelationshipSchema = Joi.object({
  referredId: Joi.string().uuid().required(),
  referralCode: Joi.string().min(4).max(20).pattern(/^[A-Z0-9]+$/).required()
});

const validateReferralEligibilitySchema = Joi.object({
  referredId: Joi.string().uuid().required()
});

const checkCircularReferenceSchema = Joi.object({
  referrerId: Joi.string().uuid().required(),
  referredId: Joi.string().uuid().required()
});

/**
 * @route POST /api/referral-relationships
 * @desc Create a new referral relationship
 * @access Private
 */

/**
 * @swagger
 * /:
 *   post:
 *     summary: POST /
 *     description: POST endpoint for /
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
router.post('/',
  authenticateJWT(),
  referralRelationshipController.referralRelationshipRateLimit,
  validateRequestBody(createReferralRelationshipSchema),
  referralRelationshipController.createReferralRelationship
);

/**
 * @route GET /api/referral-relationships/validate/:referredId
 * @desc Validate referral eligibility for a user
 * @access Private
 */
router.get('/validate/:referredId',
  authenticateJWT(),
  referralRelationshipController.referralRelationshipRateLimit,
  validateQueryParams(validateReferralEligibilitySchema),
  referralRelationshipController.validateReferralEligibility
);

/**
 * @route GET /api/referral-relationships/chain/:userId?
 * @desc Get referral chain for a user (defaults to current user)
 * @access Private
 */
router.get('/chain/:userId?',
  authenticateJWT(),
  referralRelationshipController.referralRelationshipRateLimit,
  referralRelationshipController.getReferralChain
);

/**
 * @route POST /api/referral-relationships/check-circular
 * @desc Check for circular references between two users
 * @access Private
 */

/**
 * @swagger
 * /check-circular:
 *   post:
 *     summary: POST /check-circular
 *     description: POST endpoint for /check-circular
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
router.post('/check-circular',
  authenticateJWT(),
  referralRelationshipController.referralRelationshipRateLimit,
  validateRequestBody(checkCircularReferenceSchema),
  referralRelationshipController.checkCircularReference
);

/**
 * @route GET /api/referral-relationships/stats
 * @desc Get referral relationship statistics (admin only)
 * @access Admin
 */
router.get('/stats',
  authenticateJWT(),
  requireRole('admin'),
  referralRelationshipController.referralRelationshipRateLimit,
  referralRelationshipController.getReferralRelationshipStats
);

export default router;

