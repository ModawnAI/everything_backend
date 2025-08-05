/**
 * Booking Validation Service Tests
 * 
 * Comprehensive test suite for the BookingValidationService covering:
 * - Basic data validation
 * - Customer eligibility validation
 * - Service availability validation
 * - Booking limits validation
 * - Business rules validation
 * - Operational constraints validation
 * - Error handling and edge cases
 */

// Move jest.mock calls to the very top
jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');

import { BookingValidationService, BookingRequest, ValidationResult } from '../../src/services/booking-validation.service';
import { getSupabaseClient } from '../../src/config/database';
import { logger } from '../../src/utils/logger';

let mockSupabaseClient: any;

describe('BookingValidationService', () => {
  let validationService: BookingValidationService;
  let mockUser: any;
  let mockShop: any;
  let mockService: any;
  let mockStaff: any;
  let mockExistingBookings: any[];
  let mockCustomerHistory: any[];

  // Helper function to get future dates for testing
  const getFutureDate = (daysFromNow: number = 1): string => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize mockSupabaseClient with comprehensive mocking
    mockSupabaseClient = {
      from: jest.fn((tableName: string) => {
        const mockTable = {
          select: jest.fn(() => ({
            eq: jest.fn((field: string, value: any) => {
              // Handle different table queries
              if (tableName === 'users' && field === 'id') {
                return {
                  single: jest.fn().mockResolvedValue({ data: mockUser, error: null })
                };
              }
              if (tableName === 'shops' && field === 'id') {
                return {
                  single: jest.fn().mockResolvedValue({ data: mockShop, error: null })
                };
              }
              if (tableName === 'services' && field === 'id') {
                return {
                  single: jest.fn().mockResolvedValue({ data: mockService, error: null })
                };
              }
              if (tableName === 'staff' && field === 'id') {
                return {
                  single: jest.fn().mockResolvedValue({ data: mockStaff, error: null })
                };
              }
              if (tableName === 'reservations') {
                if (field === 'shop_id') {
                  return {
                    eq: jest.fn((dateField: string, dateValue: any) => ({
                      in: jest.fn((statusField: string, statusValues: string[]) => {
                        // Return a Promise that resolves to { data, error }
                        return Promise.resolve({ data: [...mockExistingBookings], error: null });
                      })
                    }))
                  };
                }
                if (field === 'user_id') {
                  return {
                    order: jest.fn(() => ({
                      limit: jest.fn().mockImplementation(() => {
                        // Always return a fresh copy of the current array
                        return Promise.resolve({ data: [...mockCustomerHistory], error: null });
                      })
                    }))
                  };
                }
              }
              // Default fallback
              return {
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
                eq: jest.fn(() => ({
                  in: jest.fn(() => ({
                    mockResolvedValue: jest.fn().mockResolvedValue({ data: [], error: null })
                  }))
                })),
                order: jest.fn(() => ({
                  limit: jest.fn().mockResolvedValue({ data: [], error: null })
                }))
              };
            })
          }))
        };
        return mockTable;
      })
    };
    
    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabaseClient);
    validationService = new BookingValidationService();

    // Create future dates for testing
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const futureDate = tomorrow.toISOString().split('T')[0];
    
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const futureWeekDate = nextWeek.toISOString().split('T')[0];

    mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      status: 'active',
      blacklist_status: 'none',
      credit_limit: 1000,
      current_balance: 0,
      membership_status: 'basic',
      no_show_count: 0
    };

    mockShop = {
      id: 'shop-1',
      name: 'Test Shop',
      is_active: true,
      operating_hours: {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '09:00', close: '18:00' },
        sunday: { open: '09:00', close: '18:00' }
      }
    };

    mockService = {
      id: 'service-1',
      shop_id: 'shop-1',
      is_active: true,
      capacity: 10,
      duration: 60,
      price: 50
    };

    mockStaff = {
      id: 'staff-1',
      is_active: true,
      name: 'Test Staff'
    };

    mockExistingBookings = [
      {
        id: 'booking-1',
        user_id: 'user-2',
        shop_id: 'shop-1',
        service_id: 'service-1',
        staff_id: 'staff-1',
        date: futureDate,
        time_slot: '10:00',
        quantity: 1,
        status: 'confirmed'
      }
    ];

    mockCustomerHistory = [
      {
        id: 'booking-1',
        user_id: 'user-1',
        shop_id: 'shop-1',
        service_id: 'service-1',
        date: futureWeekDate,
        time_slot: '14:00',
        status: 'completed',
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
      }
    ];
  });

  describe('Basic Data Validation', () => {
    test('should validate valid booking request', async () => {
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00', // Changed from '10:00' to avoid premium slot restriction
        quantity: 1
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject booking with missing required fields', async () => {
      const request: BookingRequest = {
        userId: '',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      } as any;

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MISSING_USER_ID');
    });

    test('should reject booking for past date', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: yesterday.toISOString().split('T')[0],
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PAST_DATE');
    });

    test('should reject booking too far in the future', async () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 7);
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: futureDate.toISOString().split('T')[0],
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('TOO_FAR_IN_FUTURE');
    });

    test('should reject invalid time slot format', async () => {
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '10:00:00' // Invalid format
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_TIME_FORMAT');
    });

    test('should reject invalid quantity', async () => {
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00',
        quantity: 0
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INVALID_QUANTITY');
    });

    test('should warn for high quantity booking', async () => {
      // Temporarily increase service capacity to allow high quantity
      mockService.capacity = 15;
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00',
        quantity: 11
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('HIGH_QUANTITY');
    });

    test('should reject special requests that are too long', async () => {
      const longRequest = 'a'.repeat(501);
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00',
        specialRequests: longRequest
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('SPECIAL_REQUESTS_TOO_LONG');
    });
  });

  describe('Customer Eligibility Validation', () => {
    test('should validate eligible customer', async () => {
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject inactive user', async () => {
      mockUser.status = 'inactive';
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('USER_INACTIVE');
    });

    test('should reject permanently blacklisted user', async () => {
      mockUser.blacklist_status = 'permanent';
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('USER_BLACKLISTED_PERMANENT');
    });

    test('should reject temporarily blacklisted user', async () => {
      mockUser.blacklist_status = 'temporary';
      mockUser.blacklist_until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // Tomorrow
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('USER_BLACKLISTED_TEMPORARY');
    });

    test('should reject user with exceeded credit limit', async () => {
      mockUser.current_balance = 1000;
      mockUser.credit_limit = 1000;
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('CREDIT_LIMIT_EXCEEDED');
    });

    test('should warn for user with high no-show count', async () => {
      mockCustomerHistory.push(
        { status: 'no_show', created_at: '2024-01-08T10:00:00Z' },
        { status: 'no_show', created_at: '2024-01-07T10:00:00Z' },
        { status: 'no_show', created_at: '2024-01-06T10:00:00Z' }
      );
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('HIGH_NO_SHOW_COUNT');
    });

    test('should warn for user with recent cancellations', async () => {
      const recentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(); // 3 days ago
      mockCustomerHistory.push(
        { status: 'cancelled_by_user', created_at: recentDate },
        { status: 'cancelled_by_user', created_at: recentDate }
      );
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('RECENT_CANCELLATIONS');
    });
  });

  describe('Service Availability Validation', () => {
    test('should validate available service', async () => {
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject inactive service', async () => {
      mockService.is_active = false;
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('SERVICE_INACTIVE');
    });

    test('should reject inactive shop', async () => {
      mockShop.is_active = false;
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('SHOP_INACTIVE');
    });

    test('should reject service not offered by shop', async () => {
      mockService.shop_id = 'shop-2';
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('SERVICE_NOT_OFFERED');
    });

    test('should reject unavailable staff', async () => {
      mockStaff.is_active = false;
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        staffId: 'staff-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('STAFF_INACTIVE');
    });

    test('should reject when staff is already booked', async () => {
      // Clear existing bookings and add conflicting booking
      const requestDate = getFutureDate();
      mockExistingBookings.length = 0;
      mockExistingBookings.push({
        id: 'booking-2',
        user_id: 'user-2',
        shop_id: 'shop-1',
        service_id: 'service-1',
        staff_id: 'staff-1',
        date: requestDate,
        time_slot: '14:00',
        quantity: 1,
        status: 'confirmed'
      });

      // Recreate the validation service to use updated mock data
      validationService = new BookingValidationService();

      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        staffId: 'staff-1',
        date: requestDate,
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);



      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('STAFF_UNAVAILABLE');
    });

    test('should reject when capacity is exceeded', async () => {
      mockService.capacity = 1;
      // Clear existing bookings and add conflicting booking
      const requestDate = getFutureDate();
      mockExistingBookings.length = 0;
      mockExistingBookings.push({
        id: 'booking-2',
        user_id: 'user-2',
        shop_id: 'shop-1',
        service_id: 'service-1',
        date: requestDate,
        time_slot: '14:00',
        quantity: 1,
        status: 'confirmed'
      });
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: requestDate,
        timeSlot: '14:00',
        quantity: 1
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INSUFFICIENT_CAPACITY');
    });
  });

  describe('Booking Limits Validation', () => {
    test('should validate booking within limits', async () => {
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject when daily limit exceeded', async () => {
      // Clear existing history and add 3 bookings for today
      mockCustomerHistory.length = 0;
      const today = new Date().toISOString().split('T')[0];
      for (let i = 0; i < 3; i++) {
        mockCustomerHistory.push({
          id: `booking-${i}`,
          user_id: 'user-1',
          shop_id: 'shop-1',
          service_id: 'service-1',
          date: today,
          time_slot: '10:00',
          status: 'confirmed',
          created_at: new Date().toISOString()
        });
      }
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('DAILY_LIMIT_EXCEEDED');
    });

    test('should reject when weekly limit exceeded', async () => {
      // Clear existing history and add 10 bookings for this week (but not today)
      mockCustomerHistory.length = 0;
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      
      // Add 10 bookings starting from tomorrow to avoid today's daily limit
      for (let i = 0; i < 10; i++) {
        const bookingDate = new Date(tomorrow);
        bookingDate.setDate(tomorrow.getDate() + i);
        // Set created_at to yesterday to avoid today's daily limit but still be in this week
        const createdDate = new Date(today);
        createdDate.setDate(today.getDate() - 1);
        mockCustomerHistory.push({
          id: `booking-${i}`,
          user_id: 'user-1',
          shop_id: 'shop-1',
          service_id: 'service-1',
          date: bookingDate.toISOString().split('T')[0],
          time_slot: '10:00',
          status: 'confirmed',
          created_at: createdDate.toISOString()
        });
      }
      // Also clear existing bookings to avoid daily limit conflicts
      mockExistingBookings.length = 0;
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('WEEKLY_LIMIT_EXCEEDED');
    });

    test('should reject when monthly limit exceeded', async () => {
      // Clear existing history and add 30 bookings for this month (but not today)
      mockCustomerHistory.length = 0;
      const monthStart = new Date();
      monthStart.setDate(1);
      for (let i = 1; i <= 30; i++) { // Start from 1 to avoid today
        const bookingDate = new Date(monthStart);
        bookingDate.setDate(monthStart.getDate() + i);
        const createdDate = new Date(bookingDate);
        createdDate.setDate(createdDate.getDate() - 1); // Set created_at to day before the booking date
        mockCustomerHistory.push({
          id: `booking-${i}`,
          user_id: 'user-1',
          shop_id: 'shop-1',
          service_id: 'service-1',
          date: bookingDate.toISOString().split('T')[0],
          time_slot: '10:00',
          status: 'confirmed',
          created_at: createdDate.toISOString()
        });
      }
      // Also clear existing bookings to avoid daily limit conflicts
      mockExistingBookings.length = 0;
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('MONTHLY_LIMIT_EXCEEDED');
    });

    test('should warn for rapid booking attempts', async () => {
      // Clear existing history and add 2 recent bookings
      mockCustomerHistory.length = 0;
      const recentTime = new Date(Date.now() - 2 * 60 * 1000).toISOString(); // 2 minutes ago
      mockCustomerHistory.push(
        { 
          id: 'booking-recent-1',
          user_id: 'user-1',
          shop_id: 'shop-1',
          service_id: 'service-1',
          status: 'confirmed', 
          created_at: recentTime 
        },
        { 
          id: 'booking-recent-2',
          user_id: 'user-1',
          shop_id: 'shop-1',
          service_id: 'service-1',
          status: 'confirmed', 
          created_at: recentTime 
        }
      );
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('RAPID_BOOKING_ATTEMPTS');
    });
  });

  describe('Business Rules Validation', () => {
    test('should validate premium member booking premium slot', async () => {
      mockUser.membership_status = 'premium';
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '10:00' // Premium slot
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('PREMIUM_SLOT_BOOKING');
    });

    test('should reject non-premium member booking premium slot', async () => {
      mockUser.membership_status = 'basic';
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '10:00' // Premium slot
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('PREMIUM_SLOT_RESTRICTED');
    });

    test('should reject regular user booking too far in advance', async () => {
      mockUser.membership_status = 'none';
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 31);
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: futureDate.toISOString().split('T')[0],
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('ADVANCE_BOOKING_RESTRICTED');
    });
  });

  describe('Operational Constraints Validation', () => {
    test('should reject booking with insufficient notice', async () => {
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: new Date().toISOString().split('T')[0],
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('INSUFFICIENT_NOTICE');
    });

    test('should warn for booking outside normal hours', async () => {
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '06:00' // Outside normal hours
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('OUTSIDE_NORMAL_HOURS');
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Temporarily override the mock to simulate database error
      const originalMock = mockSupabaseClient.from;
      mockSupabaseClient.from = jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn().mockRejectedValue(new Error('Database connection failed'))
          }))
        }))
      }));

      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('VALIDATION_ERROR');

      // Restore original mock
      mockSupabaseClient.from = originalMock;
    });

    test('should handle missing user gracefully', async () => {
      // Temporarily override the mock to simulate missing user
      const originalMock = mockSupabaseClient.from;
      mockSupabaseClient.from = jest.fn((tableName: string) => ({
        select: jest.fn(() => ({
          eq: jest.fn((field: string, value: any) => {
            if (tableName === 'users' && field === 'id') {
              return {
                single: jest.fn().mockResolvedValue({ data: null, error: null })
              };
            }
            if (tableName === 'shops' && field === 'id') {
              return {
                single: jest.fn().mockResolvedValue({ data: mockShop, error: null })
              };
            }
            if (tableName === 'services' && field === 'id') {
              return {
                single: jest.fn().mockResolvedValue({ data: mockService, error: null })
              };
            }
            if (tableName === 'reservations') {
              if (field === 'shop_id') {
                return {
                  eq: jest.fn((dateField: string, dateValue: any) => ({
                    in: jest.fn(() => ({
                      mockResolvedValue: jest.fn().mockResolvedValue({ data: [], error: null })
                    }))
                  }))
                };
              }
              if (field === 'user_id') {
                return {
                  order: jest.fn(() => ({
                    limit: jest.fn().mockResolvedValue({ data: [], error: null })
                  }))
                };
              }
            }
            // Default fallback
            return {
              single: jest.fn().mockResolvedValue({ data: null, error: null })
            };
          })
        }))
      }));

      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('USER_NOT_FOUND');

      // Restore original mock
      mockSupabaseClient.from = originalMock;
    });
  });

  describe('Validation Metadata', () => {
    test('should include comprehensive validation metadata', async () => {
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.validationTime).toBeDefined();
      // The validation duration should be >= 0 (can be 0 for very fast operations)
      expect(result.metadata.validationDuration).toBeGreaterThanOrEqual(0);
      expect(result.metadata.checksPerformed).toContain('basic_data_validation');
      expect(result.metadata.checksPerformed).toContain('customer_eligibility');
      expect(result.metadata.checksPerformed).toContain('service_availability');
      expect(result.metadata.checksPerformed).toContain('booking_limits');
      expect(result.metadata.checksPerformed).toContain('business_rules');
      expect(result.metadata.checksPerformed).toContain('operational_constraints');
    });

    test('should include customer eligibility information', async () => {
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.metadata.customerEligibility).toBeDefined();
      expect(result.metadata.customerEligibility.isEligible).toBe(true);
      expect(result.metadata.customerEligibility.membershipStatus).toBe('basic');
      expect(result.metadata.customerEligibility.totalBookings).toBeGreaterThanOrEqual(0);
    });

    test('should include service availability information', async () => {
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.metadata.serviceAvailability).toBeDefined();
      expect(result.metadata.serviceAvailability.isAvailable).toBe(true);
      expect(result.metadata.serviceAvailability.capacity).toBe(10);
      expect(result.metadata.serviceAvailability.price).toBe(50);
    });

    test('should include booking limits information', async () => {
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.metadata.bookingLimits).toBeDefined();
      expect(result.metadata.bookingLimits.dailyLimit).toBe(3);
      expect(result.metadata.bookingLimits.weeklyLimit).toBe(10);
      expect(result.metadata.bookingLimits.monthlyLimit).toBe(30);
      expect(result.metadata.bookingLimits.canBookToday).toBe(true);
    });
  });
}); 