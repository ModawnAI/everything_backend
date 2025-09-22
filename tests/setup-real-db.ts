/**
 * Real Database Test Setup
 * 
 * Sets up test environment with real Supabase connection
 * Handles test data isolation and cleanup
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '../src/utils/logger';
import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Test database configuration
export const testConfig = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  testSchemaPrefix: 'test_',
  cleanupTimeout: 30000
};

// Global test state
let testSupabaseClient: any = null;
let testDataIds: Set<string> = new Set();

/**
 * Initialize test database connection
 */
export async function initializeTestDatabase() {
  try {
    // Create real Supabase client directly (bypassing test mocks)
    if (!testConfig.supabaseUrl || !testConfig.supabaseServiceKey) {
      throw new Error('Missing Supabase configuration in environment variables');
    }

    testSupabaseClient = createClient(
      testConfig.supabaseUrl,
      testConfig.supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
        db: {
          schema: 'public'
        }
      }
    );
    
    // Verify connection
    const { data, error } = await testSupabaseClient
      .from('users')
      .select('count')
      .limit(1);
    
    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
    
    logger.info('✅ Test database connection established');
    return testSupabaseClient;
  } catch (error) {
    logger.error('❌ Failed to initialize test database:', error);
    throw error;
  }
}

/**
 * Create test user for testing
 */
export async function createTestUser(userData: any = {}) {
  const testUser = {
    id: userData.id || crypto.randomUUID(),
    email: userData.email || `test-${Date.now()}@example.com`,
    name: userData.name || 'Test User',
    phone_number: userData.phone_number || `+8210${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
    user_status: 'active',
    total_points: userData.total_points || 1000,
    available_points: userData.available_points || 1000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...userData
  };

  const { data, error } = await testSupabaseClient
    .from('users')
    .insert(testUser)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  testDataIds.add(`user:${testUser.id}`);
  return data;
}

/**
 * Create test shop for testing
 */
export async function createTestShop(shopData: any = {}) {
  const testShop = {
    id: shopData.id || crypto.randomUUID(),
    name: shopData.name || 'Test Beauty Shop',
    description: shopData.description || 'Test shop for automated testing',
    address: shopData.address || 'Test Address 123, Test City',
    latitude: shopData.latitude || 37.5665,
    longitude: shopData.longitude || 126.9780,
    phone_number: shopData.phone_number || '+821012345678',
    shop_status: 'active',
    verification_status: 'verified',
    main_category: 'beauty',
    operating_hours: shopData.operating_hours || {
      monday: { open: '09:00', close: '18:00', closed: false },
      tuesday: { open: '09:00', close: '18:00', closed: false },
      wednesday: { open: '09:00', close: '18:00', closed: false },
      thursday: { open: '09:00', close: '18:00', closed: false },
      friday: { open: '09:00', close: '18:00', closed: false },
      saturday: { open: '09:00', close: '17:00', closed: false },
      sunday: { open: '10:00', close: '16:00', closed: false }
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...shopData
  };

  const { data, error } = await testSupabaseClient
    .from('shops')
    .insert(testShop)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test shop: ${error.message}`);
  }

  testDataIds.add(`shop:${testShop.id}`);
  return data;
}

/**
 * Create test service for testing
 */
export async function createTestService(serviceData: any = {}) {
  const testService = {
    id: serviceData.id || crypto.randomUUID(),
    shop_id: serviceData.shop_id || 'test-shop-id',
    name: serviceData.name || 'Test Service',
    description: serviceData.description || 'Test service description',
    category: 'hair',
    price_min: serviceData.price_min || 30000,
    price_max: serviceData.price_max || 50000,
    duration_minutes: serviceData.duration_minutes || 60,
    deposit_amount: serviceData.deposit_amount || 10000,
    deposit_percentage: serviceData.deposit_percentage || 20,
    is_available: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...serviceData
  };

  const { data, error } = await testSupabaseClient
    .from('shop_services')
    .insert(testService)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test service: ${error.message}`);
  }

  testDataIds.add(`service:${testService.id}`);
  return data;
}

/**
 * Create test reservation for testing
 */
export async function createTestReservation(reservationData: any = {}) {
  const testReservation = {
    id: reservationData.id || crypto.randomUUID(),
    user_id: reservationData.user_id || 'test-user-id',
    shop_id: reservationData.shop_id || 'test-shop-id',
    reservation_date: reservationData.reservation_date || '2024-12-25',
    reservation_time: reservationData.reservation_time || '14:00:00',
    reservation_datetime: reservationData.reservation_datetime || '2024-12-25T14:00:00Z',
    status: reservationData.status || 'requested',
    total_amount: reservationData.total_amount || 50000,
    deposit_amount: reservationData.deposit_amount || 10000,
    remaining_amount: reservationData.remaining_amount || 40000,
    points_used: reservationData.points_used || 0,
    points_earned: reservationData.points_earned || 0,
    special_requests: reservationData.special_requests || 'Test request',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...reservationData
  };

  const { data, error } = await testSupabaseClient
    .from('reservations')
    .insert(testReservation)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create test reservation: ${error.message}`);
  }

  testDataIds.add(`reservation:${testReservation.id}`);
  return data;
}

/**
 * Clean up all test data
 */
export async function cleanupTestData() {
  if (!testSupabaseClient || testDataIds.size === 0) {
    return;
  }

  try {
    // Group IDs by type for batch deletion
    const userIds: string[] = [];
    const shopIds: string[] = [];
    const serviceIds: string[] = [];
    const reservationIds: string[] = [];

    for (const id of testDataIds) {
      const [type, actualId] = id.split(':');
      switch (type) {
        case 'user':
          userIds.push(actualId);
          break;
        case 'shop':
          shopIds.push(actualId);
          break;
        case 'service':
          serviceIds.push(actualId);
          break;
        case 'reservation':
          reservationIds.push(actualId);
          break;
      }
    }

    // Delete in reverse dependency order
    if (reservationIds.length > 0) {
      await testSupabaseClient
        .from('reservations')
        .delete()
        .in('id', reservationIds);
    }

    if (serviceIds.length > 0) {
      await testSupabaseClient
        .from('shop_services')
        .delete()
        .in('id', serviceIds);
    }

    if (shopIds.length > 0) {
      await testSupabaseClient
        .from('shops')
        .delete()
        .in('id', shopIds);
    }

    if (userIds.length > 0) {
      await testSupabaseClient
        .from('users')
        .delete()
        .in('id', userIds);
    }

    testDataIds.clear();
    logger.info(`✅ Cleaned up test data: ${userIds.length} users, ${shopIds.length} shops, ${serviceIds.length} services, ${reservationIds.length} reservations`);
  } catch (error) {
    logger.error('❌ Failed to cleanup test data:', error);
    throw error;
  }
}

/**
 * Close test database connection
 */
export async function closeTestDatabase() {
  // Supabase client doesn't need explicit closing
  testSupabaseClient = null;
  logger.info('✅ Test database connection closed');
}

// Global setup and teardown
beforeAll(async () => {
  await initializeTestDatabase();
}, 30000);

afterAll(async () => {
  await cleanupTestData();
  await closeTestDatabase();
}, 30000);

// Clean up after each test to prevent data leakage
afterEach(async () => {
  await cleanupTestData();
}, 10000);

export { testSupabaseClient };
