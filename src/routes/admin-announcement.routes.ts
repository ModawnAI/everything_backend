import { Router } from 'express';
import { adminAnnouncementController } from '../controllers/admin-announcement.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdminAuth } from '../middleware/admin-auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

// Apply authentication, admin authorization, and rate limiting to all routes
router.use(authenticateJWT());
router.use(requireAdminAuth);
router.use(rateLimit());

/**
 * GET /api/admin/announcements
 * Get all announcements with filtering
 */
router.get('/', adminAnnouncementController.getAnnouncements);

/**
 * GET /api/admin/announcements/:id
 * Get announcement by ID
 */
router.get('/:id', adminAnnouncementController.getAnnouncementById);

/**
 * POST /api/admin/announcements
 * Create new announcement
 */
router.post('/', adminAnnouncementController.createAnnouncement);

/**
 * PUT /api/admin/announcements/:id
 * Update announcement
 */
router.put('/:id', adminAnnouncementController.updateAnnouncement);

/**
 * DELETE /api/admin/announcements/:id
 * Delete announcement
 */
router.delete('/:id', adminAnnouncementController.deleteAnnouncement);

export default router;
