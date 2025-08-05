/**
 * Reservation Rescheduling Routes
 * 
 * Defines API endpoints for reservation rescheduling functionality
 */

import { Router } from 'express';
import { reservationReschedulingController } from '../controllers/reservation-rescheduling.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';

const router = Router();

// Apply authentication to all routes
router.use(authenticateJWT());

// Validate reschedule request
router.post('/reservations/:reservationId/reschedule/validate', 
  reservationReschedulingController.validateReschedule.bind(reservationReschedulingController)
);

// Execute reschedule request
router.post('/reservations/:reservationId/reschedule', 
  reservationReschedulingController.rescheduleReservation.bind(reservationReschedulingController)
);

// Get available reschedule slots
router.get('/reservations/:reservationId/reschedule/available-slots', 
  reservationReschedulingController.getAvailableRescheduleSlots.bind(reservationReschedulingController)
);

// Get reschedule history
router.get('/reservations/:reservationId/reschedule/history', 
  reservationReschedulingController.getRescheduleHistory.bind(reservationReschedulingController)
);

// Get reschedule statistics for shop (shop owner/admin only)
router.get('/shops/:shopId/reschedule/stats', 
  requirePermission({ resource: 'reservations', action: 'read' }),
  reservationReschedulingController.getRescheduleStats.bind(reservationReschedulingController)
);

// Get reschedule configuration (admin only)
router.get('/admin/reschedule/config', 
  requirePermission({ resource: 'system_settings', action: 'read' }),
  reservationReschedulingController.getRescheduleConfig.bind(reservationReschedulingController)
);

// Update reschedule configuration (admin only)
router.put('/admin/reschedule/config', 
  requirePermission({ resource: 'system_settings', action: 'update' }),
  reservationReschedulingController.updateRescheduleConfig.bind(reservationReschedulingController)
);

export default router; 