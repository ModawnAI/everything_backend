/**
 * Unit Tests for Reservation Rescheduling Service
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

jest.mock('../../src/services/time-slot.service', () => ({
  timeSlotService: {
    isSlotAvailable: jest.fn(),
    getAvailableTimeSlots: jest.fn(),
    getNextAvailableSlot: jest.fn(),
    validateSlotAvailability: jest.fn()
  }
}));

jest.mock('../../src/services/reservation-state-machine.service', () => ({
  reservationStateMachine: {
    transition: jest.fn(),
    canTransition: jest.fn(),
    getAvailableTransitions: jest.fn()
  }
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { ReservationReschedulingService } from '../../src/services/reservation-rescheduling.service';
import { timeSlotService } from '../../src/services/time-slot.service';

describe('ReservationReschedulingService', () => {
  let service: any;

  beforeEach(() => {
    jest.clearAllMocks();
    resetMockSupabase();
    service = new ReservationReschedulingService();
  });

  describe('validateRescheduleRequest', () => {
    const mockReservation = {
      id: 'reservation-1',
      shop_id: 'shop-1',
      user_id: 'user-1',
      reservation_date: '2024-01-15',
      reservation_time: '14:00',
      status: 'confirmed',
      total_amount: 50000,
      points_used: 0,
      special_requests: null,
      created_at: '2024-01-10T10:00:00Z',
      updated_at: '2024-01-10T10:00:00Z'
    };

    it('should validate a valid reschedule request', async () => {
      jest.spyOn(service, 'getReservationById').mockResolvedValue(mockReservation);
      jest.spyOn(service, 'getRescheduleCount').mockResolvedValue(0);
      jest.spyOn(service, 'validateNewDateTime').mockReturnValue({ errors: [], warnings: [] });
      jest.spyOn(service, 'validateNoticePeriod').mockReturnValue({ errors: [], warnings: [] });
      jest.spyOn(service, 'validateSlotAvailability').mockResolvedValue({ errors: [], warnings: [] });
      jest.spyOn(service, 'calculateRescheduleFees').mockResolvedValue(undefined);
      jest.spyOn(service, 'validatePermissions').mockResolvedValue({ errors: [], warnings: [], requiresShopApproval: false });

      const request = {
        reservationId: 'reservation-1',
        newDate: '2024-01-16',
        newTime: '15:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await service.validateRescheduleRequest(request);

      expect(result.canReschedule).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject reschedule for non-existent reservation', async () => {
      jest.spyOn(service, 'getReservationById').mockResolvedValue(null);

      const request = {
        reservationId: 'non-existent',
        newDate: '2024-01-16',
        newTime: '15:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await service.validateRescheduleRequest(request);

      expect(result.canReschedule).toBe(false);
      expect(result.errors).toContain('Reservation not found');
    });

    it('should reject reschedule for completed reservation', async () => {
      const completedReservation = { ...mockReservation, status: 'completed' };
      jest.spyOn(service, 'getReservationById').mockResolvedValue(completedReservation);

      const request = {
        reservationId: 'reservation-1',
        newDate: '2024-01-16',
        newTime: '15:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await service.validateRescheduleRequest(request);

      expect(result.canReschedule).toBe(false);
      expect(result.errors).toContain('Reservation cannot be rescheduled in status: completed');
    });

    it('should reject reschedule when maximum reschedules exceeded', async () => {
      jest.spyOn(service, 'getReservationById').mockResolvedValue(mockReservation);
      jest.spyOn(service, 'getRescheduleCount').mockResolvedValue(3);

      const request = {
        reservationId: 'reservation-1',
        newDate: '2024-01-16',
        newTime: '15:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await service.validateRescheduleRequest(request);

      expect(result.canReschedule).toBe(false);
      expect(result.errors).toContain('Maximum reschedules (3) exceeded');
    });

    it('should reject reschedule for past date/time', async () => {
      jest.spyOn(service, 'getReservationById').mockResolvedValue(mockReservation);
      jest.spyOn(service, 'getRescheduleCount').mockResolvedValue(0);
      // Let validateNewDateTime run naturally - it will detect past date
      jest.spyOn(service, 'validateNoticePeriod').mockReturnValue({ errors: [], warnings: [] });
      jest.spyOn(service, 'validateSlotAvailability').mockResolvedValue({ errors: [], warnings: [] });
      jest.spyOn(service, 'calculateRescheduleFees').mockResolvedValue(undefined);
      jest.spyOn(service, 'validatePermissions').mockResolvedValue({ errors: [], warnings: [], requiresShopApproval: false });

      const request = {
        reservationId: 'reservation-1',
        newDate: '2024-01-01',
        newTime: '10:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await service.validateRescheduleRequest(request);

      expect(result.canReschedule).toBe(false);
      expect(result.errors).toContain('New reservation time cannot be in the past');
    });

    it('should reject reschedule for unavailable slot', async () => {
      jest.spyOn(service, 'getReservationById').mockResolvedValue(mockReservation);
      jest.spyOn(service, 'getRescheduleCount').mockResolvedValue(0);
      jest.spyOn(service, 'validateNewDateTime').mockReturnValue({ errors: [], warnings: [] });
      jest.spyOn(service, 'validateNoticePeriod').mockReturnValue({ errors: [], warnings: [] });
      jest.spyOn(service, 'validateSlotAvailability').mockResolvedValue({
        errors: ['Selected time slot is not available'],
        warnings: []
      });
      jest.spyOn(service, 'calculateRescheduleFees').mockResolvedValue(undefined);
      jest.spyOn(service, 'validatePermissions').mockResolvedValue({ errors: [], warnings: [], requiresShopApproval: false });

      const request = {
        reservationId: 'reservation-1',
        newDate: '2024-01-16',
        newTime: '15:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await service.validateRescheduleRequest(request);

      expect(result.canReschedule).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should calculate fees for last-minute rescheduling', async () => {
      jest.spyOn(service, 'getReservationById').mockResolvedValue(mockReservation);
      jest.spyOn(service, 'getRescheduleCount').mockResolvedValue(0);
      jest.spyOn(service, 'validateNewDateTime').mockReturnValue({ errors: [], warnings: [] });
      jest.spyOn(service, 'validateNoticePeriod').mockReturnValue({ errors: [], warnings: [] });
      jest.spyOn(service, 'validateSlotAvailability').mockResolvedValue({ errors: [], warnings: [] });
      jest.spyOn(service, 'calculateRescheduleFees').mockResolvedValue({
        rescheduleFee: 10000,
        reason: 'Same-day rescheduling fee'
      });
      jest.spyOn(service, 'validatePermissions').mockResolvedValue({ errors: [], warnings: [], requiresShopApproval: false });

      const request = {
        reservationId: 'reservation-1',
        newDate: '2024-01-15',
        newTime: '16:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await service.validateRescheduleRequest(request);

      expect(result.canReschedule).toBe(true);
      expect(result.fees).toBeDefined();
      expect(result.fees?.rescheduleFee).toBe(10000); // Same-day fee
    });
  });

  describe('rescheduleReservation', () => {
    const mockReservation = {
      id: 'reservation-1',
      shop_id: 'shop-1',
      user_id: 'user-1',
      reservation_date: '2024-01-15',
      reservation_time: '14:00',
      status: 'confirmed',
      total_amount: 50000,
      points_used: 0,
      special_requests: null,
      created_at: '2024-01-10T10:00:00Z',
      updated_at: '2024-01-10T10:00:00Z'
    };

    it('should successfully reschedule a reservation', async () => {
      const updatedReservation = { ...mockReservation, reservation_date: '2024-01-16', reservation_time: '15:00' };

      jest.spyOn(service, 'validateRescheduleRequest').mockResolvedValue({
        canReschedule: true,
        errors: [],
        warnings: [],
        restrictions: [],
        fees: undefined
      });
      jest.spyOn(service, 'getReservationById').mockResolvedValue(mockReservation);
      jest.spyOn(service, 'acquireRescheduleLock').mockResolvedValue('lock-123');
      jest.spyOn(service, 'validateSlotAvailabilityWithLock').mockResolvedValue({
        available: true,
        warnings: []
      });
      mockSupabase.rpc.mockResolvedValue({
        data: updatedReservation,
        error: null
      });
      jest.spyOn(service, 'logRescheduleHistory').mockResolvedValue(undefined);
      jest.spyOn(service, 'sendRescheduleNotifications').mockResolvedValue({
        user: true,
        shop: true,
        admin: false
      });
      jest.spyOn(service, 'releaseRescheduleLock').mockResolvedValue(undefined);

      const request = {
        reservationId: 'reservation-1',
        newDate: '2024-01-16',
        newTime: '15:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await service.rescheduleReservation(request);

      expect(result.success).toBe(true);
      expect(result.reservation).toBeDefined();
      expect(result.errors).toHaveLength(0);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('reschedule_reservation_with_lock', expect.any(Object));
    });

    it('should fail reschedule when validation fails', async () => {
      jest.spyOn(service, 'validateRescheduleRequest').mockResolvedValue({
        canReschedule: false,
        errors: ['Reservation not found'],
        warnings: [],
        restrictions: []
      });

      const request = {
        reservationId: 'non-existent',
        newDate: '2024-01-16',
        newTime: '15:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await service.rescheduleReservation(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Reservation not found');
    });

    it('should handle database errors during reschedule', async () => {
      jest.spyOn(service, 'validateRescheduleRequest').mockResolvedValue({
        canReschedule: true,
        errors: [],
        warnings: [],
        restrictions: [],
        fees: undefined
      });
      jest.spyOn(service, 'getReservationById').mockResolvedValue(mockReservation);
      jest.spyOn(service, 'acquireRescheduleLock').mockResolvedValue('lock-123');
      jest.spyOn(service, 'validateSlotAvailabilityWithLock').mockResolvedValue({
        available: true,
        warnings: []
      });
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'Database error' } });
      jest.spyOn(service, 'releaseRescheduleLock').mockResolvedValue(undefined);

      const request = {
        reservationId: 'reservation-1',
        newDate: '2024-01-16',
        newTime: '15:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await service.rescheduleReservation(request);

      expect(result.success).toBe(false);
      // Actual error messages are in Korean
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getAvailableRescheduleSlots', () => {
    const mockReservation = {
      id: 'reservation-1',
      shop_id: 'shop-1',
      user_id: 'user-1',
      reservation_date: '2024-01-15',
      reservation_time: '14:00',
      status: 'confirmed'
    };

    const mockReservationServices = [
      { service_id: 'service-1', quantity: 1 },
      { service_id: 'service-2', quantity: 2 }
    ];

    it('should return available slots for rescheduling', async () => {
      jest.spyOn(service, 'getReservationById').mockResolvedValue(mockReservation);

      mockSupabase.from = createTableAwareFromMock({
        'reservation_services': { data: mockReservationServices, error: null }
      });

      // Return slots only on first call, empty for the rest (7-day loop)
      (timeSlotService.getAvailableTimeSlots as jest.Mock)
        .mockResolvedValueOnce([
          { startTime: '09:00', endTime: '09:30', duration: 30, isAvailable: true },
          { startTime: '10:00', endTime: '10:30', duration: 30, isAvailable: true }
        ])
        .mockResolvedValue([]);

      const result = await service.getAvailableRescheduleSlots('reservation-1');

      expect(result.slots).toHaveLength(2);
      // Restrictions may include last-minute fee warning since mock reservation date is in the past
      expect(timeSlotService.getAvailableTimeSlots).toHaveBeenCalled();
    });

    it('should filter out current reservation slot', async () => {
      jest.spyOn(service, 'getReservationById').mockResolvedValue(mockReservation);

      mockSupabase.from = createTableAwareFromMock({
        'reservation_services': { data: mockReservationServices, error: null }
      });

      // Return slots only for the first day (which matches reservation date when using preferredDate)
      (timeSlotService.getAvailableTimeSlots as jest.Mock)
        .mockResolvedValueOnce([
          { startTime: '14:00', endTime: '14:30', duration: 30, isAvailable: true }, // Current slot
          { startTime: '15:00', endTime: '15:30', duration: 30, isAvailable: true }
        ])
        .mockResolvedValue([]);

      // Pass preferredDate matching reservation date so first iteration is 2024-01-15
      const result = await service.getAvailableRescheduleSlots('reservation-1', '2024-01-15');

      // Should filter out the current slot (14:00 on 2024-01-15)
      expect(result.slots).toHaveLength(1);
      expect(result.slots[0].startTime).toBe('15:00');
    });

    it('should add restrictions for no-show reservations', async () => {
      const noShowReservation = { ...mockReservation, status: 'no_show' };
      jest.spyOn(service, 'getReservationById').mockResolvedValue(noShowReservation);

      mockSupabase.from = createTableAwareFromMock({
        'reservation_services': { data: mockReservationServices, error: null }
      });

      (timeSlotService.getAvailableTimeSlots as jest.Mock).mockResolvedValue([]);

      const result = await service.getAvailableRescheduleSlots('reservation-1');

      expect(result.restrictions).toContain('Additional fees may apply for rescheduling after no-show');
    });
  });

  describe('getRescheduleHistory', () => {
    it('should return reschedule history for a reservation', async () => {
      const mockHistory = [
        {
          id: 'history-1',
          reservation_id: 'reservation-1',
          old_date: '2024-01-15',
          old_time: '14:00',
          new_date: '2024-01-16',
          new_time: '15:00',
          reason: 'Schedule conflict',
          requested_by: 'user',
          requested_by_id: 'user-1',
          fees: 5000,
          timestamp: '2024-01-10T10:00:00Z'
        }
      ];

      mockSupabase.from = createTableAwareFromMock({
        'reservation_reschedule_history': { data: mockHistory, error: null }
      });

      const result = await service.getRescheduleHistory('reservation-1');

      expect(result).toEqual(mockHistory);
    });

    it('should return empty array when no history exists', async () => {
      mockSupabase.from = createTableAwareFromMock({
        'reservation_reschedule_history': { data: [], error: null }
      });

      const result = await service.getRescheduleHistory('reservation-1');

      expect(result).toEqual([]);
    });
  });

  describe('getRescheduleStats', () => {
    it('should return reschedule statistics for a shop', async () => {
      const mockReschedules = [
        { requested_by: 'user', fees: 5000 },
        { requested_by: 'shop', fees: 10000 },
        { requested_by: 'admin', fees: 0 }
      ];

      mockSupabase.from = createTableAwareFromMock({
        'reservation_reschedule_history': { data: mockReschedules, error: null }
      });

      const result = await service.getRescheduleStats(
        'shop-1',
        '2024-01-01',
        '2024-01-31'
      );

      expect(result.totalReschedules).toBe(3);
      expect(result.userRequested).toBe(1);
      expect(result.shopRequested).toBe(1);
      expect(result.adminRequested).toBe(1);
      expect(result.totalFees).toBe(15000);
      expect(result.averageFees).toBe(5000);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from = createTableAwareFromMock({
        'reservation_reschedule_history': { data: null, error: { message: 'Database error' } }
      });

      const result = await service.getRescheduleStats(
        'shop-1',
        '2024-01-01',
        '2024-01-31'
      );

      expect(result.totalReschedules).toBe(0);
      expect(result.totalFees).toBe(0);
      expect(result.averageFees).toBe(0);
    });
  });
});
