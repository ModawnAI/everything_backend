import { Router } from 'express';
import { adminPointPolicyController } from '../controllers/admin-point-policy.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdminAuth } from '../middleware/admin-auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

// Apply authentication, admin authorization, and rate limiting to all routes
router.use(authenticateJWT());
router.use(requireAdminAuth);
router.use(rateLimit());

/**
 * GET /api/admin/points/policy
 * Get current active point policy
 */
router.get('/policy', adminPointPolicyController.getActivePolicy);

/**
 * GET /api/admin/points/policy/history
 * Get point policy history
 */
router.get('/policy/history', adminPointPolicyController.getPolicyHistory);

/**
 * POST /api/admin/points/policy
 * Create new point policy
 */
router.post('/policy', adminPointPolicyController.createPolicy);

/**
 * PUT /api/admin/points/policy/:id
 * Update point policy
 */
router.put('/policy/:id', adminPointPolicyController.updatePolicy);

/**
 * DELETE /api/admin/points/policy/:id
 * Deactivate point policy
 */
router.delete('/policy/:id', adminPointPolicyController.deactivatePolicy);

export default router;
