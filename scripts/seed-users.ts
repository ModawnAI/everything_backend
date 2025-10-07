/**
 * Seed Regular Users for Testing Admin Panel
 * Creates diverse user profiles with various statuses and roles
 */

import { getSupabaseClient } from '../src/config/database';
import { randomUUID } from 'crypto';

const supabase = getSupabaseClient();

async function seedUsers() {
  console.log('👥 Seeding regular users...\n');

  const users = [
    // Active regular users
    {
      id: randomUUID(),
      email: 'user1@example.com',
      name: '김민지',
      nickname: 'minji',
      phone_number: '010-1234-5678',
      phone_verified: true,
      gender: 'female',
      birth_date: '1995-03-15',
      user_role: 'user',
      user_status: 'active',
      is_influencer: false,
      social_provider: 'kakao',
      referral_code: 'MINJI2024',
      total_points: 5000,
      available_points: 5000,
      total_referrals: 3,
      successful_referrals: 2,
      marketing_consent: true,
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted_at: new Date().toISOString(),
      last_login_at: new Date().toISOString()
    },
    {
      id: randomUUID(),
      email: 'user2@example.com',
      name: '박서준',
      nickname: 'seojun',
      phone_number: '010-2345-6789',
      phone_verified: true,
      gender: 'male',
      birth_date: '1992-07-22',
      user_role: 'user',
      user_status: 'active',
      is_influencer: false,
      social_provider: 'google',
      referral_code: 'SEOJUN2024',
      total_points: 12000,
      available_points: 8000,
      total_referrals: 5,
      successful_referrals: 4,
      marketing_consent: true,
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted_at: new Date().toISOString(),
      last_login_at: new Date(Date.now() - 86400000).toISOString() // 1 day ago
    },
    {
      id: randomUUID(),
      email: 'user3@example.com',
      name: '이지은',
      nickname: 'jieun',
      phone_number: '010-3456-7890',
      phone_verified: true,
      gender: 'female',
      birth_date: '1998-11-05',
      user_role: 'user',
      user_status: 'active',
      is_influencer: false,
      social_provider: 'google',
      referral_code: 'JIEUN2024',
      total_points: 3000,
      available_points: 3000,
      total_referrals: 1,
      successful_referrals: 1,
      marketing_consent: false,
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted_at: new Date().toISOString(),
      last_login_at: new Date(Date.now() - 172800000).toISOString() // 2 days ago
    },

    // Shop owners
    {
      id: randomUUID(),
      email: 'owner1@example.com',
      name: '최유나',
      nickname: 'yuna_beauty',
      phone_number: '010-4567-8901',
      phone_verified: true,
      gender: 'female',
      birth_date: '1988-05-10',
      user_role: 'shop_owner',
      user_status: 'active',
      is_influencer: false,
      social_provider: 'email',
      referral_code: 'YUNA2024',
      total_points: 50000,
      available_points: 45000,
      total_referrals: 15,
      successful_referrals: 12,
      marketing_consent: true,
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted_at: new Date().toISOString(),
      last_login_at: new Date().toISOString()
    },
    {
      id: randomUUID(),
      email: 'owner2@example.com',
      name: '강태희',
      nickname: 'taehee_nails',
      phone_number: '010-5678-9012',
      phone_verified: true,
      gender: 'female',
      birth_date: '1990-09-18',
      user_role: 'shop_owner',
      user_status: 'active',
      is_influencer: false,
      social_provider: 'email',
      referral_code: 'TAEHEE2024',
      total_points: 35000,
      available_points: 30000,
      total_referrals: 8,
      successful_referrals: 7,
      marketing_consent: true,
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted_at: new Date().toISOString(),
      last_login_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    },

    // Influencers
    {
      id: randomUUID(),
      email: 'influencer1@example.com',
      name: '송하나',
      nickname: 'hana_beauty',
      phone_number: '010-6789-0123',
      phone_verified: true,
      gender: 'female',
      birth_date: '1997-02-14',
      user_role: 'user',
      user_status: 'active',
      social_provider: 'apple',
      is_influencer: true,
      influencer_qualified_at: new Date().toISOString(),
      referral_code: 'HANA2024',
      total_points: 80000,
      available_points: 75000,
      total_referrals: 50,
      successful_referrals: 45,
      marketing_consent: true,
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted_at: new Date().toISOString(),
      last_login_at: new Date().toISOString()
    },

    // Inactive users
    {
      id: randomUUID(),
      email: 'inactive@example.com',
      name: '정수민',
      nickname: 'sumin',
      phone_number: '010-7890-1234',
      phone_verified: false,
      gender: 'female',
      birth_date: '1996-12-25',
      user_role: 'user',
      user_status: 'inactive',
      is_influencer: false,
      social_provider: 'email',
      referral_code: 'SUMIN2024',
      total_points: 0,
      available_points: 0,
      total_referrals: 0,
      successful_referrals: 0,
      marketing_consent: false,
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted_at: new Date().toISOString(),
      last_login_at: new Date(Date.now() - 7776000000).toISOString() // 90 days ago
    },

    // Suspended user
    {
      id: randomUUID(),
      email: 'suspended@example.com',
      name: '윤재호',
      nickname: 'jaeho',
      phone_number: '010-8901-2345',
      phone_verified: true,
      gender: 'male',
      birth_date: '1994-08-30',
      user_role: 'user',
      user_status: 'suspended',
      is_influencer: false,
      social_provider: 'email',
      referral_code: 'JAEHO2024',
      total_points: 1000,
      available_points: 1000,
      total_referrals: 0,
      successful_referrals: 0,
      marketing_consent: false,
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted_at: new Date().toISOString(),
      last_login_at: new Date(Date.now() - 604800000).toISOString() // 7 days ago
    },

    // More active users for variety
    {
      id: randomUUID(),
      email: 'user4@example.com',
      name: '한지민',
      nickname: 'jimin_han',
      phone_number: '010-9012-3456',
      phone_verified: true,
      gender: 'female',
      birth_date: '1999-04-20',
      user_role: 'user',
      user_status: 'active',
      is_influencer: false,
      social_provider: 'kakao',
      referral_code: 'JIMIN2024',
      total_points: 7500,
      available_points: 6000,
      total_referrals: 2,
      successful_referrals: 1,
      marketing_consent: true,
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted_at: new Date().toISOString(),
      last_login_at: new Date().toISOString()
    },
    {
      id: randomUUID(),
      email: 'user5@example.com',
      name: '오성훈',
      nickname: 'sunghoon',
      phone_number: '010-0123-4567',
      phone_verified: true,
      gender: 'male',
      birth_date: '1991-06-12',
      user_role: 'user',
      user_status: 'active',
      is_influencer: false,
      social_provider: 'google',
      referral_code: 'SUNGHOON2024',
      total_points: 15000,
      available_points: 10000,
      total_referrals: 7,
      successful_referrals: 6,
      marketing_consent: true,
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted_at: new Date().toISOString(),
      last_login_at: new Date(Date.now() - 43200000).toISOString() // 12 hours ago
    },

    // Add more users for testing pagination
    {
      id: randomUUID(),
      email: 'user6@example.com',
      name: '김태연',
      nickname: 'taeyeon',
      phone_number: '010-1111-2222',
      phone_verified: true,
      gender: 'female',
      birth_date: '1993-03-09',
      user_role: 'user',
      user_status: 'active',
      is_influencer: false,
      social_provider: 'kakao',
      referral_code: 'TAEYEON2024',
      total_points: 9500,
      available_points: 7000,
      total_referrals: 4,
      successful_referrals: 3,
      marketing_consent: true,
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted_at: new Date().toISOString(),
      last_login_at: new Date().toISOString()
    },
    {
      id: randomUUID(),
      email: 'user7@example.com',
      name: '이동욱',
      nickname: 'dongwook',
      phone_number: '010-2222-3333',
      phone_verified: true,
      gender: 'male',
      birth_date: '1989-11-06',
      user_role: 'user',
      user_status: 'active',
      is_influencer: false,
      social_provider: 'google',
      referral_code: 'DONGWOOK2024',
      total_points: 18000,
      available_points: 14000,
      total_referrals: 9,
      successful_referrals: 8,
      marketing_consent: true,
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted_at: new Date().toISOString(),
      last_login_at: new Date(Date.now() - 7200000).toISOString() // 2 hours ago
    }
  ];

  const { data, error } = await supabase
    .from('users')
    .upsert(users, { onConflict: 'email' })
    .select();

  if (error) {
    console.error('❌ Error seeding users:', error);
    throw error;
  }

  console.log(`✅ Seeded ${data?.length || 0} users\n`);

  // Display summary
  console.log('📊 User Summary:');
  console.log(`   - Active users: ${users.filter(u => u.user_status === 'active').length}`);
  console.log(`   - Shop owners: ${users.filter(u => u.user_role === 'shop_owner').length}`);
  console.log(`   - Influencers: ${users.filter(u => u.is_influencer).length}`);
  console.log(`   - Inactive/Suspended: ${users.filter(u => ['inactive', 'suspended'].includes(u.user_status)).length}`);

  return data || [];
}

async function main() {
  try {
    console.log('🚀 Starting user seeding...\n');
    await seedUsers();
    console.log('\n✅ User seeding completed successfully!');
    console.log('\n💡 Users can now be viewed at /api/admin/users');
  } catch (error) {
    console.error('\n❌ Error seeding users:', error);
    process.exit(1);
  }
}

main();
