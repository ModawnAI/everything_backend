/**
 * Admin Editor Picks Routes
 * Endpoints for managing editor's picks
 */

import { Router } from 'express';
import { adminEditorPicksController } from '../controllers/admin-editor-picks.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdminAuth } from '../middleware/admin-auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

// Apply authentication, admin authorization, and rate limiting to all routes
router.use(authenticateJWT());
router.use(requireAdminAuth);
router.use(rateLimit());

/**
 * GET /api/admin/editor-picks
 * Get all editor picks
 */
router.get('/', adminEditorPicksController.getAll);

/**
 * GET /api/admin/editor-picks/search-shops
 * Search shops for adding to editor picks
 */
router.get('/search-shops', adminEditorPicksController.searchShops);

/**
 * GET /api/admin/editor-picks/:id
 * Get a single editor pick by ID
 */
router.get('/:id', adminEditorPicksController.getById);

/**
 * POST /api/admin/editor-picks
 * Create a new editor pick
 */
router.post('/', adminEditorPicksController.create);

/**
 * POST /api/admin/editor-picks/reorder
 * Reorder editor picks
 */
router.post('/reorder', adminEditorPicksController.reorder);

/**
 * PUT /api/admin/editor-picks/:id
 * Update an editor pick
 */
router.put('/:id', adminEditorPicksController.update);

/**
 * DELETE /api/admin/editor-picks/:id
 * Delete an editor pick
 */
router.delete('/:id', adminEditorPicksController.delete);

export default router;
