/**
 * Admin Shop Entry Request Routes
 * Endpoints for managing shop entry requests
 */

import { Router } from 'express';
import { shopEntryRequestController } from '../controllers/shop-entry-request.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdminAuth } from '../middleware/admin-auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

// Apply authentication, admin authorization, and rate limiting to all routes
router.use(authenticateJWT());
router.use(requireAdminAuth);
router.use(rateLimit());

/**
 * GET /api/admin/shop-entry-requests
 * Get all shop entry requests with pagination
 * Query params: page, limit, status, sort_by, sort_order
 */
router.get('/', shopEntryRequestController.listRequests);

/**
 * GET /api/admin/shop-entry-requests/statistics
 * Get shop entry request statistics
 */
router.get('/statistics', shopEntryRequestController.getStatistics);

/**
 * GET /api/admin/shop-entry-requests/:id
 * Get a single shop entry request by ID
 */
router.get('/:id', shopEntryRequestController.getRequest);

/**
 * PATCH /api/admin/shop-entry-requests/:id
 * Update shop entry request status
 * Body: { status: 'pending' | 'contacted' | 'registered' | 'rejected', admin_notes?: string }
 */
router.patch('/:id', shopEntryRequestController.updateRequestStatus);

/**
 * DELETE /api/admin/shop-entry-requests/:id
 * Delete a shop entry request
 */
router.delete('/:id', shopEntryRequestController.deleteRequest);

export default router;
