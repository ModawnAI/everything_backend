/**
 * Comprehensive Time Slot Service Unit Tests
 * 
 * Enhanced unit tests for the time slot service covering:
 * - Time slot generation based on operating hours
 * - Availability checking with existing reservations
 * - Service duration and buffer time handling
 * - Conflict detection and resolution
 * - Performance optimization features
 * - Edge cases and boundary conditions
 */

import { TimeSlotService, TimeSlot, TimeSlotRequest, ShopOperatingHours, ServiceDuration } from '../../src/services/time-slot.service';
import { ReservationTestUtils } from '../utils/reservation-test-utils';
import { getTestConfig } from '../config/reservation-test-config';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');

import { getSupabaseClient } from '../../src/config/database';
import { logger } from '../../src/utils/logger';

describe('Time Slot Service - Comprehensive Tests', () => {
  let timeSlotService: TimeSlotService;
  let testUtils: ReservationTestUtils;
  let mockSupabase: any;
  let mockLogger: jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup service
    timeSlotService = new TimeSlotService();
    testUtils = new ReservationTestUtils();

    // Setup mocks
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              lte: jest.fn(() => ({
                in: jest.fn(() => ({
                  or: jest.fn(() => ({
                    order: jest.fn(() => ({
                      then: jest.fn(() => Promise.resolve({ data: [], error: null }))
                    }))
                  }))
                }))
              }))
            }))
          }))
        }))
      }))
    };
    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    mockLogger = logger as jest.Mocked<typeof logger>;
  });

  describe('Time Slot Generation', () => {
    it('should generate time slots for standard business hours', async () => {
      const operatingHours: ShopOperatingHours = {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: null
      };

      const serviceDuration: ServiceDuration = {
        duration: 60, // 1 hour
        bufferTime: 15 // 15 minutes
      };

      const request: TimeSlotRequest = {
        shopId: 'shop-123',
        date: '2024-03-15', // Friday
        serviceIds: ['service-1'],
        duration: serviceDuration
      };

      const timeSlots = await timeSlotService.generateTimeSlots(request, operatingHours);

      expect(timeSlots).toHaveLength(8); // 9 AM to 6 PM with 1-hour slots = 8 slots
      expect(timeSlots[0].startTime).toBe('09:00');
      expect(timeSlots[0].endTime).toBe('10:15'); // 60 min + 15 min buffer
      expect(timeSlots[timeSlots.length - 1].startTime).toBe('17:00');
    });

    it('should handle different service durations', async () => {
      const operatingHours: ShopOperatingHours = {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: null
      };

      const shortService: ServiceDuration = { duration: 30, bufferTime: 10 };
      const longService: ServiceDuration = { duration: 120, bufferTime: 30 };

      const request: TimeSlotRequest = {
        shopId: 'shop-123',
        date: '2024-03-15',
        serviceIds: ['service-1'],
        duration: shortService
      };

      const shortSlots = await timeSlotService.generateTimeSlots(request, operatingHours);
      request.duration = longService;
      const longSlots = await timeSlotService.generateTimeSlots(request, operatingHours);

      expect(shortSlots.length).toBeGreaterThan(longSlots.length);
      expect(shortSlots[0].endTime).toBe('09:40'); // 30 min + 10 min buffer
      expect(longSlots[0].endTime).toBe('11:30'); // 120 min + 30 min buffer
    });

    it('should handle lunch break exclusions', async () => {
      const operatingHours: ShopOperatingHours = {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: null
      };

      const serviceDuration: ServiceDuration = { duration: 60, bufferTime: 15 };
      const lunchBreak = { start: '12:00', end: '13:00' };

      const request: TimeSlotRequest = {
        shopId: 'shop-123',
        date: '2024-03-15',
        serviceIds: ['service-1'],
        duration: serviceDuration,
        exclusions: [lunchBreak]
      };

      const timeSlots = await timeSlotService.generateTimeSlots(request, operatingHours);

      // Should not have slots that overlap with lunch break
      const lunchOverlapSlots = timeSlots.filter(slot => 
        (slot.startTime >= '12:00' && slot.startTime < '13:00') ||
        (slot.endTime > '12:00' && slot.endTime <= '13:00')
      );

      expect(lunchOverlapSlots).toHaveLength(0);
    });

    it('should handle closed days', async () => {
      const operatingHours: ShopOperatingHours = {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: null // Closed on Sunday
      };

      const request: TimeSlotRequest = {
        shopId: 'shop-123',
        date: '2024-03-17', // Sunday
        serviceIds: ['service-1'],
        duration: { duration: 60, bufferTime: 15 }
      };

      const timeSlots = await timeSlotService.generateTimeSlots(request, operatingHours);

      expect(timeSlots).toHaveLength(0);
    });
  });

  describe('Availability Checking', () => {
    it('should check slot availability against existing reservations', async () => {
      const existingReservations = [
        {
          id: 'reservation-1',
          start_time: '10:00',
          end_time: '11:15',
          status: 'confirmed'
        },
        {
          id: 'reservation-2',
          start_time: '14:00',
          end_time: '15:15',
          status: 'confirmed'
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({
                data: existingReservations,
                error: null
              })
            })
          })
        })
      });

      const isAvailable = await timeSlotService.isSlotAvailable(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1']
      );

      expect(isAvailable).toBe(false); // Should be unavailable due to existing reservation
    });

    it('should handle multiple service bookings in same slot', async () => {
      const existingReservations = [
        {
          id: 'reservation-1',
          start_time: '10:00',
          end_time: '11:15',
          status: 'confirmed',
          services: [{ serviceId: 'service-1', quantity: 1 }]
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({
                data: existingReservations,
                error: null
              })
            })
          })
        })
      });

      // Check availability for same service
      const sameServiceAvailable = await timeSlotService.isSlotAvailable(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1']
      );

      // Check availability for different service
      const differentServiceAvailable = await timeSlotService.isSlotAvailable(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-2']
      );

      expect(sameServiceAvailable).toBe(false);
      expect(differentServiceAvailable).toBe(true);
    });

    it('should ignore cancelled reservations in availability check', async () => {
      const reservations = [
        {
          id: 'reservation-1',
          start_time: '10:00',
          end_time: '11:15',
          status: 'cancelled_by_user'
        },
        {
          id: 'reservation-2',
          start_time: '14:00',
          end_time: '15:15',
          status: 'confirmed'
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({
                data: reservations,
                error: null
              })
            })
          })
        })
      });

      // Check availability for cancelled slot
      const cancelledSlotAvailable = await timeSlotService.isSlotAvailable(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1']
      );

      // Check availability for confirmed slot
      const confirmedSlotAvailable = await timeSlotService.isSlotAvailable(
        'shop-123',
        '2024-03-15',
        '14:00',
        ['service-1']
      );

      expect(cancelledSlotAvailable).toBe(true); // Should be available
      expect(confirmedSlotAvailable).toBe(false); // Should be unavailable
    });
  });

  describe('Conflict Detection and Resolution', () => {
    it('should detect time conflicts between reservations', async () => {
      const conflictingReservations = [
        {
          id: 'reservation-1',
          start_time: '10:00',
          end_time: '11:15',
          status: 'confirmed'
        },
        {
          id: 'reservation-2',
          start_time: '10:30',
          end_time: '11:45',
          status: 'requested'
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({
                data: conflictingReservations,
                error: null
              })
            })
          })
        })
      });

      const conflicts = await timeSlotService.detectConflicts(
        'shop-123',
        '2024-03-15',
        '10:00',
        '11:15'
      );

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('time_overlap');
      expect(conflicts[0].severity).toBe('high');
    });

    it('should resolve conflicts by suggesting alternative slots', async () => {
      const existingReservations = [
        {
          id: 'reservation-1',
          start_time: '10:00',
          end_time: '11:15',
          status: 'confirmed'
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({
                data: existingReservations,
                error: null
              })
            })
          })
        })
      });

      const alternatives = await timeSlotService.getAlternativeSlots(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1']
      );

      expect(alternatives).toBeDefined();
      expect(alternatives.length).toBeGreaterThan(0);
      expect(alternatives[0].startTime).not.toBe('10:00'); // Should suggest different time
    });

    it('should handle service capacity conflicts', async () => {
      const reservations = [
        {
          id: 'reservation-1',
          start_time: '10:00',
          end_time: '11:15',
          status: 'confirmed',
          services: [{ serviceId: 'service-1', quantity: 2 }]
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({
                data: reservations,
                error: null
              })
            })
          })
        })
      });

      const availability = await timeSlotService.checkServiceCapacity(
        'shop-123',
        '2024-03-15',
        '10:00',
        'service-1',
        3 // Requesting 3 units when only 2 are available
      );

      expect(availability.available).toBe(false);
      expect(availability.availableQuantity).toBe(2);
      expect(availability.requestedQuantity).toBe(3);
    });
  });

  describe('Performance Optimization', () => {
    it('should cache time slot data for repeated requests', async () => {
      const request: TimeSlotRequest = {
        shopId: 'shop-123',
        date: '2024-03-15',
        serviceIds: ['service-1'],
        duration: { duration: 60, bufferTime: 15 }
      };

      // First request
      const start1 = performance.now();
      await timeSlotService.getAvailableTimeSlots(request);
      const end1 = performance.now();
      const firstRequestTime = end1 - start1;

      // Second request (should use cache)
      const start2 = performance.now();
      await timeSlotService.getAvailableTimeSlots(request);
      const end2 = performance.now();
      const secondRequestTime = end2 - start2;

      expect(secondRequestTime).toBeLessThan(firstRequestTime);
    });

    it('should batch process multiple date requests', async () => {
      const dates = ['2024-03-15', '2024-03-16', '2024-03-17', '2024-03-18'];
      const requests = dates.map(date => ({
        shopId: 'shop-123',
        date,
        serviceIds: ['service-1'],
        duration: { duration: 60, bufferTime: 15 }
      }));

      const startTime = performance.now();
      const results = await Promise.all(
        requests.map(request => timeSlotService.getAvailableTimeSlots(request))
      );
      const endTime = performance.now();

      expect(results).toHaveLength(4);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should optimize database queries for large date ranges', async () => {
      const startDate = '2024-03-01';
      const endDate = '2024-03-31';
      
      const reservations = await timeSlotService.getReservationsForDateRange(
        'shop-123',
        startDate,
        endDate
      );

      // Should make efficient queries instead of individual date queries
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle midnight crossover scenarios', async () => {
      const operatingHours: ShopOperatingHours = {
        monday: { open: '22:00', close: '02:00' }, // Overnight hours
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: null
      };

      const request: TimeSlotRequest = {
        shopId: 'shop-123',
        date: '2024-03-18', // Monday
        serviceIds: ['service-1'],
        duration: { duration: 60, bufferTime: 15 }
      };

      const timeSlots = await timeSlotService.generateTimeSlots(request, operatingHours);

      expect(timeSlots).toHaveLength(4); // 22:00, 23:00, 00:00, 01:00
      expect(timeSlots[0].startTime).toBe('22:00');
      expect(timeSlots[timeSlots.length - 1].startTime).toBe('01:00');
    });

    it('should handle very short service durations', async () => {
      const operatingHours: ShopOperatingHours = {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: null
      };

      const request: TimeSlotRequest = {
        shopId: 'shop-123',
        date: '2024-03-15',
        serviceIds: ['service-1'],
        duration: { duration: 15, bufferTime: 5 } // Very short service
      };

      const timeSlots = await timeSlotService.generateTimeSlots(request, operatingHours);

      expect(timeSlots).toHaveLength(36); // 9 hours * 4 slots per hour (15 min + 5 min buffer)
      expect(timeSlots[0].endTime).toBe('09:20'); // 15 min + 5 min buffer
    });

    it('should handle very long service durations', async () => {
      const operatingHours: ShopOperatingHours = {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: null
      };

      const request: TimeSlotRequest = {
        shopId: 'shop-123',
        date: '2024-03-15',
        serviceIds: ['service-1'],
        duration: { duration: 480, bufferTime: 60 } // 8 hours + 1 hour buffer
      };

      const timeSlots = await timeSlotService.generateTimeSlots(request, operatingHours);

      expect(timeSlots).toHaveLength(1); // Only one 9-hour slot fits in 9-hour day
      expect(timeSlots[0].startTime).toBe('09:00');
      expect(timeSlots[0].endTime).toBe('18:00');
    });

    it('should handle invalid time formats gracefully', async () => {
      const request: TimeSlotRequest = {
        shopId: 'shop-123',
        date: '2024-03-15',
        serviceIds: ['service-1'],
        duration: { duration: 60, bufferTime: 15 }
      };

      await expect(
        timeSlotService.isSlotAvailable('shop-123', '2024-03-15', '25:00', ['service-1'])
      ).rejects.toThrow('Invalid time format');

      await expect(
        timeSlotService.isSlotAvailable('shop-123', '2024-03-15', '10:60', ['service-1'])
      ).rejects.toThrow('Invalid time format');
    });

    it('should handle database connection failures', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockRejectedValue(new Error('Database connection failed'))
            })
          })
        })
      });

      await expect(
        timeSlotService.isSlotAvailable('shop-123', '2024-03-15', '10:00', ['service-1'])
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('Integration with Reservation System', () => {
    it('should validate slot availability before reservation creation', async () => {
      const validation = await timeSlotService.validateSlotAvailability(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1']
      );

      expect(validation).toHaveProperty('available');
      expect(validation).toHaveProperty('conflictReason');
      expect(validation).toHaveProperty('conflictingReservations');
    });

    it('should provide detailed conflict information', async () => {
      const conflictingReservations = [
        {
          id: 'reservation-1',
          start_time: '10:00',
          end_time: '11:15',
          status: 'confirmed',
          user_id: 'user-123'
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({
                data: conflictingReservations,
                error: null
              })
            })
          })
        })
      });

      const validation = await timeSlotService.validateSlotAvailability(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1']
      );

      expect(validation.available).toBe(false);
      expect(validation.conflictReason).toContain('Time slot already booked');
      expect(validation.conflictingReservations).toHaveLength(1);
    });
  });
});
