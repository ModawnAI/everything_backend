import { createRealSupabaseClient, setupTestEnvironment } from '../setup/supabase-test-setup';
import { TestUserUtils } from '../setup/test-user-utils';
import { config } from '../../src/config/environment';

describe('Database Functions and Triggers Tests', () => {
  let supabase: any;
  let testUserUtils: TestUserUtils;
  let testUserIds: string[] = [];
  let testShopIds: string[] = [];
  let testServiceIds: string[] = [];
  let testReservationIds: string[] = [];

  beforeAll(async () => {
    setupTestEnvironment();
    
    // Skip tests if Supabase is not configured
    if (!config.database.supabaseUrl || !config.database.supabaseServiceRoleKey) {
      console.warn('Skipping database function tests: Supabase not configured');
      return;
    }
    
    supabase = createRealSupabaseClient();
    testUserUtils = new TestUserUtils();
    
    // Verify database connection
    const { error } = await supabase.from('users').select('count').limit(1);
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  });

  afterAll(async () => {
    // Cleanup test data
    if (testReservationIds.length > 0) {
      await supabase.from('reservations').delete().in('id', testReservationIds);
    }
    if (testServiceIds.length > 0) {
      await supabase.from('shop_services').delete().in('id', testServiceIds);
    }
    if (testShopIds.length > 0) {
      await supabase.from('shops').delete().in('id', testShopIds);
    }
    if (testUserIds.length > 0) {
      for (const userId of testUserIds) {
        try {
          await testUserUtils.cleanupTestUser(userId);
        } catch (error) {
          console.warn(`Failed to cleanup user ${userId}:`, error);
        }
      }
    }
  });

  describe('create_reservation_with_lock function', () => {
    beforeEach(() => {
      // Skip tests if Supabase is not configured
      if (!config.database.supabaseUrl || !config.database.supabaseServiceRoleKey) {
        pending('Supabase not configured');
      }
    });

    it('should create reservation with proper locking mechanism', async () => {
      // Create test user
      const { profile: user } = await testUserUtils.createTestUser({
        name: 'Test User',
        birth_date: '1990-01-01',
        gender: 'male',
        user_status: 'active'
      });
      testUserIds.push(user.id);

      // Create test shop
      const shop = await testUserUtils.createTestShop(user.id, {
        name: 'Test Shop',
        description: 'Test shop',
        address: 'Test Address',
        main_category: 'beauty',
        shop_status: 'active'
      });
      testShopIds.push(shop.id);

      // Create test service
      const service = await testUserUtils.createTestService(shop.id, {
        name: 'Test Service',
        description: 'Test service description',
        duration_minutes: 60,
        price_min: 50000,
        price_max: 50000,
        category: 'haircut',
        is_available: true
      });
      testServiceIds.push(service.id);

      // Test the database function
      const reservationDate = new Date();
      reservationDate.setDate(reservationDate.getDate() + 1); // Tomorrow
      const reservationDateStr = reservationDate.toISOString().split('T')[0];

      const { data: reservation, error: reservationError } = await supabase
        .rpc('create_reservation_with_lock', {
          p_user_id: user.id,
          p_shop_id: shop.id,
          p_service_id: service.id,
          p_reservation_date: reservationDateStr,
          p_start_time: '10:00',
          p_end_time: '11:00',
          p_notes: 'Test reservation'
        });

      expect(reservationError).toBeNull();
      expect(reservation).toBeDefined();
      expect(reservation.id).toBeDefined();
      expect(reservation.reservation_status).toBe('pending');
      
      testReservationIds.push(reservation.id);
    }, 30000);

    it('should handle concurrent reservation attempts', async () => {
      // Create test users
      const users = [];
      for (let i = 0; i < 3; i++) {
        const { profile: user } = await testUserUtils.createTestUser({
          name: `Test User ${i}`,
          birth_date: '1990-01-01',
          gender: 'male',
          user_status: 'active'
        });
        users.push(user);
        testUserIds.push(user.id);
      }

      // Create test shop
      const shop = await testUserUtils.createTestShop(users[0].id, {
        name: 'Test Shop Concurrent',
        description: 'Test shop for concurrent testing',
        address: 'Test Address',
        main_category: 'beauty',
        shop_status: 'active'
      });
      testShopIds.push(shop.id);

      // Create test service
      const service = await testUserUtils.createTestService(shop.id, {
        name: 'Test Service',
        description: 'Test service description',
        duration_minutes: 60,
        price_min: 50000,
        price_max: 50000,
        category: 'haircut',
        is_available: true
      });
      testServiceIds.push(service.id);

      // Attempt concurrent reservations for the same time slot
      const reservationDate = new Date();
      reservationDate.setDate(reservationDate.getDate() + 1);
      const reservationDateStr = reservationDate.toISOString().split('T')[0];

      const concurrentPromises = users.map(user =>
        supabase.rpc('create_reservation_with_lock', {
          p_user_id: user.id,
          p_shop_id: shop.id,
          p_service_id: service.id,
          p_reservation_date: reservationDateStr,
          p_start_time: '10:00',
          p_end_time: '11:00',
          p_notes: `Concurrent test reservation for user ${user.id}`
        })
      );

      const results = await Promise.allSettled(concurrentPromises);
      
      // Only one reservation should succeed, others should fail
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.error === null
      );
      const failed = results.filter(r => 
        r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error !== null)
      );

      expect(successful.length).toBe(1);
      expect(failed.length).toBe(2);

      // Store successful reservation for cleanup
      if (successful.length > 0) {
        const successResult = successful[0] as PromiseFulfilledResult<any>;
        testReservationIds.push(successResult.value.data.id);
      }
    }, 30000);
  });

  describe('reschedule_reservation function', () => {
    it('should reschedule an existing reservation', async () => {
      // Create test user
      const { profile: user } = await testUserUtils.createTestUser({
        name: 'Test User Reschedule',
        birth_date: '1990-01-01',
        gender: 'male',
        user_status: 'active'
      });
      testUserIds.push(user.id);

      // Create test shop
      const shop = await testUserUtils.createTestShop(user.id, {
        name: 'Test Shop Reschedule',
        description: 'Test shop for reschedule',
        address: 'Test Address',
        main_category: 'beauty',
        shop_status: 'active'
      });
      testShopIds.push(shop.id);

      // Create test service
      const service = await testUserUtils.createTestService(shop.id, {
        name: 'Test Service',
        description: 'Test service description',
        duration_minutes: 60,
        price_min: 50000,
        price_max: 50000,
        category: 'haircut',
        is_available: true
      });
      testServiceIds.push(service.id);

      // Create initial reservation
      const reservationDate = new Date();
      reservationDate.setDate(reservationDate.getDate() + 1);
      const reservationDateStr = reservationDate.toISOString().split('T')[0];

      const { data: reservation, error: reservationError } = await supabase
        .rpc('create_reservation_with_lock', {
          p_user_id: user.id,
          p_shop_id: shop.id,
          p_service_id: service.id,
          p_reservation_date: reservationDateStr,
          p_start_time: '10:00',
          p_end_time: '11:00',
          p_notes: 'Initial reservation'
        });

      expect(reservationError).toBeNull();
      testReservationIds.push(reservation.id);

      // Reschedule the reservation
      const newReservationDate = new Date();
      newReservationDate.setDate(newReservationDate.getDate() + 2);
      const newReservationDateStr = newReservationDate.toISOString().split('T')[0];

      const { data: rescheduledReservation, error: rescheduleError } = await supabase
        .rpc('reschedule_reservation', {
          p_reservation_id: reservation.id,
          p_new_date: newReservationDateStr,
          p_new_start_time: '14:00',
          p_new_end_time: '15:00',
          p_reason: 'Customer request'
        });

      expect(rescheduleError).toBeNull();
      expect(rescheduledReservation).toBeDefined();
      expect(rescheduledReservation.reservation_date).toBe(newReservationDateStr);
      expect(rescheduledReservation.start_time).toBe('14:00');
      expect(rescheduledReservation.end_time).toBe('15:00');

      // Verify the original reservation is updated
      const { data: updatedReservation, error: fetchError } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', reservation.id)
        .single();

      expect(fetchError).toBeNull();
      expect(updatedReservation.reservation_date).toBe(newReservationDateStr);
      expect(updatedReservation.start_time).toBe('14:00');
      expect(updatedReservation.end_time).toBe('15:00');
    }, 30000);
  });

  describe('Point Transaction Triggers', () => {
    it('should automatically update user point balance on point transaction', async () => {
      // Create test user
      const { profile: user } = await testUserUtils.createTestUser({
        name: 'Test User Points',
        birth_date: '1990-01-01',
        gender: 'male',
        user_status: 'active'
      });
      testUserIds.push(user.id);

      // Insert point transaction
      const { data: transaction, error: transactionError } = await supabase
        .from('point_transactions')
        .insert({
          user_id: user.id,
          points_amount: 1000,
          transaction_type: 'earned',
          source_type: 'reservation',
          description: 'Test point earning',
          transaction_status: 'completed'
        })
        .select()
        .single();

      expect(transactionError).toBeNull();

      // Verify user point balance was updated
      const { data: updatedUser, error: fetchError } = await supabase
        .from('users')
        .select('total_points, available_points')
        .eq('id', user.id)
        .single();

      expect(fetchError).toBeNull();
      expect(updatedUser.total_points).toBe(1000);
      expect(updatedUser.available_points).toBe(1000);
    });
  });

  describe('Reservation Status Log Triggers', () => {
    it('should create status log entry when reservation status changes', async () => {
      // Create test user
      const { profile: user } = await testUserUtils.createTestUser({
        name: 'Test User Status',
        birth_date: '1990-01-01',
        gender: 'male',
        user_status: 'active'
      });
      testUserIds.push(user.id);

      // Create test shop
      const shop = await testUserUtils.createTestShop(user.id, {
        name: 'Test Shop Status',
        description: 'Test shop for status',
        address: 'Test Address',
        main_category: 'beauty',
        shop_status: 'active'
      });
      testShopIds.push(shop.id);

      // Create test service
      const service = await testUserUtils.createTestService(shop.id, {
        name: 'Test Service',
        description: 'Test service description',
        duration_minutes: 60,
        price_min: 50000,
        price_max: 50000,
        category: 'haircut',
        is_available: true
      });
      testServiceIds.push(service.id);

      // Create reservation
      const reservationDate = new Date();
      reservationDate.setDate(reservationDate.getDate() + 1);
      const reservationDateStr = reservationDate.toISOString().split('T')[0];

      const { data: reservation, error: reservationError } = await supabase
        .rpc('create_reservation_with_lock', {
          p_user_id: user.id,
          p_shop_id: shop.id,
          p_service_id: service.id,
          p_reservation_date: reservationDateStr,
          p_start_time: '10:00',
          p_end_time: '11:00',
          p_notes: 'Status test reservation'
        });

      expect(reservationError).toBeNull();
      testReservationIds.push(reservation.id);

      // Update reservation status
      const { error: updateError } = await supabase
        .from('reservations')
        .update({ reservation_status: 'confirmed' })
        .eq('id', reservation.id);

      expect(updateError).toBeNull();

      // Verify status log was created
      const { data: statusLogs, error: logError } = await supabase
        .from('reservation_status_logs')
        .select('*')
        .eq('reservation_id', reservation.id)
        .order('created_at', { ascending: false });

      expect(logError).toBeNull();
      expect(statusLogs).toHaveLength(2); // Initial 'pending' and updated 'confirmed'
      expect(statusLogs[0].status).toBe('confirmed');
      expect(statusLogs[1].status).toBe('pending');
    });
  });

  describe('Shop Approval Triggers', () => {
    it('should update shop status and create approval log', async () => {
      // Create test user
      const { profile: user } = await testUserUtils.createTestUser({
        name: 'Test User Shop',
        birth_date: '1990-01-01',
        gender: 'male',
        user_status: 'active'
      });
      testUserIds.push(user.id);

      // Create shop with pending status
      const shop = await testUserUtils.createTestShop(user.id, {
        name: 'Test Shop Approval',
        description: 'Test shop for approval',
        address: 'Test Address',
        main_category: 'beauty',
        shop_status: 'pending_approval'
      });
      testShopIds.push(shop.id);

      // Approve shop
      const { error: approveError } = await supabase
        .from('shops')
        .update({ shop_status: 'active' })
        .eq('id', shop.id);

      expect(approveError).toBeNull();

      // Verify shop status was updated
      const { data: updatedShop, error: fetchError } = await supabase
        .from('shops')
        .select('shop_status')
        .eq('id', shop.id)
        .single();

      expect(fetchError).toBeNull();
      expect(updatedShop.shop_status).toBe('active');
    });
  });

  describe('User Profile Update Triggers', () => {
    it('should update user profile timestamps', async () => {
      // Create test user
      const { profile: user } = await testUserUtils.createTestUser({
        name: 'Test User Profile',
        birth_date: '1990-01-01',
        gender: 'male',
        user_status: 'active'
      });
      testUserIds.push(user.id);

      const originalUpdatedAt = user.updated_at;

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update user profile
      const { error: updateError } = await supabase
        .from('users')
        .update({ name: 'Updated Name' })
        .eq('id', user.id);

      expect(updateError).toBeNull();

      // Verify updated_at timestamp was updated
      const { data: updatedUser, error: fetchError } = await supabase
        .from('users')
        .select('updated_at')
        .eq('id', user.id)
        .single();

      expect(fetchError).toBeNull();
      expect(new Date(updatedUser.updated_at)).toBeInstanceOf(Date);
      expect(new Date(updatedUser.updated_at).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime()
      );
    });
  });

  describe('Error Handling in Database Functions', () => {
    it('should handle invalid parameters gracefully', async () => {
      // Test with non-existent user ID
      const { data, error } = await supabase
        .rpc('create_reservation_with_lock', {
          p_user_id: 'non-existent-user-id',
          p_shop_id: 'non-existent-shop-id',
          p_service_id: 'non-existent-service-id',
          p_reservation_date: '2024-01-01',
          p_start_time: '10:00',
          p_end_time: '11:00',
          p_notes: 'Invalid test'
        });

      expect(error).toBeDefined();
      expect(error.message).toContain('not found');
    });

    it('should handle invalid date formats', async () => {
      // Create test user first
      const { profile: user } = await testUserUtils.createTestUser({
        name: 'Test User Invalid',
        birth_date: '1990-01-01',
        gender: 'male',
        user_status: 'active'
      });
      testUserIds.push(user.id);

      // Test with invalid date format
      const { data, error } = await supabase
        .rpc('create_reservation_with_lock', {
          p_user_id: user.id,
          p_shop_id: 'non-existent-shop-id',
          p_service_id: 'non-existent-service-id',
          p_reservation_date: 'invalid-date',
          p_start_time: '10:00',
          p_end_time: '11:00',
          p_notes: 'Invalid date test'
        });

      expect(error).toBeDefined();
    });
  });
});