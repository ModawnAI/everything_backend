/**
 * Admin Blind Request Routes
 *
 * API endpoints for super admin blind request management including:
 * - Fetching all blind requests with filters
 * - Processing (approving/rejecting) blind requests
 * - Statistics for blind requests
 */

import { Router } from 'express';
import { adminBlindRequestController } from '../controllers/admin-blind-request.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdminAuth } from '../middleware/admin-auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

// Apply authentication, admin authorization, and rate limiting to all routes
router.use(authenticateJWT());
router.use(requireAdminAuth);
router.use(rateLimit());

/**
 * GET /api/admin/blind-requests
 * Get all blind requests with filtering
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - status: Filter by status ('pending', 'approved', 'rejected', 'all')
 * - sortBy: Sort order ('newest', 'oldest')
 *
 * Returns:
 * - List of blind requests with review and shop details
 * - Pagination information
 */
router.get('/', async (req, res) => {
  try {
    await adminBlindRequestController.getRequests(req, res);
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '블라인드 요청 목록 조회 중 오류가 발생했습니다.'
      }
    });
  }
});

/**
 * GET /api/admin/blind-requests/stats
 * Get blind request statistics
 *
 * Returns:
 * - Pending count
 * - Approved today count
 * - Rejected today count
 * - Total processed count
 */
router.get('/stats', async (req, res) => {
  try {
    await adminBlindRequestController.getStats(req, res);
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '블라인드 요청 통계 조회 중 오류가 발생했습니다.'
      }
    });
  }
});

/**
 * GET /api/admin/blind-requests/:requestId
 * Get a single blind request by ID
 *
 * Returns:
 * - Blind request with full details
 */
router.get('/:requestId', async (req, res) => {
  try {
    await adminBlindRequestController.getRequestById(req, res);
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '블라인드 요청 조회 중 오류가 발생했습니다.'
      }
    });
  }
});

/**
 * PATCH /api/admin/blind-requests/:requestId
 * Process a blind request (approve or reject)
 *
 * Request Body:
 * - status: 'approved' or 'rejected' (required)
 * - adminNotes: Notes for the decision (optional)
 *
 * Returns:
 * - Updated blind request object
 */
router.patch('/:requestId', async (req, res) => {
  try {
    await adminBlindRequestController.processRequest(req, res);
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '블라인드 요청 처리 중 오류가 발생했습니다.'
      }
    });
  }
});

export default router;
