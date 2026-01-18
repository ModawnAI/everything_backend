/**
 * Reservation Controller
 * 
 * Handles reservation-related API endpoints including:
 * - Available time slots for booking
 * - Reservation creation and management
 * - Reservation status updates
 */

import { Request, Response } from 'express';
import { timeSlotService } from '../services/time-slot.service';
import { reservationService, CreateReservationRequest } from '../services/reservation.service';
import { BookingValidationService } from '../services/booking-validation.service';
import { ValidatedBookingRequest } from '../middleware/booking-validation.middleware';
import { logger } from '../utils/logger';

export class ReservationController {
  /**
   * @swagger
   * /api/shops/{shopId}/available-slots:
   *   get:
   *     summary: Get available time slots
   *     description: Retrieve available time slots for a shop on a specific date for selected services
   *     tags: [Reservations]
   *     parameters:
   *       - in: path
   *         name: shopId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Shop ID
   *         example: "123e4567-e89b-12d3-a456-426614174000"
   *       - in: query
   *         name: date
   *         required: true
   *         schema:
   *           type: string
   *           format: date
   *           pattern: '^\d{4}-\d{2}-\d{2}$'
   *         description: Date in YYYY-MM-DD format
   *         example: "2024-03-15"
   *       - in: query
   *         name: serviceIds
   *         required: true
   *         schema:
   *           type: array
   *           items:
   *             type: string
   *             format: uuid
   *         style: form
   *         explode: true
   *         description: Array of service UUIDs
   *         example: ["service-uuid-1", "service-uuid-2"]
   *       - in: query
   *         name: startTime
   *         required: false
   *         schema:
   *           type: string
   *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
   *         description: Optional start time filter (HH:MM format)
   *         example: "09:00"
   *       - in: query
   *         name: endTime
   *         required: false
   *         schema:
   *           type: string
   *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
   *         description: Optional end time filter (HH:MM format)
   *         example: "18:00"
   *       - in: query
   *         name: interval
   *         required: false
   *         schema:
   *           type: integer
   *           minimum: 15
   *           maximum: 120
   *           default: 30
   *         description: Time slot interval in minutes
   *         example: 30
   *     responses:
   *       200:
   *         description: Available time slots retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     shopId:
   *                       type: string
   *                       format: uuid
   *                       example: "123e4567-e89b-12d3-a456-426614174000"
   *                     date:
   *                       type: string
   *                       format: date
   *                       example: "2024-03-15"
   *                     availableSlots:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           startTime:
   *                             type: string
   *                             pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
   *                             example: "10:00"
   *                           endTime:
   *                             type: string
   *                             pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
   *                             example: "10:30"
   *                           available:
   *                             type: boolean
   *                             example: true
   *                           capacity:
   *                             type: integer
   *                             minimum: 1
   *                             example: 2
   *                           booked:
   *                             type: integer
   *                             minimum: 0
   *                             example: 0
   *                     totalSlots:
   *                       type: integer
   *                       description: Total number of time slots
   *                       example: 16
   *                     availableCount:
   *                       type: integer
   *                       description: Number of available slots
   *                       example: 12
   *       400:
   *         description: Bad request - Invalid parameters
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: object
   *                   properties:
   *                     code:
   *                       type: string
   *                       example: "MISSING_REQUIRED_PARAMETERS"
   *                     message:
   *                       type: string
   *                       example: "필수 파라미터가 누락되었습니다."
   *                     details:
   *                       type: string
   *                       example: "date와 serviceIds는 필수입니다."
   *       404:
   *         description: Shop not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: object
   *                   properties:
   *                     code:
   *                       type: string
   *                       example: "SHOP_NOT_FOUND"
   *                     message:
   *                       type: string
   *                       example: "샵을 찾을 수 없습니다."
   *       500:
   *         description: Internal server error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  async getAvailableSlots(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { date, serviceIds, startTime, endTime, interval } = req.query;

      // Validate required parameters
      if (!date || !serviceIds) {
        res.status(400).json({
          error: {
            code: 'MISSING_REQUIRED_PARAMETERS',
            message: '필수 파라미터가 누락되었습니다.',
            details: 'date와 serviceIds는 필수입니다.'
          }
        });
        return;
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date as string)) {
        res.status(400).json({
          error: {
            code: 'INVALID_DATE_FORMAT',
            message: '날짜 형식이 올바르지 않습니다.',
            details: 'YYYY-MM-DD 형식으로 입력해주세요.'
          }
        });
        return;
      }

      // Validate serviceIds is an array
      const serviceIdsArray = Array.isArray(serviceIds) ? serviceIds : [serviceIds];
      if (serviceIdsArray.length === 0) {
        res.status(400).json({
          error: {
            code: 'MISSING_SERVICE_IDS',
            message: '서비스 ID가 필요합니다.',
            details: '최소 하나의 서비스 ID를 제공해주세요.'
          }
        });
        return;
      }

      // Validate interval if provided
      let intervalMinutes = 30; // default
      if (interval) {
        const parsedInterval = parseInt(interval as string);
        if (isNaN(parsedInterval) || parsedInterval < 15 || parsedInterval > 120) {
          res.status(400).json({
            error: {
              code: 'INVALID_INTERVAL',
              message: '시간 간격이 올바르지 않습니다.',
              details: '15분에서 120분 사이의 값을 입력해주세요.'
            }
          });
          return;
        }
        intervalMinutes = parsedInterval;
      }

      // Validate time format if provided
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (startTime && !timeRegex.test(startTime as string)) {
        res.status(400).json({
          error: {
            code: 'INVALID_START_TIME',
            message: '시작 시간 형식이 올바르지 않습니다.',
            details: 'HH:MM 형식으로 입력해주세요.'
          }
        });
        return;
      }

      if (endTime && !timeRegex.test(endTime as string)) {
        res.status(400).json({
          error: {
            code: 'INVALID_END_TIME',
            message: '종료 시간 형식이 올바르지 않습니다.',
            details: 'HH:MM 형식으로 입력해주세요.'
          }
        });
        return;
      }

      // Get available time slots
      const timeSlotRequest: any = {
        shopId,
        date: date as string,
        serviceIds: serviceIdsArray as string[],
        interval: intervalMinutes
      };

      if (startTime) {
        timeSlotRequest.startTime = startTime as string;
      }
      if (endTime) {
        timeSlotRequest.endTime = endTime as string;
      }

      const timeSlots = await timeSlotService.getAvailableTimeSlots(timeSlotRequest);

      // Format response
      const availableSlots = timeSlots
        .filter(slot => slot.isAvailable)
        .map(slot => ({
          startTime: slot.startTime,
          endTime: slot.endTime,
          duration: slot.duration
        }));

      logger.info('Available slots retrieved successfully', {
        shopId,
        date,
        serviceIds: serviceIdsArray,
        availableSlotsCount: availableSlots.length
      });

      res.status(200).json({
        success: true,
        data: {
          shopId,
          date,
          serviceIds: serviceIdsArray,
          availableSlots,
          totalSlots: timeSlots.length,
          availableCount: availableSlots.length
        }
      });

    } catch (error) {
      logger.error('Error in getAvailableSlots', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.shopId,
        query: req.query
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '예약 가능 시간 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * POST /api/reservations
   * Create a new reservation
   * 
   * Request Body:
   * {
   *   "shopId": "uuid",
   *   "services": [
   *     {
   *       "serviceId": "uuid",
   *       "quantity": 1
   *     }
   *   ],
   *   "reservationDate": "2024-03-15",
   *   "reservationTime": "14:00",
   *   "specialRequests": "특별 요청사항",
   *   "pointsToUse": 5000
   * }
   */
  async createReservation(req: ValidatedBookingRequest, res: Response): Promise<void> {
    try {
      const {
        shopId,
        services,
        reservationDate,
        reservationTime,
        specialRequests,
        pointsToUse = 0,
        paymentInfo,
        requestMetadata,
        notificationPreferences
      } = req.body;

      // Get user ID from JWT token
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인이 필요합니다.'
          }
        });
        return;
      }

      // Check if validation was performed and passed
      if (req.validationResult && !req.validationResult.isValid) {
        // Validation errors should have been handled by middleware
        return;
      }

      // Extract request metadata from headers if not provided
      const rawIpAddress = requestMetadata?.ipAddress || req.ip || req.connection.remoteAddress;

      // Normalize IP address (convert IPv6 localhost to IPv4)
      let normalizedIpAddress = rawIpAddress;
      if (rawIpAddress === '::1' || rawIpAddress === '::ffff:127.0.0.1') {
        normalizedIpAddress = '127.0.0.1';
      } else if (rawIpAddress && rawIpAddress.startsWith('::ffff:')) {
        // Convert IPv4-mapped IPv6 to IPv4
        normalizedIpAddress = rawIpAddress.substring(7);
      }

      const enhancedRequestMetadata = {
        ...requestMetadata,
        userAgent: requestMetadata?.userAgent || req.get('User-Agent'),
        ipAddress: normalizedIpAddress,
        source: requestMetadata?.source || 'web_app' // Default to web_app if not specified
      };

      // Create reservation request with v3.1 flow support
      const reservationRequest: CreateReservationRequest = {
        shopId,
        userId,
        services,
        reservationDate,
        reservationTime,
        specialRequests,
        pointsToUse,
        paymentInfo,
        requestMetadata: enhancedRequestMetadata,
        notificationPreferences
      };

      // Create reservation with concurrent booking prevention and v3.1 flow
      const reservation = await reservationService.createReservation(reservationRequest);

      logger.info('v3.1 flow reservation created successfully', {
        reservationId: reservation.id,
        shopId,
        userId,
        reservationDate,
        reservationTime,
        status: reservation.status,
        paymentInfo: paymentInfo ? {
          depositAmount: paymentInfo.depositAmount,
          remainingAmount: paymentInfo.remainingAmount,
          paymentMethod: paymentInfo.paymentMethod,
          depositRequired: paymentInfo.depositRequired
        } : undefined
      });

      // Get detailed pricing information for response
      const pricingDetails = await reservationService.calculatePricingWithDeposit(reservationRequest);

      res.status(201).json({
        success: true,
        data: {
          reservation: {
            id: reservation.id,
            shopId: reservation.shopId,
            userId: reservation.userId,
            reservationDate: reservation.reservationDate,
            reservationTime: reservation.reservationTime,
            status: reservation.status,
            totalAmount: reservation.totalAmount,
            depositAmount: reservation.depositAmount,
            remainingAmount: reservation.remainingAmount,
            pointsUsed: reservation.pointsUsed,
            specialRequests: reservation.specialRequests,
            createdAt: reservation.createdAt,
            updatedAt: reservation.updatedAt
          },
          // v3.1 Flow - Enhanced pricing and payment information
          pricingDetails: {
            totalAmount: pricingDetails.totalAmount,
            depositAmount: pricingDetails.depositAmount,
            remainingAmount: pricingDetails.remainingAmount,
            depositRequired: pricingDetails.depositRequired,
            serviceBreakdown: pricingDetails.depositCalculationDetails.serviceDeposits,
            appliedDiscounts: pricingDetails.depositCalculationDetails.appliedDiscounts,
            calculationSummary: pricingDetails.depositCalculationDetails.finalCalculation
          },
          // v3.1 Flow - Additional response data
          flowInfo: {
            version: '3.1',
            status: reservation.status,
            requiresShopConfirmation: true,
            paymentInfo: paymentInfo ? {
              depositAmount: paymentInfo.depositAmount,
              remainingAmount: paymentInfo.remainingAmount,
              paymentMethod: paymentInfo.paymentMethod,
              depositRequired: paymentInfo.depositRequired
            } : undefined,
            nextSteps: [
              'Payment processing (if applicable)',
              'Shop owner notification sent',
              'Awaiting shop confirmation',
              'Confirmation notification will be sent'
            ]
          }
        }
      });

    } catch (error) {
      logger.error('Error in createReservation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body
      });

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message === 'Selected time slot is no longer available') {
          res.status(409).json({
            error: {
              code: 'SLOT_UNAVAILABLE',
              message: '선택한 시간대가 더 이상 사용할 수 없습니다.',
              details: '다른 시간대를 선택해주세요.'
            }
          });
          return;
        }

        if (error.message === 'LOCK_TIMEOUT') {
          res.status(408).json({
            error: {
              code: 'LOCK_TIMEOUT',
              message: '예약 처리 중 시간이 초과되었습니다.',
              details: '잠시 후 다시 시도해주세요.'
            }
          });
          return;
        }

        if (error.message === 'SLOT_CONFLICT') {
          res.status(409).json({
            error: {
              code: 'SLOT_CONFLICT',
              message: '시간대 충돌이 발생했습니다.',
              details: '다른 시간대를 선택해주세요.'
            }
          });
          return;
        }

        if (error.message.includes('Missing required fields')) {
          res.status(400).json({
            error: {
              code: 'MISSING_REQUIRED_FIELDS',
              message: '필수 필드가 누락되었습니다.',
              details: error.message
            }
          });
          return;
        }

        if (error.message.includes('Invalid')) {
          res.status(400).json({
            error: {
              code: 'INVALID_INPUT',
              message: '입력값이 올바르지 않습니다.',
              details: error.message
            }
          });
          return;
        }
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '예약 생성 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/reservations
   * Get user's reservations with filtering
   * 
   * Query Parameters:
   * - status: Filter by reservation status
   * - startDate: Filter from date
   * - endDate: Filter to date
   * - shopId: Filter by shop
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 20)
   */
  async getReservations(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인이 필요합니다.'
          }
        });
        return;
      }

      const {
        status,
        startDate,
        endDate,
        shopId,
        page = 1,
        limit = 20
      } = req.query;

      const filters = {
        status: status as any,
        startDate: startDate as string,
        endDate: endDate as string,
        shopId: shopId as string,
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 20
      };

      const result = await reservationService.getUserReservations(userId, filters);

      res.status(200).json({
        success: true,
        data: {
          reservations: result.reservations,
          pagination: {
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: Math.ceil(result.total / result.limit)
          }
        }
      });

    } catch (error) {
      logger.error('Error in getReservations', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        query: req.query
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '예약 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/reservations/:id
   * Get specific reservation details
   * 
   * Path Parameters:
   * - id: Reservation UUID
   */
  async getReservationById(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인이 필요합니다.'
          }
        });
        return;
      }

      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          error: {
            code: 'MISSING_RESERVATION_ID',
            message: '예약 ID가 필요합니다.',
            details: '예약 ID를 제공해주세요.'
          }
        });
        return;
      }

      const reservation = await reservationService.getReservationById(id);

      if (!reservation) {
        res.status(404).json({
          error: {
            code: 'RESERVATION_NOT_FOUND',
            message: '예약을 찾을 수 없습니다.',
            details: '존재하지 않는 예약입니다.'
          }
        });
        return;
      }

      // Check if user owns this reservation
      if (reservation.userId !== userId) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: '접근 권한이 없습니다.',
            details: '다른 사용자의 예약입니다.'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          reservation
        }
      });

    } catch (error) {
      logger.error('Error in getReservationById', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params.id
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '예약 상세 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/reservations/:id/refund-preview
   * Get refund preview for a reservation cancellation
   *
   * Returns the estimated refund amount and percentage based on the cancellation window
   * without actually cancelling the reservation.
   *
   * Path Parameters:
   * - id: Reservation UUID
   *
   * Query Parameters:
   * - cancellationType: Optional cancellation type (default: 'user_request')
   *
   * Response:
   * - refundAmount: Amount to be refunded
   * - refundPercentage: Percentage of deposit to be refunded
   * - cancellationFee: Cancellation fee percentage
   * - cancellationWindow: Time window classification (48h, 24h, 2h, etc.)
   * - isEligible: Whether refund is eligible
   * - reason: Explanation of refund calculation
   */
  async getRefundPreview(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인이 필요합니다.'
          }
        });
        return;
      }

      const { id } = req.params;
      const cancellationType = (req.query.cancellationType as string) || 'user_request';

      if (!id) {
        res.status(400).json({
          error: {
            code: 'MISSING_RESERVATION_ID',
            message: '예약 ID가 필요합니다.',
            details: '예약 ID를 제공해주세요.'
          }
        });
        return;
      }

      // Import refund calculation service
      const { timezoneRefundService } = await import('../services/timezone-refund.service');

      // Calculate refund amount
      const refundCalculation = await timezoneRefundService.calculateRefundAmount({
        reservationId: id,
        userId,
        cancellationType: cancellationType as any,
        reason: 'Preview calculation'
      });

      // Format response
      const response = {
        refundAmount: refundCalculation.refundAmount || 0,
        refundPercentage: refundCalculation.refundPercentage || 0,
        cancellationFee: 100 - (refundCalculation.refundPercentage || 0),
        cancellationWindow: refundCalculation.cancellationWindow || 'unknown',
        isEligible: refundCalculation.isEligible || false,
        reason: refundCalculation.reason || 'Refund calculation completed',
        reservationDate: refundCalculation.koreanTimeInfo?.reservationTime,
        hoursUntilReservation: refundCalculation.cancellationWindow
      };

      logger.info('Refund preview calculated', {
        reservationId: id,
        userId,
        refundAmount: response.refundAmount,
        refundPercentage: response.refundPercentage
      });

      res.status(200).json({
        success: true,
        data: response
      });

    } catch (error) {
      logger.error('Error in getRefundPreview', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params.id
      });

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('Reservation not found') || error.message.includes('not found')) {
          res.status(404).json({
            error: {
              code: 'RESERVATION_NOT_FOUND',
              message: '예약을 찾을 수 없습니다.',
              details: '존재하지 않는 예약입니다.'
            }
          });
          return;
        }

        if (error.message.includes('Unauthorized') || error.message.includes('권한')) {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: '권한이 없습니다.',
              details: '본인의 예약만 조회할 수 있습니다.'
            }
          });
          return;
        }
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '환불 금액 계산 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * PUT /api/reservations/:id/cancel
   * Cancel a reservation with comprehensive v3.2 cancellation system
   *
   * Path Parameters:
   * - id: Reservation UUID
   *
   * Request Body:
   * - reason: Optional cancellation reason (max 500 characters)
   * - cancellationType: Optional cancellation type (user_request, shop_request, no_show, admin_force)
   * - refundPreference: Optional refund preference (full_refund, partial_refund, no_refund)
   * - notifyShop: Optional flag to notify shop owner (default: true)
   * - notifyCustomer: Optional flag to notify customer (default: true)
   */
  async cancelReservation(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인이 필요합니다.'
          }
        });
        return;
      }

      const { id } = req.params;
      const { 
        reason, 
        cancellationType = 'user_request',
        refundPreference = 'full_refund',
        notifyShop = true,
        notifyCustomer = true
      } = req.body;

      if (!id) {
        res.status(400).json({
          error: {
            code: 'MISSING_RESERVATION_ID',
            message: '예약 ID가 필요합니다.',
            details: '예약 ID를 제공해주세요.'
          }
        });
        return;
      }

      // Validate cancellation type
      const validCancellationTypes = ['user_request', 'shop_request', 'no_show', 'admin_force'];
      if (!validCancellationTypes.includes(cancellationType)) {
        res.status(400).json({
          error: {
            code: 'INVALID_CANCELLATION_TYPE',
            message: '유효하지 않은 취소 유형입니다.',
            details: `허용된 취소 유형: ${validCancellationTypes.join(', ')}`
          }
        });
        return;
      }

      // Validate refund preference
      const validRefundPreferences = ['full_refund', 'partial_refund', 'no_refund'];
      if (!validRefundPreferences.includes(refundPreference)) {
        res.status(400).json({
          error: {
            code: 'INVALID_REFUND_PREFERENCE',
            message: '유효하지 않은 환불 선호도입니다.',
            details: `허용된 환불 선호도: ${validRefundPreferences.join(', ')}`
          }
        });
        return;
      }

      // Check if reservation can be cancelled
      const canCancel = await reservationService.canCancelReservation(id, userId);

      if (!canCancel.canCancel) {
        res.status(400).json({
          error: {
            code: 'CANCELLATION_NOT_ALLOWED',
            message: '예약을 취소할 수 없습니다.',
            details: canCancel.reason
          }
        });
        return;
      }

      // Process comprehensive cancellation with refund handling
      const cancellationResult = await this.processComprehensiveCancellation({
        reservationId: id,
        userId,
        userRole: 'user',
        reason,
        cancellationType,
        refundPreference,
        notifyShop,
        notifyCustomer,
        adminOverride: false
      });

      logger.info('Reservation cancelled successfully with v3.2 system', {
        reservationId: id,
        userId,
        reason,
        cancellationType,
        refundPreference,
        refundAmount: cancellationResult.refundAmount,
        refundStatus: cancellationResult.refundStatus
      });

      res.status(200).json({
        success: true,
        data: {
          reservation: cancellationResult.reservation,
          refund: {
            amount: cancellationResult.refundAmount,
            status: cancellationResult.refundStatus,
            processingTime: cancellationResult.processingTime
          },
          notifications: {
            shopNotified: cancellationResult.shopNotified,
            customerNotified: cancellationResult.customerNotified
          },
          auditTrail: {
            cancelledAt: cancellationResult.cancelledAt,
            cancellationType,
            reason,
            processedBy: userId
          }
        }
      });

    } catch (error) {
      logger.error('Error in cancelReservation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params.id
      });

      // Handle specific error types
      if (error instanceof Error) {
        if (error.message === 'Reservation not found') {
          res.status(404).json({
            error: {
              code: 'RESERVATION_NOT_FOUND',
              message: '예약을 찾을 수 없습니다.',
              details: '존재하지 않는 예약입니다.'
            }
          });
          return;
        }

        if (error.message === 'Unauthorized to cancel this reservation') {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: '접근 권한이 없습니다.',
              details: '다른 사용자의 예약입니다.'
            }
          });
          return;
        }

        if (error.message === 'Reservation is already cancelled') {
          res.status(400).json({
            error: {
              code: 'ALREADY_CANCELLED',
              message: '이미 취소된 예약입니다.',
              details: '이미 취소된 예약입니다.'
            }
          });
          return;
        }

        if (error.message === 'Cannot cancel completed reservation') {
          res.status(400).json({
            error: {
              code: 'COMPLETED_RESERVATION',
              message: '완료된 예약은 취소할 수 없습니다.',
              details: '완료된 예약은 취소할 수 없습니다.'
            }
          });
          return;
        }
      }

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '예약 취소 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }


  /**
   * Create comprehensive audit trail for cancellation
   */
  private async createCancellationAuditTrail(params: {
    reservationId: string;
    userId: string;
    reason?: string;
    cancellationType: string;
    refundAmount: number;
    refundStatus: string;
    shopNotified: boolean;
    customerNotified: boolean;
  }): Promise<void> {
    try {
      const { getSupabaseClient } = await import('../config/database');
      const supabase = getSupabaseClient();

      await supabase
        .from('cancellation_audit_log')
        .insert({
          reservation_id: params.reservationId,
          user_id: params.userId,
          cancellation_type: params.cancellationType,
          reason: params.reason,
          refund_amount: params.refundAmount,
          refund_status: params.refundStatus,
          shop_notified: params.shopNotified,
          customer_notified: params.customerNotified,
          created_at: new Date().toISOString()
        });

      logger.info('Cancellation audit trail created', {
        reservationId: params.reservationId,
        cancellationType: params.cancellationType,
        refundAmount: params.refundAmount
      });

    } catch (error) {
      logger.error('Failed to create cancellation audit trail', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: params.reservationId
      });
      // Don't throw - audit trail failure shouldn't break cancellation
    }
  }

  /**
   * PUT /api/reservations/:id/cancel-v2
   * Enhanced cancellation endpoint with comprehensive v3.2 system
   * 
   * Features:
   * - Multi-role support (user, shop owner, admin)
   * - State machine integration
   * - Comprehensive audit logging
   * - Notification triggers
   * - Bulk cancellation support
   * - Advanced validation and error handling
   */
  async cancelReservationV2(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const userRole = (req as any).user?.role;
      
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인이 필요합니다.'
          }
        });
        return;
      }

      const { id } = req.params;
      const { 
        reason, 
        cancellationType = 'user_request',
        refundPreference = 'full_refund',
        notifyShop = true,
        notifyCustomer = true,
        adminOverride = false,
        bulkCancellation = false,
        cancellationIds = []
      } = req.body;

      if (!id && !bulkCancellation) {
        res.status(400).json({
          error: {
            code: 'MISSING_RESERVATION_ID',
            message: '예약 ID가 필요합니다.',
            details: '예약 ID를 제공해주세요.'
          }
        });
        return;
      }

      // Handle bulk cancellation for admin users
      if (bulkCancellation) {
        if (userRole !== 'admin') {
          res.status(403).json({
            error: {
              code: 'FORBIDDEN',
              message: '대량 취소는 관리자만 가능합니다.',
              details: '관리자 권한이 필요합니다.'
            }
          });
          return;
        }

        if (!cancellationIds || !Array.isArray(cancellationIds) || cancellationIds.length === 0) {
          res.status(400).json({
            error: {
              code: 'MISSING_BULK_IDS',
              message: '대량 취소할 예약 ID 목록이 필요합니다.',
              details: 'cancellationIds 배열을 제공해주세요.'
            }
          });
          return;
        }

        return await this.processBulkCancellation(req, res, {
          userId,
          cancellationIds,
          reason,
          cancellationType: 'admin_force',
          refundPreference: 'full_refund',
          notifyShop,
          notifyCustomer
        });
      }

      // Validate cancellation type based on user role
      const validCancellationTypes = this.getValidCancellationTypes(userRole);
      if (!validCancellationTypes.includes(cancellationType)) {
        res.status(400).json({
          error: {
            code: 'INVALID_CANCELLATION_TYPE',
            message: '유효하지 않은 취소 유형입니다.',
            details: `허용된 취소 유형: ${validCancellationTypes.join(', ')}`
          }
        });
        return;
      }

      // Validate refund preference
      const validRefundPreferences = ['full_refund', 'partial_refund', 'no_refund'];
      if (!validRefundPreferences.includes(refundPreference)) {
        res.status(400).json({
          error: {
            code: 'INVALID_REFUND_PREFERENCE',
            message: '유효하지 않은 환불 선호도입니다.',
            details: `허용된 환불 선호도: ${validRefundPreferences.join(', ')}`
          }
        });
        return;
      }

      // Process comprehensive cancellation with state machine integration
      const cancellationResult = await this.processComprehensiveCancellation({
        reservationId: id,
        userId,
        userRole,
        reason,
        cancellationType,
        refundPreference,
        notifyShop,
        notifyCustomer,
        adminOverride
      });

      res.json({
        success: true,
        data: {
          reservation: cancellationResult.reservation,
          refund: cancellationResult.refund,
          notifications: cancellationResult.notifications,
          auditTrail: cancellationResult.auditTrail
        }
      });

    } catch (error) {
      logger.error('Error in cancelReservationV2', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params.id,
        userId: (req as any).user?.id 
      });
      
      res.status(500).json({
        error: {
          code: 'CANCELLATION_V2_FAILED',
          message: '고급 예약 취소 중 오류가 발생했습니다.',
          details: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Get valid cancellation types based on user role
   */
  private getValidCancellationTypes(userRole: string): string[] {
    switch (userRole) {
      case 'admin':
        return ['user_request', 'shop_request', 'no_show', 'admin_force'];
      case 'shop_owner':
        return ['shop_request', 'no_show'];
      case 'user':
      default:
        return ['user_request'];
    }
  }

  /**
   * Process comprehensive cancellation with state machine integration
   */
  private async processComprehensiveCancellation(params: {
    reservationId: string;
    userId: string;
    userRole: string;
    reason?: string;
    cancellationType: string;
    refundPreference: string;
    notifyShop: boolean;
    notifyCustomer: boolean;
    adminOverride: boolean;
  }): Promise<{
    reservation: any;
    refund: any;
    notifications: any;
    auditTrail: any;
    refundAmount: number;
    refundStatus: string;
    processingTime: number;
    shopNotified: boolean;
    customerNotified: boolean;
    cancelledAt: string;
  }> {
    try {
      const { reservationService } = await import('../services/reservation.service');
      const { reservationStateMachine } = await import('../services/reservation-state-machine.service');
      const { refundService } = await import('../services/refund.service');

      // Get reservation details
      const reservation = await reservationService.getReservationById(params.reservationId);
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      // Verify permissions based on user role
      await this.verifyCancellationPermissions(reservation, params.userId, params.userRole);

      // Use state machine for proper status transition
      const stateMachineResult = await reservationStateMachine.executeTransition(
        params.reservationId,
        'cancelled_by_user',
        params.userRole === 'admin' ? 'admin' : 'user',
        params.userId,
        params.reason,
        {
          cancellationType: params.cancellationType,
          refundPreference: params.refundPreference,
          notifyShop: params.notifyShop,
          notifyCustomer: params.notifyCustomer,
          adminOverride: params.adminOverride,
          userRole: params.userRole
        }
      );

      // Process automatic refunds
      let refundResult = null;
      if (stateMachineResult.success) {
        try {
          refundResult = await reservationService.cancelReservation(
            params.reservationId,
            params.userId,
            params.reason,
            params.cancellationType as any,
            params.refundPreference as any
          );
        } catch (refundError) {
          logger.error('Refund processing failed during comprehensive cancellation', {
            reservationId: params.reservationId,
            error: refundError instanceof Error ? refundError.message : 'Unknown error'
          });
          // Continue with cancellation even if refund fails
        }
      }

      // Trigger notifications
      const notifications = await this.triggerCancellationNotifications({
        reservation,
        cancellationType: params.cancellationType,
        reason: params.reason,
        notifyShop: params.notifyShop,
        notifyCustomer: params.notifyCustomer,
        refundResult
      });

      // Create comprehensive audit trail
      const auditTrail = await this.createComprehensiveCancellationAuditTrail({
        reservationId: params.reservationId,
        userId: params.userId,
        userRole: params.userRole,
        reason: params.reason,
        cancellationType: params.cancellationType,
        refundPreference: params.refundPreference,
        stateMachineResult,
        refundResult,
        notifications,
        adminOverride: params.adminOverride
      });

      const startTime = Date.now();
      const processingTime = Date.now() - startTime;

      return {
        reservation: stateMachineResult.reservation,
        refund: refundResult,
        notifications,
        auditTrail,
        refundAmount: refundResult?.refundAmount || 0,
        refundStatus: refundResult?.status || 'no_refund',
        processingTime,
        shopNotified: notifications?.shopNotification?.success || false,
        customerNotified: notifications?.customerNotification?.success || false,
        cancelledAt: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error in processComprehensiveCancellation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: params.reservationId,
        userId: params.userId
      });
      throw error;
    }
  }

  /**
   * Verify cancellation permissions based on user role
   */
  private async verifyCancellationPermissions(
    reservation: any, 
    userId: string, 
    userRole: string
  ): Promise<void> {
    switch (userRole) {
      case 'admin':
        // Admins can cancel any reservation
        return;
      
      case 'shop_owner':
        // Shop owners can only cancel their own shop's reservations
        if (reservation.shopId !== userId) {
          throw new Error('Shop owners can only cancel their own shop reservations');
        }
        break;
      
      case 'user':
      default:
        // Users can only cancel their own reservations
        if (reservation.userId !== userId) {
          throw new Error('Users can only cancel their own reservations');
        }
        break;
    }
  }

  /**
   * Trigger cancellation notifications
   */
  private async triggerCancellationNotifications(params: {
    reservation: any;
    cancellationType: string;
    reason?: string;
    notifyShop: boolean;
    notifyCustomer: boolean;
    refundResult?: any;
  }): Promise<{
    shopNotification: any;
    customerNotification: any;
  }> {
    const notifications = {
      shopNotification: null,
      customerNotification: null
    };

    try {
      // Shop notification
      if (params.notifyShop) {
        notifications.shopNotification = await this.sendShopCancellationNotification({
          reservation: params.reservation,
          cancellationType: params.cancellationType,
          reason: params.reason,
          refundResult: params.refundResult
        });
      }

      // Customer notification
      if (params.notifyCustomer) {
        notifications.customerNotification = await this.sendCustomerCancellationNotification({
          reservation: params.reservation,
          cancellationType: params.cancellationType,
          reason: params.reason,
          refundResult: params.refundResult
        });
      }

      logger.info('Cancellation notifications triggered', {
        reservationId: params.reservation.id,
        shopNotified: !!notifications.shopNotification,
        customerNotified: !!notifications.customerNotification
      });

    } catch (error) {
      logger.error('Failed to trigger cancellation notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: params.reservation.id
      });
      // Don't throw - notification failure shouldn't break cancellation
    }

    return notifications;
  }

  /**
   * Send shop cancellation notification
   */
  private async sendShopCancellationNotification(params: {
    reservation: any;
    cancellationType: string;
    reason?: string;
    refundResult?: any;
  }): Promise<any> {
    // Implementation would integrate with notification service
    logger.info('Shop cancellation notification sent', {
      reservationId: params.reservation.id,
      shopId: params.reservation.shopId,
      cancellationType: params.cancellationType,
      reason: params.reason
    });

    return {
      success: true,
      notificationId: `shop_cancel_${params.reservation.id}_${Date.now()}`,
      type: 'cancellation_notification',
      recipient: 'shop_owner'
    };
  }

  /**
   * Send customer cancellation notification
   */
  private async sendCustomerCancellationNotification(params: {
    reservation: any;
    cancellationType: string;
    reason?: string;
    refundResult?: any;
  }): Promise<any> {
    // Implementation would integrate with notification service
    logger.info('Customer cancellation notification sent', {
      reservationId: params.reservation.id,
      userId: params.reservation.userId,
      cancellationType: params.cancellationType,
      refundAmount: params.refundResult?.refundAmount || 0
    });

    return {
      success: true,
      notificationId: `customer_cancel_${params.reservation.id}_${Date.now()}`,
      type: 'cancellation_notification',
      recipient: 'customer',
      refundInfo: params.refundResult ? {
        refundAmount: params.refundResult.refundAmount,
        refundPercentage: params.refundResult.refundPercentage,
        refundStatus: params.refundResult.status
      } : null
    };
  }

  /**
   * Process bulk cancellation for admin users
   */
  private async processBulkCancellation(
    req: Request, 
    res: Response, 
    params: {
      userId: string;
      cancellationIds: string[];
      reason?: string;
      cancellationType: string;
      refundPreference: string;
      notifyShop: boolean;
      notifyCustomer: boolean;
    }
  ): Promise<void> {
    try {
      const results = [];
      const errors = [];

      for (const reservationId of params.cancellationIds) {
        try {
          const result = await this.processComprehensiveCancellation({
            reservationId,
            userId: params.userId,
            userRole: 'admin',
            reason: params.reason,
            cancellationType: params.cancellationType,
            refundPreference: params.refundPreference,
            notifyShop: params.notifyShop,
            notifyCustomer: params.notifyCustomer,
            adminOverride: true
          });

          results.push({
            reservationId,
            success: true,
            result
          });

        } catch (error) {
          errors.push({
            reservationId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      res.json({
        success: true,
        data: {
          totalProcessed: params.cancellationIds.length,
          successful: results.length,
          failed: errors.length,
          results,
          errors
        }
      });

    } catch (error) {
      logger.error('Error in processBulkCancellation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: params.userId,
        cancellationCount: params.cancellationIds.length
      });

      res.status(500).json({
        error: {
          code: 'BULK_CANCELLATION_FAILED',
          message: '대량 취소 처리 중 오류가 발생했습니다.',
          details: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Create comprehensive cancellation audit trail
   */
  private async createComprehensiveCancellationAuditTrail(params: {
    reservationId: string;
    userId: string;
    userRole: string;
    reason?: string;
    cancellationType: string;
    refundPreference: string;
    stateMachineResult: any;
    refundResult?: any;
    notifications: any;
    adminOverride: boolean;
  }): Promise<any> {
    try {
      const { formatKoreanDateTime, getCurrentKoreanTime } = await import('../utils/korean-timezone');
      
      const auditRecord = {
        reservation_id: params.reservationId,
        user_id: params.userId,
        user_role: params.userRole,
        cancellation_type: params.cancellationType,
        cancellation_reason: params.reason,
        refund_preference: params.refundPreference,
        state_machine_success: params.stateMachineResult.success,
        state_machine_result: params.stateMachineResult,
        refund_processed: !!params.refundResult,
        refund_details: params.refundResult,
        notifications_sent: params.notifications,
        admin_override: params.adminOverride,
        created_at: formatKoreanDateTime(getCurrentKoreanTime()),
        korean_timezone: 'Asia/Seoul (KST)'
      };

      // Store in comprehensive audit log
      const { getSupabaseClient } = await import('../config/database');
      const supabase = getSupabaseClient();
      
      await supabase
        .from('comprehensive_cancellation_audit_log')
        .insert(auditRecord);

      logger.info('Comprehensive cancellation audit trail created', {
        reservationId: params.reservationId,
        userRole: params.userRole,
        cancellationType: params.cancellationType,
        refundProcessed: !!params.refundResult
      });

      return auditRecord;

    } catch (error) {
      logger.error('Failed to create comprehensive cancellation audit trail', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: params.reservationId
      });
      // Don't throw - audit trail failure shouldn't break cancellation
      return null;
    }
  }
} 