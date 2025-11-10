#!/usr/bin/env node

/**
 * Script to update shopowner@test.com and assign to shop
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

async function updateShopOwnerTestAccount() {
  console.log('🚀 Updating shopowner@test.com account...\n');

  try {
    // Step 1: Find the auth user
    console.log('1️⃣  Finding auth user...');
    const { data: listData } = await supabase.auth.admin.listUsers();
    const authUser = listData.users.find(u => u.email === 'shopowner@test.com');

    if (!authUser) {
      console.error('   ❌ User not found!');
      console.log('\n   Creating new user...');

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: 'shopowner@test.com',
        password: 'Test1234!',
        email_confirm: true,
        user_metadata: {
          name: '테스트 샵 오너'
        }
      });

      if (createError) {
        throw createError;
      }

      console.log(`   ✅ User created: ${newUser.user.id}`);

      // Create profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: newUser.user.id,
          email: 'shopowner@test.com',
          name: '테스트 샵 오너',
          phone_number: '010-9999-9999',
          gender: 'male',
          birth_date: '1990-01-01',
          user_status: 'active',
          user_role: 'shop_owner',
          shop_id: '22222222-2222-2222-2222-222222222222',
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
      } else {
        console.log('   ✅ Profile created');
      }

      console.log('\n✅ Account setup complete!');
      return;
    }

    console.log(`   ✅ Found user: ${authUser.id}`);

    // Step 2: Update/create user profile
    console.log('\n2️⃣  Updating user profile...');
    const { error: profileError } = await supabase
      .from('users')
      .upsert({
        id: authUser.id,
        email: 'shopowner@test.com',
        name: '테스트 샵 오너',
        phone_number: '010-9999-9999',
        gender: 'male',
        birth_date: '1990-01-01',
        user_status: 'active',
        user_role: 'shop_owner',
        shop_id: '22222222-2222-2222-2222-222222222222', // 엘레강스 헤어살롱
        is_influencer: false,
        referral_code: 'TESTSHOP',
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

    console.log('   ✅ User profile updated');

    // Step 3: Verify shop assignment (it's already assigned)
    console.log('\n3️⃣  Verifying shop assignment...');
    const { data: shop, error: shopError } = await supabase
      .from('shops')
      .select('*')
      .eq('id', '22222222-2222-2222-2222-222222222222')
      .single();

    if (shopError) {
      console.error('   ❌ Shop query failed:', shopError.message);
      throw shopError;
    }

    console.log(`   ✅ Shop found: ${shop.name}`);
    console.log(`   📍 Owner ID: ${shop.owner_id}`);

    // Step 4: Verify
    console.log('\n4️⃣  Verifying complete setup...');
    const { data: verification, error: verifyError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        user_role,
        shop_id,
        shops:shop_id(
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

    console.log('\n✅ SUCCESS! Account updated and verified:\n');
    console.log('📧 Email:', verification.email);
    console.log('👤 Name:', verification.name);
    console.log('🎭 Role:', verification.user_role);
    console.log('🔑 Password: Test1234!');
    if (verification.shops) {
      console.log('\n🏪 Assigned Shop:');
      console.log(`   - ${verification.shops.name}`);
      console.log(`     ID: ${verification.shops.id}`);
      console.log(`     Status: ${verification.shops.shop_status}`);
      console.log(`     Address: ${verification.shops.address}`);
    } else {
      console.log('\n⚠️  No shops found - something may be wrong');
    }

    console.log('\n✨ You can now login at http://localhost:3000/login with:');
    console.log('   Email: shopowner@test.com');
    console.log('   Password: Test1234!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

updateShopOwnerTestAccount();
