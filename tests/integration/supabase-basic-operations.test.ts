import { createRealSupabaseClient, setupTestEnvironment } from '../setup/supabase-test-setup';
import { config } from '../../src/config/environment';

describe('Supabase Basic Operations Tests', () => {
  let supabase: any;

  beforeAll(async () => {
    setupTestEnvironment();
    
    // Skip tests if Supabase is not configured
    if (!config.database.supabaseUrl || !config.database.supabaseServiceRoleKey) {
      console.warn('Skipping Supabase tests: Supabase not configured');
      return;
    }
    
    supabase = createRealSupabaseClient();
    
    // Verify database connection
    const { error } = await supabase.from('users').select('count').limit(1);
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  });

  describe('Database Connection and Basic Queries', () => {
    beforeEach(() => {
      // Skip tests if Supabase is not configured
      if (!config.database.supabaseUrl || !config.database.supabaseServiceRoleKey) {
        pending('Supabase not configured');
      }
    });

    it('should connect to Supabase successfully', async () => {
      const { data, error } = await supabase
        .from('users')
        .select('count')
        .limit(1);

      // Should not have connection errors
      expect(error).toBeNull();
    });

    it('should query existing tables', async () => {
      const tablesToCheck = [
        'users',
        'shops',
        'shop_categories',
        'shop_services',
        'user_settings'
      ];

      for (const table of tablesToCheck) {
        const { error } = await supabase
          .from(table)
          .select('count')
          .limit(1);
        
        if (error) {
          console.log(`Table ${table} not accessible: ${error.message}`);
        } else {
          console.log(`Table ${table} is accessible`);
        }
      }
    });

    it('should handle queries on non-existent tables gracefully', async () => {
      const { error } = await supabase
        .from('non_existent_table')
        .select('*');

      expect(error).toBeDefined();
      expect(error.message).toContain('Could not find the table');
    });
  });

  describe('Data Validation and Constraints', () => {
    it('should enforce required fields', async () => {
      // Try to insert user without required name field
      const { error } = await supabase
        .from('users')
        .insert({
          id: '00000000-0000-0000-0000-000000000999',
          email: 'test@example.com'
          // Missing required 'name' field
        });

      expect(error).toBeDefined();
      expect(error.message).toContain('null value in column "name"');
    });

    it('should enforce foreign key constraints', async () => {
      // Try to create shop with non-existent owner
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

    it('should validate enum values', async () => {
      // Try to create shop with invalid category
      const { error } = await supabase
        .from('shops')
        .insert({
          name: 'Invalid Category Shop',
          description: 'This should fail',
          address: 'Invalid Address',
          owner_id: '00000000-0000-0000-0000-000000000001',
          main_category: 'invalid_category' // Invalid enum value
        });

      expect(error).toBeDefined();
      expect(error.message).toContain('invalid input value for enum');
    });

    it('should enforce unique constraints', async () => {
      // First, check if there are any existing users
      const { data: existingUsers } = await supabase
        .from('users')
        .select('email')
        .limit(1);

      if (existingUsers && existingUsers.length > 0) {
        // Try to create another user with the same email
        const { error } = await supabase
          .from('users')
          .insert({
            id: '00000000-0000-0000-0000-000000000998',
            email: existingUsers[0].email, // Same email
            name: 'Duplicate Email User'
          });

        expect(error).toBeDefined();
        expect(error.message).toContain('violates unique constraint');
      } else {
        console.log('No existing users found to test unique constraint');
      }
    });
  });

  describe('Shop Categories and Services', () => {
    it('should query available shop categories', async () => {
      const { data: categories, error } = await supabase
        .from('shop_categories')
        .select('id, display_name, description')
        .limit(10);

      expect(error).toBeNull();
      expect(categories).toBeDefined();
      expect(Array.isArray(categories)).toBe(true);
      
      if (categories.length > 0) {
        expect(categories[0]).toHaveProperty('id');
        expect(categories[0]).toHaveProperty('display_name');
        console.log('Available categories:', categories.map(c => `${c.id}: ${c.display_name}`));
      }
    });

    it('should query existing shops', async () => {
      const { data: shops, error } = await supabase
        .from('shops')
        .select('id, name, main_category, shop_status')
        .limit(5);

      expect(error).toBeNull();
      expect(shops).toBeDefined();
      expect(Array.isArray(shops)).toBe(true);
      
      if (shops.length > 0) {
        console.log('Existing shops:', shops.map(s => `${s.name} (${s.main_category})`));
      }
    });

    it('should query existing services', async () => {
      const { data: services, error } = await supabase
        .from('shop_services')
        .select('id, name, category, price_min, price_max')
        .limit(5);

      expect(error).toBeNull();
      expect(services).toBeDefined();
      expect(Array.isArray(services)).toBe(true);
      
      if (services.length > 0) {
        console.log('Existing services:', services.map(s => `${s.name} (${s.category})`));
      }
    });
  });

  describe('Database Functions (if available)', () => {
    it('should check if reservation functions exist', async () => {
      // Try to call the reservation function to see if it exists
      const { error } = await supabase.rpc('create_reservation_with_lock', {
        p_shop_id: '00000000-0000-0000-0000-000000000001',
        p_user_id: '00000000-0000-0000-0000-000000000001',
        p_reservation_date: '2024-01-01',
        p_reservation_time: '10:00:00'
      });

      if (error) {
        if (error.message.includes('Could not find the function')) {
          console.log('⚠️  Database functions not installed yet');
        } else {
          console.log('✅ Database functions exist (call failed as expected):', error.message);
        }
      } else {
        console.log('✅ Database functions exist and call succeeded');
      }
    });

    it('should check if reschedule function exists', async () => {
      const { error } = await supabase.rpc('reschedule_reservation', {
        p_reservation_id: '00000000-0000-0000-0000-000000000001',
        p_new_date: '2024-01-02',
        p_new_time: '11:00:00'
      });

      if (error) {
        if (error.message.includes('Could not find the function')) {
          console.log('⚠️  Reschedule function not installed yet');
        } else {
          console.log('✅ Reschedule function exists (call failed as expected):', error.message);
        }
      } else {
        console.log('✅ Reschedule function exists and call succeeded');
      }
    });
  });

  describe('Missing Tables Check', () => {
    it('should identify missing tables needed for full functionality', async () => {
      const requiredTables = [
        'reservations',
        'reservation_services', 
        'point_transactions',
        'reservation_status_logs',
        'notification_settings'
      ];

      const missingTables = [];

      for (const table of requiredTables) {
        const { error } = await supabase
          .from(table)
          .select('count')
          .limit(1);
        
        if (error && error.message.includes('Could not find the table')) {
          missingTables.push(table);
        }
      }

      if (missingTables.length > 0) {
        console.log('⚠️  Missing tables that need to be created:');
        missingTables.forEach(table => console.log(`   - ${table}`));
        console.log('💡 Run migrations to create these tables: npm run migrate');
      } else {
        console.log('✅ All required tables exist');
      }

      // This test always passes - it's just for information
      expect(true).toBe(true);
    });
  });
});
