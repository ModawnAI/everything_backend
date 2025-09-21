import { createRealSupabaseClient, setupTestEnvironment } from '../setup/supabase-test-setup';
import { TestUserUtils } from '../setup/test-user-utils';
import { config } from '../../src/config/environment';

describe('Basic Database Functions Tests (Current Schema)', () => {
  let supabase: any;
  let testUserUtils: TestUserUtils;
  let testUserIds: string[] = [];
  let testShopIds: string[] = [];
  let testServiceIds: string[] = [];

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

  describe('User Creation and Management', () => {
    beforeEach(() => {
      // Skip tests if Supabase is not configured
      if (!config.database.supabaseUrl || !config.database.supabaseServiceRoleKey) {
        pending('Supabase not configured');
      }
    });

    it('should create a test user with auth and profile', async () => {
      // Create test user
      const { authUser, profile } = await testUserUtils.createTestUser({
        name: 'Test User Basic',
        birth_date: '1990-01-01',
        gender: 'male',
        user_status: 'active'
      });
      
      expect(authUser).toBeDefined();
      expect(authUser.id).toBeDefined();
      expect(profile).toBeDefined();
      expect(profile.id).toBe(authUser.id);
      expect(profile.name).toBe('Test User Basic');
      expect(profile.user_status).toBe('active');
      
      testUserIds.push(profile.id);
    }, 30000);

    it('should create multiple users concurrently', async () => {
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          testUserUtils.createTestUser({
            name: `Concurrent User ${i}`,
            birth_date: '1990-01-01',
            gender: 'male',
            user_status: 'active'
          })
        );
      }

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.profile.name).toBe(`Concurrent User ${index}`);
        testUserIds.push(result.profile.id);
      });
    }, 30000);
  });

  describe('Shop Creation and Management', () => {
    it('should create a shop for a user', async () => {
      // Create test user first
      const { profile: user } = await testUserUtils.createTestUser({
        name: 'Shop Owner',
        birth_date: '1985-01-01',
        gender: 'female',
        user_status: 'active'
      });
      testUserIds.push(user.id);

      // Create test shop
      const shop = await testUserUtils.createTestShop(user.id, {
        name: 'Test Beauty Shop',
        description: 'A beautiful test shop',
        address: '123 Test Street, Seoul',
        main_category: 'hair',
        shop_status: 'active'
      });
      
      expect(shop).toBeDefined();
      expect(shop.id).toBeDefined();
      expect(shop.owner_id).toBe(user.id);
      expect(shop.name).toBe('Test Beauty Shop');
      expect(shop.shop_status).toBe('active');
      
      testShopIds.push(shop.id);
    }, 30000);

    it('should create a service for a shop', async () => {
      // Create test user first
      const { profile: user } = await testUserUtils.createTestUser({
        name: 'Service Owner',
        birth_date: '1988-01-01',
        gender: 'male',
        user_status: 'active'
      });
      testUserIds.push(user.id);

      // Create test shop
      const shop = await testUserUtils.createTestShop(user.id, {
        name: 'Service Test Shop',
        description: 'Shop for service testing',
        address: '456 Service Street, Seoul',
        main_category: 'hair',
        shop_status: 'active'
      });
      testShopIds.push(shop.id);

      // Create test service
      const service = await testUserUtils.createTestService(shop.id, {
        name: 'Premium Haircut',
        description: 'A premium haircut service',
        category: 'haircut',
        duration_minutes: 90,
        price_min: 80000,
        price_max: 100000,
        is_available: true
      });
      
      expect(service).toBeDefined();
      expect(service.id).toBeDefined();
      expect(service.shop_id).toBe(shop.id);
      expect(service.name).toBe('Premium Haircut');
      expect(service.duration_minutes).toBe(90);
      expect(service.price_min).toBe(80000);
      expect(service.price_max).toBe(100000);
      expect(service.is_available).toBe(true);
      
      testServiceIds.push(service.id);
    }, 30000);
  });

  describe('Data Relationships and Constraints', () => {
    it('should enforce foreign key constraints', async () => {
      // Try to create a shop with non-existent owner
      const { error } = await supabase
        .from('shops')
        .insert({
          name: 'Invalid Shop',
          description: 'This should fail',
          address: 'Invalid Address',
          owner_id: '00000000-0000-0000-0000-000000000001', // Non-existent user
          main_category: 'hair'
        });

      expect(error).toBeDefined();
      expect(error.message).toContain('violates foreign key constraint');
    });

    it('should enforce unique constraints', async () => {
      // Create first user
      const { profile: user1 } = await testUserUtils.createTestUser({
        name: 'Unique User 1',
        email: 'unique@example.com'
      });
      testUserIds.push(user1.id);

      // Try to create second user with same email
      try {
        await testUserUtils.createTestUser({
          name: 'Unique User 2',
          email: 'unique@example.com' // Same email
        });
        fail('Should have thrown an error for duplicate email');
      } catch (error) {
        expect(error.message).toContain('Failed to create auth user');
      }
    });

    it('should handle null constraints properly', async () => {
      // Try to create user without required name field
      const { error } = await supabase
        .from('users')
        .insert({
          id: '00000000-0000-0000-0000-000000000999',
          email: 'noname@example.com'
          // Missing required 'name' field
        });

      expect(error).toBeDefined();
      expect(error.message).toContain('null value in column "name"');
    });
  });

  describe('Database Triggers (Available Tables)', () => {
    it('should update user timestamps on profile update', async () => {
      // Create test user
      const { profile: user } = await testUserUtils.createTestUser({
        name: 'Timestamp Test User',
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

    it('should update shop timestamps on shop update', async () => {
      // Create test user and shop
      const { profile: user } = await testUserUtils.createTestUser({
        name: 'Shop Timestamp Owner',
        birth_date: '1990-01-01',
        gender: 'male',
        user_status: 'active'
      });
      testUserIds.push(user.id);

      const shop = await testUserUtils.createTestShop(user.id, {
        name: 'Timestamp Test Shop',
        description: 'Shop for timestamp testing',
        address: 'Timestamp Street, Seoul',
        main_category: 'hair',
        shop_status: 'active'
      });
      testShopIds.push(shop.id);

      const originalUpdatedAt = shop.updated_at;

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update shop
      const { error: updateError } = await supabase
        .from('shops')
        .update({ name: 'Updated Shop Name' })
        .eq('id', shop.id);

      expect(updateError).toBeNull();

      // Verify updated_at timestamp was updated
      const { data: updatedShop, error: fetchError } = await supabase
        .from('shops')
        .select('updated_at')
        .eq('id', shop.id)
        .single();

      expect(fetchError).toBeNull();
      expect(new Date(updatedShop.updated_at)).toBeInstanceOf(Date);
      expect(new Date(updatedShop.updated_at).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime()
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid data gracefully', async () => {
      // Try to create user with invalid email format
      const { error } = await supabase
        .from('users')
        .insert({
          id: '00000000-0000-0000-0000-000000000998',
          email: 'invalid-email-format',
          name: 'Invalid Email User'
        });

      expect(error).toBeDefined();
      expect(error.message).toContain('violates foreign key constraint');
    });

    it('should handle non-existent table gracefully', async () => {
      // Try to query a table that doesn't exist yet
      const { error } = await supabase
        .from('non_existent_table')
        .select('*');

      expect(error).toBeDefined();
      expect(error.message).toContain('Could not find the table');
    });
  });
});
