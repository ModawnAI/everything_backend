/**
 * Reservation Database Test Setup
 * 
 * Database setup and teardown utilities for reservation system testing
 */

import { getSupabaseClient } from '../../src/config/database';
import { ReservationTestUtils } from '../utils/reservation-test-utils';
import { getTestConfig, TestEnvironmentUtils } from '../config/reservation-test-config';

export interface TestDatabaseState {
  users: any[];
  shops: any[];
  services: any[];
  reservations: any[];
  timeSlots: any[];
  conflicts: any[];
  notifications: any[];
  pointTransactions: any[];
}

export class ReservationDatabaseSetup {
  private supabase: any;
  private testUtils: ReservationTestUtils;
  private config: any;
  private testState: TestDatabaseState;

  constructor() {
    this.supabase = getSupabaseClient();
    this.testUtils = new ReservationTestUtils();
    this.config = getTestConfig(process.env.NODE_ENV);
    this.testState = {
      users: [],
      shops: [],
      services: [],
      reservations: [],
      timeSlots: [],
      conflicts: [],
      notifications: [],
      pointTransactions: [],
    };
  }

  /**
   * Setup test database with seed data
   */
  async setupTestDatabase(): Promise<void> {
    try {
      console.log('Setting up test database...');

      if (this.config.database.seedTestData) {
        await this.seedTestData();
      }

      if (this.config.database.useTransactions) {
        await this.beginTransaction();
      }

      console.log('Test database setup completed');
    } catch (error) {
      console.error('Failed to setup test database:', error);
      throw error;
    }
  }

  /**
   * Teardown test database
   */
  async teardownTestDatabase(): Promise<void> {
    try {
      console.log('Tearing down test database...');

      if (this.config.database.useTransactions) {
        await this.rollbackTransaction();
      }

      if (this.config.database.cleanupTestData && TestEnvironmentUtils.shouldCleanupTestData()) {
        await this.cleanupTestData();
      }

      console.log('Test database teardown completed');
    } catch (error) {
      console.error('Failed to teardown test database:', error);
      throw error;
    }
  }

  /**
   * Seed test data
   */
  private async seedTestData(): Promise<void> {
    const { testData } = this.config;

    // Create test users
    for (let i = 0; i < testData.userCount; i++) {
      const user = await this.testUtils.createTestUser({
        email: `testuser${i}@example.com`,
        name: `Test User ${i}`,
      });
      this.testState.users.push(user);
    }

    // Create test shops
    for (let i = 0; i < testData.shopCount; i++) {
      const ownerId = this.testState.users[i % this.testState.users.length].id;
      const shop = await this.testUtils.createTestShop(ownerId, {
        name: `Test Shop ${i}`,
      });
      this.testState.shops.push(shop);
    }

    // Create test services
    for (let i = 0; i < testData.serviceCount; i++) {
      const shopId = this.testState.shops[i % this.testState.shops.length].id;
      const service = await this.testUtils.createTestService(shopId, {
        name: `Test Service ${i}`,
      });
      this.testState.services.push(service);
    }

    // Create test reservations
    for (let i = 0; i < testData.reservationCount; i++) {
      const userId = this.testState.users[i % this.testState.users.length].id;
      const shopId = this.testState.shops[i % this.testState.shops.length].id;
      const reservation = await this.testUtils.createTestReservation(userId, shopId, {
        status: 'requested',
      });
      this.testState.reservations.push(reservation);
    }

    // Create test time slots
    await this.seedTimeSlots();

    console.log(`Seeded ${this.testState.users.length} users, ${this.testState.shops.length} shops, ${this.testState.services.length} services, ${this.testState.reservations.length} reservations`);
  }

  /**
   * Seed time slots for testing
   */
  private async seedTimeSlots(): Promise<void> {
    const timeSlots = [];
    const today = new Date();
    
    // Generate time slots for the next 30 days
    for (let day = 0; day < 30; day++) {
      const date = new Date(today);
      date.setDate(date.getDate() + day);
      const dateStr = date.toISOString().split('T')[0];
      
      // Generate time slots for each shop
      for (const shop of this.testState.shops) {
        for (let hour = 9; hour < 21; hour++) {
          for (let minute = 0; minute < 60; minute += 30) {
            const timeSlot = {
              id: `timeslot-${shop.id}-${dateStr}-${hour}-${minute}`,
              shop_id: shop.id,
              date: dateStr,
              start_time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
              end_time: `${hour.toString().padStart(2, '0')}:${(minute + 30).toString().padStart(2, '0')}`,
              is_available: Math.random() > 0.3, // 70% availability
              capacity: 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            timeSlots.push(timeSlot);
          }
        }
      }
    }
    
    this.testState.timeSlots = timeSlots;
  }

  /**
   * Begin database transaction
   */
  private async beginTransaction(): Promise<void> {
    try {
      await this.supabase.rpc('begin_transaction');
    } catch (error) {
      // Transaction might not be supported in test environment
      console.log('Transaction not supported in test environment');
    }
  }

  /**
   * Rollback database transaction
   */
  private async rollbackTransaction(): Promise<void> {
    try {
      await this.supabase.rpc('rollback_transaction');
    } catch (error) {
      // Transaction might not be supported in test environment
      console.log('Transaction rollback not supported in test environment');
    }
  }

  /**
   * Cleanup test data
   */
  private async cleanupTestData(): Promise<void> {
    try {
      // Clean up in reverse order to respect foreign key constraints
      await this.cleanupTable('point_transactions');
      await this.cleanupTable('notifications');
      await this.cleanupTable('conflicts');
      await this.cleanupTable('reservations');
      await this.cleanupTable('time_slots');
      await this.cleanupTable('shop_services');
      await this.cleanupTable('shops');
      await this.cleanupTable('users');
      
      // Reset test state
      this.testState = {
        users: [],
        shops: [],
        services: [],
        reservations: [],
        timeSlots: [],
        conflicts: [],
        notifications: [],
        pointTransactions: [],
      };
    } catch (error) {
      console.error('Failed to cleanup test data:', error);
      throw error;
    }
  }

  /**
   * Cleanup specific table
   */
  private async cleanupTable(tableName: string): Promise<void> {
    try {
      // Mock cleanup for test environment
      console.log(`Cleaning up table: ${tableName}`);
    } catch (error) {
      console.error(`Failed to cleanup table ${tableName}:`, error);
    }
  }

  /**
   * Get test database state
   */
  getTestState(): TestDatabaseState {
    return this.testState;
  }

  /**
   * Reset test state
   */
  resetTestState(): void {
    this.testState = {
      users: [],
      shops: [],
      services: [],
      reservations: [],
      timeSlots: [],
      conflicts: [],
      notifications: [],
      pointTransactions: [],
    };
  }

  /**
   * Create isolated test environment
   */
  async createIsolatedTestEnvironment(): Promise<{
    cleanup: () => Promise<void>;
    testData: TestDatabaseState;
  }> {
    await this.setupTestDatabase();
    
    return {
      cleanup: async () => {
        await this.teardownTestDatabase();
      },
      testData: this.getTestState(),
    };
  }

  /**
   * Mock database responses for testing
   */
  mockDatabaseResponses(): void {
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
      single: jest.fn().mockImplementation(() => {
        return Promise.resolve({
          data: null,
          error: null,
        });
      }),
      rpc: jest.fn().mockImplementation((functionName: string, params?: any) => {
        // Mock specific RPC functions
        switch (functionName) {
          case 'create_reservation_with_lock':
            return Promise.resolve({
              data: { id: 'mock-reservation-id', status: 'requested' },
              error: null,
            });
          case 'detect_conflicts':
            return Promise.resolve({
              data: [],
              error: null,
            });
          case 'begin_transaction':
          case 'rollback_transaction':
            return Promise.resolve({ data: null, error: null });
          default:
            return Promise.resolve({ data: null, error: null });
        }
      }),
    };

    // Mock the getSupabaseClient function
    jest.doMock('../../src/config/database', () => ({
      getSupabaseClient: () => mockSupabase,
    }));
  }
}

/**
 * Global test setup and teardown
 */
export class GlobalTestSetup {
  private static instance: ReservationDatabaseSetup;
  private static isSetup: boolean = false;

  static getInstance(): ReservationDatabaseSetup {
    if (!this.instance) {
      this.instance = new ReservationDatabaseSetup();
    }
    return this.instance;
  }

  static async setup(): Promise<void> {
    if (!this.isSetup) {
      const setup = this.getInstance();
      await setup.setupTestDatabase();
      this.isSetup = true;
    }
  }

  static async teardown(): Promise<void> {
    if (this.isSetup) {
      const setup = this.getInstance();
      await setup.teardownTestDatabase();
      this.isSetup = false;
    }
  }

  static reset(): void {
    this.isSetup = false;
    this.instance = new ReservationDatabaseSetup();
  }
}

export default ReservationDatabaseSetup;
