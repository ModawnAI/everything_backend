#!/usr/bin/env node

/**
 * Script to create admin@test.com test account
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ysrudwzwnzxrrwjtpuoh.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzcnVkd3p3bnp4cnJ3anRwdW9oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDQ2OTAwMiwiZXhwIjoyMDcwMDQ1MDAyfQ.d2HQ0w4qW7ulyqaFN558wZaBDVIS_aUF_9PUFU6Rv1s';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdminTestAccount() {
  console.log('🚀 Creating/updating admin@test.com account...\n');

  try {
    // Step 1: Find or create the auth user
    console.log('1️⃣  Finding auth user...');
    const { data: listData } = await supabase.auth.admin.listUsers();
    let authUser = listData.users.find(u => u.email === 'admin@test.com');

    if (!authUser) {
      console.log('   ❌ User not found!');
      console.log('\n   Creating new user...');

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: 'admin@test.com',
        password: 'Admin1234!',
        email_confirm: true,
        user_metadata: {
          name: '테스트 관리자'
        }
      });

      if (createError) {
        throw createError;
      }

      console.log(`   ✅ User created: ${newUser.user.id}`);
      authUser = newUser.user;
    } else {
      console.log(`   ✅ Found user: ${authUser.id}`);
    }

    // Step 2: Update/create user profile with ADMIN role
    console.log('\n2️⃣  Updating user profile with ADMIN role...');
    const { error: profileError } = await supabase
      .from('users')
      .upsert({
        id: authUser.id,
        email: 'admin@test.com',
        name: '테스트 관리자',
        phone_number: '010-1111-1111',
        gender: 'male',
        birth_date: '1990-01-01',
        user_status: 'active',
        user_role: 'admin',  // ADMIN ROLE
        shop_id: null,  // Admin doesn't need a shop
        is_influencer: false,
        referral_code: 'TESTADMIN',
        total_points: 0,
        available_points: 0,
        total_referrals: 0,
        social_provider: 'email',
        terms_accepted_at: new Date().toISOString(),
        privacy_accepted_at: new Date().toISOString(),
        marketing_consent: true
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      console.error('   ❌ Profile update failed:', profileError.message);
      throw profileError;
    }

    console.log('   ✅ User profile updated with ADMIN role');

    // Step 3: Verify
    console.log('\n3️⃣  Verifying complete setup...');
    const { data: verification, error: verifyError } = await supabase
      .from('users')
      .select('id, email, name, user_role, user_status')
      .eq('email', 'admin@test.com')
      .single();

    if (verifyError) {
      console.error('   ❌ Verification failed:', verifyError.message);
      throw verifyError;
    }

    console.log('\n✅ SUCCESS! Account created/updated and verified:\n');
    console.log('📧 Email:', verification.email);
    console.log('👤 Name:', verification.name);
    console.log('🎭 Role:', verification.user_role);
    console.log('📊 Status:', verification.user_status);
    console.log('🔑 Password: Admin1234!');

    console.log('\n✨ You can now login for API testing with:');
    console.log('   Email: admin@test.com');
    console.log('   Password: Admin1234!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createAdminTestAccount();
