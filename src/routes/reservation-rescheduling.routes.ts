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


/**
 * @swagger
 * /reservations/:reservationId/reschedule/validate:
 *   post:
 *     summary: POST /reservations/:reservationId/reschedule/validate (POST /reservations/:reservationId/reschedule/validate)
 *     description: POST endpoint for /reservations/:reservationId/reschedule/validate
 *       
 *       예약 관련 API입니다. 예약 생성, 조회, 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [예약]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */
// Validate reschedule request
router.post('/reservations/:reservationId/reschedule/validate', 
  reservationReschedulingController.validateReschedule.bind(reservationReschedulingController)
);

// Execute reschedule request
/**
 * @swagger
 * /reservations/:reservationId/reschedule:
 *   post:
 *     summary: POST /reservations/:reservationId/reschedule (POST /reservations/:reservationId/reschedule)
 *     description: POST endpoint for /reservations/:reservationId/reschedule
 *       
 *       예약 관련 API입니다. 예약 생성, 조회, 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Reservation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.post('/reservations/:reservationId/reschedule', 
  reservationReschedulingController.rescheduleReservation.bind(reservationReschedulingController)
);

// Get available reschedule slots
/**
 * @swagger
 * /reservations/:reservationId/reschedule/available-slots:
 *   get:
 *     summary: /reservations/:reservationId/reschedule/available-slots 조회
 *     description: GET endpoint for /reservations/:reservationId/reschedule/available-slots
 *       
 *       예약 관련 API입니다. 예약 생성, 조회, 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Reservation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.get('/reservations/:reservationId/reschedule/available-slots', 
  reservationReschedulingController.getAvailableRescheduleSlots.bind(reservationReschedulingController)
);

// Get reschedule history
/**
 * @swagger
 * /reservations/:reservationId/reschedule/history:
 *   get:
 *     summary: /reservations/:reservationId/reschedule/history 조회
 *     description: GET endpoint for /reservations/:reservationId/reschedule/history
 *       
 *       예약 관련 API입니다. 예약 생성, 조회, 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Reservation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.get('/reservations/:reservationId/reschedule/history', 
  reservationReschedulingController.getRescheduleHistory.bind(reservationReschedulingController)
);

// Get reschedule statistics for shop (shop owner/admin only)
/**
 * @swagger
 * /shops/:shopId/reschedule/stats:
 *   get:
 *     summary: /shops/:shopId/reschedule/stats 조회
 *     description: GET endpoint for /shops/:shopId/reschedule/stats
 *       
 *       예약 관련 API입니다. 예약 생성, 조회, 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Reservation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.get('/shops/:shopId/reschedule/stats', 
  requirePermission({ resource: 'reservations', action: 'read' }),
  reservationReschedulingController.getRescheduleStats.bind(reservationReschedulingController)
);

// Get reschedule configuration (admin only)
/**
 * @swagger
 * /admin/reschedule/config:
 *   get:
 *     summary: /admin/reschedule/config 조회
 *     description: GET endpoint for /admin/reschedule/config
 *       
 *       예약 관련 API입니다. 예약 생성, 조회, 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Reservation]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */

router.get('/admin/reschedule/config', 
  requirePermission({ resource: 'system_settings', action: 'read' }),
  reservationReschedulingController.getRescheduleConfig.bind(reservationReschedulingController)
);


/**
 * @swagger
 * /admin/reschedule/config:
 *   put:
 *     summary: PUT /admin/reschedule/config (PUT /admin/reschedule/config)
 *     description: PUT endpoint for /admin/reschedule/config
 *       
 *       예약 관련 API입니다. 예약 생성, 조회, 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [예약]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */
// Update reschedule configuration (admin only)
router.put('/admin/reschedule/config', 
  requirePermission({ resource: 'system_settings', action: 'update' }),
  reservationReschedulingController.updateRescheduleConfig.bind(reservationReschedulingController)
);

export default router; 