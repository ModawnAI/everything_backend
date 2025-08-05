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
   * GET /api/shops/:shopId/available-slots
   * Get available time slots for a shop on a specific date
   * 
   * Query Parameters:
   * - date: Date in YYYY-MM-DD format (required)
   * - serviceIds[]: Array of service UUIDs (required)
   * - startTime: Optional start time filter (HH:MM format)
   * - endTime: Optional end time filter (HH:MM format)
   * - interval: Optional interval in minutes (default: 30)
   * 
   * Example: GET /api/shops/123e4567-e89b-12d3-a456-426614174000/available-slots?date=2024-03-15&serviceIds[]=uuid1&serviceIds[]=uuid2
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
        pointsToUse = 0
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

      // Create reservation request
      const reservationRequest: CreateReservationRequest = {
        shopId,
        userId,
        services,
        reservationDate,
        reservationTime,
        specialRequests,
        pointsToUse
      };

      // Create reservation with concurrent booking prevention
      const reservation = await reservationService.createReservation(reservationRequest);

      logger.info('Reservation created successfully', {
        reservationId: reservation.id,
        shopId,
        userId,
        reservationDate,
        reservationTime
      });

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
            pointsUsed: reservation.pointsUsed,
            specialRequests: reservation.specialRequests,
            createdAt: reservation.createdAt,
            updatedAt: reservation.updatedAt
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
   * PUT /api/reservations/:id/cancel
   * Cancel a reservation
   * 
   * Path Parameters:
   * - id: Reservation UUID
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
      const { reason } = req.body;

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

      // Cancel the reservation
      const cancelledReservation = await reservationService.cancelReservation(id, userId, reason);

      logger.info('Reservation cancelled successfully', {
        reservationId: id,
        userId,
        reason
      });

      res.status(200).json({
        success: true,
        data: {
          reservation: cancelledReservation
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
} 