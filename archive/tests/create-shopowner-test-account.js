#!/usr/bin/env node

/**
 * Script to create shopowner@test.com account and assign to existing shop
 */

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const SUPABASE_URL = 'https://ysrudwzwnzxrrwjtpuoh.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzcnVkd3p3bnp4cnJ3anRwdW9oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDQ2OTAwMiwiZXhwIjoyMDcwMDQ1MDAyfQ.d2HQ0w4qW7ulyqaFN558wZaBDVIS_aUF_9PUFU6Rv1s';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createShopOwnerTestAccount() {
  console.log('🚀 Creating shopowner@test.com account...\n');

  try {
    // Step 1: Create auth user with Supabase Admin API
    console.log('1️⃣  Creating auth user...');
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: 'shopowner@test.com',
      password: 'Test1234!',
      email_confirm: true,
      user_metadata: {
        name: '테스트 샵 오너',
        full_name: '테스트 샵 오너'
      }
    });

    if (authError) {
      // If user already exists, try to get it
      if (authError.message.includes('already registered')) {
        console.log('   ℹ️  User already exists in auth, fetching...');
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers.users.find(u => u.email === 'shopowner@test.com');

        if (existingUser) {
          console.log(`   ✅ Found existing user: ${existingUser.id}`);

          // Step 2: Create/update user profile
          console.log('\n2️⃣  Creating/updating user profile...');
          const { error: profileError } = await supabase
            .from('users')
            .upsert({
              id: existingUser.id,
              email: 'shopowner@test.com',
              name: '테스트 샵 오너',
              phone_number: '010-9999-9999',
              gender: 'male',
              birth_date: '1990-01-01',
              user_status: 'active',
              user_role: 'shop_owner',
              is_influencer: false,
              referral_code: 'TESTSHOP',
              total_points: 0,
              available_points: 0,
              total_referrals: 0,
              social_provider: 'email',
              terms_accepted_at: new Date().toISOString(),
              privacy_accepted_at: new Date().toISOString(),
              marketing_consent: true
            });

          if (profileError) {
            console.error('   ❌ Profile creation failed:', profileError.message);
            throw profileError;
          }

          console.log('   ✅ User profile created/updated');

          // Step 3: Assign to shop
          console.log('\n3️⃣  Assigning to shop "강남 프리미엄 네일샵"...');
          const { error: shopError } = await supabase
            .from('shops')
            .update({ owner_id: existingUser.id })
            .eq('id', '00000000-0000-0000-0000-000000000101');

          if (shopError) {
            console.error('   ❌ Shop assignment failed:', shopError.message);
            throw shopError;
          }

          console.log('   ✅ Shop assigned successfully');

          // Step 4: Verify
          console.log('\n4️⃣  Verifying...');
          const { data: verification, error: verifyError } = await supabase
            .from('users')
            .select(`
              id,
              email,
              name,
              user_role,
              shops:shops!owner_id(
                id,
                name,
                shop_status,
                address
              )
            `)
            .eq('email', 'shopowner@test.com')
            .single();

          if (verifyError) {
            console.error('   ❌ Verification failed:', verifyError.message);
            throw verifyError;
          }

          console.log('\n✅ SUCCESS! Account created and verified:\n');
          console.log('📧 Email:', verification.email);
          console.log('👤 Name:', verification.name);
          console.log('🎭 Role:', verification.user_role);
          console.log('🔑 Password: Test1234!');
          if (verification.shops && verification.shops.length > 0) {
            console.log('\n🏪 Assigned Shop:');
            verification.shops.forEach(shop => {
              console.log(`   - ${shop.name}`);
              console.log(`     ID: ${shop.id}`);
              console.log(`     Status: ${shop.shop_status}`);
              console.log(`     Address: ${shop.address}`);
            });
          }

          console.log('\n✨ You can now login at http://localhost:3000/login with:');
          console.log('   Email: shopowner@test.com');
          console.log('   Password: Test1234!');

          return;
        }
      }

      console.error('   ❌ Auth user creation failed:', authError.message);
      throw authError;
    }

    console.log(`   ✅ Auth user created: ${authUser.user.id}`);

    // Step 2: Create user profile
    console.log('\n2️⃣  Creating user profile...');
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        email: 'shopowner@test.com',
        name: '테스트 샵 오너',
        phone_number: '010-9999-9999',
        gender: 'male',
        birth_date: '1990-01-01',
        user_status: 'active',
        user_role: 'shop_owner',
        is_influencer: false,
        referral_code: 'TESTSHOP',
        total_points: 0,
        available_points: 0,
        total_referrals: 0,
        social_provider: 'email',
        terms_accepted_at: new Date().toISOString(),
        privacy_accepted_at: new Date().toISOString(),
        marketing_consent: true
      });

    if (profileError) {
      console.error('   ❌ Profile creation failed:', profileError.message);
      throw profileError;
    }

    console.log('   ✅ User profile created');

    // Step 3: Assign to shop
    console.log('\n3️⃣  Assigning to shop "강남 프리미엄 네일샵"...');
    const { error: shopError } = await supabase
      .from('shops')
      .update({ owner_id: authUser.user.id })
      .eq('id', '00000000-0000-0000-0000-000000000101');

    if (shopError) {
      console.error('   ❌ Shop assignment failed:', shopError.message);
      throw shopError;
    }

    console.log('   ✅ Shop assigned successfully');

    // Step 4: Verify
    console.log('\n4️⃣  Verifying...');
    const { data: verification, error: verifyError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        user_role,
        shops:shops!owner_id(
          id,
          name,
          shop_status,
          address
        )
      `)
      .eq('email', 'shopowner@test.com')
      .single();

    if (verifyError) {
      console.error('   ❌ Verification failed:', verifyError.message);
      throw verifyError;
    }

    console.log('\n✅ SUCCESS! Account created and verified:\n');
    console.log('📧 Email:', verification.email);
    console.log('👤 Name:', verification.name);
    console.log('🎭 Role:', verification.user_role);
    console.log('🔑 Password: Test1234!');
    if (verification.shops && verification.shops.length > 0) {
      console.log('\n🏪 Assigned Shop:');
      verification.shops.forEach(shop => {
        console.log(`   - ${shop.name}`);
        console.log(`     ID: ${shop.id}`);
        console.log(`     Status: ${shop.shop_status}`);
        console.log(`     Address: ${shop.address}`);
      });
    }

    console.log('\n✨ You can now login at http://localhost:3000/login with:');
    console.log('   Email: shopowner@test.com');
    console.log('   Password: Test1234!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

createShopOwnerTestAccount();
