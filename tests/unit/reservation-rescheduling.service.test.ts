/**
 * Unit Tests for Reservation Rescheduling Service
 */

import { reservationReschedulingService } from '../../src/services/reservation-rescheduling.service';
import { getSupabaseClient } from '../../src/config/database';
import { timeSlotService } from '../../src/services/time-slot.service';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/time-slot.service');
jest.mock('../../src/utils/logger');

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  rpc: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  count: jest.fn().mockReturnThis(),
  head: jest.fn().mockReturnThis()
};

const mockTimeSlotService = {
  getAvailableTimeSlots: jest.fn(),
  isSlotAvailable: jest.fn()
};

describe('ReservationReschedulingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
    (timeSlotService as any) = mockTimeSlotService;
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
      mockSupabase.single.mockResolvedValue({ data: mockReservation, error: null });
      mockSupabase.count.mockResolvedValue({ count: 0, error: null });
      mockTimeSlotService.isSlotAvailable.mockResolvedValue(true);

      const request = {
        reservationId: 'reservation-1',
        newDate: '2024-01-16',
        newTime: '15:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await reservationReschedulingService.validateRescheduleRequest(request);

      expect(result.canReschedule).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should reject reschedule for non-existent reservation', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      const request = {
        reservationId: 'non-existent',
        newDate: '2024-01-16',
        newTime: '15:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await reservationReschedulingService.validateRescheduleRequest(request);

      expect(result.canReschedule).toBe(false);
      expect(result.errors).toContain('Reservation not found');
    });

    it('should reject reschedule for completed reservation', async () => {
      const completedReservation = { ...mockReservation, status: 'completed' };
      mockSupabase.single.mockResolvedValue({ data: completedReservation, error: null });

      const request = {
        reservationId: 'reservation-1',
        newDate: '2024-01-16',
        newTime: '15:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await reservationReschedulingService.validateRescheduleRequest(request);

      expect(result.canReschedule).toBe(false);
      expect(result.errors).toContain('Reservation cannot be rescheduled in status: completed');
    });

    it('should reject reschedule when maximum reschedules exceeded', async () => {
      mockSupabase.single.mockResolvedValue({ data: mockReservation, error: null });
      mockSupabase.count.mockResolvedValue({ count: 3, error: null });

      const request = {
        reservationId: 'reservation-1',
        newDate: '2024-01-16',
        newTime: '15:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await reservationReschedulingService.validateRescheduleRequest(request);

      expect(result.canReschedule).toBe(false);
      expect(result.errors).toContain('Maximum reschedules (3) exceeded');
    });

    it('should reject reschedule for past date/time', async () => {
      mockSupabase.single.mockResolvedValue({ data: mockReservation, error: null });
      mockSupabase.count.mockResolvedValue({ count: 0, error: null });

      const request = {
        reservationId: 'reservation-1',
        newDate: '2024-01-01',
        newTime: '10:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await reservationReschedulingService.validateRescheduleRequest(request);

      expect(result.canReschedule).toBe(false);
      expect(result.errors).toContain('New reservation time cannot be in the past');
    });

    it('should reject reschedule for unavailable slot', async () => {
      mockSupabase.single.mockResolvedValue({ data: mockReservation, error: null });
      mockSupabase.count.mockResolvedValue({ count: 0, error: null });
      mockTimeSlotService.isSlotAvailable.mockResolvedValue(false);

      const request = {
        reservationId: 'reservation-1',
        newDate: '2024-01-16',
        newTime: '15:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await reservationReschedulingService.validateRescheduleRequest(request);

      expect(result.canReschedule).toBe(false);
      expect(result.errors).toContain('Selected time slot is not available');
    });

    it('should calculate fees for last-minute rescheduling', async () => {
      mockSupabase.single.mockResolvedValue({ data: mockReservation, error: null });
      mockSupabase.count.mockResolvedValue({ count: 0, error: null });
      mockTimeSlotService.isSlotAvailable.mockResolvedValue(true);

      const request = {
        reservationId: 'reservation-1',
        newDate: '2024-01-15',
        newTime: '16:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await reservationReschedulingService.validateRescheduleRequest(request);

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
      mockSupabase.single.mockResolvedValue({ data: mockReservation, error: null });
      mockSupabase.count.mockResolvedValue({ count: 0, error: null });
      mockSupabase.rpc.mockResolvedValue({ 
        data: { ...mockReservation, reservation_date: '2024-01-16', reservation_time: '15:00' }, 
        error: null 
      });
      mockTimeSlotService.isSlotAvailable.mockResolvedValue(true);

      const request = {
        reservationId: 'reservation-1',
        newDate: '2024-01-16',
        newTime: '15:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await reservationReschedulingService.rescheduleReservation(request);

      expect(result.success).toBe(true);
      expect(result.reservation).toBeDefined();
      expect(result.errors).toHaveLength(0);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('reschedule_reservation', expect.any(Object));
    });

    it('should fail reschedule when validation fails', async () => {
      mockSupabase.single.mockResolvedValue({ data: null, error: null });

      const request = {
        reservationId: 'non-existent',
        newDate: '2024-01-16',
        newTime: '15:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await reservationReschedulingService.rescheduleReservation(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Reservation not found');
    });

    it('should handle database errors during reschedule', async () => {
      mockSupabase.single.mockResolvedValue({ data: mockReservation, error: null });
      mockSupabase.count.mockResolvedValue({ count: 0, error: null });
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'Database error' } });
      mockTimeSlotService.isSlotAvailable.mockResolvedValue(true);

      const request = {
        reservationId: 'reservation-1',
        newDate: '2024-01-16',
        newTime: '15:00',
        reason: 'Schedule conflict',
        requestedBy: 'user' as const,
        requestedById: 'user-1'
      };

      const result = await reservationReschedulingService.rescheduleReservation(request);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Failed to reschedule reservation');
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
      mockSupabase.single.mockResolvedValue({ data: mockReservation, error: null });
      mockSupabase.select.mockResolvedValue({ data: mockReservationServices, error: null });
      mockTimeSlotService.getAvailableTimeSlots.mockResolvedValue([
        { startTime: '09:00', endTime: '09:30', duration: 30, isAvailable: true },
        { startTime: '10:00', endTime: '10:30', duration: 30, isAvailable: true }
      ]);

      const result = await reservationReschedulingService.getAvailableRescheduleSlots('reservation-1');

      expect(result.slots).toHaveLength(2);
      expect(result.restrictions).toHaveLength(0);
      expect(mockTimeSlotService.getAvailableTimeSlots).toHaveBeenCalled();
    });

    it('should filter out current reservation slot', async () => {
      mockSupabase.single.mockResolvedValue({ data: mockReservation, error: null });
      mockSupabase.select.mockResolvedValue({ data: mockReservationServices, error: null });
      mockTimeSlotService.getAvailableTimeSlots.mockResolvedValue([
        { startTime: '14:00', endTime: '14:30', duration: 30, isAvailable: true }, // Current slot
        { startTime: '15:00', endTime: '15:30', duration: 30, isAvailable: true }
      ]);

      const result = await reservationReschedulingService.getAvailableRescheduleSlots('reservation-1');

      // Should filter out the current slot (14:00)
      expect(result.slots).toHaveLength(1);
      expect(result.slots[0].startTime).toBe('15:00');
    });

    it('should add restrictions for no-show reservations', async () => {
      const noShowReservation = { ...mockReservation, status: 'no_show' };
      mockSupabase.single.mockResolvedValue({ data: noShowReservation, error: null });
      mockSupabase.select.mockResolvedValue({ data: mockReservationServices, error: null });
      mockTimeSlotService.getAvailableTimeSlots.mockResolvedValue([]);

      const result = await reservationReschedulingService.getAvailableRescheduleSlots('reservation-1');

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

      mockSupabase.select.mockResolvedValue({ data: mockHistory, error: null });

      const result = await reservationReschedulingService.getRescheduleHistory('reservation-1');

      expect(result).toEqual(mockHistory);
    });

    it('should return empty array when no history exists', async () => {
      mockSupabase.select.mockResolvedValue({ data: [], error: null });

      const result = await reservationReschedulingService.getRescheduleHistory('reservation-1');

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

      mockSupabase.select.mockResolvedValue({ data: mockReschedules, error: null });

      const result = await reservationReschedulingService.getRescheduleStats(
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
      mockSupabase.select.mockResolvedValue({ data: null, error: { message: 'Database error' } });

      const result = await reservationReschedulingService.getRescheduleStats(
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