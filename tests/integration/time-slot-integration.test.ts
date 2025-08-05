/**
 * Time Slot Integration Tests
 * 
 * End-to-end tests for the Time Slot Availability Calculation Engine
 * Tests the complete flow from API request to time slot generation
 */

import request from 'supertest';
import express from 'express';
import { ReservationController } from '../../src/controllers/reservation.controller';
import { timeSlotService } from '../../src/services/time-slot.service';

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

const mockTimeSlotService = timeSlotService as jest.Mocked<typeof timeSlotService>;

describe('Time Slot Integration Tests', () => {
  let app: express.Application;
  let reservationController: ReservationController;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create Express app for testing
    app = express();
    app.use(express.json());
    
    // Create controller instance
    reservationController = new ReservationController();
    
    // Add route for testing
    app.get('/api/shops/:shopId/available-slots', async (req, res) => {
      await reservationController.getAvailableSlots(req, res);
    });
  });

  describe('GET /api/shops/:shopId/available-slots', () => {
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
      },
      {
        startTime: '10:30',
        endTime: '11:00',
        duration: 30,
        isAvailable: true
      }
    ];

    test('should return available time slots for valid request', async () => {
      // Mock the service response
      mockTimeSlotService.getAvailableTimeSlots.mockResolvedValue(mockTimeSlots);

      const response = await request(app)
        .get('/api/shops/123e4567-e89b-12d3-a456-426614174000/available-slots')
        .query({
          date: '2024-03-15',
          'serviceIds[]': ['service-1', 'service-2'],
          interval: '30'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.shopId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(response.body.data.date).toBe('2024-03-15');
      expect(response.body.data.serviceIds).toEqual(['service-1', 'service-2']);
      expect(response.body.data.availableSlots).toHaveLength(3); // Only available slots
      expect(response.body.data.totalSlots).toBe(4);
      expect(response.body.data.availableCount).toBe(3);

      // Verify service was called with correct parameters
      expect(mockTimeSlotService.getAvailableTimeSlots).toHaveBeenCalledWith({
        shopId: '123e4567-e89b-12d3-a456-426614174000',
        date: '2024-03-15',
        serviceIds: ['service-1', 'service-2'],
        interval: 30
      });
    });

    test('should return 400 for missing date parameter', async () => {
      const response = await request(app)
        .get('/api/shops/123e4567-e89b-12d3-a456-426614174000/available-slots')
        .query({
          'serviceIds[]': ['service-1']
        })
        .expect(400);

      expect(response.body.error.code).toBe('MISSING_REQUIRED_PARAMETERS');
      expect(response.body.error.message).toBe('필수 파라미터가 누락되었습니다.');
    });

    test('should return 400 for missing serviceIds parameter', async () => {
      const response = await request(app)
        .get('/api/shops/123e4567-e89b-12d3-a456-426614174000/available-slots')
        .query({
          date: '2024-03-15'
        })
        .expect(400);

      expect(response.body.error.code).toBe('MISSING_REQUIRED_PARAMETERS');
      expect(response.body.error.message).toBe('필수 파라미터가 누락되었습니다.');
    });

    test('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .get('/api/shops/123e4567-e89b-12d3-a456-426614174000/available-slots')
        .query({
          date: '2024/03/15',
          'serviceIds[]': ['service-1']
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_DATE_FORMAT');
      expect(response.body.error.message).toBe('날짜 형식이 올바르지 않습니다.');
    });

    test('should return 400 for invalid interval', async () => {
      const response = await request(app)
        .get('/api/shops/123e4567-e89b-12d3-a456-426614174000/available-slots')
        .query({
          date: '2024-03-15',
          'serviceIds[]': ['service-1'],
          interval: '10' // Too small
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_INTERVAL');
      expect(response.body.error.message).toBe('시간 간격이 올바르지 않습니다.');
    });

    test('should return 400 for invalid start time format', async () => {
      const response = await request(app)
        .get('/api/shops/123e4567-e89b-12d3-a456-426614174000/available-slots')
        .query({
          date: '2024-03-15',
          'serviceIds[]': ['service-1'],
          startTime: '9:60' // Invalid format (invalid minutes)
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_START_TIME');
      expect(response.body.error.message).toBe('시작 시간 형식이 올바르지 않습니다.');
    });

    test('should return 400 for invalid end time format', async () => {
      const response = await request(app)
        .get('/api/shops/123e4567-e89b-12d3-a456-426614174000/available-slots')
        .query({
          date: '2024-03-15',
          'serviceIds[]': ['service-1'],
          endTime: '25:00' // Invalid format (invalid hour)
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_END_TIME');
      expect(response.body.error.message).toBe('종료 시간 형식이 올바르지 않습니다.');
    });

    test('should handle service errors gracefully', async () => {
      // Mock service to throw error
      mockTimeSlotService.getAvailableTimeSlots.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/shops/123e4567-e89b-12d3-a456-426614174000/available-slots')
        .query({
          date: '2024-03-15',
          'serviceIds[]': ['service-1']
        })
        .expect(500);

      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(response.body.error.message).toBe('예약 가능 시간 조회 중 오류가 발생했습니다.');
    });

    test('should handle empty serviceIds array', async () => {
      const response = await request(app)
        .get('/api/shops/123e4567-e89b-12d3-a456-426614174000/available-slots')
        .query({
          date: '2024-03-15',
          'serviceIds[]': []
        })
        .expect(400);

      expect(response.body.error.code).toBe('MISSING_REQUIRED_PARAMETERS');
      expect(response.body.error.message).toBe('필수 파라미터가 누락되었습니다.');
    });

    test('should handle single serviceId (not array)', async () => {
      // Mock the service response
      mockTimeSlotService.getAvailableTimeSlots.mockResolvedValue(mockTimeSlots);

      const response = await request(app)
        .get('/api/shops/123e4567-e89b-12d3-a456-426614174000/available-slots')
        .query({
          date: '2024-03-15',
          serviceIds: 'service-1' // Single value instead of array
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.serviceIds).toEqual(['service-1']);

      // Verify service was called with array
      expect(mockTimeSlotService.getAvailableTimeSlots).toHaveBeenCalledWith({
        shopId: '123e4567-e89b-12d3-a456-426614174000',
        date: '2024-03-15',
        serviceIds: ['service-1'],
        interval: 30
      });
    });

    test('should handle time constraints correctly', async () => {
      // Mock the service response
      mockTimeSlotService.getAvailableTimeSlots.mockResolvedValue(mockTimeSlots);

      const response = await request(app)
        .get('/api/shops/123e4567-e89b-12d3-a456-426614174000/available-slots')
        .query({
          date: '2024-03-15',
          'serviceIds[]': ['service-1'],
          startTime: '09:00',
          endTime: '12:00'
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify service was called with time constraints
      expect(mockTimeSlotService.getAvailableTimeSlots).toHaveBeenCalledWith({
        shopId: '123e4567-e89b-12d3-a456-426614174000',
        date: '2024-03-15',
        serviceIds: ['service-1'],
        startTime: '09:00',
        endTime: '12:00',
        interval: 30
      });
    });
  });

  describe('Time Slot Calculation Engine Features', () => {
    test('should support different intervals', async () => {
      mockTimeSlotService.getAvailableTimeSlots.mockResolvedValue([]);

      await request(app)
        .get('/api/shops/123e4567-e89b-12d3-a456-426614174000/available-slots')
        .query({
          date: '2024-03-15',
          'serviceIds[]': ['service-1'],
          interval: '60'
        })
        .expect(200);

      expect(mockTimeSlotService.getAvailableTimeSlots).toHaveBeenCalledWith({
        shopId: '123e4567-e89b-12d3-a456-426614174000',
        date: '2024-03-15',
        serviceIds: ['service-1'],
        interval: 60
      });
    });

    test('should handle multiple service IDs', async () => {
      mockTimeSlotService.getAvailableTimeSlots.mockResolvedValue([]);

      await request(app)
        .get('/api/shops/123e4567-e89b-12d3-a456-426614174000/available-slots')
        .query({
          date: '2024-03-15',
          'serviceIds[]': ['service-1', 'service-2', 'service-3']
        })
        .expect(200);

      expect(mockTimeSlotService.getAvailableTimeSlots).toHaveBeenCalledWith({
        shopId: '123e4567-e89b-12d3-a456-426614174000',
        date: '2024-03-15',
        serviceIds: ['service-1', 'service-2', 'service-3'],
        interval: 30
      });
    });

    test('should provide comprehensive response data', async () => {
      const mockSlots = [
        { startTime: '09:00', endTime: '09:30', duration: 30, isAvailable: true },
        { startTime: '09:30', endTime: '10:00', duration: 30, isAvailable: false },
        { startTime: '10:00', endTime: '10:30', duration: 30, isAvailable: true }
      ];

      mockTimeSlotService.getAvailableTimeSlots.mockResolvedValue(mockSlots);

      const response = await request(app)
        .get('/api/shops/123e4567-e89b-12d3-a456-426614174000/available-slots')
        .query({
          date: '2024-03-15',
          'serviceIds[]': ['service-1']
        })
        .expect(200);

      expect(response.body.data).toHaveProperty('shopId');
      expect(response.body.data).toHaveProperty('date');
      expect(response.body.data).toHaveProperty('serviceIds');
      expect(response.body.data).toHaveProperty('availableSlots');
      expect(response.body.data).toHaveProperty('totalSlots');
      expect(response.body.data).toHaveProperty('availableCount');

      expect(response.body.data.totalSlots).toBe(3);
      expect(response.body.data.availableCount).toBe(2);
      expect(response.body.data.availableSlots).toHaveLength(2);
    });
  });
}); 