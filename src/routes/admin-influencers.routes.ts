import { Router } from 'express';
import { getInfluencers, getInfluencerStats } from '../controllers/admin-influencers.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdminAuth } from '../middleware/admin-auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

// Apply authentication, admin authorization, and rate limiting to all routes
router.use(authenticateJWT());
router.use(requireAdminAuth);
router.use(rateLimit());

/**
 * Admin Influencer Management Routes
 *
 * Endpoints for managing influencers in the admin panel:
 * - List influencers with pagination and filtering
 * - Get influencer statistics
 */

/**
 * GET /api/admin/influencers
 * Get paginated list of influencers
 */
router.get('/', getInfluencers);

/**
 * GET /api/admin/influencers/stats
 * Get influencer statistics summary
 */
router.get('/stats', getInfluencerStats);

export default router;
