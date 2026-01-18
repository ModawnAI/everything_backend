/**
 * Popup Routes
 * Public and authenticated endpoints for app popups
 */

import { Router } from 'express';
import { popupController } from '../controllers/popup.controller';
import { optionalAuth } from '../middleware/auth.middleware';
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
 * GET /api/popups/active
 * Get active popups for the current user/device
 * Query params: device_id, is_new_user
 * Optional authentication enhances filtering (can exclude dismissed popups for user)
 */
router.get('/active', optionalAuth(), popupController.getActivePopups);

/**
 * POST /api/popups/:id/dismiss
 * Dismiss a popup (close or never show again)
 * Body: { dismiss_type: 'close' | 'never_show', device_id?: string }
 * Optional authentication (can use device_id instead)
 */
router.post('/:id/dismiss', optionalAuth(), popupController.dismissPopup);

/**
 * POST /api/popups/:id/click
 * Record a click on a popup
 * Public endpoint for tracking
 */
router.post('/:id/click', popupController.recordClick);

export default router;
