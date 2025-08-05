/**
 * Reservation Controller Tests
 * 
 * Tests for reservation-related API endpoints including:
 * - Available time slots for booking
 * - Reservation creation and management
 * - Reservation status updates
 */

import { Request, Response } from 'express';
import { ReservationController } from '../../src/controllers/reservation.controller';

// Mock the time slot service
jest.mock('../../src/services/time-slot.service', () => ({
  timeSlotService: {
    getAvailableTimeSlots: jest.fn(),
    getNextAvailableSlot: jest.fn(),
    isSlotAvailable: jest.fn(),
    getShopWeeklyHours: jest.fn(),
    updateShopOperatingHours: jest.fn(),
    getTimeSlotStats: jest.fn()
  }
}));

// Mock the reservation service
jest.mock('../../src/services/reservation.service', () => ({
  reservationService: {
    createReservation: jest.fn(),
    getReservationById: jest.fn(),
    getUserReservations: jest.fn(),
    cancelReservation: jest.fn(),
    canCancelReservation: jest.fn()
  }
}));

import { timeSlotService } from '../../src/services/time-slot.service';
import { reservationService } from '../../src/services/reservation.service';
const mockTimeSlotService = timeSlotService as jest.Mocked<typeof timeSlotService>;
const mockReservationService = reservationService as jest.Mocked<typeof reservationService>;

describe('Reservation Controller Tests', () => {
  let reservationController: ReservationController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    reservationController = new ReservationController();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockResponse = {
      status: mockStatus,
      json: mockJson
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('getAvailableSlots', () => {
    it('should return available slots for valid request', async () => {
      // Mock the time slot service response
      const mockTimeSlots = [
        {
          startTime: '09:00',
          endTime: '09:30',
          duration: 30,
          isAvailable: true
        },
        {
          startTime: '09:30',
          endTime: '10:00',
          duration: 30,
          isAvailable: true
        },
        {
          startTime: '10:00',
          endTime: '10:30',
          duration: 30,
          isAvailable: false
        }
      ];

      mockTimeSlotService.getAvailableTimeSlots.mockResolvedValue(mockTimeSlots);

      // Mock request
      mockRequest = {
        params: {
          shopId: '123e4567-e89b-12d3-a456-426614174000'
        },
        query: {
          date: '2024-03-15',
          serviceIds: ['uuid1', 'uuid2'],
          interval: '30'
        }
      };

      // Call the method
      await reservationController.getAvailableSlots(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify the service was called with correct parameters
      expect(mockTimeSlotService.getAvailableTimeSlots).toHaveBeenCalledWith({
        shopId: '123e4567-e89b-12d3-a456-426614174000',
        date: '2024-03-15',
        serviceIds: ['uuid1', 'uuid2'],
        startTime: undefined,
        endTime: undefined,
        interval: 30
      });

      // Verify the response
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          shopId: '123e4567-e89b-12d3-a456-426614174000',
          date: '2024-03-15',
          serviceIds: ['uuid1', 'uuid2'],
          availableSlots: [
            {
              startTime: '09:00',
              endTime: '09:30',
              duration: 30
            },
            {
              startTime: '09:30',
              endTime: '10:00',
              duration: 30
            }
          ],
          totalSlots: 3,
          availableCount: 2
        }
      });
    });

    it('should return 400 for missing required parameters', async () => {
      // Mock request without required parameters
      mockRequest = {
        params: {
          shopId: '123e4567-e89b-12d3-a456-426614174000'
        },
        query: {
          // Missing date and serviceIds
        }
      };

      // Call the method
      await reservationController.getAvailableSlots(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify error response
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_REQUIRED_PARAMETERS',
          message: '필수 파라미터가 누락되었습니다.',
          details: 'date와 serviceIds는 필수입니다.'
        }
      });
    });

    it('should return 400 for invalid date format', async () => {
      // Mock request with invalid date format
      mockRequest = {
        params: {
          shopId: '123e4567-e89b-12d3-a456-426614174000'
        },
        query: {
          date: 'invalid-date',
          serviceIds: ['uuid1']
        }
      };

      // Call the method
      await reservationController.getAvailableSlots(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify error response
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_DATE_FORMAT',
          message: '날짜 형식이 올바르지 않습니다.',
          details: 'YYYY-MM-DD 형식으로 입력해주세요.'
        }
      });
    });

    it('should return 400 for invalid interval', async () => {
      // Mock request with invalid interval
      mockRequest = {
        params: {
          shopId: '123e4567-e89b-12d3-a456-426614174000'
        },
        query: {
          date: '2024-03-15',
          serviceIds: ['uuid1'],
          interval: '5' // Too small
        }
      };

      // Call the method
      await reservationController.getAvailableSlots(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify error response
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_INTERVAL',
          message: '시간 간격이 올바르지 않습니다.',
          details: '15분에서 120분 사이의 값을 입력해주세요.'
        }
      });
    });

    it('should handle service errors gracefully', async () => {
      // Mock the service to throw an error
      mockTimeSlotService.getAvailableTimeSlots.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Mock request
      mockRequest = {
        params: {
          shopId: '123e4567-e89b-12d3-a456-426614174000'
        },
        query: {
          date: '2024-03-15',
          serviceIds: ['uuid1']
        }
      };

      // Call the method
      await reservationController.getAvailableSlots(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify error response
      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '예약 가능 시간 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    });
  });

  describe('createReservation', () => {
    it('should create reservation successfully', async () => {
      const mockReservation = {
        id: 'reservation-1',
        shopId: '123e4567-e89b-12d3-a456-426614174000',
        userId: 'user-1',
        reservationDate: '2024-03-15',
        reservationTime: '14:00',
        status: 'requested' as const,
        totalAmount: 50000,
        pointsUsed: 0,
        specialRequests: 'Test request',
        createdAt: '2024-03-15T10:00:00Z',
        updatedAt: '2024-03-15T10:00:00Z'
      };

      mockReservationService.createReservation.mockResolvedValue(mockReservation);

      // Mock request
      mockRequest = {
        body: {
          shopId: '123e4567-e89b-12d3-a456-426614174000',
          services: [{ serviceId: 'service-1', quantity: 1 }],
          reservationDate: '2024-03-15',
          reservationTime: '14:00',
          specialRequests: 'Test request'
        },
        user: { id: 'user-1' }
      } as any;

      // Call the method
      await reservationController.createReservation(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify success response
      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          reservation: mockReservation
        }
      });
    });

    it('should return 401 when user not authenticated', async () => {
      // Mock request without user
      mockRequest = {
        body: {
          shopId: '123e4567-e89b-12d3-a456-426614174000',
          services: [{ serviceId: 'service-1', quantity: 1 }],
          reservationDate: '2024-03-15',
          reservationTime: '14:00'
        }
      } as any;

      // Call the method
      await reservationController.createReservation(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify unauthorized response
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: '인증이 필요합니다.',
          details: '로그인이 필요합니다.'
        }
      });
    });
  });

  describe('getReservations', () => {
    it('should return 401 when user not authenticated', async () => {
      // Mock request without user
      mockRequest = {
        query: {}
      } as any;

      // Call the method
      await reservationController.getReservations(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify unauthorized response
      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'UNAUTHORIZED',
          message: '인증이 필요합니다.',
          details: '로그인이 필요합니다.'
        }
      });
    });

    it('should get user reservations successfully', async () => {
      const mockResult = {
        reservations: [
          {
            id: 'reservation-1',
            shopId: '123e4567-e89b-12d3-a456-426614174000',
            userId: 'user-1',
            reservationDate: '2024-03-15',
            reservationTime: '14:00',
            status: 'requested' as const,
            totalAmount: 50000,
            pointsUsed: 0,
            createdAt: '2024-03-15T10:00:00Z',
            updatedAt: '2024-03-15T10:00:00Z'
          }
        ],
        total: 1,
        page: 1,
        limit: 20
      };

      mockReservationService.getUserReservations.mockResolvedValue(mockResult);

      // Mock request with user
      mockRequest = {
        query: {
          status: 'requested',
          page: '1',
          limit: '20'
        },
        user: { id: 'user-1' }
      } as any;

      // Call the method
      await reservationController.getReservations(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify success response
      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          reservations: mockResult.reservations,
          pagination: {
            total: mockResult.total,
            page: mockResult.page,
            limit: mockResult.limit,
            totalPages: 1
          }
        }
      });
    });
  });

  describe('getReservationById', () => {
    it('should return not implemented for now', async () => {
      // Mock request
      mockRequest = {
        params: {
          id: '123e4567-e89b-12d3-a456-426614174000'
        }
      };

      // Call the method
      await reservationController.getReservationById(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify not implemented response
      expect(mockStatus).toHaveBeenCalledWith(501);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'NOT_IMPLEMENTED',
          message: '예약 상세 조회 기능은 아직 구현되지 않았습니다.',
          details: '다음 단계에서 구현 예정입니다.'
        }
      });
    });
  });

  describe('cancelReservation', () => {
    it('should return not implemented for now', async () => {
      // Mock request
      mockRequest = {
        params: {
          id: '123e4567-e89b-12d3-a456-426614174000'
        }
      };

      // Call the method
      await reservationController.cancelReservation(
        mockRequest as Request,
        mockResponse as Response
      );

      // Verify not implemented response
      expect(mockStatus).toHaveBeenCalledWith(501);
      expect(mockJson).toHaveBeenCalledWith({
        error: {
          code: 'NOT_IMPLEMENTED',
          message: '예약 취소 기능은 아직 구현되지 않았습니다.',
          details: '다음 단계에서 구현 예정입니다.'
        }
      });
    });
  });
}); 