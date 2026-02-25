/**
 * Reservation Service Tests
 *
 * Tests for reservation service with concurrent booking prevention
 * Focuses on business logic and error handling without complex database mocking
 */

// Persistent mock object -- the service singleton captures this reference at module load
const mockSupabase: any = {};

/**
 * Create a table-aware from() mock.
 * Returns different chain mocks based on table name, each resolving to the configured result.
 */
function createTableAwareFromMock(tableOverrides: Record<string, any> = {}) {
  const defaultResult = { data: null, error: null };

  return jest.fn((tableName: string) => {
    const result = tableOverrides[tableName] || defaultResult;
    const chain: any = {};
    ['select','insert','update','upsert','delete','eq','neq','gt','gte','lt','lte',
     'like','ilike','is','in','not','contains','containedBy','overlaps',
     'filter','match','or','and','order','limit','range','offset','count',
     'single','maybeSingle','csv','returns','textSearch','throwOnError'
    ].forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
    chain.then = (resolve: any) => resolve(result);
    return chain;
  });
}

function resetMockSupabase() {
  mockSupabase.from = createTableAwareFromMock();
  mockSupabase.rpc = jest.fn().mockResolvedValue({ data: null, error: null });
  mockSupabase.auth = {
    getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    admin: { getUserById: jest.fn(), listUsers: jest.fn(), deleteUser: jest.fn() },
  };
  mockSupabase.storage = { from: jest.fn(() => ({ upload: jest.fn(), getPublicUrl: jest.fn() })) };
}
resetMockSupabase();

jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn(() => mockSupabase),
  initializeDatabase: jest.fn(() => ({ client: mockSupabase })),
  getDatabase: jest.fn(() => ({ client: mockSupabase })),
  database: { getClient: jest.fn(() => mockSupabase) },
}));

// Mock query-cache.service to bypass caching and directly call queryFn
jest.mock('../../src/services/query-cache.service', () => ({
  queryCacheService: {
    getCachedQuery: jest.fn(async (_key: string, queryFn: () => Promise<any>) => queryFn()),
  }
}));

// Mock the time slot service
jest.mock('../../src/services/time-slot.service', () => ({
  timeSlotService: {
    isSlotAvailable: jest.fn(),
    getAvailableTimeSlots: jest.fn(),
    getNextAvailableSlot: jest.fn(),
    validateSlotAvailability: jest.fn()
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

import { ReservationService, CreateReservationRequest } from '../../src/services/reservation.service';
import { getSupabaseClient } from '../../src/config/database';
import { timeSlotService } from '../../src/services/time-slot.service';
import { logger } from '../../src/utils/logger';

// Mock service data returned by shop_services query
const mockServiceData = [
  { id: 'service-1', price_min: 50000, name: 'Test Service', deposit_amount: null, deposit_percentage: null }
];

describe('Reservation Service Tests', () => {
  let reservationService: ReservationService;
  let mockTimeSlotService: jest.Mocked<typeof timeSlotService>;
  let mockLogger: jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetMockSupabase();
    reservationService = new ReservationService();
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
      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: false,
        conflictReason: 'Time slot is no longer available',
        conflictingReservations: []
      });

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('Selected time slot is no longer available');

      expect(mockTimeSlotService.validateSlotAvailability).toHaveBeenCalledWith(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1']
      );
    });

    it('should proceed when time slot is available', async () => {
      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      // Set up from() to return proper service data for shop_services query
      mockSupabase.from = createTableAwareFromMock({
        'shop_services': { data: mockServiceData, error: null },
        'users': { data: { booking_preferences: {} }, error: null },
      });

      // Mock RPC to return reservation data
      mockSupabase.rpc.mockResolvedValue({
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
      // Mock slot validation to pass
      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      // Set up from() to return proper service data
      mockSupabase.from = createTableAwareFromMock({
        'shop_services': { data: mockServiceData, error: null },
        'users': { data: { booking_preferences: {} }, error: null },
      });
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
      // Use uppercase LOCK_TIMEOUT to match the code's includes check
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'LOCK_TIMEOUT: Lock acquisition failed',
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
      // Mock slot validation to pass
      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      // Set up from() to return proper service data
      mockSupabase.from = createTableAwareFromMock({
        'shop_services': { data: mockServiceData, error: null },
        'users': { data: { booking_preferences: {} }, error: null },
      });
    });

    it('should retry on lock acquisition failures', async () => {
      // Use 'lock_timeout' in error message to match shouldRetry() check
      // First call: rpc throws (rejected) → withEnhancedRetry catches → shouldRetry → retry
      // Second call: rpc succeeds
      mockSupabase.rpc
        .mockRejectedValueOnce(new Error('lock_timeout: Lock acquisition failed'))
        .mockResolvedValueOnce({
          data: {
            id: 'reservation-123',
            shopId: 'shop-123',
            userId: 'user-123',
            reservationDate: '2024-03-15',
            reservationTime: '10:00',
            status: 'confirmed',
            totalAmount: 50000,
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
    });

    it('should fail after maximum retries', async () => {
      // Mock delay/sleep to speed up the test
      const service = reservationService as any;
      service.delay = jest.fn().mockResolvedValue(undefined);
      service.sleep = jest.fn().mockResolvedValue(undefined);

      // All rpc calls throw with retryable error
      mockSupabase.rpc.mockRejectedValue(new Error('lock_timeout: Lock acquisition failed'));

      await expect(reservationService.createReservation(mockRequest))
        .rejects.toThrow('lock_timeout: Lock acquisition failed');

      // Inner loop retries 3 times per attempt, outer withEnhancedRetry does 4 attempts total
      // 4 outer × 3 inner = 12 rpc calls
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(12);
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
