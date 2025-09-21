import { createClient } from '@supabase/supabase-js';
import { config } from '../../src/config/environment';

/**
 * Test utility for creating users in Supabase for database function testing
 */
export class TestUserUtils {
  private supabase: any;

  constructor() {
    this.supabase = createClient(
      config.database.supabaseUrl!,
      config.database.supabaseServiceRoleKey!
    );
  }

  /**
   * Create a test user with both auth and profile
   */
  async createTestUser(userData: {
    email?: string;
    phone_number?: string;
    name: string;
    birth_date?: string;
    gender?: 'male' | 'female' | 'other';
    user_status?: 'active' | 'suspended' | 'inactive';
    user_role?: 'user' | 'admin' | 'shop_owner';
  }): Promise<{ authUser: any; profile: any }> {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    
    const email = userData.email || `testuser${randomId}@gmail.com`;
    const phone_number = userData.phone_number || `+821012345${String(randomId).padStart(3, '0')}`;
    const password = `TestPassword${timestamp}!`;

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: userData.name,
          phone: phone_number
        }
      }
    });

    if (authError || !authData.user) {
      throw new Error(`Failed to create auth user: ${authError?.message}`);
    }

    // Create profile in public.users
    const profileData = {
      id: authData.user.id,
      email,
      phone_number,
      name: userData.name,
      birth_date: userData.birth_date || '1990-01-01',
      gender: userData.gender || 'male',
      user_status: userData.user_status || 'active',
      user_role: userData.user_role || 'user',
      phone_verified: false,
      is_influencer: false,
      total_points: 0,
      available_points: 0,
      total_referrals: 0,
      successful_referrals: 0
    };

    const { data: profile, error: profileError } = await this.supabase
      .from('users')
      .insert(profileData)
      .select()
      .single();

    if (profileError) {
      // Clean up auth user if profile creation fails
      await this.supabase.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Failed to create user profile: ${profileError.message}`);
    }

    return { authUser: authData.user, profile };
  }

  /**
   * Create a test shop
   */
  async createTestShop(ownerId: string, shopData: {
    name?: string;
    description?: string;
    address?: string;
    main_category?: string;
    shop_status?: 'pending_approval' | 'active' | 'suspended' | 'inactive';
  } = {}): Promise<any> {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 6);

    const shop = {
      name: shopData.name || `Test Shop ${timestamp}-${randomId}`,
      description: shopData.description || 'Test shop for database function testing',
      address: shopData.address || 'Test Address, Seoul, South Korea',
      detailed_address: 'Test Detailed Address',
      postal_code: '12345',
      latitude: 37.5665,
      longitude: 126.9780,
      phone_number: `+82109876${randomId}`,
      email: `shop${timestamp}@example.com`,
      owner_id: ownerId,
      main_category: shopData.main_category || 'beauty',
      shop_status: shopData.shop_status || 'active',
      verification_status: 'pending',
      is_featured: false,
      total_bookings: 0,
      commission_rate: 10.00
    };

    const { data, error } = await this.supabase
      .from('shops')
      .insert(shop)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test shop: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a test service for a shop
   */
  async createTestService(shopId: string, serviceData: {
    name?: string;
    description?: string;
    category?: string;
    duration_minutes?: number;
    price_min?: number;
    price_max?: number;
    is_available?: boolean;
  } = {}): Promise<any> {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 6);

    const service = {
      shop_id: shopId,
      name: serviceData.name || `Test Service ${timestamp}-${randomId}`,
      description: serviceData.description || 'Test service for database function testing',
      category: serviceData.category || 'haircut',
      duration_minutes: serviceData.duration_minutes || 60,
      price_min: serviceData.price_min || 50000,
      price_max: serviceData.price_max || 50000,
      is_available: serviceData.is_available !== undefined ? serviceData.is_available : true,
      booking_advance_days: 30,
      cancellation_hours: 24,
      display_order: 0
    };

    const { data, error } = await this.supabase
      .from('shop_services')
      .insert(service)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test service: ${error.message}`);
    }

    return data;
  }

  /**
   * Clean up test user (both auth and profile)
   */
  async cleanupTestUser(userId: string): Promise<void> {
    // Delete profile first
    await this.supabase
      .from('users')
      .delete()
      .eq('id', userId);

    // Delete auth user
    await this.supabase.auth.admin.deleteUser(userId);
  }

  /**
   * Clean up test shop
   */
  async cleanupTestShop(shopId: string): Promise<void> {
    await this.supabase
      .from('shops')
      .delete()
      .eq('id', shopId);
  }

  /**
   * Clean up test service
   */
  async cleanupTestService(serviceId: string): Promise<void> {
    await this.supabase
      .from('shop_services')
      .delete()
      .eq('id', serviceId);
  }
}
