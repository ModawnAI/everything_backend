import { Router } from 'express';
import { adminReservationController } from '../controllers/admin-reservation.controller';

const router = Router();

/**
 * Admin Reservation Management Routes
 * 
 * Comprehensive reservation oversight and management system:
 * - Advanced reservation filtering and search
 * - Status management and manual intervention
 * - Dispute resolution tools
 * - Analytics and reporting
 * - Bulk operations for efficiency
 */

/**
 * GET /api/admin/reservations
 * Get reservations with comprehensive filtering and admin oversight
 * 
 * Query Parameters:
 * - status: Filter by reservation status (requested, confirmed, completed, cancelled_by_user, cancelled_by_shop, no_show)
 * - shopId: Filter by specific shop
 * - userId: Filter by specific customer
 * - startDate: Filter by reservation date range (YYYY-MM-DD)
 * - endDate: Filter by reservation date range (YYYY-MM-DD)
 * - search: Search in customer name, phone, shop name
 * - minAmount: Filter by minimum total amount
 * - maxAmount: Filter by maximum total amount
 * - hasPointsUsed: Filter by points usage (true/false)
 * - sortBy: Sort field (reservation_datetime, created_at, total_amount, customer_name, shop_name)
 * - sortOrder: Sort order (asc, desc)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "reservations": [
 *       {
 *         "id": "uuid",
 *         "reservationDate": "2024-03-15",
 *         "reservationTime": "14:00:00",
 *         "reservationDatetime": "2024-03-15T14:00:00Z",
 *         "status": "confirmed",
 *         "totalAmount": 50000,
 *         "depositAmount": 10000,
 *         "remainingAmount": 40000,
 *         "pointsUsed": 1000,
 *         "pointsEarned": 1250,
 *         "specialRequests": "Window seat preferred",
 *         "confirmedAt": "2024-03-10T10:00:00Z",
 *         "createdAt": "2024-03-08T15:30:00Z",
 *         "updatedAt": "2024-03-10T10:00:00Z",
 *         "customer": {
 *           "id": "uuid",
 *           "name": "김미영",
 *           "email": "kim@example.com",
 *           "phoneNumber": "+82-10-1234-5678",
 *           "userStatus": "active"
 *         },
 *         "shop": {
 *           "id": "uuid",
 *           "name": "Beauty Salon Seoul",
 *           "address": "123 Gangnam-gu, Seoul",
 *           "mainCategory": "nail",
 *           "shopStatus": "active"
 *         },
 *         "services": [
 *           {
 *             "id": "uuid",
 *             "name": "Gel Manicure",
 *             "category": "nail",
 *             "quantity": 1,
 *             "unitPrice": 30000,
 *             "totalPrice": 30000
 *           }
 *         ],
 *         "payments": [
 *           {
 *             "id": "uuid",
 *             "paymentMethod": "card",
 *             "paymentStatus": "fully_paid",
 *             "amount": 50000,
 *             "paidAt": "2024-03-08T16:00:00Z"
 *           }
 *         ],
 *         "daysUntilReservation": 5,
 *         "isOverdue": false,
 *         "isToday": false,
 *         "isPast": false,
 *         "totalPaidAmount": 50000,
 *         "outstandingAmount": 0
 *       }
 *     ],
 *     "totalCount": 150,
 *     "hasMore": true,
 *     "currentPage": 1,
 *     "totalPages": 8,
 *     "filters": { ... }
 *   }
 * }
 * 
 * Security Features:
 * - Requires valid admin session
 * - IP address validation
 * - Comprehensive audit logging
 * - Rate limiting protection
 * - Advanced filtering and search capabilities
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: / 조회
 *     description: GET endpoint for /
 *       
 *       관리자용 예약 관리 API입니다. 예약 현황과 상태를 관리합니다.
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
router.get('/', adminReservationController.getReservations);

/**
 * GET /api/admin/reservations/analytics
 * Get reservation analytics for admin dashboard
 * 
 * Query Parameters:
 * - startDate: Start date for analytics (YYYY-MM-DD, default: 30 days ago)
 * - endDate: End date for analytics (YYYY-MM-DD, default: today)
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "totalReservations": 1250,
 *     "activeReservations": 45,
 *     "completedReservations": 1100,
 *     "cancelledReservations": 80,
 *     "noShowReservations": 25,
 *     "totalRevenue": 62500000,
 *     "averageReservationValue": 50000,
 *     "reservationsByStatus": {
 *       "requested": 15,
 *       "confirmed": 30,
 *       "completed": 1100,
 *       "cancelled_by_user": 50,
 *       "cancelled_by_shop": 30,
 *       "no_show": 25
 *     },
 *     "reservationsByCategory": {
 *       "nail": 600,
 *       "eyelash": 400,
 *       "waxing": 200,
 *       "eyebrow_tattoo": 50
 *     },
 *     "reservationsByShop": [
 *       {
 *         "shopId": "uuid",
 *         "shopName": "Beauty Salon Seoul",
 *         "count": 150,
 *         "revenue": 7500000
 *       }
 *     ],
 *     "recentActivity": [
 *       {
 *         "id": "uuid",
 *         "action": "reservation_status_update",
 *         "reservationId": "uuid",
 *         "customerName": "김미영",
 *         "shopName": "Beauty Salon Seoul",
 *         "timestamp": "2024-03-15T10:00:00Z"
 *       }
 *     ],
 *     "trends": {
 *       "dailyReservations": [
 *         {
 *           "date": "2024-03-15",
 *           "count": 25,
 *           "revenue": 1250000
 *         }
 *       ],
 *       "weeklyReservations": [...],
 *       "monthlyReservations": [...]
 *     }
 *   }
 * }
 * 
 * Security Features:
 * - Requires valid admin session
 * - Real-time data aggregation
 * - Performance optimized queries
 * - Trend analysis and insights
 */

/**
 * @swagger
 * /analytics:
 *   get:
 *     summary: /analytics 조회
 *     description: GET endpoint for /analytics
 *       
 *       관리자용 예약 관리 API입니다. 예약 현황과 상태를 관리합니다.
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
router.get('/analytics', adminReservationController.getReservationAnalytics);

/**
 * GET /api/admin/reservations/statistics
 * Get reservation statistics for admin dashboard (frontend-compatible)
 *
 * Query Parameters:
 * - shopId: Filter by specific shop (UUID)
 * - staffId: Filter by specific staff member (UUID)
 * - dateFrom: Start date for statistics (ISO date, default: start of current month)
 * - dateTo: End date for statistics (ISO date, default: today)
 *
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "todayReservations": 12,
 *     "todayConfirmed": 8,
 *     "todayPending": 3,
 *     "todayCompleted": 1,
 *     "monthlyRevenue": 1250000,
 *     "revenueGrowth": 15.5,
 *     "monthlyReservations": 145,
 *     "totalCustomers": 320,
 *     "newCustomersThisMonth": 28,
 *     "returningCustomers": 187,
 *     "activeServices": 8,
 *     "topService": "헤어 컷",
 *     "topServiceCount": 45,
 *     "statusBreakdown": {
 *       "requested": 5,
 *       "confirmed": 42,
 *       "completed": 89,
 *       "cancelled_by_user": 7,
 *       "cancelled_by_shop": 2,
 *       "no_show": 0
 *     },
 *     "revenueByStatus": {
 *       "total": 1480000,
 *       "paid": 1250000,
 *       "outstanding": 230000
 *     }
 *   },
 *   "message": "Statistics retrieved successfully"
 * }
 *
 * Security Features:
 * - Requires valid admin session
 * - Real-time statistics calculation
 * - Supports filtering by shop and staff
 * - Date range filtering with defaults
 * - Performance optimized queries
 */
router.get('/statistics', adminReservationController.getReservationStatistics);

/**
 * GET /api/admin/reservations/:id
 * Get reservation by ID (alias to /:id/details for backwards compatibility)
 *
 * @swagger
 * /:id:
 *   get:
 *     summary: Get reservation by ID
 *     description: GET endpoint for /:id - Returns detailed reservation information
 *     tags: [예약]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Reservation ID
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Reservation not found
 *       500:
 *         description: Internal Server Error
 */
router.get('/:id', adminReservationController.getReservationDetails);

/**
 * PUT /api/admin/reservations/:id/status
 * Update reservation status with admin oversight
 * 
 * Parameters:
 * - id: Reservation UUID
 * 
 * Request Body:
 * {
 *   "status": "completed",
 *   "notes": "Service completed successfully",
 *   "reason": "Customer satisfied with service",
 *   "notifyCustomer": true,
 *   "notifyShop": true,
 *   "autoProcessPayment": false
 * }
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "reservation": {
 *       "id": "uuid",
 *       "previousStatus": "confirmed",
 *       "newStatus": "completed",
 *       "updatedAt": "2024-03-15T14:30:00Z"
 *     },
 *     "action": {
 *       "type": "status_update",
 *       "reason": "Customer satisfied with service",
 *       "notes": "Service completed successfully",
 *       "performedBy": "admin-uuid",
 *       "performedAt": "2024-03-15T14:30:00Z"
 *     }
 *   }
 * }
 * 
 * Security Features:
 * - Requires valid admin session
 * - Status transition validation
 * - Comprehensive audit logging
 * - Optional customer/shop notifications
 * - Auto-payment processing option
 */

/**
 * @swagger
 * /:id/status:
 *   put:
 *     summary: PUT /:id/status (PUT /:id/status)
 *     description: PUT endpoint for /:id/status
 *       
 *       관리자용 예약 관리 API입니다. 예약 현황과 상태를 관리합니다.
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
router.put('/:id/status', adminReservationController.updateReservationStatus);

/**
 * GET /api/admin/reservations/:id/details
 * Get detailed reservation information for admin oversight
 * 
 * Parameters:
 * - id: Reservation UUID
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "reservationDate": "2024-03-15",
 *     "reservationTime": "14:00:00",
 *     "reservationDatetime": "2024-03-15T14:00:00Z",
 *     "status": "confirmed",
 *     "totalAmount": 50000,
 *     "depositAmount": 10000,
 *     "remainingAmount": 40000,
 *     "pointsUsed": 1000,
 *     "pointsEarned": 1250,
 *     "specialRequests": "Window seat preferred",
 *     "confirmedAt": "2024-03-10T10:00:00Z",
 *     "createdAt": "2024-03-08T15:30:00Z",
 *     "updatedAt": "2024-03-10T10:00:00Z",
 *     "customer": {
 *       "id": "uuid",
 *       "name": "김미영",
 *       "email": "kim@example.com",
 *       "phoneNumber": "+82-10-1234-5678",
 *       "userStatus": "active",
 *       "joinedAt": "2023-01-15T00:00:00Z",
 *       "lastLoginAt": "2024-03-14T18:30:00Z"
 *     },
 *     "shop": {
 *       "id": "uuid",
 *       "name": "Beauty Salon Seoul",
 *       "description": "Professional beauty services",
 *       "address": "123 Gangnam-gu, Seoul",
 *       "detailedAddress": "Building A, Floor 2",
 *       "phoneNumber": "+82-2-1234-5678",
 *       "email": "salon@example.com",
 *       "mainCategory": "nail",
 *       "shopStatus": "active",
 *       "verificationStatus": "verified",
 *       "joinedAt": "2023-06-01T00:00:00Z"
 *     },
 *     "services": [
 *       {
 *         "id": "uuid",
 *         "name": "Gel Manicure",
 *         "description": "Long-lasting gel polish application",
 *         "category": "nail",
 *         "quantity": 1,
 *         "unitPrice": 30000,
 *         "totalPrice": 30000,
 *         "originalPriceMin": 25000,
 *         "originalPriceMax": 35000,
 *         "durationMinutes": 60
 *       }
 *     ],
 *     "payments": [
 *       {
 *         "id": "uuid",
 *         "paymentMethod": "card",
 *         "paymentStatus": "fully_paid",
 *         "amount": 50000,
 *         "paidAt": "2024-03-08T16:00:00Z",
 *         "createdAt": "2024-03-08T15:45:00Z"
 *       }
 *     ],
 *     "disputes": [
 *       {
 *         "id": "uuid",
 *         "disputeType": "service_quality",
 *         "description": "Customer reported unsatisfactory service quality",
 *         "requestedAction": "compensation",
 *         "priority": "high",
 *         "status": "open",
 *         "createdAt": "2024-03-12T09:00:00Z",
 *         "resolvedAt": null
 *       }
 *     ],
 *     "daysUntilReservation": 5,
 *     "isOverdue": false,
 *     "isToday": false,
 *     "isPast": false,
 *     "totalPaidAmount": 50000,
 *     "outstandingAmount": 0,
 *     "analysis": {
 *       "paymentCompletion": 100,
 *       "hasDisputes": true,
 *       "openDisputes": 1,
 *       "isUrgent": true,
 *       "requiresAttention": true
 *     }
 *   }
 * }
 * 
 * Security Features:
 * - Requires valid admin session
 * - Comprehensive reservation data with related information
 * - Payment analysis and dispute tracking
 * - Attention indicators and urgency flags
 * - Performance optimized with joins
 */

/**
 * @swagger
 * /:id/details:
 *   get:
 *     summary: /:id/details 조회
 *     description: GET endpoint for /:id/details
 *       
 *       관리자용 예약 관리 API입니다. 예약 현황과 상태를 관리합니다.
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
router.get('/:id/details', adminReservationController.getReservationDetails);

/**
 * POST /api/admin/reservations/:id/dispute
 * Create reservation dispute for admin resolution
 * 
 * Parameters:
 * - id: Reservation UUID
 * 
 * Request Body:
 * {
 *   "disputeType": "customer_complaint",
 *   "description": "Customer reported unsatisfactory service quality",
 *   "requestedAction": "compensation",
 *   "priority": "high",
 *   "evidence": ["https://example.com/evidence1.jpg"]
 * }
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "dispute": {
 *       "id": "uuid",
 *       "reservationId": "uuid",
 *       "disputeType": "customer_complaint",
 *       "status": "open",
 *       "priority": "high",
 *       "createdAt": "2024-03-15T10:00:00Z"
 *     }
 *   }
 * }
 * 
 * Available Dispute Types:
 * - customer_complaint: Customer complaints about service
 * - shop_issue: Issues reported by shop
 * - payment_dispute: Payment-related disputes
 * - service_quality: Service quality issues
 * - other: Other types of disputes
 * 
 * Available Requested Actions:
 * - refund: Request for refund
 * - reschedule: Request for rescheduling
 * - compensation: Request for compensation
 * - investigation: Request for investigation
 * - other: Other requested actions
 * 
 * Priority Levels:
 * - low: Low priority disputes
 * - medium: Medium priority disputes
 * - high: High priority disputes
 * - urgent: Urgent disputes requiring immediate attention
 * 
 * Security Features:
 * - Requires valid admin session
 * - Dispute type and action validation
 * - Priority-based workflow
 * - Evidence file support
 * - Comprehensive audit logging
 */

/**
 * @swagger
 * /:id/dispute:
 *   post:
 *     summary: POST /:id/dispute (POST /:id/dispute)
 *     description: POST endpoint for /:id/dispute
 *       
 *       관리자용 예약 관리 API입니다. 예약 현황과 상태를 관리합니다.
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
router.post('/:id/dispute', adminReservationController.createReservationDispute);

/**
 * POST /api/admin/reservations/:id/force-complete
 * Force complete a reservation for dispute resolution
 * 
 * Parameters:
 * - id: Reservation UUID
 * 
 * Request Body:
 * {
 *   "reason": "Customer service quality issue resolved",
 *   "notes": "Service was completed but customer had initial concerns. Compensation provided.",
 *   "refundAmount": 10000,
 *   "compensationPoints": 500,
 *   "notifyCustomer": true,
 *   "notifyShop": true
 * }
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "reservation": {
 *       "id": "uuid",
 *       "status": "completed",
 *       "updatedAt": "2024-03-15T14:30:00Z"
 *     },
 *     "refundProcessed": true,
 *     "compensationProcessed": true,
 *     "notificationsSent": {
 *       "customer": true,
 *       "shop": true
 *     }
 *   }
 * }
 * 
 * Security Features:
 * - Requires valid admin session
 * - Force completion validation
 * - Optional refund processing
 * - Optional compensation points
 * - Customer and shop notifications
 * - Comprehensive audit logging
 * - Dispute resolution tracking
 */

/**
 * @swagger
 * /:id/force-complete:
 *   post:
 *     summary: POST /:id/force-complete (POST /:id/force-complete)
 *     description: POST endpoint for /:id/force-complete
 *       
 *       관리자용 예약 관리 API입니다. 예약 현황과 상태를 관리합니다.
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
router.post('/:id/force-complete', adminReservationController.forceCompleteReservation);

/**
 * POST /api/admin/reservations/bulk-status-update
 * Perform bulk status updates on multiple reservations
 * 
 * Request Body:
 * {
 *   "reservationIds": ["uuid1", "uuid2", "uuid3"],
 *   "status": "completed",
 *   "notes": "Bulk completion for confirmed reservations",
 *   "reason": "All services completed successfully",
 *   "notifyCustomers": true,
 *   "notifyShops": true
 * }
 * 
 * Headers:
 * Authorization: Bearer <admin-jwt-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "results": [
 *       {
 *         "reservationId": "uuid1",
 *         "success": true
 *       },
 *       {
 *         "reservationId": "uuid2",
 *         "success": false,
 *         "error": "Reservation not found"
 *       }
 *     ],
 *     "summary": {
 *       "total": 3,
 *       "successful": 2,
 *       "failed": 1
 *     }
 *   }
 * }
 * 
 * Available Statuses:
 * - requested: Initial reservation request
 * - confirmed: Reservation confirmed by shop
 * - completed: Service completed successfully
 * - cancelled_by_user: Cancelled by customer
 * - cancelled_by_shop: Cancelled by shop
 * - no_show: Customer did not show up
 * 
 * Security Features:
 * - Requires valid admin session
 * - Bulk operation validation
 * - Individual error handling
 * - Comprehensive audit logging
 * - Rate limiting for bulk operations
 * - Optional customer/shop notifications
 */

/**
 * @swagger
 * /bulk-status-update:
 *   post:
 *     summary: POST /bulk-status-update
 *     description: POST endpoint for /bulk-status-update
 *       
 *       관리자용 예약 관리 API입니다. 예약 현황과 상태를 관리합니다.
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
router.post('/bulk-status-update', adminReservationController.bulkStatusUpdate);

export default router; 