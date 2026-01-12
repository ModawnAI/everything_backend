/**
 * Staff Schedule Routes
 * API endpoints for staff working hours and day off management
 */

import { Router } from 'express';
import { staffScheduleController } from '../controllers/staff-schedule.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireShopOwnerWithShop } from '../middleware/shop-owner-auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

// Rate limiting
const generalRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    strategy: 'fixed_window',
  },
});

// Apply authentication and shop owner middleware to all routes
router.use(authenticateJWT());
router.use(requireShopOwnerWithShop);

// ==================== Schedule Management ====================

/**
 * GET /api/shop-owner/staff/schedules
 * Get all staff schedules for the shop
 */
router.get(
  '/schedules',
  generalRateLimit,
  staffScheduleController.getAllStaffSchedules.bind(staffScheduleController)
);

/**
 * GET /api/shop-owner/staff/availability
 * Get all staff availability for a specific date
 * Query params: date (YYYY-MM-DD)
 */
router.get(
  '/availability',
  generalRateLimit,
  staffScheduleController.getAllStaffAvailability.bind(staffScheduleController)
);

/**
 * GET /api/shop-owner/staff/:staffId/schedule
 * Get weekly schedule for a staff member
 */
router.get(
  '/:staffId/schedule',
  generalRateLimit,
  staffScheduleController.getStaffSchedule.bind(staffScheduleController)
);

/**
 * PUT /api/shop-owner/staff/:staffId/schedule
 * Set weekly schedule for a staff member (all 7 days)
 * Body: { schedules: [{ dayOfWeek, isWorking, startTime, endTime, breakStartTime, breakEndTime }, ...] }
 */
router.put(
  '/:staffId/schedule',
  generalRateLimit,
  staffScheduleController.setWeeklySchedule.bind(staffScheduleController)
);

/**
 * PUT /api/shop-owner/staff/:staffId/schedule/:dayOfWeek
 * Set/update schedule for a specific day (0-6, 0=Sunday)
 * Body: { isWorking, startTime, endTime, breakStartTime, breakEndTime }
 */
router.put(
  '/:staffId/schedule/:dayOfWeek',
  generalRateLimit,
  staffScheduleController.setDaySchedule.bind(staffScheduleController)
);

// ==================== Day Off Management ====================

/**
 * GET /api/shop-owner/staff/:staffId/dayoffs
 * Get day offs for a staff member
 * Query params: startDate, endDate (optional, YYYY-MM-DD format)
 */
router.get(
  '/:staffId/dayoffs',
  generalRateLimit,
  staffScheduleController.getStaffDayOffs.bind(staffScheduleController)
);

/**
 * POST /api/shop-owner/staff/:staffId/dayoffs
 * Create a day off
 * Body: { date (YYYY-MM-DD), reason?, isRecurring?, recurringPattern? }
 */
router.post(
  '/:staffId/dayoffs',
  generalRateLimit,
  staffScheduleController.createDayOff.bind(staffScheduleController)
);

/**
 * PUT /api/shop-owner/staff/:staffId/dayoffs/:dayOffId
 * Update a day off
 * Body: { date?, reason?, isRecurring?, recurringPattern? }
 */
router.put(
  '/:staffId/dayoffs/:dayOffId',
  generalRateLimit,
  staffScheduleController.updateDayOff.bind(staffScheduleController)
);

/**
 * DELETE /api/shop-owner/staff/:staffId/dayoffs/:dayOffId
 * Delete a day off
 */
router.delete(
  '/:staffId/dayoffs/:dayOffId',
  generalRateLimit,
  staffScheduleController.deleteDayOff.bind(staffScheduleController)
);

// ==================== Availability ====================

/**
 * GET /api/shop-owner/staff/:staffId/availability
 * Get staff availability for a specific date
 * Query params: date (YYYY-MM-DD)
 */
router.get(
  '/:staffId/availability',
  generalRateLimit,
  staffScheduleController.getStaffAvailability.bind(staffScheduleController)
);

export default router;
