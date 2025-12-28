#!/usr/bin/env node

/**
 * Script to find existing shop or create a test shop
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

async function findOrCreateShop() {
  console.log('🔍 Finding existing shops...\n');

  try {
    // Query existing shops
    const { data: existingShops, error: queryError } = await supabase
      .from('shops')
      .select('*')
      .limit(5);

    if (queryError) {
      console.error('❌ Query error:', queryError.message);
      throw queryError;
    }

    console.log(`📊 Found ${existingShops?.length || 0} shops in database\n`);

    if (existingShops && existingShops.length > 0) {
      console.log('🏪 Existing Shops:');
      existingShops.forEach((shop, idx) => {
        console.log(`\n${idx + 1}. ${shop.name}`);
        console.log(`   ID: ${shop.id}`);
        console.log(`   Status: ${shop.shop_status}`);
        console.log(`   Owner ID: ${shop.owner_id || 'No owner assigned'}`);
        console.log(`   Address: ${shop.address || 'N/A'}`);
      });

      // Use the first shop without an owner, or the first shop if all have owners
      const availableShop = existingShops.find(s => !s.owner_id) || existingShops[0];
      
      console.log(`\n✅ Will use shop: ${availableShop.name} (${availableShop.id})\n`);
      return availableShop.id;
    }

    // No shops exist, create a test shop
    console.log('📝 No shops found. Creating test shop...\n');

    const newShop = {
      id: '00000000-0000-0000-0000-000000000101',
      name: '테스트 네일샵',
      business_name: '테스트 네일샵 (주)',
      business_registration_number: '123-45-67890',
      address: '서울시 강남구 테스트로 123',
      detailed_address: '1층 101호',
      phone_number: '02-1234-5678',
      shop_status: 'active',
      verification_status: 'verified',
      opening_hours: {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: { closed: true }
      },
      location: {
        type: 'Point',
        coordinates: [127.027619, 37.497942]
      },
      description: '테스트용 네일샵입니다.',
      images: [],
      rating_average: 0,
      review_count: 0,
      created_at: new Date().toISOString()
    };

    const { data: createdShop, error: createError } = await supabase
      .from('shops')
      .insert(newShop)
      .select()
      .single();

    if (createError) {
      console.error('❌ Shop creation failed:', createError.message);
      throw createError;
    }

    console.log('✅ Test shop created successfully!');
    console.log(`   Name: ${createdShop.name}`);
    console.log(`   ID: ${createdShop.id}\n`);

    return createdShop.id;

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

findOrCreateShop().then(shopId => {
  console.log(`\n🎯 Shop ID to use: ${shopId}`);
  process.exit(0);
});
