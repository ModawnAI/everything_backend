#!/usr/bin/env ts-node

/**
 * Test Data Setup Script
 * 
 * This script creates mock data and uploads it to Supabase for testing purposes.
 * It creates realistic test data that matches the database schema.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { faker } from '@faker-js/faker';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Test user IDs that will be used consistently across tests
const TEST_USER_IDS = [
  'user-1',
  'user-2', 
  'user-3',
  'test-user-123',
  'premium-user-456'
];

const TEST_SHOP_IDS = [
  'shop-123',
  '123e4567-e89b-12d3-a456-426614174000',
  'test-shop-1',
  'test-shop-2'
];

const TEST_SERVICE_IDS = [
  'service-1',
  'service-2',
  'uuid1',
  'uuid2'
];

async function clearTestData() {
  console.log('🧹 Clearing existing test data...');
  
  try {
    // Clear in reverse dependency order
    await supabase.from('point_usage_history').delete().in('user_id', TEST_USER_IDS);
    await supabase.from('point_transactions').delete().in('user_id', TEST_USER_IDS);
    await supabase.from('notifications').delete().in('user_id', TEST_USER_IDS);
    await supabase.from('reservations').delete().in('user_id', TEST_USER_IDS);
    await supabase.from('reservation_services').delete().in('reservation_id', ['reservation-1', 'reservation-2']);
    await supabase.from('shop_services').delete().in('shop_id', TEST_SHOP_IDS);
    await supabase.from('services').delete().in('id', TEST_SERVICE_IDS);
    await supabase.from('shops').delete().in('id', TEST_SHOP_IDS);
    await supabase.from('users').delete().in('id', TEST_USER_IDS);
    
    console.log('✅ Test data cleared successfully');
  } catch (error) {
    console.warn('⚠️ Warning: Some test data may not have been cleared:', error);
  }
}

async function createTestUsers() {
  console.log('👥 Creating test users...');
  
  const testUsers = [
    {
      id: 'user-1',
      email: 'test1@example.com',
      name: 'Test User 1',
      phone_number: '010-1234-5678',
      phone_verified: true,
      user_role: 'user',
      user_status: 'active',
      total_points: 150,
      available_points: 150,
      total_referrals: 0,
      successful_referrals: 0,
      marketing_consent: false,
      referral_code: 'TEST001',
      created_at: new Date('2024-01-01').toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'user-2',
      email: 'test2@example.com',
      name: 'Test User 2',
      phone_number: '010-2345-6789',
      phone_verified: true,
      user_role: 'user',
      user_status: 'active',
      total_points: 500,
      available_points: 300,
      total_referrals: 2,
      successful_referrals: 1,
      marketing_consent: true,
      referral_code: 'TEST002',
      created_at: new Date('2024-01-15').toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'user-3',
      email: 'test3@example.com',
      name: 'Test User 3',
      phone_number: '010-3456-7890',
      phone_verified: false,
      user_role: 'user',
      user_status: 'suspended',
      total_points: 50,
      available_points: 0,
      total_referrals: 0,
      successful_referrals: 0,
      marketing_consent: false,
      referral_code: 'TEST003',
      created_at: new Date('2024-02-01').toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'test-user-123',
      email: 'testuser123@example.com',
      name: 'Test User 123',
      phone_number: '010-4567-8901',
      phone_verified: true,
      user_role: 'user',
      user_status: 'active',
      total_points: 200,
      available_points: 200,
      total_referrals: 1,
      successful_referrals: 1,
      marketing_consent: true,
      referral_code: 'TEST123',
      created_at: new Date('2024-02-15').toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'premium-user-456',
      email: 'premium456@example.com',
      name: 'Premium User 456',
      phone_number: '010-5678-9012',
      phone_verified: true,
      user_role: 'premium',
      user_status: 'active',
      is_influencer: true,
      influencer_qualified_at: new Date('2024-03-01').toISOString(),
      total_points: 1000,
      available_points: 800,
      total_referrals: 5,
      successful_referrals: 4,
      marketing_consent: true,
      referral_code: 'PREM456',
      created_at: new Date('2024-03-01').toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const { error } = await supabase.from('users').insert(testUsers);
  if (error) {
    console.error('❌ Error creating test users:', error);
    throw error;
  }
  
  console.log(`✅ Created ${testUsers.length} test users`);
}

async function createTestShops() {
  console.log('🏪 Creating test shops...');
  
  const testShops = [
    {
      id: 'shop-123',
      owner_id: 'user-1',
      name: 'Test Beauty Salon',
      description: 'A test beauty salon for testing purposes',
      address: '123 Test Street, Seoul',
      phone_number: '02-1234-5678',
      email: 'shop1@example.com',
      shop_status: 'active',
      verification_status: 'verified',
      main_category: 'beauty',
      sub_categories: ['hair', 'skincare'],
      operating_hours: {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '10:00', close: '17:00' },
        sunday: { closed: true }
      },
      payment_methods: ['card', 'cash', 'points'],
      total_bookings: 50,
      commission_rate: 10.00,
      created_at: new Date('2024-01-01').toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '123e4567-e89b-12d3-a456-426614174000',
      owner_id: 'user-2',
      name: 'Premium Test Spa',
      description: 'A premium test spa for advanced testing',
      address: '456 Premium Avenue, Seoul',
      phone_number: '02-2345-6789',
      email: 'spa@example.com',
      shop_status: 'active',
      verification_status: 'verified',
      main_category: 'wellness',
      sub_categories: ['massage', 'skincare'],
      operating_hours: {
        monday: { open: '08:00', close: '20:00' },
        tuesday: { open: '08:00', close: '20:00' },
        wednesday: { open: '08:00', close: '20:00' },
        thursday: { open: '08:00', close: '20:00' },
        friday: { open: '08:00', close: '20:00' },
        saturday: { open: '09:00', close: '19:00' },
        sunday: { open: '10:00', close: '18:00' }
      },
      payment_methods: ['card', 'points'],
      total_bookings: 100,
      commission_rate: 8.00,
      is_featured: true,
      created_at: new Date('2024-01-15').toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'test-shop-1',
      owner_id: 'user-3',
      name: 'Test Shop 1',
      description: 'Basic test shop',
      address: '789 Test Road, Seoul',
      phone_number: '02-3456-7890',
      email: 'testshop1@example.com',
      shop_status: 'active',
      verification_status: 'pending',
      main_category: 'beauty',
      sub_categories: ['nails'],
      operating_hours: {
        monday: { open: '10:00', close: '19:00' },
        tuesday: { open: '10:00', close: '19:00' },
        wednesday: { open: '10:00', close: '19:00' },
        thursday: { open: '10:00', close: '19:00' },
        friday: { open: '10:00', close: '19:00' },
        saturday: { open: '11:00', close: '18:00' },
        sunday: { closed: true }
      },
      payment_methods: ['card', 'cash'],
      total_bookings: 10,
      commission_rate: 12.00,
      created_at: new Date('2024-02-01').toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'test-shop-2',
      name: 'Inactive Test Shop',
      description: 'Inactive shop for testing',
      address: '999 Closed Street, Seoul',
      phone_number: '02-4567-8901',
      email: 'inactive@example.com',
      shop_status: 'inactive',
      verification_status: 'rejected',
      main_category: 'beauty',
      sub_categories: [],
      operating_hours: {},
      payment_methods: ['card'],
      total_bookings: 0,
      commission_rate: 15.00,
      created_at: new Date('2024-02-15').toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const { error } = await supabase.from('shops').insert(testShops);
  if (error) {
    console.error('❌ Error creating test shops:', error);
    throw error;
  }
  
  console.log(`✅ Created ${testShops.length} test shops`);
}

async function createTestServices() {
  console.log('💅 Creating test shop services...');
  
  const testShopServices = [
    {
      id: 'service-1',
      shop_id: 'shop-123',
      name: 'Hair Cut',
      description: 'Professional hair cutting service',
      category: 'hair',
      price_min: 45000,
      price_max: 55000,
      duration_minutes: 60,
      deposit_amount: 10000,
      deposit_percentage: 20,
      is_available: true,
      booking_advance_days: 30,
      cancellation_hours: 24,
      created_at: new Date('2024-01-01').toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'service-2',
      shop_id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Facial Treatment',
      description: 'Relaxing facial treatment',
      category: 'skincare',
      price_min: 75000,
      price_max: 85000,
      duration_minutes: 90,
      deposit_amount: 15000,
      deposit_percentage: 20,
      is_available: true,
      booking_advance_days: 30,
      cancellation_hours: 24,
      created_at: new Date('2024-01-01').toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'uuid1',
      shop_id: 'shop-123',
      name: 'Manicure',
      description: 'Professional nail care',
      category: 'nails',
      price_min: 25000,
      price_max: 35000,
      duration_minutes: 45,
      deposit_amount: 5000,
      deposit_percentage: 20,
      is_available: true,
      booking_advance_days: 14,
      cancellation_hours: 12,
      created_at: new Date('2024-01-15').toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'uuid2',
      shop_id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Massage Therapy',
      description: 'Therapeutic massage',
      category: 'wellness',
      price_min: 95000,
      price_max: 105000,
      duration_minutes: 120,
      deposit_amount: 20000,
      deposit_percentage: 20,
      is_available: true,
      booking_advance_days: 30,
      cancellation_hours: 24,
      created_at: new Date('2024-01-15').toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const { error } = await supabase.from('shop_services').insert(testShopServices);
  if (error) {
    console.error('❌ Error creating test shop services:', error);
    throw error;
  }
  
  console.log(`✅ Created ${testShopServices.length} test shop services`);
}

// Shop services are now created directly in createTestServices function

async function createTestReservations() {
  console.log('📅 Creating test reservations...');
  
  const testReservations = [
    {
      id: 'reservation-1',
      user_id: 'user-1',
      shop_id: 'shop-123',
      reservation_date: '2024-03-15',
      reservation_time: '14:00',
      status: 'confirmed',
      total_amount: 50000,
      deposit_amount: 10000,
      remaining_amount: 40000,
      points_used: 0,
      special_requests: 'Test request',
      created_at: '2024-03-15T10:00:00Z',
      updated_at: '2024-03-15T10:00:00Z'
    },
    {
      id: 'reservation-2',
      user_id: 'user-2',
      shop_id: '123e4567-e89b-12d3-a456-426614174000',
      reservation_date: '2024-03-16',
      reservation_time: '15:00',
      status: 'requested',
      total_amount: 80000,
      deposit_amount: 16000,
      remaining_amount: 64000,
      points_used: 5000,
      special_requests: 'Premium service',
      created_at: '2024-03-15T11:00:00Z',
      updated_at: '2024-03-15T11:00:00Z'
    }
  ];

  const { error } = await supabase.from('reservations').insert(testReservations);
  if (error) {
    console.error('❌ Error creating test reservations:', error);
    throw error;
  }
  
  console.log(`✅ Created ${testReservations.length} test reservations`);
}

async function createReservationServices() {
  console.log('🛍️ Creating reservation services...');
  
  const reservationServices = [
    {
      reservation_id: 'reservation-1',
      service_id: 'service-1',
      quantity: 1,
      unit_price: 50000,
      total_price: 50000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      reservation_id: 'reservation-2',
      service_id: 'service-2',
      quantity: 1,
      unit_price: 80000,
      total_price: 80000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const { error } = await supabase.from('reservation_services').insert(reservationServices);
  if (error) {
    console.error('❌ Error creating reservation services:', error);
    throw error;
  }
  
  console.log(`✅ Created ${reservationServices.length} reservation services`);
}

async function createTestPointTransactions() {
  console.log('💰 Creating test point transactions...');
  
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const pointTransactions = [
    // Available points for user-1
    {
      id: 't1',
      user_id: 'user-1',
      amount: 100,
      status: 'available',
      transaction_type: 'earned',
      description: 'Welcome bonus',
      available_from: yesterday.toISOString(),
      expires_at: nextWeek.toISOString(),
      created_at: yesterday.toISOString(),
      updated_at: yesterday.toISOString()
    },
    {
      id: 't2',
      user_id: 'user-1',
      amount: 50,
      status: 'available',
      transaction_type: 'earned',
      description: 'Referral bonus',
      available_from: yesterday.toISOString(),
      expires_at: nextWeek.toISOString(),
      created_at: yesterday.toISOString(),
      updated_at: yesterday.toISOString()
    },
    // Pending points
    {
      id: 't3',
      user_id: 'user-2',
      amount: 200,
      status: 'pending',
      transaction_type: 'earned',
      description: 'Booking reward',
      available_from: tomorrow.toISOString(),
      expires_at: nextWeek.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString()
    },
    // Expiring points
    {
      id: 't4',
      user_id: 'premium-user-456',
      amount: 300,
      status: 'available',
      transaction_type: 'earned',
      description: 'Old points expiring soon',
      available_from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    },
    // Expired points
    {
      id: 't5',
      user_id: 'user-3',
      amount: 150,
      status: 'available',
      transaction_type: 'earned',
      description: 'Expired points',
      available_from: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: yesterday.toISOString(),
      created_at: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  const { error } = await supabase.from('point_transactions').insert(pointTransactions);
  if (error) {
    console.error('❌ Error creating test point transactions:', error);
    throw error;
  }
  
  console.log(`✅ Created ${pointTransactions.length} test point transactions`);
}

async function createTestNotifications() {
  console.log('🔔 Creating test notifications...');
  
  const notifications = [
    {
      id: 'notification-1',
      user_id: 'user-1',
      type: 'reservation_confirmed',
      title: 'Reservation Confirmed',
      message: 'Your reservation has been confirmed',
      status: 'sent',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'notification-2',
      user_id: 'user-2',
      type: 'points_expiring',
      title: 'Points Expiring Soon',
      message: 'Your points will expire in 2 days',
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const { error } = await supabase.from('notifications').insert(notifications);
  if (error) {
    console.error('❌ Error creating test notifications:', error);
    throw error;
  }
  
  console.log(`✅ Created ${notifications.length} test notifications`);
}

async function main() {
  try {
    console.log('🚀 Starting test data setup...');
    console.log(`📍 Supabase URL: ${supabaseUrl}`);
    
    await clearTestData();
    await createTestUsers();
    await createTestShops();
    await createTestServices();
    await createTestReservations();
    await createReservationServices();
    await createTestPointTransactions();
    await createTestNotifications();
    
    console.log('🎉 Test data setup completed successfully!');
    console.log('\n📊 Test Data Summary:');
    console.log(`   👥 Users: ${TEST_USER_IDS.length}`);
    console.log(`   🏪 Shops: ${TEST_SHOP_IDS.length}`);
    console.log(`   💅 Services: ${TEST_SERVICE_IDS.length}`);
    console.log(`   📅 Reservations: 2`);
    console.log(`   💰 Point Transactions: 5`);
    console.log(`   🔔 Notifications: 2`);
    
  } catch (error) {
    console.error('❌ Failed to setup test data:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main as setupTestData };
