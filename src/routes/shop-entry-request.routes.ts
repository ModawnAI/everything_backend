/**
 * Shop Entry Request Routes
 * Public endpoint for submitting shop entry requests
 */

import { Router } from 'express';
import { shopEntryRequestController } from '../controllers/shop-entry-request.controller';
import { optionalAuth } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

// Apply rate limiting to all routes
router.use(rateLimit());

/**
 * POST /api/shop-entry-requests
 * Submit a new shop entry request
 * Body: { shop_name, shop_address?, shop_phone?, shop_category?, additional_info?, requester_email?, requester_phone? }
 * Optional authentication (can be anonymous)
 */
router.post('/', optionalAuth(), shopEntryRequestController.submitRequest);

export default router;
