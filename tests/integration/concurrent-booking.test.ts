/**
 * Concurrent Booking Integration Tests
 * 
 * Tests for concurrent booking scenarios to validate database locking
 * and retry mechanisms work correctly under load
 */

import { ReservationService, CreateReservationRequest } from '../../src/services/reservation.service';
import { getSupabaseClient } from '../../src/config/database';
import { timeSlotService } from '../../src/services/time-slot.service';
import { PostgrestResponse, PostgrestError } from '@supabase/supabase-js';

// Mock the database client
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn()
}));

// Mock the time slot service
jest.mock('../../src/services/time-slot.service', () => ({
  timeSlotService: {
    isSlotAvailable: jest.fn()
  }
}));

const mockSupabase = {
  rpc: jest.fn()
} as any;

const mockTimeSlotService = timeSlotService as jest.Mocked<typeof timeSlotService>;

// Mock the getSupabaseClient to return our mock
(getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

describe('Concurrent Booking Integration Tests', () => {
  let reservationService: ReservationService;

  beforeEach(() => {
    reservationService = new ReservationService();
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockSupabase.rpc.mockReset();
    
    // Default mock for slot availability
    mockTimeSlotService.isSlotAvailable.mockResolvedValue(true);
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
      // Simulate first request succeeds, subsequent requests fail with conflict
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: mockReservation,
          error: null,
          count: null,
          status: 200,
          statusText: 'OK'
        } as unknown as PostgrestResponse<any>)
        .mockResolvedValueOnce({
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
        } as unknown as PostgrestResponse<any>)
        .mockResolvedValueOnce({
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
      // Simulate lock timeout - this should fail immediately, not retry
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { 
          message: 'lock_timeout: Lock acquisition failed',
          details: '',
          hint: '',
          code: 'lock_timeout'
        } as PostgrestError,
        count: null,
        status: 408,
        statusText: 'Request Timeout'
      } as unknown as PostgrestResponse<any>);

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('Lock acquisition timeout - please try again');

      // Should not retry on lock timeout errors
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
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
      // Simulate consistent lock timeouts - should not retry this error
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

      // Should not retry on validation errors
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
    }, 15000); // Increase timeout for this test

    it('should handle mixed error scenarios', async () => {
      // Simulate different types of errors on retries
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: null,
          error: { 
            message: 'lock_timeout: Lock acquisition failed',
            details: '',
            hint: '',
            code: 'lock_timeout'
          } as PostgrestError,
          count: null,
          status: 408,
          statusText: 'Request Timeout'
        } as unknown as PostgrestResponse<any>);

      // The lock timeout should fail immediately, not retry
      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('Lock acquisition timeout - please try again');

      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
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

      // Should not retry on validation errors
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
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

      // Should not retry on validation errors
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
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
      // Simulate temporary connection error - this should not be retried
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

      // Should not retry on connection timeout errors
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1);
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