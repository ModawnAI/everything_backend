/**
 * Comprehensive Reservation Service Unit Tests
 * 
 * Tests reservation service with real Supabase database connection
 * Follows new testing rule: use real database, mock only external APIs
 */

import { ReservationService, CreateReservationRequest } from '../../src/services/reservation.service';
import { 
  createTestUser, 
  createTestShop, 
  createTestService,
  cleanupTestData 
} from '../setup-real-db';

// Mock only external services (not database)
jest.mock('../../src/services/shop-owner-notification.service', () => ({
  shopOwnerNotificationService: {
    sendReservationNotification: jest.fn().mockResolvedValue({ success: true }),
    sendStateChangeNotification: jest.fn().mockResolvedValue({ success: true })
  }
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Reservation Service - Real Database Tests', () => {
  let reservationService: ReservationService;
  let testUser: any;
  let testShop: any;
  let testService: any;

  beforeAll(() => {
    reservationService = new ReservationService();
  });

  beforeEach(async () => {
    // Create fresh test data for each test
    testUser = await createTestUser({
      total_points: 5000,
      available_points: 5000
    });

    testShop = await createTestShop({
      operating_hours: {
        monday: { open: '09:00', close: '18:00', closed: false },
        tuesday: { open: '09:00', close: '18:00', closed: false },
        wednesday: { open: '09:00', close: '18:00', closed: false },
        thursday: { open: '09:00', close: '18:00', closed: false },
        friday: { open: '09:00', close: '18:00', closed: false },
        saturday: { open: '09:00', close: '17:00', closed: false },
        sunday: { open: '10:00', close: '16:00', closed: false }
      }
    });

    testService = await createTestService({
      shop_id: testShop.id,
      price_min: 30000,
      price_max: 50000,
      duration_minutes: 60,
      deposit_amount: 10000,
      deposit_percentage: 20
    });
  });

  afterEach(async () => {
    // Clean up test data after each test
    await cleanupTestData();
  });

  describe('Reservation Creation', () => {
    it('should create a reservation successfully with valid data', async () => {
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [
          { serviceId: testService.id, quantity: 1 }
        ],
        reservationDate: '2024-12-25',
        reservationTime: '14:00',
        specialRequests: 'Please call before arrival',
        pointsToUse: 0
      };

      const result = await reservationService.createReservation(reservationRequest);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.shopId).toBe(testShop.id);
      expect(result.userId).toBe(testUser.id);
      expect(result.status).toBe('requested');
      expect(result.totalAmount).toBeGreaterThan(0);
      expect(result.depositAmount).toBeGreaterThan(0);
      expect(result.specialRequests).toBe('Please call before arrival');
    });

    it('should calculate pricing correctly based on service data', async () => {
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [
          { serviceId: testService.id, quantity: 1 }
        ],
        reservationDate: '2024-12-25',
        reservationTime: '14:00'
      };

      const result = await reservationService.createReservation(reservationRequest);

      // Verify pricing calculations
      expect(result.totalAmount).toBeGreaterThanOrEqual(testService.price_min);
      expect(result.totalAmount).toBeLessThanOrEqual(testService.price_max);
      expect(result.depositAmount).toBe(testService.deposit_amount);
      expect(result.remainingAmount).toBe(result.totalAmount - result.depositAmount);
    });

    it('should apply points discount correctly', async () => {
      const pointsToUse = 1000;
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [
          { serviceId: testService.id, quantity: 1 }
        ],
        reservationDate: '2024-12-25',
        reservationTime: '14:00',
        pointsToUse
      };

      const result = await reservationService.createReservation(reservationRequest);

      expect(result.pointsUsed).toBe(pointsToUse);
      expect(result.totalAmount).toBeGreaterThan(0);
      // Remaining amount should account for points used
      expect(result.remainingAmount).toBe(result.totalAmount - result.depositAmount - pointsToUse);
    });

    it('should handle multiple services correctly', async () => {
      // Create another service
      const testService2 = await createTestService({
        shop_id: testShop.id,
        name: 'Test Service 2',
        price_min: 20000,
        price_max: 30000,
        duration_minutes: 30,
        deposit_amount: 5000
      });

      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [
          { serviceId: testService.id, quantity: 1 },
          { serviceId: testService2.id, quantity: 1 }
        ],
        reservationDate: '2024-12-25',
        reservationTime: '14:00'
      };

      const result = await reservationService.createReservation(reservationRequest);

      // Total amount should be sum of both services
      expect(result.totalAmount).toBeGreaterThanOrEqual(
        testService.price_min + testService2.price_min
      );
      expect(result.depositAmount).toBe(
        testService.deposit_amount + testService2.deposit_amount
      );
    });

    it('should reject reservation with invalid shop ID', async () => {
      const reservationRequest: CreateReservationRequest = {
        shopId: 'invalid-shop-id',
        userId: testUser.id,
        services: [
          { serviceId: testService.id, quantity: 1 }
        ],
        reservationDate: '2024-12-25',
        reservationTime: '14:00'
      };

      await expect(reservationService.createReservation(reservationRequest))
        .rejects.toThrow();
    });

    it('should reject reservation with invalid user ID', async () => {
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: 'invalid-user-id',
        services: [
          { serviceId: testService.id, quantity: 1 }
        ],
        reservationDate: '2024-12-25',
        reservationTime: '14:00'
      };

      await expect(reservationService.createReservation(reservationRequest))
        .rejects.toThrow();
    });

    it('should reject reservation with invalid service ID', async () => {
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [
          { serviceId: 'invalid-service-id', quantity: 1 }
        ],
        reservationDate: '2024-12-25',
        reservationTime: '14:00'
      };

      await expect(reservationService.createReservation(reservationRequest))
        .rejects.toThrow();
    });

    it('should reject reservation with insufficient points', async () => {
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [
          { serviceId: testService.id, quantity: 1 }
        ],
        reservationDate: '2024-12-25',
        reservationTime: '14:00',
        pointsToUse: 10000 // More than user's available points (5000)
      };

      await expect(reservationService.createReservation(reservationRequest))
        .rejects.toThrow('Insufficient points');
    });

    it('should reject reservation with past date', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [
          { serviceId: testService.id, quantity: 1 }
        ],
        reservationDate: pastDate.toISOString().split('T')[0],
        reservationTime: '14:00'
      };

      await expect(reservationService.createReservation(reservationRequest))
        .rejects.toThrow();
    });

    it('should reject reservation outside operating hours', async () => {
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [
          { serviceId: testService.id, quantity: 1 }
        ],
        reservationDate: '2024-12-25',
        reservationTime: '20:00' // After shop closes at 18:00
      };

      await expect(reservationService.createReservation(reservationRequest))
        .rejects.toThrow();
    });
  });

  describe('Reservation Retrieval', () => {
    let testReservation: any;

    beforeEach(async () => {
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [
          { serviceId: testService.id, quantity: 1 }
        ],
        reservationDate: '2024-12-25',
        reservationTime: '14:00',
        specialRequests: 'Test reservation'
      };

      testReservation = await reservationService.createReservation(reservationRequest);
    });

    it('should retrieve reservation by ID', async () => {
      const result = await reservationService.getReservationById(testReservation.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(testReservation.id);
      expect(result.shopId).toBe(testShop.id);
      expect(result.userId).toBe(testUser.id);
      expect(result.specialRequests).toBe('Test reservation');
    });

    it('should return null for non-existent reservation ID', async () => {
      const result = await reservationService.getReservationById('non-existent-id');
      expect(result).toBeNull();
    });

    it('should retrieve reservations by user ID', async () => {
      const results = await reservationService.getReservationsByUserId(testUser.id);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].userId).toBe(testUser.id);
    });

    it('should retrieve reservations by shop ID', async () => {
      const results = await reservationService.getReservationsByShopId(testShop.id);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].shopId).toBe(testShop.id);
    });
  });

  describe('Reservation Updates', () => {
    let testReservation: any;

    beforeEach(async () => {
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [
          { serviceId: testService.id, quantity: 1 }
        ],
        reservationDate: '2024-12-25',
        reservationTime: '14:00'
      };

      testReservation = await reservationService.createReservation(reservationRequest);
    });

    it('should update reservation status', async () => {
      const result = await reservationService.updateReservationStatus(
        testReservation.id,
        'confirmed'
      );

      expect(result).toBeDefined();
      expect(result.status).toBe('confirmed');
      expect(result.updatedAt).toBeDefined();
    });

    it('should update special requests', async () => {
      const newRequests = 'Updated special requests';
      const result = await reservationService.updateSpecialRequests(
        testReservation.id,
        newRequests
      );

      expect(result).toBeDefined();
      expect(result.specialRequests).toBe(newRequests);
    });

    it('should handle invalid status transitions', async () => {
      await expect(reservationService.updateReservationStatus(
        testReservation.id,
        'invalid_status' as any
      )).rejects.toThrow();
    });
  });

  describe('Business Logic Validation', () => {
    it('should validate service availability', async () => {
      // Create unavailable service
      const unavailableService = await createTestService({
        shop_id: testShop.id,
        is_available: false
      });

      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [
          { serviceId: unavailableService.id, quantity: 1 }
        ],
        reservationDate: '2024-12-25',
        reservationTime: '14:00'
      };

      await expect(reservationService.createReservation(reservationRequest))
        .rejects.toThrow('Service is not available');
    });

    it('should validate service quantity limits', async () => {
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [
          { serviceId: testService.id, quantity: 0 } // Invalid quantity
        ],
        reservationDate: '2024-12-25',
        reservationTime: '14:00'
      };

      await expect(reservationService.createReservation(reservationRequest))
        .rejects.toThrow('Invalid service quantity');
    });

    it('should validate reservation time format', async () => {
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [
          { serviceId: testService.id, quantity: 1 }
        ],
        reservationDate: '2024-12-25',
        reservationTime: 'invalid-time'
      };

      await expect(reservationService.createReservation(reservationRequest))
        .rejects.toThrow('Invalid time format');
    });

    it('should validate reservation date format', async () => {
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [
          { serviceId: testService.id, quantity: 1 }
        ],
        reservationDate: 'invalid-date',
        reservationTime: '14:00'
      };

      await expect(reservationService.createReservation(reservationRequest))
        .rejects.toThrow('Invalid date format');
    });
  });

  describe('Concurrent Booking Prevention', () => {
    it('should handle concurrent booking attempts', async () => {
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [
          { serviceId: testService.id, quantity: 1 }
        ],
        reservationDate: '2024-12-25',
        reservationTime: '14:00'
      };

      // Create another user for concurrent booking
      const testUser2 = await createTestUser();
      const reservationRequest2: CreateReservationRequest = {
        ...reservationRequest,
        userId: testUser2.id
      };

      // Attempt concurrent bookings
      const promises = [
        reservationService.createReservation(reservationRequest),
        reservationService.createReservation(reservationRequest2)
      ];

      const results = await Promise.allSettled(promises);
      
      // One should succeed, one should fail
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful.length).toBe(1);
      expect(failed.length).toBe(1);
    });
  });
});
