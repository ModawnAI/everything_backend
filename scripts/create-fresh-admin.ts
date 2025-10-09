/**
 * Create Fresh Admin Account
 * Creates a brand new admin account with known credentials
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

// New admin credentials
const NEW_ADMIN_EMAIL = 'superadmin@ebeautything.com';
const NEW_ADMIN_PASSWORD = 'SuperAdmin2025!';
const NEW_ADMIN_NAME = '슈퍼 관리자';

async function createFreshAdmin() {
  console.log('🆕 Creating Fresh Admin Account\n');
  console.log('='.repeat(60));

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Step 1: Check if email already exists
  console.log('\n📋 Step 1: Checking if email already exists');
  console.log('-'.repeat(60));

  const { data: existingAuthUsers } = await adminClient.auth.admin.listUsers();
  const existingAuth = existingAuthUsers?.users.find((u: any) => u.email === NEW_ADMIN_EMAIL);

  if (existingAuth) {
    console.log('⚠️  Email already exists in auth.users');
    console.log('   Deleting existing account...');

    await adminClient.auth.admin.deleteUser(existingAuth.id);
    console.log('✅ Old account deleted');
  }

  const { data: existingPublic } = await adminClient
    .from('users')
    .select('id')
    .eq('email', NEW_ADMIN_EMAIL)
    .maybeSingle();

  if (existingPublic) {
    console.log('⚠️  Email already exists in public.users');
    console.log('   Deleting existing record...');

    await adminClient
      .from('users')
      .delete()
      .eq('id', existingPublic.id);

    console.log('✅ Old record deleted');
  }

  // Step 2: Create auth user
  console.log('\n📋 Step 2: Creating auth user');
  console.log('-'.repeat(60));

  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email: NEW_ADMIN_EMAIL,
    password: NEW_ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      name: NEW_ADMIN_NAME
    }
  });

  if (authError || !authUser.user) {
    console.error('❌ Failed to create auth user:', authError?.message);
    process.exit(1);
  }

  console.log('✅ Auth user created');
  console.log('   ID:', authUser.user.id);
  console.log('   Email:', authUser.user.email);

  // Step 3: Create public.users record with same ID
  console.log('\n📋 Step 3: Creating public.users record');
  console.log('-'.repeat(60));

  const { error: publicError } = await adminClient
    .from('users')
    .insert({
      id: authUser.user.id, // Same ID as auth user
      email: NEW_ADMIN_EMAIL,
      name: NEW_ADMIN_NAME,
      phone_number: '010-0000-0000',
      gender: 'prefer_not_to_say',
      birth_date: '1990-01-01',
      user_status: 'active',
      user_role: 'admin',
      is_influencer: false,
      referral_code: `SUPER${Date.now().toString().slice(-6)}`,
      total_points: 0,
      available_points: 0,
      total_referrals: 0,
      social_provider: 'email',
      terms_accepted_at: new Date().toISOString(),
      privacy_accepted_at: new Date().toISOString(),
      marketing_consent: false,
      created_at: new Date().toISOString()
    });

  if (publicError) {
    console.error('❌ Failed to create public.users record:', publicError.message);
    // Clean up auth user
    await adminClient.auth.admin.deleteUser(authUser.user.id);
    process.exit(1);
  }

  console.log('✅ Public.users record created');
  console.log('   Linked to auth.users with same ID');

  // Step 4: Test login
  console.log('\n📋 Step 4: Testing login');
  console.log('-'.repeat(60));

  const testClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: loginData, error: loginError } = await testClient.auth.signInWithPassword({
    email: NEW_ADMIN_EMAIL,
    password: NEW_ADMIN_PASSWORD
  });

  if (loginError) {
    console.error('❌ Login test failed:', loginError.message);
    process.exit(1);
  }

  console.log('✅ Login successful!');
  console.log('   User ID:', loginData.user?.id);
  console.log('   Email:', loginData.user?.email);

  // Sign out
  await testClient.auth.signOut();

  // Step 5: Display credentials
  console.log('\n' + '='.repeat(60));
  console.log('🎉 ADMIN ACCOUNT CREATED SUCCESSFULLY!');
  console.log('='.repeat(60));
  console.log('\n📝 Login Credentials:');
  console.log('━'.repeat(60));
  console.log(`📧 Email:    ${NEW_ADMIN_EMAIL}`);
  console.log(`🔑 Password: ${NEW_ADMIN_PASSWORD}`);
  console.log('━'.repeat(60));
  console.log('\n💡 You can now login at:');
  console.log('   - Frontend: http://localhost:3000/admin/login');
  console.log('   - Backend:  POST http://localhost:3001/api/admin/auth/login');
  console.log('\n⚠️  IMPORTANT: Save these credentials securely!');
  console.log('='.repeat(60));
}

// Run script
createFreshAdmin()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
