/**
 * Reservation Service Tests
 * 
 * Tests for reservation service with concurrent booking prevention
 * Focuses on business logic and error handling without complex database mocking
 */

import { ReservationService, CreateReservationRequest } from '../../src/services/reservation.service';

// Mock the database client with a simple approach
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn(() => ({
    rpc: jest.fn(),
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            range: jest.fn(() => ({
              then: jest.fn(() => Promise.resolve({ data: [], error: null, count: 0 }))
            }))
          }))
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        }))
      }))
    }))
  })),
  initializeDatabase: jest.fn(() => ({
    client: {},
    healthCheck: jest.fn(() => Promise.resolve(true)),
    disconnect: jest.fn(() => Promise.resolve())
  }))
}));

// Mock the time slot service
jest.mock('../../src/services/time-slot.service', () => ({
  timeSlotService: {
    isSlotAvailable: jest.fn(),
    getAvailableTimeSlots: jest.fn(),
    getNextAvailableSlot: jest.fn()
  }
}));

// Mock the logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

import { getSupabaseClient } from '../../src/config/database';
import { timeSlotService } from '../../src/services/time-slot.service';
import { logger } from '../../src/utils/logger';

describe('Reservation Service Tests', () => {
  let reservationService: ReservationService;
  let mockSupabase: any;
  let mockTimeSlotService: jest.Mocked<typeof timeSlotService>;
  let mockLogger: jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    reservationService = new ReservationService();
    mockSupabase = getSupabaseClient();
    mockTimeSlotService = timeSlotService as jest.Mocked<typeof timeSlotService>;
    mockLogger = logger as jest.Mocked<typeof logger>;
  });

  describe('Input Validation', () => {
    const baseRequest: CreateReservationRequest = {
      shopId: 'shop-123',
      userId: 'user-123',
      services: [
        { serviceId: 'service-1', quantity: 1 }
      ],
      reservationDate: '2024-03-15',
      reservationTime: '10:00',
      specialRequests: 'Test request'
    };

    it('should validate required fields', async () => {
      // Test missing shopId
      const invalidRequest1 = { ...baseRequest, shopId: '' };
      await expect(reservationService.createReservation(invalidRequest1))
        .rejects.toThrow('Shop ID and User ID are required');

      // Test missing userId
      const invalidRequest2 = { ...baseRequest, userId: '' };
      await expect(reservationService.createReservation(invalidRequest2))
        .rejects.toThrow('Shop ID and User ID are required');

      // Test empty services array
      const invalidRequest3 = { ...baseRequest, services: [] };
      await expect(reservationService.createReservation(invalidRequest3))
        .rejects.toThrow('At least one service is required');
    });

    it('should validate date format', async () => {
      const invalidRequest = { ...baseRequest, reservationDate: 'invalid-date' };
      await expect(reservationService.createReservation(invalidRequest))
        .rejects.toThrow('Invalid date format. Use YYYY-MM-DD');
    });

    it('should validate time format', async () => {
      const invalidRequest = { ...baseRequest, reservationTime: '25:00' };
      await expect(reservationService.createReservation(invalidRequest))
        .rejects.toThrow('Invalid time format. Use HH:MM');
    });

    it('should validate service quantity', async () => {
      const invalidRequest = {
        ...baseRequest,
        services: [{ serviceId: 'service-1', quantity: 0 }]
      };
      await expect(reservationService.createReservation(invalidRequest))
        .rejects.toThrow('Service quantity must be greater than 0');
    });

    it('should validate points usage', async () => {
      const invalidRequest = { ...baseRequest, pointsToUse: -100 };
      await expect(reservationService.createReservation(invalidRequest))
        .rejects.toThrow('Points used cannot be negative');
    });
  });

  describe('Time Slot Availability', () => {
    const mockRequest: CreateReservationRequest = {
      shopId: 'shop-123',
      userId: 'user-123',
      services: [
        { serviceId: 'service-1', quantity: 1 }
      ],
      reservationDate: '2024-03-15',
      reservationTime: '10:00',
      specialRequests: 'Test request'
    };

    it('should check time slot availability before creating reservation', async () => {
      mockTimeSlotService.isSlotAvailable.mockResolvedValue(false);

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('Selected time slot is no longer available');

      expect(mockTimeSlotService.isSlotAvailable).toHaveBeenCalledWith(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1']
      );
    });

    it('should proceed when time slot is available', async () => {
      mockTimeSlotService.isSlotAvailable.mockResolvedValue(true);
      
      // Debug: Check if the mock is set up correctly
      console.log('mockSupabase:', mockSupabase);
      console.log('mockSupabase.rpc:', mockSupabase.rpc);
      
      // Mock successful database response
      const mockResponse = {
        data: {
          id: 'reservation-123',
          shopId: 'shop-123',
          userId: 'user-123',
          reservationDate: '2024-03-15',
          reservationTime: '10:00',
          status: 'confirmed',
          totalAmount: 5000,
          pointsUsed: 0,
          specialRequests: 'Test request',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        error: null
      };
      
      console.log('Setting up mock response:', mockResponse);
      mockSupabase.rpc.mockResolvedValue(mockResponse);

      const result = await reservationService.createReservation(mockRequest);

      expect(result.id).toBe('reservation-123');
      expect(result.status).toBe('confirmed');
    });
  });

  describe('Error Handling', () => {
    const mockRequest: CreateReservationRequest = {
      shopId: 'shop-123',
      userId: 'user-123',
      services: [
        { serviceId: 'service-1', quantity: 1 }
      ],
      reservationDate: '2024-03-15',
      reservationTime: '10:00',
      specialRequests: 'Test request'
    };

    beforeEach(() => {
      mockTimeSlotService.isSlotAvailable.mockResolvedValue(true);
    });

    it('should handle slot conflict errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { 
          message: 'SLOT_CONFLICT: Time slot is not available due to existing reservations',
          details: '',
          hint: '',
          code: '23505',
          name: 'PostgrestError'
        }
      });

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('Time slot is no longer available due to concurrent booking');
    });

    it('should handle lock timeout errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { 
          message: 'lock_timeout: Lock acquisition failed',
          details: '',
          hint: '',
          code: '40P01',
          name: 'PostgrestError'
        }
      });

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('Lock acquisition timeout - please try again');
    });

    it('should handle deadlock errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { 
          message: 'deadlock detected',
          details: '',
          hint: '',
          code: '40P01',
          name: 'PostgrestError'
        }
      });

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('Deadlock detected - please try again');
    });

    it('should handle service not found errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { 
          message: 'SERVICE_NOT_FOUND: Service with ID does not exist',
          details: '',
          hint: '',
          code: '23505',
          name: 'PostgrestError'
        }
      });

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('One or more services are not available');
    });

    it('should handle invalid quantity errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { 
          message: 'INVALID_QUANTITY: Quantity must be greater than 0',
          details: '',
          hint: '',
          code: '23505',
          name: 'PostgrestError'
        }
      });

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('Invalid service quantity');
    });

    it('should handle insufficient amount errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { 
          message: 'INSUFFICIENT_AMOUNT: Points used cannot exceed total amount',
          details: '',
          hint: '',
          code: '23505',
          name: 'PostgrestError'
        }
      });

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('Points used cannot exceed total amount');
    });

    it('should handle generic database errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { 
          message: 'Unknown database error',
          details: '',
          hint: '',
          code: '23505',
          name: 'PostgrestError'
        }
      });

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('Reservation creation failed - please try again');
    });

    it('should handle null reservation data', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null
      });

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('Failed to create reservation');
    });
  });

  describe('Retry Logic', () => {
    const mockRequest: CreateReservationRequest = {
      shopId: 'shop-123',
      userId: 'user-123',
      services: [
        { serviceId: 'service-1', quantity: 1 }
      ],
      reservationDate: '2024-03-15',
      reservationTime: '10:00',
      specialRequests: 'Test request'
    };

    beforeEach(() => {
      mockTimeSlotService.isSlotAvailable.mockResolvedValue(true);
    });

    it('should retry on lock acquisition failures', async () => {
      // Mock initial failure, then success
      mockSupabase.rpc
        .mockRejectedValueOnce(new Error('Lock acquisition failed'))
        .mockResolvedValueOnce({
          data: {
            id: 'reservation-123',
            shopId: 'shop-123',
            userId: 'user-123',
            reservationDate: '2024-03-15',
            reservationTime: '10:00',
            status: 'confirmed',
            totalAmount: 5000,
            pointsUsed: 0,
            specialRequests: 'Test request',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          error: null
        });

      const result = await reservationService.createReservation(mockRequest);

      expect(result.id).toBe('reservation-123');
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Retrying reservation operation')
      );
    });

    it('should fail after maximum retries', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Lock acquisition failed'));

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('Lock acquisition failed');
      
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(3); // Default max retries
    });
  });

  describe('Configuration', () => {
    it('should have proper timeout and retry configuration', () => {
      // Test that the service has the expected configuration
      expect(reservationService).toBeDefined();
      
      // These values should be accessible for testing
      const service = reservationService as any;
      expect(service.LOCK_TIMEOUT).toBe(10000); // 10 seconds
      expect(service.MAX_RETRIES).toBe(3);
      expect(service.BASE_RETRY_DELAY).toBe(1000); // 1 second
      expect(service.MAX_RETRY_DELAY).toBe(5000); // 5 seconds
      expect(service.DEADLOCK_RETRY_DELAY).toBe(2000); // 2 seconds
    });
  });
}); 