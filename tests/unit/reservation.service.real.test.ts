/**
 * Comprehensive Reservation Service Unit Tests
 *
 * Tests reservation service with mocked Supabase database.
 * Covers creation, retrieval, validation, and concurrent booking prevention.
 */

// Persistent mock object -- the service singleton captures this reference at module load
const mockSupabase: any = {};

function createChainMock(resolvedValue: { data: any; error: any; count?: any } = { data: null, error: null }) {
  const chain: any = { _resolvedValue: resolvedValue };
  [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'is', 'in', 'not',
    'contains', 'containedBy', 'overlaps',
    'filter', 'match', 'or', 'and',
    'order', 'limit', 'range', 'offset', 'count',
    'single', 'maybeSingle',
    'csv', 'returns', 'textSearch', 'throwOnError',
  ].forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
  chain.then = (resolve: any) => resolve(chain._resolvedValue);
  return chain;
}

function resetMockSupabase() {
  const defaultChain = createChainMock({ data: null, error: null });
  mockSupabase.from = jest.fn().mockReturnValue(defaultChain);
  mockSupabase.rpc = jest.fn().mockResolvedValue({ data: null, error: null });
  mockSupabase.auth = {
    getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    admin: { getUserById: jest.fn(), listUsers: jest.fn(), deleteUser: jest.fn() },
  };
  mockSupabase.storage = { from: jest.fn(() => ({ upload: jest.fn(), getPublicUrl: jest.fn() })) };
}
resetMockSupabase();

// Mock database module
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn(() => mockSupabase),
  initializeDatabase: jest.fn(() => ({ client: mockSupabase })),
  getDatabase: jest.fn(() => ({ client: mockSupabase })),
  database: { getClient: jest.fn(() => mockSupabase) },
}));

// Mock time slot service
jest.mock('../../src/services/time-slot.service', () => ({
  timeSlotService: {
    isSlotAvailable: jest.fn(),
    getAvailableTimeSlots: jest.fn(),
    getNextAvailableSlot: jest.fn(),
    validateSlotAvailability: jest.fn(),
  },
}));

// Mock shop owner notification service
jest.mock('../../src/services/shop-owner-notification.service', () => ({
  shopOwnerNotificationService: {
    sendReservationNotification: jest.fn().mockResolvedValue({ success: true }),
    sendStateChangeNotification: jest.fn().mockResolvedValue({ success: true }),
    notifyShopOwnerOfNewRequest: jest.fn().mockResolvedValue({ success: true }),
  },
}));

// Mock customer notification service
jest.mock('../../src/services/customer-notification.service', () => ({
  customerNotificationService: {
    notifyCustomerOfReservationUpdate: jest.fn().mockResolvedValue({ success: true }),
  },
}));

// Mock query cache service
jest.mock('../../src/services/query-cache.service', () => ({
  queryCacheService: {
    getCachedQuery: jest.fn((_key: string, fetcher: () => Promise<any>) => fetcher()),
    invalidateCache: jest.fn(),
  },
}));

// Mock batch query service
jest.mock('../../src/services/batch-query.service', () => ({
  batchQueryService: {},
}));

// Mock websocket service
jest.mock('../../src/services/websocket.service', () => ({
  websocketService: {
    broadcastReservationUpdate: jest.fn(),
  },
}));

// Mock point service
jest.mock('../../src/services/point.service', () => ({
  PointService: jest.fn().mockImplementation(() => ({
    deductPoints: jest.fn().mockResolvedValue({ success: true }),
  })),
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { ReservationService, CreateReservationRequest } from '../../src/services/reservation.service';
import { timeSlotService } from '../../src/services/time-slot.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set up the mock so that `from('users')` returns user data while
 *  other `from(...)` calls return a default chainable mock. */
function setupUserBookingPreferencesQuery(prefs: any = {}) {
  const userChain = createChainMock({
    data: { booking_preferences: prefs },
    error: null,
  });
  return userChain;
}

/** Build a `from(...)` dispatcher that returns different chains per table name. */
function setupFromDispatcher(tableChains: Record<string, any>) {
  const defaultChain = createChainMock({ data: null, error: null });
  mockSupabase.from.mockImplementation((table: string) => {
    return tableChains[table] || defaultChain;
  });
}

/** Return a chain that resolves to the given service data for shop_services queries. */
function setupServiceChain(services: any[]) {
  return createChainMock({ data: services, error: null });
}

/** Set up all mocks needed for a successful createReservation call. */
function setupSuccessfulCreation(options: {
  reservationId?: string;
  shopId?: string;
  userId?: string;
  totalAmount?: number;
  depositAmount?: number;
  status?: string;
  specialRequests?: string;
  serviceData?: any[];
  userPrefs?: any;
} = {}) {
  const {
    reservationId = 'reservation-123',
    shopId = 'shop-001',
    userId = 'user-001',
    totalAmount = 30000,
    depositAmount = 10000,
    status = 'requested',
    specialRequests = undefined,
    serviceData = [
      { id: 'service-001', price_min: 30000, name: 'Test Service', deposit_amount: 10000, deposit_percentage: 20 },
    ],
    userPrefs = {},
  } = options;

  const mockTimeSlot = timeSlotService as jest.Mocked<typeof timeSlotService>;
  mockTimeSlot.validateSlotAvailability.mockResolvedValue({
    available: true,
    conflictReason: null,
    conflictingReservations: [],
  });

  const userChain = setupUserBookingPreferencesQuery(userPrefs);
  const serviceChain = setupServiceChain(serviceData);
  const shopChain = createChainMock({ data: { id: shopId, name: 'Test Shop' }, error: null });
  const reservationServicesChain = createChainMock({ data: [], error: null });
  const customerUserChain = createChainMock({
    data: { id: userId, name: 'Test User', nickname: 'Test', email: 'test@example.com', phone_number: '+821012345678', profile_image_url: null },
    error: null,
  });
  // For reservation_services insert and reservations update (booking_preferences / points_used)
  const defaultWriteChain = createChainMock({ data: null, error: null });

  // We need the from dispatcher to handle multiple sequential calls.
  // The createReservation flow calls from() for:
  //   1. 'users' (booking preferences)
  //   2. 'shop_services' (pricing - via queryCacheService which calls fetcher directly)
  //   3. 'reservations' (update booking_preferences)
  //   4. 'reservation_services' (insert)
  //   5. 'shops' (customer notification)
  //   6. 'reservation_services' (customer notification)
  //   7. 'users' (websocket - customer details)
  const callCounts: Record<string, number> = {};
  mockSupabase.from.mockImplementation((table: string) => {
    callCounts[table] = (callCounts[table] || 0) + 1;
    if (table === 'users') {
      // First call: booking preferences; later calls: customer details for websocket
      if (callCounts[table] === 1) return userChain;
      return customerUserChain;
    }
    if (table === 'shop_services') return serviceChain;
    if (table === 'shops') return shopChain;
    if (table === 'reservation_services') return reservationServicesChain;
    if (table === 'reservations') return defaultWriteChain;
    return defaultWriteChain;
  });

  // RPC returns reservation data
  const reservationData = {
    id: reservationId,
    shop_id: shopId,
    user_id: userId,
    reservation_date: '2026-12-25',
    reservation_time: '14:00',
    status,
    total_amount: totalAmount,
    deposit_amount: depositAmount,
    remaining_amount: totalAmount - depositAmount,
    points_used: 0,
    special_requests: specialRequests || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockSupabase.rpc.mockResolvedValue({ data: reservationData, error: null });

  return { reservationData };
}

describe('Reservation Service - Comprehensive Unit Tests', () => {
  let reservationService: ReservationService;
  let mockTimeSlotService: jest.Mocked<typeof timeSlotService>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetMockSupabase();
    reservationService = new ReservationService();
    mockTimeSlotService = timeSlotService as jest.Mocked<typeof timeSlotService>;
  });

  describe('Reservation Creation', () => {
    it('should create a reservation successfully with valid data', async () => {
      const { reservationData } = setupSuccessfulCreation({
        specialRequests: 'Please call before arrival',
      });

      const request: CreateReservationRequest = {
        shopId: 'shop-001',
        userId: 'user-001',
        services: [{ serviceId: 'service-001', quantity: 1 }],
        reservationDate: '2026-12-25',
        reservationTime: '14:00',
        specialRequests: 'Please call before arrival',
        pointsToUse: 0,
      };

      const result = await reservationService.createReservation(request);

      expect(result).toBeDefined();
      expect(result.id).toBe('reservation-123');
      expect(result.shop_id || (result as any).shopId).toBeTruthy();
      expect(result.user_id || (result as any).userId).toBeTruthy();
      expect(result.status).toBe('requested');
      expect(result.total_amount || (result as any).totalAmount).toBeGreaterThan(0);
      expect(result.deposit_amount || (result as any).depositAmount).toBeGreaterThan(0);
      expect(result.special_requests || (result as any).specialRequests).toBe('Please call before arrival');
    });

    it('should calculate pricing correctly based on service data', async () => {
      setupSuccessfulCreation({
        serviceData: [
          { id: 'service-001', price_min: 30000, name: 'Test Service', deposit_amount: 10000, deposit_percentage: 20 },
        ],
      });

      const request: CreateReservationRequest = {
        shopId: 'shop-001',
        userId: 'user-001',
        services: [{ serviceId: 'service-001', quantity: 1 }],
        reservationDate: '2026-12-25',
        reservationTime: '14:00',
      };

      // Test pricing calculation directly
      const pricing = await reservationService.calculatePricingWithDeposit(request);

      expect(pricing.totalAmount).toBe(30000);
      expect(pricing.depositAmount).toBe(10000);
      expect(pricing.remainingAmount).toBe(20000);
    });

    it('should apply points discount correctly', async () => {
      const pointsToUse = 1000;
      setupSuccessfulCreation({
        serviceData: [
          { id: 'service-001', price_min: 30000, name: 'Test Service', deposit_amount: 10000, deposit_percentage: 20 },
        ],
      });

      const request: CreateReservationRequest = {
        shopId: 'shop-001',
        userId: 'user-001',
        services: [{ serviceId: 'service-001', quantity: 1 }],
        reservationDate: '2026-12-25',
        reservationTime: '14:00',
        pointsToUse,
      };

      const pricing = await reservationService.calculatePricingWithDeposit(request);

      // Total is reduced by points
      expect(pricing.totalAmount).toBe(30000 - pointsToUse);
      expect(pricing.depositCalculationDetails.appliedDiscounts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'points', amount: pointsToUse }),
        ])
      );
    });

    it('should handle multiple services correctly', async () => {
      setupSuccessfulCreation({
        serviceData: [
          { id: 'service-001', price_min: 30000, name: 'Test Service 1', deposit_amount: 10000, deposit_percentage: 20 },
          { id: 'service-002', price_min: 20000, name: 'Test Service 2', deposit_amount: 5000, deposit_percentage: 20 },
        ],
      });

      const request: CreateReservationRequest = {
        shopId: 'shop-001',
        userId: 'user-001',
        services: [
          { serviceId: 'service-001', quantity: 1 },
          { serviceId: 'service-002', quantity: 1 },
        ],
        reservationDate: '2026-12-25',
        reservationTime: '14:00',
      };

      const pricing = await reservationService.calculatePricingWithDeposit(request);

      // Total should be sum of both services
      expect(pricing.totalAmount).toBe(50000);
      // Deposit is sum of individual service deposits (both clamped to min 10000)
      expect(pricing.depositAmount).toBe(pricing.depositCalculationDetails.totalServiceDeposit);
    });

    it('should reject reservation with invalid shop ID', async () => {
      const request: CreateReservationRequest = {
        shopId: '',
        userId: 'user-001',
        services: [{ serviceId: 'service-001', quantity: 1 }],
        reservationDate: '2026-12-25',
        reservationTime: '14:00',
      };

      await expect(reservationService.createReservation(request))
        .rejects.toThrow('Shop ID and User ID are required');
    });

    it('should reject reservation with invalid user ID', async () => {
      const request: CreateReservationRequest = {
        shopId: 'shop-001',
        userId: '',
        services: [{ serviceId: 'service-001', quantity: 1 }],
        reservationDate: '2026-12-25',
        reservationTime: '14:00',
      };

      await expect(reservationService.createReservation(request))
        .rejects.toThrow('Shop ID and User ID are required');
    });

    it('should reject reservation with invalid service ID', async () => {
      const request: CreateReservationRequest = {
        shopId: 'shop-001',
        userId: 'user-001',
        services: [{ serviceId: '', quantity: 1 }],
        reservationDate: '2026-12-25',
        reservationTime: '14:00',
      };

      await expect(reservationService.createReservation(request))
        .rejects.toThrow('Service ID is required for all services');
    });

    it('should reject reservation with insufficient points via RPC error', async () => {
      // Setup: validation passes, user fetched OK, slot available, pricing OK
      setupSuccessfulCreation();

      // Override RPC to return INSUFFICIENT_AMOUNT error
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'INSUFFICIENT_AMOUNT: Points used cannot exceed total amount' },
      });

      const request: CreateReservationRequest = {
        shopId: 'shop-001',
        userId: 'user-001',
        services: [{ serviceId: 'service-001', quantity: 1 }],
        reservationDate: '2026-12-25',
        reservationTime: '14:00',
        pointsToUse: 100000,
      };

      await expect(reservationService.createReservation(request))
        .rejects.toThrow('Points used cannot exceed total amount');
    });

    it('should reject reservation when user profile fetch fails', async () => {
      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: [],
      });

      // User query returns error
      const userChain = createChainMock({
        data: null,
        error: { message: 'User not found' },
      });
      mockSupabase.from.mockReturnValue(userChain);

      const request: CreateReservationRequest = {
        shopId: 'shop-001',
        userId: 'invalid-user-id',
        services: [{ serviceId: 'service-001', quantity: 1 }],
        reservationDate: '2026-12-25',
        reservationTime: '14:00',
      };

      await expect(reservationService.createReservation(request))
        .rejects.toThrow('Failed to verify user profile information');
    });

    it('should reject reservation outside operating hours (slot unavailable)', async () => {
      // User query succeeds
      const userChain = setupUserBookingPreferencesQuery({});
      mockSupabase.from.mockReturnValue(userChain);

      // Slot validation fails
      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: false,
        conflictReason: 'Shop is closed at this time',
        conflictingReservations: [],
      });

      const request: CreateReservationRequest = {
        shopId: 'shop-001',
        userId: 'user-001',
        services: [{ serviceId: 'service-001', quantity: 1 }],
        reservationDate: '2026-12-25',
        reservationTime: '20:00',
      };

      await expect(reservationService.createReservation(request))
        .rejects.toThrow('Selected time slot is no longer available');
    });
  });

  describe('Reservation Retrieval', () => {
    it('should retrieve reservation by ID', async () => {
      const reservationData = {
        id: 'reservation-123',
        shop_id: 'shop-001',
        user_id: 'user-001',
        reservation_date: '2026-12-25',
        reservation_time: '14:00',
        status: 'requested',
        total_amount: 30000,
        deposit_amount: 10000,
        remaining_amount: 20000,
        points_used: 0,
        special_requests: 'Test reservation',
        booking_preferences: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        shops: { id: 'shop-001', name: 'Test Shop', description: null, phone_number: null, email: null, address: null, detailed_address: null, postal_code: null, latitude: null, longitude: null, main_category: null, operating_hours: null, kakao_channel_url: null },
        reservation_services: [],
        payments: [],
      };

      const chain = createChainMock({ data: reservationData, error: null });
      mockSupabase.from.mockReturnValue(chain);

      const result = await reservationService.getReservationById('reservation-123');

      expect(result).toBeDefined();
      expect(result.id).toBe('reservation-123');
      expect(result.shopId).toBe('shop-001');
      expect(result.userId).toBe('user-001');
      expect(result.specialRequests).toBe('Test reservation');
    });

    it('should return null for non-existent reservation ID', async () => {
      // Single query returns PGRST116 (no rows)
      const chain = createChainMock({
        data: null,
        error: { message: 'No rows found', code: 'PGRST116' },
      });
      mockSupabase.from.mockReturnValue(chain);

      const result = await reservationService.getReservationById('non-existent-id');
      expect(result).toBeNull();
    });

    it('should retrieve reservations by user ID', async () => {
      const reservationsData = [
        {
          id: 'reservation-123',
          shop_id: 'shop-001',
          user_id: 'user-001',
          reservation_date: '2026-12-25',
          reservation_time: '14:00',
          status: 'requested',
          total_amount: 30000,
          deposit_amount: 10000,
          remaining_amount: 20000,
          points_used: 0,
          special_requests: null,
          booking_preferences: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          shops: { id: 'shop-001', name: 'Test Shop', address: null, phone_number: null },
          reservation_services: [],
        },
      ];

      const chain = createChainMock({ data: reservationsData, error: null, count: 1 });
      mockSupabase.from.mockReturnValue(chain);

      const result = await reservationService.getUserReservations('user-001');

      expect(result).toBeDefined();
      expect(result.reservations).toBeDefined();
      expect(Array.isArray(result.reservations)).toBe(true);
      expect(result.reservations.length).toBeGreaterThan(0);
      expect(result.reservations[0].userId).toBe('user-001');
    });

    it('should retrieve reservations filtered by shop ID', async () => {
      const reservationsData = [
        {
          id: 'reservation-456',
          shop_id: 'shop-001',
          user_id: 'user-001',
          reservation_date: '2026-12-25',
          reservation_time: '14:00',
          status: 'requested',
          total_amount: 30000,
          deposit_amount: 10000,
          remaining_amount: 20000,
          points_used: 0,
          special_requests: null,
          booking_preferences: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          shops: { id: 'shop-001', name: 'Test Shop', address: null, phone_number: null },
          reservation_services: [],
        },
      ];

      const chain = createChainMock({ data: reservationsData, error: null, count: 1 });
      mockSupabase.from.mockReturnValue(chain);

      const result = await reservationService.getUserReservations('user-001', { shopId: 'shop-001' });

      expect(result).toBeDefined();
      expect(result.reservations).toBeDefined();
      expect(Array.isArray(result.reservations)).toBe(true);
      expect(result.reservations.length).toBeGreaterThan(0);
      expect(result.reservations[0].shopId).toBe('shop-001');
    });
  });

  describe('Reservation Cancellation', () => {
    it('should cancel a reservation successfully', async () => {
      // Mock getReservationById (called by canCancelReservation)
      const reservationForCheck = {
        id: 'reservation-123',
        shop_id: 'shop-001',
        user_id: 'user-001',
        reservation_date: '2099-12-25',
        reservation_time: '14:00',
        status: 'requested',
        total_amount: 30000,
        deposit_amount: 10000,
        remaining_amount: 20000,
        points_used: 0,
        special_requests: null,
        booking_preferences: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        shops: null,
        reservation_services: [],
        payments: [],
      };

      const cancelledReservation = {
        id: 'reservation-123',
        shop_id: 'shop-001',
        user_id: 'user-001',
        reservation_date: '2099-12-25',
        reservation_time: '14:00',
        status: 'cancelled',
        total_amount: 30000,
        deposit_amount: 10000,
        remaining_amount: 20000,
        points_used: 0,
        special_requests: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // First from('reservations') call: getReservationById -> returns reservation data
      // Second from('reservations') call: update -> returns cancelled data
      // Third from('enhanced_cancellation_audit_log') call: audit trail insert
      let fromCallCount = 0;
      const getByIdChain = createChainMock({ data: reservationForCheck, error: null });
      const updateChain = createChainMock({ data: cancelledReservation, error: null });
      const auditChain = createChainMock({ data: null, error: null });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'reservations') {
          fromCallCount++;
          if (fromCallCount === 1) return getByIdChain;
          return updateChain;
        }
        if (table === 'enhanced_cancellation_audit_log') return auditChain;
        return createChainMock({ data: null, error: null });
      });

      const result = await reservationService.cancelReservation('reservation-123', 'user-001', 'Test cancellation');

      expect(result).toBeDefined();
      expect(result.status).toBe('cancelled');
    });

    it('should reject cancellation for non-cancellable status', async () => {
      const completedReservation = {
        id: 'reservation-123',
        shopId: 'shop-001',
        userId: 'user-001',
        reservationDate: '2026-12-25',
        reservationTime: '14:00',
        status: 'completed',
        totalAmount: 30000,
        depositAmount: 10000,
        remainingAmount: 20000,
        pointsUsed: 0,
        specialRequests: null,
        bookingPreferences: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        shop: null,
        services: [],
        payments: [],
      };

      // getReservationById via queryCacheService calls fetcher -> from('reservations')
      const chain = createChainMock({
        data: {
          ...completedReservation,
          shop_id: 'shop-001',
          user_id: 'user-001',
          reservation_date: '2026-12-25',
          reservation_time: '14:00',
          total_amount: 30000,
          deposit_amount: 10000,
          remaining_amount: 20000,
          points_used: 0,
          special_requests: null,
          booking_preferences: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          shops: null,
          reservation_services: [],
          payments: [],
        },
        error: null,
      });
      mockSupabase.from.mockReturnValue(chain);

      await expect(
        reservationService.cancelReservation('reservation-123', 'user-001')
      ).rejects.toThrow('Reservation cannot be cancelled in its current state');
    });

    it('should reject cancellation for wrong user', async () => {
      const chain = createChainMock({
        data: {
          id: 'reservation-123',
          shop_id: 'shop-001',
          user_id: 'user-001',
          reservation_date: '2099-12-25',
          reservation_time: '14:00',
          status: 'requested',
          total_amount: 30000,
          deposit_amount: 10000,
          remaining_amount: 20000,
          points_used: 0,
          special_requests: null,
          booking_preferences: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          shops: null,
          reservation_services: [],
          payments: [],
        },
        error: null,
      });
      mockSupabase.from.mockReturnValue(chain);

      await expect(
        reservationService.cancelReservation('reservation-123', 'wrong-user')
      ).rejects.toThrow('You can only cancel your own reservations');
    });
  });

  describe('Business Logic Validation', () => {
    it('should validate service availability via pricing (missing service returns error)', async () => {
      // Setup: validation passes, user prefs OK, slot available
      const userChain = setupUserBookingPreferencesQuery({});
      const serviceChain = createChainMock({ data: [], error: null }); // No services returned

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'users') return userChain;
        if (table === 'shop_services') return serviceChain;
        return createChainMock({ data: null, error: null });
      });

      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: [],
      });

      const request: CreateReservationRequest = {
        shopId: 'shop-001',
        userId: 'user-001',
        services: [{ serviceId: 'nonexistent-service', quantity: 1 }],
        reservationDate: '2026-12-25',
        reservationTime: '14:00',
      };

      await expect(reservationService.createReservation(request))
        .rejects.toThrow('Service with ID nonexistent-service not found');
    });

    it('should validate service quantity limits', async () => {
      const request: CreateReservationRequest = {
        shopId: 'shop-001',
        userId: 'user-001',
        services: [{ serviceId: 'service-001', quantity: 0 }],
        reservationDate: '2026-12-25',
        reservationTime: '14:00',
      };

      await expect(reservationService.createReservation(request))
        .rejects.toThrow('Service quantity must be greater than 0');
    });

    it('should validate reservation time format', async () => {
      const request: CreateReservationRequest = {
        shopId: 'shop-001',
        userId: 'user-001',
        services: [{ serviceId: 'service-001', quantity: 1 }],
        reservationDate: '2026-12-25',
        reservationTime: 'invalid-time',
      };

      await expect(reservationService.createReservation(request))
        .rejects.toThrow('Invalid time format. Use HH:MM');
    });

    it('should validate reservation date format', async () => {
      const request: CreateReservationRequest = {
        shopId: 'shop-001',
        userId: 'user-001',
        services: [{ serviceId: 'service-001', quantity: 1 }],
        reservationDate: 'invalid-date',
        reservationTime: '14:00',
      };

      await expect(reservationService.createReservation(request))
        .rejects.toThrow('Invalid date format. Use YYYY-MM-DD');
    });
  });

  describe('Concurrent Booking Prevention', () => {
    it('should handle concurrent booking attempts via slot conflict', async () => {
      // First call succeeds, second call gets SLOT_CONFLICT
      setupSuccessfulCreation();

      const request: CreateReservationRequest = {
        shopId: 'shop-001',
        userId: 'user-001',
        services: [{ serviceId: 'service-001', quantity: 1 }],
        reservationDate: '2026-12-25',
        reservationTime: '14:00',
      };

      // First reservation succeeds
      const result1Promise = reservationService.createReservation(request);

      // Before settling, set up the second call to fail
      // (In practice we simulate by running two calls with different RPC outcomes)

      // For the second call, override the RPC mock to fail with SLOT_CONFLICT
      const service2 = new ReservationService();
      const originalRpc = mockSupabase.rpc;

      // Re-setup for second call after first resolves
      const result1 = await result1Promise;
      expect(result1).toBeDefined();
      expect(result1.id).toBe('reservation-123');

      // Now set up RPC to fail for second attempt
      setupSuccessfulCreation(); // re-setup from dispatcher
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'SLOT_CONFLICT: Time slot is not available' },
      });

      const request2: CreateReservationRequest = {
        ...request,
        userId: 'user-002',
      };

      await expect(service2.createReservation(request2))
        .rejects.toThrow('Time slot is no longer available due to concurrent booking');
    });
  });
});
