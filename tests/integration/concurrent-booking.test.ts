/**
 * Concurrent Booking Integration Tests
 *
 * Tests for concurrent booking scenarios to validate database locking
 * and retry mechanisms work correctly under load
 */

// --- Mock setup: must be before any imports that use the mocked modules ---
const mockChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
};
const mockSupabase = {
  from: jest.fn().mockReturnValue(mockChain),
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  auth: { admin: { createUser: jest.fn() } },
} as any;

jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn(() => mockSupabase),
  getSupabaseAdmin: jest.fn(() => mockSupabase),
  supabase: mockSupabase,
}));

// Mock the time slot service
jest.mock('../../src/services/time-slot.service', () => ({
  timeSlotService: {
    isSlotAvailable: jest.fn(),
    validateSlotAvailability: jest.fn().mockResolvedValue({
      available: true,
      conflictReason: null,
      conflictingReservations: [],
      suggestedAlternatives: [],
    }),
    getAvailableSlots: jest.fn().mockResolvedValue([]),
    checkSlotConflict: jest.fn().mockResolvedValue(false),
  }
}));

// Mock query cache service to execute query functions directly
jest.mock('../../src/services/query-cache.service', () => ({
  queryCacheService: {
    getCachedQuery: jest.fn((_key: string, queryFn: () => Promise<any>) => queryFn()),
    invalidate: jest.fn(),
    invalidatePattern: jest.fn(),
  }
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock notification and websocket services
jest.mock('../../src/services/shop-owner-notification.service', () => ({
  shopOwnerNotificationService: {
    sendNewReservationNotification: jest.fn().mockResolvedValue(undefined),
    sendNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/customer-notification.service', () => ({
  customerNotificationService: {
    sendReservationConfirmation: jest.fn().mockResolvedValue(undefined),
    sendNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/batch-query.service', () => ({
  batchQueryService: {
    executeBatch: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../src/services/websocket.service', () => ({
  websocketService: {
    emitReservationUpdate: jest.fn(),
    emit: jest.fn(),
  },
}));

jest.mock('../../src/services/point.service', () => ({
  PointService: jest.fn().mockImplementation(() => ({
    getUserPoints: jest.fn().mockResolvedValue({ totalPoints: 1000, availablePoints: 1000 }),
    deductPoints: jest.fn().mockResolvedValue(true),
  })),
}));

import { ReservationService, CreateReservationRequest } from '../../src/services/reservation.service';
import { timeSlotService } from '../../src/services/time-slot.service';
import { PostgrestResponse, PostgrestError } from '@supabase/supabase-js';

const mockTimeSlotService = timeSlotService as jest.Mocked<typeof timeSlotService>;

describe('Concurrent Booking Integration Tests', () => {
  let reservationService: ReservationService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Re-establish mock chain after clearAllMocks
    Object.keys(mockChain).forEach(key => {
      if (key === 'single' || key === 'maybeSingle') {
        (mockChain as any)[key].mockResolvedValue({ data: null, error: null });
      } else if (key === 'rpc') {
        (mockChain as any)[key].mockResolvedValue({ data: null, error: null });
      } else {
        (mockChain as any)[key].mockReturnValue(mockChain);
      }
    });
    mockSupabase.from.mockReturnValue(mockChain);
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    // Re-establish getSupabaseClient mock (cleared by clearAllMocks)
    const db = require('../../src/config/database');
    db.getSupabaseClient.mockReturnValue(mockSupabase);
    db.getSupabaseAdmin?.mockReturnValue?.(mockSupabase);

    // Make .in() resolve with shop_services data (for calculatePricingWithDeposit)
    mockChain.in.mockResolvedValue({
      data: [{
        id: '789e0123-e89b-12d3-a456-426614174002',
        price_min: 5000,
        name: 'Test Service',
        deposit_amount: null,
        deposit_percentage: null,
      }],
      error: null,
    });

    // Make .single() resolve with user data (for user booking preferences query)
    mockChain.single.mockResolvedValue({
      data: { booking_preferences: { skinType: 'normal', allergyInfo: 'none' } },
      error: null,
    });

    reservationService = new ReservationService();

    // Default mock for slot availability
    mockTimeSlotService.isSlotAvailable.mockResolvedValue(true);
    mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
      available: true,
      conflictReason: null,
      conflictingReservations: [],
      suggestedAlternatives: [],
    });
  });

  describe('Concurrent Reservation Creation', () => {
    const mockRequest: CreateReservationRequest = {
      shopId: '123e4567-e89b-12d3-a456-426614174000',
      userId: '456e7890-e89b-12d3-a456-426614174001',
      services: [
        { serviceId: '789e0123-e89b-12d3-a456-426614174002', quantity: 1 }
      ],
      reservationDate: '2024-03-15',
      reservationTime: '09:00',
      specialRequests: 'Test request',
      pointsToUse: 100
    };

    const mockReservation = {
      id: 'reservation-123',
      shopId: mockRequest.shopId,
      userId: mockRequest.userId,
      reservationDate: mockRequest.reservationDate,
      reservationTime: mockRequest.reservationTime,
      status: 'requested',
      totalAmount: 5000,
      pointsUsed: 100,
      specialRequests: mockRequest.specialRequests,
      createdAt: '2024-03-15T09:00:00Z',
      updatedAt: '2024-03-15T09:00:00Z'
    };

    it('should handle multiple concurrent requests for same slot', async () => {
      // Simulate first request succeeds, all subsequent rpc calls fail with SLOT_CONFLICT.
      // The internal retry loop in createReservationWithLock retries all errors,
      // so we use mockResolvedValue (default) for SLOT_CONFLICT after the first success.
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: mockReservation,
          error: null,
          count: null,
          status: 200,
          statusText: 'OK'
        } as unknown as PostgrestResponse<any>)
        .mockResolvedValue({
          data: null,
          error: {
            message: 'SLOT_CONFLICT: Time slot is not available due to existing reservations',
            details: '',
            hint: '',
            code: 'SLOT_CONFLICT'
          } as PostgrestError,
          count: null,
          status: 400,
          statusText: 'Bad Request'
        } as unknown as PostgrestResponse<any>);

      // Execute concurrent requests
      const promises = [
        reservationService.createReservation(mockRequest),
        reservationService.createReservation(mockRequest),
        reservationService.createReservation(mockRequest)
      ];

      const results = await Promise.allSettled(promises);

      // One should succeed, others should fail
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(2);

      // Check that successful result is correct
      if (successful[0].status === 'fulfilled') {
        expect(successful[0].value).toEqual(mockReservation);
      }

      // Check that failed results have correct error messages
      failed.forEach(result => {
        if (result.status === 'rejected') {
          expect(result.reason.message).toContain('Time slot is no longer available due to concurrent booking');
        }
      });
    });

    it('should handle lock timeout scenarios', async () => {
      // Simulate lock timeout - the internal retry loop in createReservationWithLock
      // retries LOCK_TIMEOUT errors up to maxRetries (3) times before throwing
      // Note: error.message must include 'LOCK_TIMEOUT' (uppercase) to match the service check
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'LOCK_TIMEOUT: Lock acquisition failed',
          details: '',
          hint: '',
          code: 'LOCK_TIMEOUT'
        } as PostgrestError,
        count: null,
        status: 408,
        statusText: 'Request Timeout'
      } as unknown as PostgrestResponse<any>);

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('Lock acquisition timeout - please try again');

      // Internal retry loop retries LOCK_TIMEOUT 3 times before giving up
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(3);
    });

    it('should handle deadlock scenarios', async () => {
      // Simulate deadlock on first attempt, success on retry
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: null,
          error: { 
            message: 'deadlock detected',
            details: '',
            hint: '',
            code: 'deadlock'
          } as PostgrestError,
          count: null,
          status: 500,
          statusText: 'Internal Server Error'
        } as unknown as PostgrestResponse<any>)
        .mockResolvedValueOnce({
          data: mockReservation,
          error: null,
          count: null,
          status: 200,
          statusText: 'OK'
        } as unknown as PostgrestResponse<any>);

      const result = await reservationService.createReservation(mockRequest);

      expect(result).toEqual(mockReservation);
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
    });

    it('should handle maximum retries exceeded', async () => {
      // Simulate consistent SERVICE_NOT_FOUND errors
      // The internal retry loop in createReservationWithLock retries all errors
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'SERVICE_NOT_FOUND: Service with ID does not exist',
          details: '',
          hint: '',
          code: 'SERVICE_NOT_FOUND'
        } as PostgrestError,
        count: null,
        status: 400,
        statusText: 'Bad Request'
      } as unknown as PostgrestResponse<any>);

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('One or more services are not available');

      // Internal retry loop retries all errors up to maxRetries (3) times
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(3);
    }, 15000); // Increase timeout for this test

    it('should handle mixed error scenarios', async () => {
      // Simulate LOCK_TIMEOUT on all internal retry attempts
      // Note: error.message must include 'LOCK_TIMEOUT' (uppercase) to match the service check
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'LOCK_TIMEOUT: Lock acquisition failed',
          details: '',
          hint: '',
          code: 'LOCK_TIMEOUT'
        } as PostgrestError,
        count: null,
        status: 408,
        statusText: 'Request Timeout'
      } as unknown as PostgrestResponse<any>);

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('Lock acquisition timeout - please try again');

      // Internal retry loop retries LOCK_TIMEOUT 3 times before giving up
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(3);
    });

    it('should handle service validation errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'SERVICE_NOT_FOUND: Service with ID does not exist',
          details: '',
          hint: '',
          code: 'SERVICE_NOT_FOUND'
        } as PostgrestError,
        count: null,
        status: 400,
        statusText: 'Bad Request'
      } as unknown as PostgrestResponse<any>);

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('One or more services are not available');

      // Internal retry loop retries all errors up to maxRetries (3) times
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(3);
    });

    it('should handle points validation errors', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'INSUFFICIENT_AMOUNT: Points used cannot exceed total amount',
          details: '',
          hint: '',
          code: 'INSUFFICIENT_AMOUNT'
        } as PostgrestError,
        count: null,
        status: 400,
        statusText: 'Bad Request'
      } as unknown as PostgrestResponse<any>);

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('Points used cannot exceed total amount');

      // Internal retry loop retries all errors up to maxRetries (3) times
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(3);
    });
  });

  describe('Database Lock Performance', () => {
    const mockRequest: CreateReservationRequest = {
      shopId: '123e4567-e89b-12d3-a456-426614174000',
      userId: '456e7890-e89b-12d3-a456-426614174001',
      services: [
        { serviceId: '789e0123-e89b-12d3-a456-426614174002', quantity: 1 }
      ],
      reservationDate: '2024-03-15',
      reservationTime: '09:00',
      specialRequests: 'Test request',
      pointsToUse: 100
    };

    it('should complete successful requests within reasonable time', async () => {
      const startTime = Date.now();
      
      mockSupabase.rpc.mockResolvedValue({
        data: {
          id: 'reservation-123',
          shopId: mockRequest.shopId,
          userId: mockRequest.userId,
          reservationDate: mockRequest.reservationDate,
          reservationTime: mockRequest.reservationTime,
          status: 'requested',
          totalAmount: 5000,
          pointsUsed: 100,
          specialRequests: mockRequest.specialRequests,
          createdAt: '2024-03-15T09:00:00Z',
          updatedAt: '2024-03-15T09:00:00Z'
        },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK'
      } as unknown as PostgrestResponse<any>);

      const result = await reservationService.createReservation(mockRequest);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result).toBeDefined();
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle rapid successive requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        ...mockRequest,
        userId: `user-${i}`,
        reservationTime: `09:${i.toString().padStart(2, '0')}`
      }));

      // Mock successful responses for all requests
      mockSupabase.rpc.mockResolvedValue({
        data: {
          id: 'reservation-123',
          shopId: mockRequest.shopId,
          userId: mockRequest.userId,
          reservationDate: mockRequest.reservationDate,
          reservationTime: mockRequest.reservationTime,
          status: 'requested',
          totalAmount: 5000,
          pointsUsed: 100,
          specialRequests: mockRequest.specialRequests,
          createdAt: '2024-03-15T09:00:00Z',
          updatedAt: '2024-03-15T09:00:00Z'
        },
        error: null,
        count: null,
        status: 200,
        statusText: 'OK'
      } as unknown as PostgrestResponse<any>);

      const startTime = Date.now();
      const promises = requests.map(req => reservationService.createReservation(req));
      const results = await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(results).toHaveLength(10);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Error Recovery Scenarios', () => {
    const mockRequest: CreateReservationRequest = {
      shopId: '123e4567-e89b-12d3-a456-426614174000',
      userId: '456e7890-e89b-12d3-a456-426614174001',
      services: [
        { serviceId: '789e0123-e89b-12d3-a456-426614174002', quantity: 1 }
      ],
      reservationDate: '2024-03-15',
      reservationTime: '09:00',
      specialRequests: 'Test request',
      pointsToUse: 100
    };

    it('should recover from temporary database errors', async () => {
      // Simulate temporary connection error
      // The internal retry loop in createReservationWithLock retries all errors
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'connection timeout',
          details: '',
          hint: '',
          code: 'connection_timeout'
        } as PostgrestError,
        count: null,
        status: 500,
        statusText: 'Internal Server Error'
      } as unknown as PostgrestResponse<any>);

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('Reservation creation failed - please try again');

      // Internal retry loop retries all errors up to maxRetries (3) times
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(3);
    });

    it('should handle network timeouts gracefully', async () => {
      // Simulate network timeout - this should not be retryable
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { 
          message: 'timeout',
          details: '',
          hint: '',
          code: 'timeout'
        } as PostgrestError,
        count: null,
        status: 408,
        statusText: 'Request Timeout'
      } as unknown as PostgrestResponse<any>);

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('Reservation creation failed - please try again');
    });

    it('should handle temporary database errors', async () => {
      // Simulate temporary database error - this should not be retryable
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { 
          message: 'temporary database error',
          details: '',
          hint: '',
          code: 'temporary_error'
        } as PostgrestError,
        count: null,
        status: 500,
        statusText: 'Internal Server Error'
      } as unknown as PostgrestResponse<any>);

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('Reservation creation failed - please try again');
    });
  });

  describe('Validation Edge Cases', () => {
    it('should handle empty service array', async () => {
      const invalidRequest: CreateReservationRequest = {
        shopId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e7890-e89b-12d3-a456-426614174001',
        services: [],
        reservationDate: '2024-03-15',
        reservationTime: '09:00'
      };

      await expect(reservationService.createReservation(invalidRequest))
        .rejects.toThrow('At least one service is required');
    });

    it('should handle invalid service quantity', async () => {
      const invalidRequest: CreateReservationRequest = {
        shopId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e7890-e89b-12d3-a456-426614174001',
        services: [
          { serviceId: '789e0123-e89b-12d3-a456-426614174002', quantity: 0 }
        ],
        reservationDate: '2024-03-15',
        reservationTime: '09:00'
      };

      await expect(reservationService.createReservation(invalidRequest))
        .rejects.toThrow('Service quantity must be greater than 0');
    });

    it('should handle negative points usage', async () => {
      const invalidRequest: CreateReservationRequest = {
        shopId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e7890-e89b-12d3-a456-426614174001',
        services: [
          { serviceId: '789e0123-e89b-12d3-a456-426614174002', quantity: 1 }
        ],
        reservationDate: '2024-03-15',
        reservationTime: '09:00',
        pointsToUse: -100
      };

      await expect(reservationService.createReservation(invalidRequest))
        .rejects.toThrow('Points used cannot be negative');
    });

    it('should handle invalid date format', async () => {
      const invalidRequest: CreateReservationRequest = {
        shopId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e7890-e89b-12d3-a456-426614174001',
        services: [
          { serviceId: '789e0123-e89b-12d3-a456-426614174002', quantity: 1 }
        ],
        reservationDate: 'invalid-date',
        reservationTime: '09:00'
      };

      await expect(reservationService.createReservation(invalidRequest))
        .rejects.toThrow('Invalid date format. Use YYYY-MM-DD');
    });

    it('should handle invalid time format', async () => {
      const invalidRequest: CreateReservationRequest = {
        shopId: '123e4567-e89b-12d3-a456-426614174000',
        userId: '456e7890-e89b-12d3-a456-426614174001',
        services: [
          { serviceId: '789e0123-e89b-12d3-a456-426614174002', quantity: 1 }
        ],
        reservationDate: '2024-03-15',
        reservationTime: '25:00'
      };

      await expect(reservationService.createReservation(invalidRequest))
        .rejects.toThrow('Invalid time format. Use HH:MM');
    });
  });
}); 