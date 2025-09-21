import { Router } from 'express';
import { influencerQualificationController } from '../controllers/influencer-qualification.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireRole, UserRole } from '../middleware/role.middleware';
import { validateRequestBody } from '../middleware/validation.middleware';
import Joi from 'joi';

const router = Router();

// Validation schemas
const checkQualificationSchema = Joi.object({
  userId: Joi.string().uuid().optional()
});

const promoteToInfluencerSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  reason: Joi.string().min(10).max(500).required(),
  manualOverride: Joi.boolean().default(false)
});

const demoteFromInfluencerSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  reason: Joi.string().min(10).max(500).required()
});

const getTopPerformersSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(10)
});

/**
 * @route GET /api/influencer-qualification/check/:userId?
 * @desc Check influencer qualification for a user
 * @access Private (users can check own, admins can check any)
 */
router.get(
  '/check/:userId?',
  influencerQualificationController.influencerQualificationRateLimit,
  authenticateJWT,
  validateRequestBody(checkQualificationSchema),
  influencerQualificationController.checkInfluencerQualification
);

/**
 * @route POST /api/influencer-qualification/promote
 * @desc Promote a user to influencer status
 * @access Private (Admin only)
 */
router.post(
  '/promote',
  influencerQualificationController.influencerQualificationRateLimit,
  authenticateJWT,
  requireRole(UserRole.ADMIN),
  validateRequestBody(promoteToInfluencerSchema),
  influencerQualificationController.promoteToInfluencer
);

/**
 * @route POST /api/influencer-qualification/demote
 * @desc Demote a user from influencer status
 * @access Private (Admin only)
 */
router.post(
  '/demote',
  influencerQualificationController.influencerQualificationRateLimit,
  authenticateJWT,
  requireRole(UserRole.ADMIN),
  validateRequestBody(demoteFromInfluencerSchema),
  influencerQualificationController.demoteFromInfluencer
);

/**
 * @route POST /api/influencer-qualification/auto-promote
 * @desc Run automatic influencer promotion process
 * @access Private (Admin only)
 */
router.post(
  '/auto-promote',
  influencerQualificationController.influencerQualificationRateLimit,
  authenticateJWT,
  requireRole(UserRole.ADMIN),
  influencerQualificationController.runAutoPromotion
);

/**
 * @route GET /api/influencer-qualification/stats
 * @desc Get influencer qualification statistics
 * @access Private (Admin only)
 */
router.get(
  '/stats',
  influencerQualificationController.influencerQualificationRateLimit,
  authenticateJWT,
  requireRole(UserRole.ADMIN),
  influencerQualificationController.getInfluencerQualificationStats
);

/**
 * @route GET /api/influencer-qualification/top-performers
 * @desc Get top performers for influencer qualification
 * @access Private (Admin only)
 */
router.get(
  '/top-performers',
  influencerQualificationController.influencerQualificationRateLimit,
  authenticateJWT,
  requireRole(UserRole.ADMIN),
  validateRequestBody(getTopPerformersSchema),
  influencerQualificationController.getTopPerformers
);

export default router;
