/**
 * Home Routes
 * Public endpoints for home page data
 */

import { Router } from 'express';
import { homeController } from '../controllers/home.controller';
import { optionalAuth, authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

// Rate limiting configuration - use fixed_window strategy to avoid blocking issues
const publicRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 requests per windowMs
    strategy: 'fixed_window'
  }
});

// Apply rate limiting to all routes
router.use(publicRateLimit);

/**
 * GET /api/home/sections
 * Get all home page sections (public, but user context enhances results)
 * - nearby: Requires lat/lng query params
 * - frequentlyVisited: Requires authentication
 * - bestRecommended: Public
 * - editorPicks: Public
 */
router.get('/sections', optionalAuth(), homeController.getSections);

/**
 * GET /api/home/nearby
 * Get nearby nail shops (public)
 * Query params: lat, lng, limit, radius
 */
router.get('/nearby', optionalAuth(), homeController.getNearbyShops);

/**
 * GET /api/home/frequently-visited
 * Get frequently visited shops (authenticated users only)
 */
router.get('/frequently-visited', authenticateJWT(), homeController.getFrequentlyVisited);

/**
 * GET /api/home/best-recommended
 * Get best recommended shops (public)
 */
router.get('/best-recommended', homeController.getBestRecommended);

/**
 * GET /api/home/editor-picks
 * Get editor's picks (public)
 */
router.get('/editor-picks', homeController.getEditorPicks);

export default router;
