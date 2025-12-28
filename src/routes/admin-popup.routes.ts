/**
 * Admin Popup Routes
 * Endpoints for managing app popups
 */

import { Router } from 'express';
import { popupController } from '../controllers/popup.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdminAuth } from '../middleware/admin-auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

// Apply authentication, admin authorization, and rate limiting to all routes
router.use(authenticateJWT());
router.use(requireAdminAuth);
router.use(rateLimit());

/**
 * GET /api/admin/popups
 * Get all popups with pagination
 * Query params: page, limit, active, sort_by, sort_order
 */
router.get('/', popupController.listPopups);

/**
 * GET /api/admin/popups/statistics
 * Get popup statistics
 */
router.get('/statistics', popupController.getStatistics);

/**
 * GET /api/admin/popups/:id
 * Get a single popup by ID
 */
router.get('/:id', popupController.getPopup);

/**
 * POST /api/admin/popups
 * Create a new popup
 * Body: { title, image_url, link_url?, link_type?, display_order?, active?, start_date?, end_date?, target_audience? }
 */
router.post('/', popupController.createPopup);

/**
 * PUT /api/admin/popups/reorder
 * Reorder popups
 * Body: { orders: [{ id, display_order }] }
 */
router.put('/reorder', popupController.reorderPopups);

/**
 * PUT /api/admin/popups/:id
 * Update an existing popup
 * Body: Partial popup fields
 */
router.put('/:id', popupController.updatePopup);

/**
 * DELETE /api/admin/popups/:id
 * Delete a popup
 */
router.delete('/:id', popupController.deletePopup);

export default router;
