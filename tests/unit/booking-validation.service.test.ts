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

// Persistent mock object
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

import { BookingValidationService, BookingRequest, ValidationResult } from '../../src/services/booking-validation.service';

/**
 * Helper: Setup mock to return different data depending on table name and query path.
 *
 * The service calls:
 * - from('users').select('*').eq('id', ...).single()
 * - from('shops').select('*').eq('id', ...).single()
 * - from('shop_services').select('*').eq('id', ...).single()
 * - from('staff').select('*').eq('id', ...).single()
 * - from('reservations').select('*').eq('shop_id', ...).eq('date', ...).in('status', [...])
 * - from('reservations').select('*').eq('user_id', ...).order(...).limit(...)
 */
function setupTableMocks(config: {
  user?: any;
  shop?: any;
  service?: any;
  staff?: any;
  existingBookings?: any[];
  customerHistory?: any[];
}) {
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

  // Track reservations calls by field to differentiate shop_id vs user_id queries
  let reservationCallIndex = 0;

  mockSupabase.from.mockImplementation((tableName: string) => {
    if (tableName === 'users') {
      return createChain({ data: config.user ?? null, error: config.user ? null : null });
    }
    if (tableName === 'shops') {
      return createChain({ data: config.shop ?? null, error: config.shop ? null : null });
    }
    if (tableName === 'shop_services') {
      return createChain({ data: config.service ?? null, error: config.service ? null : null });
    }
    if (tableName === 'staff') {
      return createChain({ data: config.staff ?? null, error: config.staff ? null : null });
    }
    if (tableName === 'reservations') {
      // buildValidationContext calls getExistingBookings and getCustomerHistory in parallel
      // getExistingBookings: .eq('shop_id', ...).eq('date', ...).in('status', [...])
      // getCustomerHistory:  .eq('user_id', ...).order(...).limit(...)
      // Both resolve via the chain's then handler.
      // We alternate between existingBookings and customerHistory based on call order
      reservationCallIndex++;
      if (reservationCallIndex % 2 === 1) {
        // First reservations call -> getExistingBookings (called via Promise.all)
        return createChain({ data: config.existingBookings ?? [], error: null });
      } else {
        // Second reservations call -> getCustomerHistory
        return createChain({ data: config.customerHistory ?? [], error: null });
      }
    }
    return createChain({ data: null, error: null });
  });
}

describe('BookingValidationService', () => {
  let validationService: BookingValidationService;
  let mockUser: any;
  let mockShop: any;
  let mockService: any;
  let mockStaff: any;
  let mockExistingBookings: any[];
  let mockCustomerHistory: any[];

  const getFutureDate = (daysFromNow: number = 1): string => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetMockSupabase();

    const futureDate = getFutureDate(1);
    const futureWeekDate = getFutureDate(7);

    // Source checks user.user_status (NOT user.status)
    mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      user_status: 'active',
      blacklist_status: 'none',
      credit_limit: 1000,
      current_balance: 0,
      membership_status: 'basic',
      no_show_count: 0
    };

    // Source checks shop.shop_status (NOT shop.is_active)
    mockShop = {
      id: 'shop-1',
      name: 'Test Shop',
      shop_status: 'active',
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

    // Source checks service.is_available (NOT service.is_active)
    // Source queries 'shop_services' table (NOT 'services')
    mockService = {
      id: 'service-1',
      shop_id: 'shop-1',
      is_available: true,
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
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    // Setup default mocks
    setupTableMocks({
      user: mockUser,
      shop: mockShop,
      service: mockService,
      staff: mockStaff,
      existingBookings: mockExistingBookings,
      customerHistory: mockCustomerHistory
    });

    validationService = new BookingValidationService();
  });

  describe('Basic Data Validation', () => {
    test('should validate valid booking request', async () => {
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00',
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
        timeSlot: '10:00:00'
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
      // quantity > 10 triggers HIGH_QUANTITY warning
      mockService.capacity = 15;
      setupTableMocks({
        user: mockUser,
        shop: mockShop,
        service: mockService,
        staff: mockStaff,
        existingBookings: [],
        customerHistory: mockCustomerHistory
      });
      validationService = new BookingValidationService();

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
      expect(result.warnings.some(w => w.code === 'HIGH_QUANTITY')).toBe(true);
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
      // Source checks user.user_status !== 'active'
      mockUser.user_status = 'inactive';
      setupTableMocks({
        user: mockUser,
        shop: mockShop,
        service: mockService,
        staff: mockStaff,
        existingBookings: mockExistingBookings,
        customerHistory: mockCustomerHistory
      });
      validationService = new BookingValidationService();

      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'USER_INACTIVE')).toBe(true);
    });

    test('should reject permanently blacklisted user', async () => {
      mockUser.blacklist_status = 'permanent';
      setupTableMocks({
        user: mockUser, shop: mockShop, service: mockService, staff: mockStaff,
        existingBookings: mockExistingBookings, customerHistory: mockCustomerHistory
      });
      validationService = new BookingValidationService();

      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'USER_BLACKLISTED_PERMANENT')).toBe(true);
    });

    test('should reject temporarily blacklisted user', async () => {
      mockUser.blacklist_status = 'temporary';
      mockUser.blacklist_until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      setupTableMocks({
        user: mockUser, shop: mockShop, service: mockService, staff: mockStaff,
        existingBookings: mockExistingBookings, customerHistory: mockCustomerHistory
      });
      validationService = new BookingValidationService();

      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'USER_BLACKLISTED_TEMPORARY')).toBe(true);
    });

    test('should reject user with exceeded credit limit', async () => {
      mockUser.current_balance = 1000;
      mockUser.credit_limit = 1000;
      setupTableMocks({
        user: mockUser, shop: mockShop, service: mockService, staff: mockStaff,
        existingBookings: mockExistingBookings, customerHistory: mockCustomerHistory
      });
      validationService = new BookingValidationService();

      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'CREDIT_LIMIT_EXCEEDED')).toBe(true);
    });

    test('should warn for user with high no-show count', async () => {
      // Source: noShowCount >= 3 triggers HIGH_NO_SHOW_COUNT warning
      const historyWithNoShows = [
        ...mockCustomerHistory,
        { status: 'no_show', created_at: '2024-01-08T10:00:00Z' },
        { status: 'no_show', created_at: '2024-01-07T10:00:00Z' },
        { status: 'no_show', created_at: '2024-01-06T10:00:00Z' }
      ];
      setupTableMocks({
        user: mockUser, shop: mockShop, service: mockService, staff: mockStaff,
        existingBookings: mockExistingBookings, customerHistory: historyWithNoShows
      });
      validationService = new BookingValidationService();

      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.code === 'HIGH_NO_SHOW_COUNT')).toBe(true);
    });

    test('should warn for user with recent cancellations', async () => {
      const recentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const historyWithCancellations = [
        ...mockCustomerHistory,
        { status: 'cancelled_by_user', created_at: recentDate },
        { status: 'cancelled_by_user', created_at: recentDate }
      ];
      setupTableMocks({
        user: mockUser, shop: mockShop, service: mockService, staff: mockStaff,
        existingBookings: mockExistingBookings, customerHistory: historyWithCancellations
      });
      validationService = new BookingValidationService();

      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.code === 'RECENT_CANCELLATIONS')).toBe(true);
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
      // Source checks !service.is_available
      mockService.is_available = false;
      setupTableMocks({
        user: mockUser, shop: mockShop, service: mockService, staff: mockStaff,
        existingBookings: mockExistingBookings, customerHistory: mockCustomerHistory
      });
      validationService = new BookingValidationService();

      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'SERVICE_INACTIVE')).toBe(true);
    });

    test('should reject inactive shop', async () => {
      // Source checks shop.shop_status !== 'active'
      mockShop.shop_status = 'inactive';
      setupTableMocks({
        user: mockUser, shop: mockShop, service: mockService, staff: mockStaff,
        existingBookings: mockExistingBookings, customerHistory: mockCustomerHistory
      });
      validationService = new BookingValidationService();

      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'SHOP_INACTIVE')).toBe(true);
    });

    test('should reject service not offered by shop', async () => {
      mockService.shop_id = 'shop-2'; // Different from request's shopId
      setupTableMocks({
        user: mockUser, shop: mockShop, service: mockService, staff: mockStaff,
        existingBookings: mockExistingBookings, customerHistory: mockCustomerHistory
      });
      validationService = new BookingValidationService();

      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'SERVICE_NOT_OFFERED')).toBe(true);
    });

    test('should reject unavailable staff', async () => {
      mockStaff.is_active = false;
      setupTableMocks({
        user: mockUser, shop: mockShop, service: mockService, staff: mockStaff,
        existingBookings: mockExistingBookings, customerHistory: mockCustomerHistory
      });
      validationService = new BookingValidationService();

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
      expect(result.errors.some(e => e.code === 'STAFF_INACTIVE')).toBe(true);
    });

    test('should reject when staff is already booked', async () => {
      const requestDate = getFutureDate();
      const bookings = [{
        id: 'booking-2',
        user_id: 'user-2',
        shop_id: 'shop-1',
        service_id: 'service-1',
        staff_id: 'staff-1',
        date: requestDate,
        time_slot: '14:00',
        quantity: 1,
        status: 'confirmed'
      }];
      setupTableMocks({
        user: mockUser, shop: mockShop, service: mockService, staff: mockStaff,
        existingBookings: bookings, customerHistory: mockCustomerHistory
      });
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
      expect(result.errors.some(e => e.code === 'STAFF_UNAVAILABLE')).toBe(true);
    });

    test('should reject when capacity is exceeded', async () => {
      mockService.capacity = 1;
      const requestDate = getFutureDate();
      const bookings = [{
        id: 'booking-2',
        user_id: 'user-2',
        shop_id: 'shop-1',
        service_id: 'service-1',
        date: requestDate,
        time_slot: '14:00',
        quantity: 1,
        status: 'confirmed'
      }];
      setupTableMocks({
        user: mockUser, shop: mockShop, service: mockService, staff: mockStaff,
        existingBookings: bookings, customerHistory: mockCustomerHistory
      });
      validationService = new BookingValidationService();

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
      expect(result.errors.some(e => e.code === 'INSUFFICIENT_CAPACITY')).toBe(true);
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
      // Source: dailyLimit is 99 (checked as dailyBookings >= 99)
      // We need 99 bookings with created_at >= today
      const history: any[] = [];
      for (let i = 0; i < 99; i++) {
        history.push({
          id: `booking-${i}`,
          user_id: 'user-1',
          shop_id: 'shop-1',
          service_id: 'service-1',
          date: getFutureDate(),
          time_slot: '10:00',
          status: 'confirmed',
          created_at: new Date().toISOString()
        });
      }
      setupTableMocks({
        user: mockUser, shop: mockShop, service: mockService, staff: mockStaff,
        existingBookings: [], customerHistory: history
      });
      validationService = new BookingValidationService();

      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'DAILY_LIMIT_EXCEEDED')).toBe(true);
    });

    test('should reject when weekly limit exceeded', async () => {
      // Source: weeklyLimit is 99 (checked as weeklyBookings >= 99)
      // We need 99 bookings with created_at >= weekStart
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const history: any[] = [];
      for (let i = 0; i < 99; i++) {
        // Set created_at to start of this week but NOT today
        // to trigger weekly but not daily limit
        const createdAt = new Date(weekStart.getTime() + 1000);
        history.push({
          id: `booking-${i}`,
          user_id: 'user-1',
          shop_id: 'shop-1',
          service_id: 'service-1',
          date: getFutureDate(),
          time_slot: '10:00',
          status: 'confirmed',
          created_at: createdAt.toISOString()
        });
      }
      setupTableMocks({
        user: mockUser, shop: mockShop, service: mockService, staff: mockStaff,
        existingBookings: [], customerHistory: history
      });
      validationService = new BookingValidationService();

      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'WEEKLY_LIMIT_EXCEEDED')).toBe(true);
    });

    test('should reject when monthly limit exceeded', async () => {
      // Source: monthlyLimit is 99 (checked as monthlyBookings >= 99)
      // We need 99 bookings with created_at >= monthStart
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const history: any[] = [];
      for (let i = 0; i < 99; i++) {
        const createdAt = new Date(monthStart.getTime() + 1000);
        history.push({
          id: `booking-${i}`,
          user_id: 'user-1',
          shop_id: 'shop-1',
          service_id: 'service-1',
          date: getFutureDate(),
          time_slot: '10:00',
          status: 'confirmed',
          created_at: createdAt.toISOString()
        });
      }
      setupTableMocks({
        user: mockUser, shop: mockShop, service: mockService, staff: mockStaff,
        existingBookings: [], customerHistory: history
      });
      validationService = new BookingValidationService();

      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'MONTHLY_LIMIT_EXCEEDED')).toBe(true);
    });

    test('should warn for rapid booking attempts', async () => {
      // Source: recentBookings >= 2 (within last 5 minutes) triggers warning
      const recentTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const history = [
        { id: 'booking-recent-1', user_id: 'user-1', status: 'confirmed', created_at: recentTime },
        { id: 'booking-recent-2', user_id: 'user-1', status: 'confirmed', created_at: recentTime }
      ];
      setupTableMocks({
        user: mockUser, shop: mockShop, service: mockService, staff: mockStaff,
        existingBookings: [], customerHistory: history
      });
      validationService = new BookingValidationService();

      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.warnings.some(w => w.code === 'RAPID_BOOKING_ATTEMPTS')).toBe(true);
    });
  });

  describe('Business Rules Validation', () => {
    test('should allow advance booking within limit for regular user', async () => {
      // Source: only business rule is advance_booking_restrictions
      // Regular users (membership_status === 'none') can book up to 30 days
      mockUser.membership_status = 'basic'; // 'basic' is NOT 'none', so no restriction
      setupTableMocks({
        user: mockUser, shop: mockShop, service: mockService, staff: mockStaff,
        existingBookings: mockExistingBookings, customerHistory: mockCustomerHistory
      });
      validationService = new BookingValidationService();

      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(10),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(true);
    });

    test('should reject regular user booking too far in advance', async () => {
      // Source: membership_status === 'none' and daysDifference > 30
      mockUser.membership_status = 'none';
      setupTableMocks({
        user: mockUser, shop: mockShop, service: mockService, staff: mockStaff,
        existingBookings: mockExistingBookings, customerHistory: mockCustomerHistory
      });
      validationService = new BookingValidationService();

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
      expect(result.errors.some(e => e.code === 'ADVANCE_BOOKING_RESTRICTED')).toBe(true);
    });

    test('should warn for booking outside normal hours', async () => {
      // Source: bookingDateTime.getHours() < 8 || > 20 triggers OUTSIDE_NORMAL_HOURS warning
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '06:00'
      };

      const result = await validationService.validateBookingRequest(request);

      // Note: even if isValid, there should be OUTSIDE_NORMAL_HOURS warning
      expect(result.warnings.some(w => w.code === 'OUTSIDE_NORMAL_HOURS')).toBe(true);
    });
  });

  describe('Operational Constraints Validation', () => {
    test('should reject booking with insufficient notice', async () => {
      // Source: hoursDifference < 2 triggers INSUFFICIENT_NOTICE
      // Booking for today at 14:00 when it's already past or within 2 hours
      const now = new Date();
      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: now.toISOString().split('T')[0],
        timeSlot: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'INSUFFICIENT_NOTICE')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      // Override from to throw on every call
      mockSupabase.from.mockImplementation(() => {
        const chain: any = {};
        ['select','insert','update','upsert','delete','eq','neq','gt','gte','lt','lte',
         'like','ilike','is','in','not','contains','containedBy','overlaps',
         'filter','match','or','and','order','limit','range','offset','count',
         'single','maybeSingle','csv','returns','textSearch','throwOnError'
        ].forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
        chain.then = (_: any, reject: any) => {
          if (reject) return reject(new Error('Database connection failed'));
          throw new Error('Database connection failed');
        };
        chain.single = jest.fn().mockRejectedValue(new Error('Database connection failed'));
        return chain;
      });
      validationService = new BookingValidationService();

      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'VALIDATION_ERROR')).toBe(true);
    });

    test('should handle missing user gracefully', async () => {
      setupTableMocks({
        user: null, // User not found
        shop: mockShop,
        service: mockService,
        staff: mockStaff,
        existingBookings: mockExistingBookings,
        customerHistory: mockCustomerHistory
      });
      validationService = new BookingValidationService();

      const request: BookingRequest = {
        userId: 'user-1',
        shopId: 'shop-1',
        serviceId: 'service-1',
        date: getFutureDate(),
        timeSlot: '14:00'
      };

      const result = await validationService.validateBookingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.code === 'USER_NOT_FOUND')).toBe(true);
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
      // Source uses 99 for all limits
      expect(result.metadata.bookingLimits.dailyLimit).toBe(99);
      expect(result.metadata.bookingLimits.weeklyLimit).toBe(99);
      expect(result.metadata.bookingLimits.monthlyLimit).toBe(99);
      expect(result.metadata.bookingLimits.canBookToday).toBe(true);
    });
  });
});
