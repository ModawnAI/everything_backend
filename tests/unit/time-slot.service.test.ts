/**
 * Time Slot Service Tests
 * 
 * Tests for the Time Slot Availability Calculation Engine including:
 * - Time slot generation based on operating hours
 * - Availability checking with existing reservations
 * - Service duration and buffer time handling
 * - Conflict detection and resolution
 */

import { TimeSlotService, TimeSlot, TimeSlotRequest, ShopOperatingHours, ServiceDuration } from '../../src/services/time-slot.service';

// Mock the database client to avoid actual database calls
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn(() => ({
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
  })),
  initializeDatabase: jest.fn(() => ({
    client: {},
    healthCheck: jest.fn(() => Promise.resolve(true)),
    disconnect: jest.fn(() => Promise.resolve())
  }))
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Time Slot Service Tests', () => {
  let timeSlotService: TimeSlotService;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    timeSlotService = new TimeSlotService();
    mockSupabase = require('../../src/config/database').getSupabaseClient();
  });

  describe('getAvailableTimeSlots', () => {
    const mockRequest: TimeSlotRequest = {
      shopId: '123e4567-e89b-12d3-a456-426614174000',
      date: '2024-03-15',
      serviceIds: ['service-1', 'service-2'],
      interval: 30
    };

    const mockOperatingHours: ShopOperatingHours = {
      shopId: '123e4567-e89b-12d3-a456-426614174000',
      dayOfWeek: 5, // Friday
      openTime: '09:00',
      closeTime: '18:00',
      isOpen: true
    };

    const mockServiceDurations: ServiceDuration[] = [
      {
        serviceId: 'service-1',
        durationMinutes: 60,
        bufferMinutes: 15
      },
      {
        serviceId: 'service-2',
        durationMinutes: 90,
        bufferMinutes: 10
      }
    ];

    const mockExistingReservations = [
      {
        id: 'reservation-1',
        reservation_date: '2024-03-15',
        reservation_time: '10:00',
        reservation_services: [
          { service_id: 'service-1', quantity: 1 }
        ],
        status: 'confirmed'
      },
      {
        id: 'reservation-2',
        reservation_date: '2024-03-15',
        reservation_time: '14:00',
        reservation_services: [
          { service_id: 'service-2', quantity: 1 }
        ],
        status: 'confirmed'
      }
    ];

    test('should generate available time slots for open shop', async () => {
      // Mock the private methods
      jest.spyOn(timeSlotService as any, 'getShopOperatingHours').mockResolvedValue(mockOperatingHours);
      jest.spyOn(timeSlotService as any, 'getServiceDurations').mockResolvedValue(mockServiceDurations);
      jest.spyOn(timeSlotService as any, 'getExistingReservations').mockResolvedValue(mockExistingReservations);
      jest.spyOn(timeSlotService as any, 'generateTimeSlots').mockReturnValue([
        { startTime: '09:00', endTime: '09:30', duration: 30, isAvailable: true },
        { startTime: '09:30', endTime: '10:00', duration: 30, isAvailable: true },
        { startTime: '10:00', endTime: '10:30', duration: 30, isAvailable: false },
        { startTime: '10:30', endTime: '11:00', duration: 30, isAvailable: true }
      ]);
      jest.spyOn(timeSlotService as any, 'checkSlotAvailability').mockResolvedValue([
        { startTime: '09:00', endTime: '09:30', duration: 30, isAvailable: true },
        { startTime: '09:30', endTime: '10:00', duration: 30, isAvailable: true },
        { startTime: '10:30', endTime: '11:00', duration: 30, isAvailable: true }
      ]);

      const result = await timeSlotService.getAvailableTimeSlots(mockRequest);

      expect(result).toHaveLength(3);
      expect(result[0].isAvailable).toBe(true);
      expect(result[0].startTime).toBe('09:00');
      expect(result[0].endTime).toBe('09:30');
    });

    test('should return empty array for closed shop', async () => {
      const closedShopHours = { ...mockOperatingHours, isOpen: false };
      jest.spyOn(timeSlotService as any, 'getShopOperatingHours').mockResolvedValue(closedShopHours);

      const result = await timeSlotService.getAvailableTimeSlots(mockRequest);

      expect(result).toHaveLength(0);
    });

    test('should throw error for missing required parameters', async () => {
      const invalidRequest = { ...mockRequest, shopId: '' };

      await expect(timeSlotService.getAvailableTimeSlots(invalidRequest)).rejects.toThrow('Missing required parameters');
    });

    test('should handle database errors gracefully', async () => {
      jest.spyOn(timeSlotService as any, 'getShopOperatingHours').mockRejectedValue(new Error('Database error'));

      await expect(timeSlotService.getAvailableTimeSlots(mockRequest)).rejects.toThrow('Database error');
    });
  });

  describe('generateTimeSlots', () => {
    test('should generate time slots with 30-minute intervals', () => {
      const operatingHours: ShopOperatingHours = {
        shopId: 'test-shop',
        dayOfWeek: 1,
        openTime: '09:00',
        closeTime: '17:00',
        isOpen: true
      };

      const result = (timeSlotService as any).generateTimeSlots(
        operatingHours,
        60, // max duration
        30, // interval
        '09:00', // start time
        '17:00'  // end time
      );

      expect(result).toHaveLength(15); // 8 hours minus maxDuration (60 min) = 7 hours = 14 slots + 1 slot
      expect(result[0].startTime).toBe('09:00');
      expect(result[0].endTime).toBe('10:00'); // 60 minutes duration
      expect(result[result.length - 1].startTime).toBe('16:00');
      expect(result[result.length - 1].endTime).toBe('17:00');
    });

    test('should respect time constraints', () => {
      const operatingHours: ShopOperatingHours = {
        shopId: 'test-shop',
        dayOfWeek: 1,
        openTime: '09:00',
        closeTime: '17:00',
        isOpen: true
      };

      const result = (timeSlotService as any).generateTimeSlots(
        operatingHours,
        60,
        30,
        '10:00', // start time constraint
        '15:00'  // end time constraint
      );

      expect(result[0].startTime).toBe('10:00');
      expect(result[result.length - 1].endTime).toBe('15:00'); // 60 minutes duration
    });
  });

  describe('checkSlotAvailability', () => {
    test('should mark slots as unavailable when conflicting with reservations', async () => {
      const timeSlots: TimeSlot[] = [
        { startTime: '09:00', endTime: '09:30', duration: 30, isAvailable: true },
        { startTime: '09:30', endTime: '10:00', duration: 30, isAvailable: true },
        { startTime: '10:00', endTime: '10:30', duration: 30, isAvailable: true },
        { startTime: '10:30', endTime: '11:00', duration: 30, isAvailable: true }
      ];

      const existingReservations = [
        {
          id: 'reservation-1',
          reservation_time: '09:30',
          reservation_services: [
            { service_id: 'service-1', quantity: 1 }
          ],
          status: 'confirmed'
        }
      ];

      const serviceDurations: ServiceDuration[] = [
        {
          serviceId: 'service-1',
          durationMinutes: 60,
          bufferMinutes: 15
        }
      ];

      const result = await (timeSlotService as any).checkSlotAvailability(
        timeSlots,
        existingReservations,
        serviceDurations
      );

      // Slots that conflict with the 9:30-10:30 reservation should be unavailable
      expect(result[0].isAvailable).toBe(true);  // 9:00-9:30
      expect(result[1].isAvailable).toBe(false); // 9:30-10:00 (conflicts)
      expect(result[2].isAvailable).toBe(false); // 10:00-10:30 (conflicts)
      expect(result[3].isAvailable).toBe(true);  // 10:30-11:00
    });
  });

  describe('time utility functions', () => {
    test('should convert time to minutes correctly', () => {
      expect((timeSlotService as any).timeToMinutes('09:00')).toBe(540);
      expect((timeSlotService as any).timeToMinutes('14:30')).toBe(870);
      expect((timeSlotService as any).timeToMinutes('23:59')).toBe(1439);
    });

    test('should convert minutes to time correctly', () => {
      expect((timeSlotService as any).minutesToTime(540)).toBe('09:00');
      expect((timeSlotService as any).minutesToTime(870)).toBe('14:30');
      expect((timeSlotService as any).minutesToTime(1439)).toBe('23:59');
    });

    test('should detect time overlaps correctly', () => {
      const start1 = new Date('2024-03-15T09:00:00');
      const end1 = new Date('2024-03-15T10:00:00');
      const start2 = new Date('2024-03-15T09:30:00');
      const end2 = new Date('2024-03-15T10:30:00');

      expect((timeSlotService as any).timesOverlap(start1, end1, start2, end2)).toBe(true);

      const start3 = new Date('2024-03-15T11:00:00');
      const end3 = new Date('2024-03-15T12:00:00');

      expect((timeSlotService as any).timesOverlap(start1, end1, start3, end3)).toBe(false);
    });
  });

  describe('getNextAvailableSlot', () => {
    test('should return next available slot', async () => {
      jest.spyOn(timeSlotService, 'getAvailableTimeSlots').mockResolvedValue([
        { startTime: '09:00', endTime: '09:30', duration: 30, isAvailable: true },
        { startTime: '09:30', endTime: '10:00', duration: 30, isAvailable: true }
      ]);

      const result = await timeSlotService.getNextAvailableSlot('test-shop', 'service-1');

      expect(result).toBeDefined();
      expect(result?.startTime).toBe('09:00');
      expect(result?.isAvailable).toBe(true);
    });

    test('should return null when no slots available', async () => {
      jest.spyOn(timeSlotService, 'getAvailableTimeSlots').mockResolvedValue([]);

      const result = await timeSlotService.getNextAvailableSlot('test-shop', 'service-1');

      expect(result).toBeNull();
    });
  });

  describe('isSlotAvailable', () => {
    test('should return true for available slot', async () => {
      jest.spyOn(timeSlotService, 'getAvailableTimeSlots').mockResolvedValue([
        { startTime: '09:00', endTime: '09:30', duration: 30, isAvailable: true }
      ]);

      const result = await timeSlotService.isSlotAvailable('test-shop', '2024-03-15', '09:00', ['service-1']);

      expect(result).toBe(true);
    });

    test('should return false for unavailable slot', async () => {
      jest.spyOn(timeSlotService, 'getAvailableTimeSlots').mockResolvedValue([
        { startTime: '09:00', endTime: '09:30', duration: 30, isAvailable: false }
      ]);

      const result = await timeSlotService.isSlotAvailable('test-shop', '2024-03-15', '09:00', ['service-1']);

      expect(result).toBe(false);
    });
  });
}); 