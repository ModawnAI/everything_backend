/**
 * Shop Staff Routes
 * Routes for shop owners to manage staff members
 */

import { Router } from 'express';
import { shopStaffController } from '../controllers/shop-staff.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireShopOwnerWithShop } from '../middleware/shop-owner-auth.middleware';

const router = Router();

// All routes require authentication and shop owner status
router.use(authenticateJWT());
router.use(requireShopOwnerWithShop);

/**
 * GET /api/shop-owner/staff
 * Get all staff for the shop
 */
router.get(
  '/',
  shopStaffController.getStaff.bind(shopStaffController)
);

/**
 * GET /api/shop-owner/staff/revenue
 * Get staff revenue summary
 */
router.get(
  '/revenue',
  shopStaffController.getStaffRevenue.bind(shopStaffController)
);

/**
 * GET /api/shop-owner/staff/:id
 * Get a single staff member
 */
router.get(
  '/:id',
  shopStaffController.getStaffById.bind(shopStaffController)
);

/**
 * POST /api/shop-owner/staff
 * Create a new staff member
 */
router.post(
  '/',
  shopStaffController.createStaff.bind(shopStaffController)
);

/**
 * PUT /api/shop-owner/staff/:id
 * Update a staff member
 */
router.put(
  '/:id',
  shopStaffController.updateStaff.bind(shopStaffController)
);

/**
 * DELETE /api/shop-owner/staff/:id
 * Delete (deactivate) a staff member
 */
router.delete(
  '/:id',
  shopStaffController.deleteStaff.bind(shopStaffController)
);

/**
 * POST /api/shop-owner/reservations/:reservationId/assign-staff
 * Assign staff to a reservation
 * Note: This route should be mounted at /api/shop-owner/reservations
 */
export const staffAssignmentRouter = Router();
staffAssignmentRouter.use(authenticateJWT());
staffAssignmentRouter.use(requireShopOwnerWithShop);

staffAssignmentRouter.post(
  '/:reservationId/assign-staff',
  shopStaffController.assignStaffToReservation.bind(shopStaffController)
);

staffAssignmentRouter.delete(
  '/:reservationId/assign-staff',
  shopStaffController.removeStaffFromReservation.bind(shopStaffController)
);

export default router;
