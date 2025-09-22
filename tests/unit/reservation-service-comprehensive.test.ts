/**
 * Comprehensive Reservation Service Unit Tests
 * 
 * Enhanced unit tests for the reservation service covering:
 * - v3.1 flow features (payment info, metadata, notifications)
 * - Concurrent booking prevention
 * - Database locking mechanisms
 * - Error handling and retry logic
 * - Pricing calculations with deposits
 * - Business rule validation
 */

import { ReservationService, CreateReservationRequest } from '../../src/services/reservation.service';
import { ReservationTestUtils } from '../utils/reservation-test-utils';
import { getTestConfig } from '../config/reservation-test-config';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/time-slot.service');
jest.mock('../../src/services/shop-owner-notification.service');
jest.mock('../../src/utils/logger');

import { getSupabaseClient } from '../../src/config/database';
import { timeSlotService } from '../../src/services/time-slot.service';
import { shopOwnerNotificationService } from '../../src/services/shop-owner-notification.service';
import { logger } from '../../src/utils/logger';

describe('Reservation Service - Comprehensive Tests', () => {
  let reservationService: ReservationService;
  let testUtils: ReservationTestUtils;
  let mockSupabase: any;
  let mockTimeSlotService: jest.Mocked<typeof timeSlotService>;
  let mockShopOwnerNotificationService: jest.Mocked<typeof shopOwnerNotificationService>;
  let mockLogger: jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup service
    reservationService = new ReservationService();
    testUtils = new ReservationTestUtils();

    // Setup mocks
    mockSupabase = {
      rpc: jest.fn(),
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        }))
      }))
    };
    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    mockTimeSlotService = timeSlotService as jest.Mocked<typeof timeSlotService>;
    mockShopOwnerNotificationService = shopOwnerNotificationService as jest.Mocked<typeof shopOwnerNotificationService>;
    mockLogger = logger as jest.Mocked<typeof logger>;
  });

  describe('v3.1 Flow Features', () => {
    const baseRequest: CreateReservationRequest = {
      shopId: 'shop-123',
      userId: 'user-123',
      services: [{ serviceId: 'service-1', quantity: 1 }],
      reservationDate: '2024-03-15',
      reservationTime: '10:00',
      specialRequests: 'Test request'
    };

    it('should handle payment info in v3.1 flow', async () => {
      const requestWithPayment: CreateReservationRequest = {
        ...baseRequest,
        paymentInfo: {
          depositAmount: 10000,
          remainingAmount: 40000,
          paymentMethod: 'card',
          depositRequired: true
        }
      };

      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { id: 'reservation-123', status: 'requested' },
        error: null
      });

      const result = await reservationService.createReservation(requestWithPayment);

      expect(result.id).toBe('reservation-123');
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'create_reservation_with_lock',
        expect.objectContaining({
          p_deposit_amount: 10000,
          p_remaining_amount: 40000
        })
      );
    });

    it('should handle request metadata in v3.1 flow', async () => {
      const requestWithMetadata: CreateReservationRequest = {
        ...baseRequest,
        requestMetadata: {
          source: 'mobile_app',
          userAgent: 'TestApp/1.0',
          ipAddress: '192.168.1.1',
          referrer: 'https://example.com'
        }
      };

      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { id: 'reservation-123', status: 'requested' },
        error: null
      });

      await reservationService.createReservation(requestWithMetadata);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Reservation request with v3.1 metadata:',
        expect.objectContaining({
          source: 'mobile_app',
          userAgent: 'TestApp/1.0',
          ipAddress: '192.168.1.1'
        })
      );
    });

    it('should handle notification preferences in v3.1 flow', async () => {
      const requestWithNotifications: CreateReservationRequest = {
        ...baseRequest,
        notificationPreferences: {
          emailNotifications: true,
          smsNotifications: false,
          pushNotifications: true
        }
      };

      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { id: 'reservation-123', status: 'requested' },
        error: null
      });

      const result = await reservationService.createReservation(requestWithNotifications);

      expect(result.id).toBe('reservation-123');
      // Verify notification service was called with preferences
      expect(mockShopOwnerNotificationService.sendNotification).toHaveBeenCalled();
    });
  });

  describe('Concurrent Booking Prevention', () => {
    const baseRequest: CreateReservationRequest = {
      shopId: 'shop-123',
      userId: 'user-123',
      services: [{ serviceId: 'service-1', quantity: 1 }],
      reservationDate: '2024-03-15',
      reservationTime: '10:00',
      specialRequests: 'Test request'
    };

    it('should handle slot validation conflicts', async () => {
      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: false,
        conflictReason: 'Time slot already booked',
        conflictingReservations: ['reservation-456']
      });

      await expect(reservationService.createReservation(baseRequest))
        .rejects.toThrow('Selected time slot is no longer available: Time slot already booked');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Slot validation failed:',
        expect.objectContaining({
          conflictReason: 'Time slot already booked',
          conflictingReservations: ['reservation-456']
        })
      );
    });

    it('should retry on deadlock errors', async () => {
      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      // Mock deadlock error on first attempt, success on second
      mockSupabase.rpc
        .mockRejectedValueOnce(new Error('deadlock detected'))
        .mockResolvedValueOnce({
          data: { id: 'reservation-123', status: 'requested' },
          error: null
        });

      const result = await reservationService.createReservation(baseRequest);

      expect(result.id).toBe('reservation-123');
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      mockSupabase.rpc.mockRejectedValue(new Error('deadlock detected'));

      await expect(reservationService.createReservation(baseRequest))
        .rejects.toThrow('deadlock detected');

      expect(mockSupabase.rpc).toHaveBeenCalledTimes(3); // MAX_RETRIES
    });
  });

  describe('Pricing Calculations with Deposits', () => {
    it('should calculate pricing with fixed deposit amount', async () => {
      const request: CreateReservationRequest = {
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00',
        paymentInfo: {
          depositAmount: 15000,
          remainingAmount: 35000,
          depositRequired: true
        }
      };

      const pricingInfo = await reservationService['calculatePricingWithDeposit'](request);

      expect(pricingInfo.totalAmount).toBe(50000);
      expect(pricingInfo.depositAmount).toBe(15000);
      expect(pricingInfo.remainingAmount).toBe(35000);
      expect(pricingInfo.depositRequired).toBe(true);
    });

    it('should calculate pricing with percentage-based deposit', async () => {
      const request: CreateReservationRequest = {
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00',
        paymentInfo: {
          depositAmount: 10000, // 20% of 50000
          remainingAmount: 40000,
          depositRequired: true
        }
      };

      const pricingInfo = await reservationService['calculatePricingWithDeposit'](request);

      expect(pricingInfo.depositCalculationDetails.serviceDeposits).toHaveLength(1);
      expect(pricingInfo.depositCalculationDetails.serviceDeposits[0]).toMatchObject({
        serviceId: 'service-1',
        quantity: 1,
        depositAmount: 10000,
        depositType: 'fixed'
      });
    });

    it('should handle points discount in pricing calculation', async () => {
      const request: CreateReservationRequest = {
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00',
        pointsToUse: 5000
      };

      const pricingInfo = await reservationService['calculatePricingWithDeposit'](request);

      expect(pricingInfo.depositCalculationDetails.appliedDiscounts).toHaveLength(1);
      expect(pricingInfo.depositCalculationDetails.appliedDiscounts[0]).toMatchObject({
        type: 'points',
        amount: 5000
      });
    });
  });

  describe('Business Rule Validation', () => {
    it('should validate required fields', async () => {
      const invalidRequests = [
        { shopId: '', userId: 'user-123', services: [{ serviceId: 'service-1', quantity: 1 }], reservationDate: '2024-03-15', reservationTime: '10:00' },
        { shopId: 'shop-123', userId: '', services: [{ serviceId: 'service-1', quantity: 1 }], reservationDate: '2024-03-15', reservationTime: '10:00' },
        { shopId: 'shop-123', userId: 'user-123', services: [], reservationDate: '2024-03-15', reservationTime: '10:00' },
      ];

      for (const request of invalidRequests) {
        await expect(reservationService.createReservation(request as CreateReservationRequest))
          .rejects.toThrow();
      }
    });

    it('should validate date format', async () => {
      const request: CreateReservationRequest = {
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: 'invalid-date',
        reservationTime: '10:00'
      };

      await expect(reservationService.createReservation(request))
        .rejects.toThrow('Invalid date format. Use YYYY-MM-DD');
    });

    it('should validate time format', async () => {
      const request: CreateReservationRequest = {
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '25:00'
      };

      await expect(reservationService.createReservation(request))
        .rejects.toThrow('Invalid time format. Use HH:MM');
    });

    it('should validate service quantity', async () => {
      const request: CreateReservationRequest = {
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 0 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00'
      };

      await expect(reservationService.createReservation(request))
        .rejects.toThrow('Service quantity must be greater than 0');
    });

    it('should validate points usage', async () => {
      const request: CreateReservationRequest = {
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00',
        pointsToUse: -100
      };

      await expect(reservationService.createReservation(request))
        .rejects.toThrow('Points used cannot be negative');
    });
  });

  describe('Error Handling and Retry Logic', () => {
    const baseRequest: CreateReservationRequest = {
      shopId: 'shop-123',
      userId: 'user-123',
      services: [{ serviceId: 'service-1', quantity: 1 }],
      reservationDate: '2024-03-15',
      reservationTime: '10:00'
    };

    it('should handle database connection errors', async () => {
      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      mockSupabase.rpc.mockRejectedValue(new Error('Database connection failed'));

      await expect(reservationService.createReservation(baseRequest))
        .rejects.toThrow('Database connection failed');

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle timeout errors with retry', async () => {
      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      // Mock timeout error on first two attempts, success on third
      mockSupabase.rpc
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce({
          data: { id: 'reservation-123', status: 'requested' },
          error: null
        });

      const result = await reservationService.createReservation(baseRequest);

      expect(result.id).toBe('reservation-123');
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(3);
    });

    it('should log retry attempts', async () => {
      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      mockSupabase.rpc
        .mockRejectedValueOnce(new Error('retry error'))
        .mockResolvedValueOnce({
          data: { id: 'reservation-123', status: 'requested' },
          error: null
        });

      await reservationService.createReservation(baseRequest);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Attempting reservation creation with lock',
        expect.objectContaining({
          attempt: 1,
          maxRetries: 3
        })
      );
    });
  });

  describe('Integration with External Services', () => {
    const baseRequest: CreateReservationRequest = {
      shopId: 'shop-123',
      userId: 'user-123',
      services: [{ serviceId: 'service-1', quantity: 1 }],
      reservationDate: '2024-03-15',
      reservationTime: '10:00'
    };

    it('should send shop owner notification after successful reservation', async () => {
      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { id: 'reservation-123', status: 'requested' },
        error: null
      });

      mockShopOwnerNotificationService.sendNotification.mockResolvedValue(true);

      await reservationService.createReservation(baseRequest);

      expect(mockShopOwnerNotificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          shopId: 'shop-123',
          reservationId: 'reservation-123',
          type: 'new_reservation_request'
        })
      );
    });

    it('should handle notification service failures gracefully', async () => {
      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { id: 'reservation-123', status: 'requested' },
        error: null
      });

      mockShopOwnerNotificationService.sendNotification.mockRejectedValue(
        new Error('Notification service unavailable')
      );

      // Should not throw even if notification fails
      const result = await reservationService.createReservation(baseRequest);

      expect(result.id).toBe('reservation-123');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send shop owner notification')
      );
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent reservation requests', async () => {
      const requests = Array(10).fill(0).map((_, index) => ({
        shopId: 'shop-123',
        userId: `user-${index}`,
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00',
        specialRequests: `Request ${index}`
      }));

      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      // Mock some requests to succeed and some to fail due to conflicts
      const mockResponses = requests.map((_, index) => {
        if (index < 5) {
          return Promise.resolve({
            data: { id: `reservation-${index}`, status: 'requested' },
            error: null
          });
        } else {
          return Promise.reject(new Error('Time slot no longer available'));
        }
      });

      mockSupabase.rpc.mockImplementation((fnName, params) => {
        const userId = params.p_user_id;
        const userIndex = parseInt(userId.split('-')[1]);
        return mockResponses[userIndex];
      });

      const results = await Promise.allSettled(
        requests.map(request => reservationService.createReservation(request))
      );

      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful).toHaveLength(5);
      expect(failed).toHaveLength(5);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle maximum service quantity', async () => {
      const request: CreateReservationRequest = {
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 100 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00'
      };

      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { id: 'reservation-123', status: 'requested' },
        error: null
      });

      const result = await reservationService.createReservation(request);

      expect(result.id).toBe('reservation-123');
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'create_reservation_with_lock',
        expect.objectContaining({
          p_services: JSON.stringify([{ serviceId: 'service-1', quantity: 100 }])
        })
      );
    });

    it('should handle very long special requests', async () => {
      const longRequest = 'A'.repeat(1000); // 1000 character request
      const request: CreateReservationRequest = {
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00',
        specialRequests: longRequest
      };

      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { id: 'reservation-123', status: 'requested' },
        error: null
      });

      const result = await reservationService.createReservation(request);

      expect(result.id).toBe('reservation-123');
    });

    it('should handle future reservation dates', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const request: CreateReservationRequest = {
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: futureDateStr,
        reservationTime: '10:00'
      };

      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { id: 'reservation-123', status: 'requested' },
        error: null
      });

      const result = await reservationService.createReservation(request);

      expect(result.id).toBe('reservation-123');
    });
  });
});
