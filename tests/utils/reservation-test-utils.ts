/**
 * Reservation System Test Utilities
 * 
 * Comprehensive test utilities for reservation system testing including:
 * - Mock data generators
 * - Test environment setup
 * - Database seeding helpers
 * - Performance testing utilities
 * - Load testing helpers
 */

// Mock faker for testing
const faker = {
  datatype: { 
    uuid: () => 'test-uuid',
    number: () => 12345
  },
  date: { 
    future: () => new Date(Date.now() + 86400000),
    recent: () => new Date(Date.now() - 86400000),
    past: () => new Date(Date.now() - 172800000),
    between: () => new Date(Date.now() - 86400000)
  },
  lorem: { words: () => 'test words' },
  internet: { email: () => 'test@example.com' },
  name: { 
    firstName: () => 'Test', 
    lastName: () => 'User',
    fullName: () => 'Test User'
  },
  phone: { number: () => '010-1234-5678' },
  address: {
    city: () => 'Seoul',
    streetAddress: () => '123 Test St'
  },
  company: {
    name: () => 'Test Company'
  }
};

import { getSupabaseClient } from '../../src/config/database';
import { ReservationStatus, CreateReservationRequest, Reservation } from '../../src/types/database.types';

// Mock faker if not available
const mockFaker = {
  datatype: {
    uuid: () => Math.random().toString(36).substring(7),
    number: (options: any) => Math.floor(Math.random() * (options?.max || 100)),
    boolean: () => Math.random() > 0.5,
  },
  date: {
    future: () => new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000),
    recent: () => new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
  },
  lorem: {
    sentence: () => 'Test description',
    words: (count: number) => Array(count).fill(0).map(() => 'test'),
  },
  name: {
    fullName: () => 'Test User',
    firstName: () => 'Test',
    lastName: () => 'User',
  },
  internet: {
    email: () => `test${Math.random().toString(36).substring(7)}@example.com`,
  },
  address: {
    streetAddress: () => '123 Test Street',
    city: () => 'Test City',
    country: () => 'South Korea',
  },
  phone: {
    number: () => '010-1234-5678',
  },
};

// Use mock faker if real faker is not available
const fakerInstance = typeof faker !== 'undefined' ? faker : mockFaker;

export interface TestUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  birth_date: string;
  gender: 'male' | 'female' | 'other';
  user_status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface TestShop {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  address: string;
  main_category: string;
  shop_status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface TestService {
  id: string;
  shop_id: string;
  name: string;
  description: string;
  duration_minutes: number;
  price_min: number;
  price_max: number;
  category: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface TestReservation {
  id: string;
  user_id: string;
  shop_id: string;
  status: ReservationStatus;
  reservation_date: string;
  start_time: string;
  end_time: string;
  total_amount: number;
  special_requests?: string;
  created_at: string;
  updated_at: string;
}

export class ReservationTestUtils {
  private supabase: any;
  private testData: {
    users: TestUser[];
    shops: TestShop[];
    services: TestService[];
    reservations: TestReservation[];
  };

  constructor() {
    this.supabase = getSupabaseClient();
    this.testData = {
      users: [],
      shops: [],
      services: [],
      reservations: [],
    };
  }

  /**
   * Generate test user data
   */
  generateTestUser(overrides: Partial<TestUser> = {}): TestUser {
    const futureDate = fakerInstance.date.future();
    const pastDate = fakerInstance.date.recent();
    
    return {
      id: fakerInstance.datatype.uuid(),
      email: fakerInstance.internet.email(),
      name: fakerInstance.name.fullName(),
      phone: fakerInstance.phone.number(),
      birth_date: pastDate.toISOString().split('T')[0],
      gender: fakerInstance.datatype.number({ max: 2 }) === 0 ? 'male' : 'female',
      user_status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Generate test shop data
   */
  generateTestShop(ownerId: string, overrides: Partial<TestShop> = {}): TestShop {
    const categories = ['beauty', 'hair', 'nails', 'skincare', 'massage'];
    
    return {
      id: fakerInstance.datatype.uuid(),
      owner_id: ownerId,
      name: `${fakerInstance.name.firstName()}'s ${categories[fakerInstance.datatype.number({ max: categories.length - 1 })]} Shop`,
      description: fakerInstance.lorem.sentence(),
      address: fakerInstance.address.streetAddress(),
      main_category: categories[fakerInstance.datatype.number({ max: categories.length - 1 })],
      shop_status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Generate test service data
   */
  generateTestService(shopId: string, overrides: Partial<TestService> = {}): TestService {
    const services = [
      { name: 'Hair Cut', category: 'haircut', duration: 60, price: 50000 },
      { name: 'Manicure', category: 'nails', duration: 90, price: 30000 },
      { name: 'Facial', category: 'skincare', duration: 120, price: 80000 },
      { name: 'Massage', category: 'massage', duration: 60, price: 70000 },
      { name: 'Pedicure', category: 'nails', duration: 90, price: 40000 },
    ];
    
    const service = services[fakerInstance.datatype.number({ max: services.length - 1 })];
    
    return {
      id: fakerInstance.datatype.uuid(),
      shop_id: shopId,
      name: service.name,
      description: fakerInstance.lorem.sentence(),
      duration_minutes: service.duration,
      price_min: service.price,
      price_max: service.price,
      category: service.category,
      is_available: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Generate test reservation data
   */
  generateTestReservation(
    userId: string,
    shopId: string,
    overrides: Partial<TestReservation> = {}
  ): TestReservation {
    const futureDate = fakerInstance.date.future();
    const reservationDate = futureDate.toISOString().split('T')[0];
    const startTime = `${String(Math.floor(Math.random() * 12) + 9).padStart(2, '0')}:00`;
    const endTime = `${String(parseInt(startTime.split(':')[0]) + 2).padStart(2, '0')}:00`;
    
    return {
      id: fakerInstance.datatype.uuid(),
      user_id: userId,
      shop_id: shopId,
      status: 'requested',
      reservation_date: reservationDate,
      start_time: startTime,
      end_time: endTime,
      total_amount: fakerInstance.datatype.number({ min: 20000, max: 150000 }),
      special_requests: fakerInstance.lorem.sentence(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Generate CreateReservationRequest for testing
   */
  generateCreateReservationRequest(
    userId: string,
    shopId: string,
    serviceId: string,
    overrides: Partial<CreateReservationRequest> = {}
  ): CreateReservationRequest {
    const futureDate = fakerInstance.date.future();
    const reservationDate = futureDate.toISOString().split('T')[0];
    const startTime = `${String(Math.floor(Math.random() * 12) + 9).padStart(2, '0')}:00`;
    
    return {
      shopId,
      userId,
      services: [{ serviceId, quantity: 1 }],
      reservationDate,
      reservationTime: startTime,
      specialRequests: fakerInstance.lorem.sentence(),
      ...overrides,
    };
  }

  /**
   * Create test user in database
   */
  async createTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
    const user = this.generateTestUser(overrides);
    
    // Mock database insertion
    this.testData.users.push(user);
    
    return user;
  }

  /**
   * Create test shop in database
   */
  async createTestShop(ownerId: string, overrides: Partial<TestShop> = {}): Promise<TestShop> {
    const shop = this.generateTestShop(ownerId, overrides);
    
    // Mock database insertion
    this.testData.shops.push(shop);
    
    return shop;
  }

  /**
   * Create test service in database
   */
  async createTestService(shopId: string, overrides: Partial<TestService> = {}): Promise<TestService> {
    const service = this.generateTestService(shopId, overrides);
    
    // Mock database insertion
    this.testData.services.push(service);
    
    return service;
  }

  /**
   * Create test reservation in database
   */
  async createTestReservation(
    userId: string,
    shopId: string,
    overrides: Partial<TestReservation> = {}
  ): Promise<TestReservation> {
    const reservation = this.generateTestReservation(userId, shopId, overrides);
    
    // Mock database insertion
    this.testData.reservations.push(reservation);
    
    return reservation;
  }

  /**
   * Generate multiple test reservations for load testing
   */
  generateTestReservations(
    count: number,
    userId: string,
    shopId: string,
    status: ReservationStatus = 'requested'
  ): TestReservation[] {
    return Array(count).fill(0).map(() => 
      this.generateTestReservation(userId, shopId, { status })
    );
  }

  /**
   * Create test scenario with user, shop, service, and reservation
   */
  async createTestScenario(overrides: {
    user?: Partial<TestUser>;
    shop?: Partial<TestShop>;
    service?: Partial<TestService>;
    reservation?: Partial<TestReservation>;
  } = {}): Promise<{
    user: TestUser;
    shop: TestShop;
    service: TestService;
    reservation: TestReservation;
  }> {
    const user = await this.createTestUser(overrides.user);
    const shop = await this.createTestShop(user.id, overrides.shop);
    const service = await this.createTestService(shop.id, overrides.service);
    const reservation = await this.createTestReservation(user.id, shop.id, overrides.reservation);

    return { user, shop, service, reservation };
  }

  /**
   * Clean up test data
   */
  async cleanup(): Promise<void> {
    this.testData = {
      users: [],
      shops: [],
      services: [],
      reservations: [],
    };
  }

  /**
   * Get test data for assertions
   */
  getTestData() {
    return this.testData;
  }

  /**
   * Generate performance test data
   */
  generatePerformanceTestData(options: {
    userCount: number;
    shopCount: number;
    serviceCount: number;
    reservationCount: number;
  }): {
    users: TestUser[];
    shops: TestShop[];
    services: TestService[];
    reservations: TestReservation[];
  } {
    const users = Array(options.userCount).fill(0).map(() => this.generateTestUser());
    const shops = Array(options.shopCount).fill(0).map((_, index) => 
      this.generateTestShop(users[index % users.length].id)
    );
    const services = Array(options.serviceCount).fill(0).map((_, index) => 
      this.generateTestService(shops[index % shops.length].id)
    );
    const reservations = Array(options.reservationCount).fill(0).map(() => {
      const user = users[Math.floor(Math.random() * users.length)];
      const shop = shops[Math.floor(Math.random() * shops.length)];
      return this.generateTestReservation(user.id, shop.id);
    });

    return { users, shops, services, reservations };
  }

  /**
   * Mock Supabase responses for testing
   */
  mockSupabaseResponses(mocks: {
    select?: any;
    insert?: any;
    update?: any;
    delete?: any;
    rpc?: any;
  }): void {
    const mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(mocks.select || { data: null, error: null }),
      rpc: jest.fn().mockResolvedValue(mocks.rpc || { data: null, error: null }),
    };

    // Mock the getSupabaseClient function
    jest.doMock('../../src/config/database', () => ({
      getSupabaseClient: () => mockSupabase,
    }));
  }
}

/**
 * Performance testing utilities
 */
export class ReservationPerformanceTestUtils {
  /**
   * Measure execution time of async functions
   */
  static async measureExecutionTime<T>(
    fn: () => Promise<T>,
    iterations: number = 1
  ): Promise<{
    result: T;
    averageTime: number;
    minTime: number;
    maxTime: number;
    times: number[];
  }> {
    const times: number[] = [];
    let result: T;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      result = await fn();
      const end = performance.now();
      times.push(end - start);
    }

    return {
      result: result!,
      averageTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      times,
    };
  }

  /**
   * Generate concurrent test scenarios
   */
  static generateConcurrentScenarios(
    count: number,
    fn: (index: number) => Promise<any>
  ): Promise<any>[] {
    return Array(count).fill(0).map((_, index) => fn(index));
  }

  /**
   * Test concurrent reservation creation
   */
  static async testConcurrentReservations(
    reservationUtils: ReservationTestUtils,
    userId: string,
    shopId: string,
    concurrentCount: number
  ): Promise<{
    successCount: number;
    failureCount: number;
    averageTime: number;
    results: any[];
  }> {
    const scenarios = this.generateConcurrentScenarios(concurrentCount, async (index) => {
      const start = performance.now();
      try {
        const reservation = await reservationUtils.createTestReservation(userId, shopId, {
          reservation_date: new Date(Date.now() + index * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });
        const end = performance.now();
        return { success: true, time: end - start, reservation };
      } catch (error) {
        const end = performance.now();
        return { success: false, time: end - start, error };
      }
    });

    const results = await Promise.all(scenarios);
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    const averageTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;

    return {
      successCount,
      failureCount,
      averageTime,
      results,
    };
  }
}

/**
 * Load testing utilities
 */
export class ReservationLoadTestUtils {
  /**
   * Generate load test scenarios
   */
  static generateLoadTestScenarios(
    baseLoad: number,
    peakLoad: number,
    duration: number
  ): Array<{ time: number; load: number }> {
    const scenarios: Array<{ time: number; load: number }> = [];
    const interval = 1000; // 1 second intervals
    
    for (let time = 0; time < duration; time += interval) {
      // Simulate peak load during business hours (9 AM - 6 PM)
      const hour = new Date().getHours();
      const isPeakHour = hour >= 9 && hour <= 18;
      const load = isPeakHour ? peakLoad : baseLoad;
      
      scenarios.push({ time, load });
    }
    
    return scenarios;
  }

  /**
   * Simulate load test execution
   */
  static async executeLoadTest(
    fn: () => Promise<any>,
    scenarios: Array<{ time: number; load: number }>
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    maxResponseTime: number;
    minResponseTime: number;
  }> {
    const results: Array<{ success: boolean; responseTime: number }> = [];
    
    for (const scenario of scenarios) {
      const requests = Array(scenario.load).fill(0).map(async () => {
        const start = performance.now();
        try {
          await fn();
          const end = performance.now();
          return { success: true, responseTime: end - start };
        } catch (error) {
          const end = performance.now();
          return { success: false, responseTime: end - start };
        }
      });
      
      const scenarioResults = await Promise.all(requests);
      results.push(...scenarioResults);
    }
    
    const totalRequests = results.length;
    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = results.filter(r => !r.success).length;
    const responseTimes = results.map(r => r.responseTime);
    const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);
    
    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      maxResponseTime,
      minResponseTime,
    };
  }
}

export default ReservationTestUtils;
