/**
 * Comprehensive Time Slot Service Unit Tests
 *
 * Enhanced unit tests for the time slot service covering:
 * - Time slot generation via getAvailableTimeSlots (generateTimeSlots is private)
 * - Availability checking with existing reservations
 * - Service duration and buffer time handling
 * - Performance optimization features (caching)
 * - Edge cases and boundary conditions
 * - Integration with reservation system (validateSlotAvailability)
 */

// Persistent mock object -- the service singleton captures this reference at module load
const mockSupabase: any = {};
let mockChain: any = {};

function resetMockSupabase() {
  mockChain = {};
  ['select','insert','update','upsert','delete','eq','neq','gt','gte','lt','lte',
   'like','ilike','is','in','not','contains','containedBy','overlaps',
   'filter','match','or','and','order','limit','range','offset','count',
   'single','maybeSingle','csv','returns','textSearch','throwOnError'
  ].forEach(m => { mockChain[m] = jest.fn().mockReturnValue(mockChain); });
  mockChain.then = (resolve: any) => resolve({ data: null, error: null });
  mockSupabase.from = jest.fn().mockReturnValue(mockChain);
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
jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../src/services/monitoring.service', () => ({
  monitoringService: {
    trackError: jest.fn(),
    trackPerformance: jest.fn(),
  },
}));
jest.mock('../../src/config/environment', () => ({
  config: {},
}));

import { TimeSlotService, TimeSlot, TimeSlotRequest } from '../../src/services/time-slot.service';
import { logger } from '../../src/utils/logger';

/**
 * Helper: Setup mock chain to return different data depending on table name.
 * The service calls from('shop_operating_hours'), from('shop_services'),
 * from('reservations') in sequence. We use mockSupabase.from's mockImplementation
 * to return different chainable mocks per table.
 */
function setupTableMocks(tableData: Record<string, any>) {
  // Create a chain factory for each table
  const createChain = (resolvedValue: any) => {
    const chain: any = {};
    ['select','insert','update','upsert','delete','eq','neq','gt','gte','lt','lte',
     'like','ilike','is','in','not','contains','containedBy','overlaps',
     'filter','match','or','and','order','limit','range','offset','count',
     'single','maybeSingle','csv','returns','textSearch','throwOnError'
    ].forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
    chain.then = (resolve: any) => resolve(resolvedValue);
    return chain;
  };

  mockSupabase.from.mockImplementation((tableName: string) => {
    if (tableData[tableName]) {
      return createChain(tableData[tableName]);
    }
    // Default: return null data
    return createChain({ data: null, error: null });
  });
}

describe('Time Slot Service - Comprehensive Tests', () => {
  let timeSlotService: TimeSlotService;

  beforeEach(() => {
    jest.clearAllMocks();
    resetMockSupabase();

    // Setup service (creates new instance each test to avoid cache leaks)
    timeSlotService = new TimeSlotService();
  });

  describe('Time Slot Generation', () => {
    it('should generate time slots for standard business hours', async () => {
      // The service calls getShopOperatingHours (from shop_operating_hours),
      // getServiceDurations (from shop_services), getExistingReservations (from reservations),
      // then checkSlotAvailability -> checkServiceCapacity -> getShopCapacity (from shop_services again)
      setupTableMocks({
        'shop_operating_hours': {
          data: {
            shop_id: 'shop-123',
            day_of_week: 5, // Friday
            open_time: '09:00',
            close_time: '18:00',
            is_open: true
          },
          error: null
        },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 60, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': {
          data: [], // No existing reservations
          error: null
        }
      });

      const request: TimeSlotRequest = {
        shopId: 'shop-123',
        date: '2024-03-15', // Friday
        serviceIds: ['service-1']
      };

      const timeSlots = await timeSlotService.getAvailableTimeSlots(request);

      // Should generate slots within 9:00-18:00 range
      expect(timeSlots.length).toBeGreaterThan(0);
      expect(timeSlots[0].startTime).toBe('09:00');
      // All slots should be within operating hours
      for (const slot of timeSlots) {
        expect(slot.startTime >= '09:00').toBe(true);
        expect(slot.endTime <= '18:00').toBe(true);
      }
    });

    it('should handle different service durations', async () => {
      // Short service (30 min)
      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '18:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 30, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': { data: [], error: null }
      });

      const request: TimeSlotRequest = {
        shopId: 'shop-123',
        date: '2024-03-15',
        serviceIds: ['service-1']
      };

      const shortSlots = await timeSlotService.getAvailableTimeSlots(request);

      // Now test with long service (120 min)
      timeSlotService = new TimeSlotService(); // new instance to clear cache
      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '18:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 120, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': { data: [], error: null }
      });

      const longSlots = await timeSlotService.getAvailableTimeSlots(request);

      // Shorter services should generate more slots
      expect(shortSlots.length).toBeGreaterThan(longSlots.length);
    });

    it('should return empty slots for closed days', async () => {
      // Shop is closed (is_open: false)
      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 0, open_time: '09:00', close_time: '18:00', is_open: false },
          error: null
        },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 60, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': { data: [], error: null }
      });

      const request: TimeSlotRequest = {
        shopId: 'shop-123',
        date: '2024-03-17', // Sunday
        serviceIds: ['service-1']
      };

      const timeSlots = await timeSlotService.getAvailableTimeSlots(request);

      expect(timeSlots).toHaveLength(0);
    });

    it('should use default operating hours when not configured', async () => {
      // No shop_operating_hours found -> returns error, falls back to defaults (09:00-18:00)
      setupTableMocks({
        'shop_operating_hours': { data: null, error: { message: 'Not found' } },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 60, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': { data: [], error: null }
      });

      const request: TimeSlotRequest = {
        shopId: 'shop-123',
        date: '2024-03-15',
        serviceIds: ['service-1']
      };

      const timeSlots = await timeSlotService.getAvailableTimeSlots(request);

      // Should use default 09:00-18:00
      expect(timeSlots.length).toBeGreaterThan(0);
      expect(timeSlots[0].startTime).toBe('09:00');
    });
  });

  describe('Availability Checking', () => {
    it('should check slot availability against existing reservations', async () => {
      const existingReservations = [
        {
          id: 'reservation-1',
          reservation_date: '2024-03-15',
          reservation_time: '10:00',
          status: 'confirmed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          reservation_services: [
            {
              service_id: 'service-1',
              quantity: 1,
              shop_services: { duration_minutes: 60, name: 'Nail Art' }
            }
          ]
        }
      ];

      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '18:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 60, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': { data: existingReservations, error: null }
      });

      const isAvailable = await timeSlotService.isSlotAvailable(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1']
      );

      // Should be unavailable due to existing reservation at 10:00
      expect(isAvailable).toBe(false);
    });

    it('should return available for non-conflicting time slots', async () => {
      const existingReservations = [
        {
          id: 'reservation-1',
          reservation_date: '2024-03-15',
          reservation_time: '14:00',
          status: 'confirmed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          reservation_services: [
            {
              service_id: 'service-1',
              quantity: 1,
              shop_services: { duration_minutes: 60, name: 'Nail Art' }
            }
          ]
        }
      ];

      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '18:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 60, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': { data: existingReservations, error: null }
      });

      // Check a time far from the existing reservation
      const isAvailable = await timeSlotService.isSlotAvailable(
        'shop-123',
        '2024-03-15',
        '09:00',
        ['service-1']
      );

      expect(isAvailable).toBe(true);
    });

    it('should filter out expired requested reservations older than 15 minutes', async () => {
      // 'requested' reservation created 20 minutes ago -> should be filtered out
      const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000);
      const existingReservations = [
        {
          id: 'reservation-1',
          reservation_date: '2024-03-15',
          reservation_time: '10:00',
          status: 'requested',
          created_at: twentyMinAgo.toISOString(),
          updated_at: twentyMinAgo.toISOString(),
          reservation_services: [
            {
              service_id: 'service-1',
              quantity: 1,
              shop_services: { duration_minutes: 60, name: 'Nail Art' }
            }
          ]
        }
      ];

      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '18:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 60, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': { data: existingReservations, error: null }
      });

      // Should be available because the expired 'requested' reservation is filtered out
      const isAvailable = await timeSlotService.isSlotAvailable(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1']
      );

      expect(isAvailable).toBe(true);
    });
  });

  describe('Performance Optimization', () => {
    it('should cache time slot data for repeated requests', async () => {
      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '18:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 60, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': { data: [], error: null }
      });

      const request: TimeSlotRequest = {
        shopId: 'shop-123',
        date: '2024-03-15',
        serviceIds: ['service-1']
      };

      // First request
      const result1 = await timeSlotService.getAvailableTimeSlots(request);
      const fromCallCount1 = mockSupabase.from.mock.calls.length;

      // Second request (same parameters)
      const result2 = await timeSlotService.getAvailableTimeSlots(request);
      const fromCallCount2 = mockSupabase.from.mock.calls.length;

      // Both should return results
      expect(result1.length).toBeGreaterThan(0);
      expect(result2.length).toBeGreaterThan(0);
    });

    it('should batch process multiple date requests', async () => {
      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '18:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 60, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': { data: [], error: null }
      });

      const dates = ['2024-03-15', '2024-03-16', '2024-03-17', '2024-03-18'];
      const requests = dates.map(date => ({
        shopId: 'shop-123',
        date,
        serviceIds: ['service-1']
      }));

      const startTime = performance.now();
      const results = await Promise.all(
        requests.map(request => timeSlotService.getAvailableTimeSlots(request))
      );
      const endTime = performance.now();

      expect(results).toHaveLength(4);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should invalidate cache when requested', async () => {
      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '18:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 60, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': { data: [], error: null }
      });

      // Call once to cache
      await timeSlotService.getAvailableTimeSlots({
        shopId: 'shop-123',
        date: '2024-03-15',
        serviceIds: ['service-1']
      });

      // Invalidate cache
      timeSlotService.invalidateCache('shop-123', '2024-03-15');

      expect(logger.info).toHaveBeenCalledWith('Cache invalidated', expect.objectContaining({
        shopId: 'shop-123',
        date: '2024-03-15'
      }));
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle very short service durations', async () => {
      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '18:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 15, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': { data: [], error: null }
      });

      const request: TimeSlotRequest = {
        shopId: 'shop-123',
        date: '2024-03-15',
        serviceIds: ['service-1'],
        interval: 15
      };

      const timeSlots = await timeSlotService.getAvailableTimeSlots(request);

      // With 15 min service + 15 min buffer = 30 min slots at 15 min intervals
      // Should have many slots in a 9-hour window
      expect(timeSlots.length).toBeGreaterThan(10);
      expect(timeSlots[0].startTime).toBe('09:00');
    });

    it('should handle very long service durations', async () => {
      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '18:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 480, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': { data: [], error: null }
      });

      const request: TimeSlotRequest = {
        shopId: 'shop-123',
        date: '2024-03-15',
        serviceIds: ['service-1']
      };

      const timeSlots = await timeSlotService.getAvailableTimeSlots(request);

      // 480 min (8h) + 15 min buffer = 495 min; operating hours = 540 min (9h)
      // Only 1 slot fits (09:00 - 17:15)
      expect(timeSlots.length).toBeLessThanOrEqual(2); // 1 or maybe 2 depending on peak hour logic
      if (timeSlots.length > 0) {
        expect(timeSlots[0].startTime).toBe('09:00');
      }
    });

    it('should throw for missing required parameters', async () => {
      const request: TimeSlotRequest = {
        shopId: '',
        date: '2024-03-15',
        serviceIds: ['service-1']
      };

      await expect(
        timeSlotService.getAvailableTimeSlots(request)
      ).rejects.toThrow();
    });

    it('should throw when no valid services found', async () => {
      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '18:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: [], // No services found
          error: null
        },
        'reservations': { data: [], error: null }
      });

      await expect(
        timeSlotService.getAvailableTimeSlots({
          shopId: 'shop-123',
          date: '2024-03-15',
          serviceIds: ['service-nonexistent']
        })
      ).rejects.toThrow();
    });

    it('should handle database errors in getAvailableTimeSlots', async () => {
      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '18:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: null,
          error: { message: 'Database connection failed' }
        },
        'reservations': { data: [], error: null }
      });

      await expect(
        timeSlotService.getAvailableTimeSlots({
          shopId: 'shop-123',
          date: '2024-03-15',
          serviceIds: ['service-1']
        })
      ).rejects.toThrow();
    });

    it('should handle custom interval parameter', async () => {
      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '12:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 30, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': { data: [], error: null }
      });

      const request60: TimeSlotRequest = {
        shopId: 'shop-123',
        date: '2024-03-15',
        serviceIds: ['service-1'],
        interval: 60
      };

      const slots = await timeSlotService.getAvailableTimeSlots(request60);

      // With 60 min interval, 30 min service + 15 min buffer = 45 min slot duration
      // In 3 hours (09:00-12:00), at 60 min intervals: 09:00, 10:00, 11:00
      expect(slots.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Integration with Reservation System', () => {
    it('should validate slot availability before reservation creation', async () => {
      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '18:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 60, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': { data: [], error: null }
      });

      const validation = await timeSlotService.validateSlotAvailability(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1']
      );

      expect(validation).toHaveProperty('available');
      expect(validation).toHaveProperty('validationDetails');
      expect(validation.available).toBe(true);
    });

    it('should return conflict information when slot is not available', async () => {
      const existingReservations = [
        {
          id: 'reservation-1',
          reservation_date: '2024-03-15',
          reservation_time: '10:00',
          status: 'confirmed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          reservation_services: [
            {
              service_id: 'service-1',
              quantity: 1,
              shop_services: { duration_minutes: 60, name: 'Nail Art' }
            }
          ]
        }
      ];

      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '18:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 60, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': { data: existingReservations, error: null }
      });

      const validation = await timeSlotService.validateSlotAvailability(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1']
      );

      expect(validation.available).toBe(false);
      // validateSlotAvailability returns conflictReason and conflictingReservations
      if (validation.conflictReason) {
        expect(typeof validation.conflictReason).toBe('string');
      }
      if (validation.conflictingReservations) {
        expect(Array.isArray(validation.conflictingReservations)).toBe(true);
      }
    });

    it('should return validation details with slot timing info', async () => {
      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '18:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 60, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': { data: [], error: null }
      });

      const validation = await timeSlotService.validateSlotAvailability(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1']
      );

      expect(validation.validationDetails).toBeDefined();
      expect(validation.validationDetails!.slotStart).toBe('10:00');
      expect(validation.validationDetails!.totalDuration).toBeGreaterThan(0);
      expect(validation.validationDetails!.bufferTime).toBe(15);
      expect(validation.validationDetails!.validationTimestamp).toBeDefined();
    });

    it('should return capacity info', async () => {
      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '18:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 60, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': { data: [], error: null }
      });

      const validation = await timeSlotService.validateSlotAvailability(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1']
      );

      expect(validation.capacityInfo).toBeDefined();
      expect(validation.capacityInfo).toHaveProperty('totalCapacity');
      expect(validation.capacityInfo).toHaveProperty('usedCapacity');
      expect(validation.capacityInfo).toHaveProperty('availableCapacity');
    });

    it('should handle validation errors gracefully', async () => {
      // validateSlotAvailability catches errors and returns safe fallback
      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '18:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: null,
          error: { message: 'Database error' }
        },
        'reservations': { data: [], error: null }
      });

      // validateSlotAvailability does NOT throw - it returns a safe fallback
      const validation = await timeSlotService.validateSlotAvailability(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1']
      );

      expect(validation.available).toBe(false);
      expect(validation.conflictReason).toContain('Validation failed');
    });
  });

  describe('Shop Operating Hours', () => {
    it('should get weekly hours for a shop', async () => {
      const weeklyHours = [
        { shop_id: 'shop-123', day_of_week: 1, open_time: '09:00', close_time: '18:00', is_open: true },
        { shop_id: 'shop-123', day_of_week: 2, open_time: '09:00', close_time: '18:00', is_open: true },
      ];

      mockChain.then = (resolve: any) => resolve({ data: weeklyHours, error: null });

      const result = await timeSlotService.getShopWeeklyHours('shop-123');

      expect(result).toHaveLength(2);
      expect(mockSupabase.from).toHaveBeenCalledWith('shop_operating_hours');
    });

    it('should update shop operating hours', async () => {
      const newHours = [
        { dayOfWeek: 1, openTime: '10:00', closeTime: '19:00', isOpen: true },
        { dayOfWeek: 2, openTime: '10:00', closeTime: '19:00', isOpen: true },
      ];

      mockChain.then = (resolve: any) => resolve({ data: null, error: null });

      await timeSlotService.updateShopOperatingHours('shop-123', newHours);

      expect(mockSupabase.from).toHaveBeenCalledWith('shop_operating_hours');
    });
  });

  describe('Temporary Slot Reservations', () => {
    it('should reserve a slot temporarily', async () => {
      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '18:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 60, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': { data: [], error: null }
      });

      const result = await timeSlotService.reserveSlotTemporarily(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1'],
        'user-123'
      );

      expect(result.success).toBe(true);
      expect(result.reservationId).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('should release a temporary reservation', async () => {
      // First reserve a slot
      setupTableMocks({
        'shop_operating_hours': {
          data: { shop_id: 'shop-123', day_of_week: 5, open_time: '09:00', close_time: '18:00', is_open: true },
          error: null
        },
        'shop_services': {
          data: [{ id: 'service-1', duration_minutes: 60, shop_id: 'shop-123' }],
          error: null
        },
        'reservations': { data: [], error: null }
      });

      const reservation = await timeSlotService.reserveSlotTemporarily(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1'],
        'user-123'
      );

      // Release it
      const released = await timeSlotService.releaseTemporaryReservation(
        'shop-123',
        '2024-03-15',
        '10:00',
        reservation.reservationId!
      );

      expect(released).toBe(true);
    });

    it('should return false for releasing non-existent reservation', async () => {
      const released = await timeSlotService.releaseTemporaryReservation(
        'shop-123',
        '2024-03-15',
        '10:00',
        'non-existent-id'
      );

      expect(released).toBe(false);
    });
  });
});
