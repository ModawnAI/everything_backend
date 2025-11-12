const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

// Supabase configuration
const supabaseUrl = 'https://ysrudwzwnzxrrwjtpuoh.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzcnVkd3p3bnp4cnJ3anRwdW9oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDQ2OTAwMiwiZXhwIjoyMDcwMDQ1MDAyfQ.d2HQ0w4qW7ulyqaFN558wZaBDVIS_aUF_9PUFU6Rv1s';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test shop owner credentials
const TEST_SHOP_OWNER = {
  email: 'shopowner@test.com',
  password: 'Test1234!',
  name: '테스트 샵 오너',
  phone: '010-1234-5678'
};

const TEST_SHOP = {
  name: 'Test Beauty Shop',
  description: '테스트용 뷰티 샵입니다',
  category: 'hair',
  address: '서울시 강남구 테스트로 123',
  detailed_address: '1층',
  latitude: 37.4979,
  longitude: 127.0276,
  phone: '02-1234-5678',
  business_registration_number: '123-45-67890'
};

const TEST_SERVICES = [
  {
    name: '기본 헤어컷',
    description: '기본적인 커트 서비스입니다',
    price: 30000,
    duration_minutes: 60,
    category: 'cut'
  },
  {
    name: '염색',
    description: '전체 염색 서비스입니다',
    price: 80000,
    duration_minutes: 120,
    category: 'coloring'
  },
  {
    name: '네일 아트',
    description: '기본 네일 아트입니다',
    price: 20000,
    duration_minutes: 45,
    category: 'nail'
  }
];

const OPERATING_HOURS = [
  { day_of_week: 1, open_time: '09:00', close_time: '18:00', is_closed: false }, // Monday
  { day_of_week: 2, open_time: '09:00', close_time: '18:00', is_closed: false }, // Tuesday
  { day_of_week: 3, open_time: '09:00', close_time: '18:00', is_closed: false }, // Wednesday
  { day_of_week: 4, open_time: '09:00', close_time: '18:00', is_closed: false }, // Thursday
  { day_of_week: 5, open_time: '09:00', close_time: '18:00', is_closed: false }, // Friday
  { day_of_week: 6, open_time: '09:00', close_time: '15:00', is_closed: false }, // Saturday
  { day_of_week: 0, open_time: '00:00', close_time: '00:00', is_closed: true }   // Sunday (closed)
];

async function main() {
  console.log('🚀 Starting test shop owner setup...\n');

  try {
    // Step 1: Check if user already exists
    console.log('📋 Step 1: Checking if user exists...');
    const { data: existingUser, error: userCheckError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', TEST_SHOP_OWNER.email)
      .single();

    let userId;

    if (existingUser) {
      console.log(`✅ User already exists: ${existingUser.email}`);
      console.log(`   User ID: ${existingUser.id}`);
      console.log(`   Role: ${existingUser.role}`);
      userId = existingUser.id;

      // Update role to shop_owner if needed
      if (existingUser.role !== 'shop_owner') {
        console.log(`   Updating role to shop_owner...`);
        const { error: roleUpdateError } = await supabase
          .from('users')
          .update({ role: 'shop_owner' })
          .eq('id', userId);

        if (roleUpdateError) throw roleUpdateError;
        console.log('   ✅ Role updated to shop_owner');
      }
    } else {
      // Create new user
      console.log('❌ User does not exist. Creating new user...');

      // Hash password
      const passwordHash = await bcrypt.hash(TEST_SHOP_OWNER.password, 12);

      const { data: newUser, error: userCreateError } = await supabase
        .from('users')
        .insert([{
          email: TEST_SHOP_OWNER.email,
          password_hash: passwordHash,
          name: TEST_SHOP_OWNER.name,
          phone: TEST_SHOP_OWNER.phone,
          role: 'shop_owner',
          email_verified: true,
          phone_verified: true,
          status: 'active'
        }])
        .select()
        .single();

      if (userCreateError) throw userCreateError;

      userId = newUser.id;
      console.log(`✅ User created successfully`);
      console.log(`   User ID: ${userId}`);
      console.log(`   Email: ${newUser.email}`);
    }

    // Step 2: Check if shop exists for this user
    console.log('\n📋 Step 2: Checking if shop exists...');
    const { data: existingShop, error: shopCheckError } = await supabase
      .from('shops')
      .select('id, name, status, verification_status')
      .eq('owner_id', userId)
      .single();

    let shopId;

    if (existingShop) {
      console.log(`✅ Shop already exists: ${existingShop.name}`);
      console.log(`   Shop ID: ${existingShop.id}`);
      console.log(`   Status: ${existingShop.status}`);
      console.log(`   Verification: ${existingShop.verification_status}`);
      shopId = existingShop.id;

      // Update verification status if needed
      if (existingShop.verification_status !== 'approved' || existingShop.status !== 'active') {
        console.log(`   Updating shop status...`);
        const { error: shopUpdateError } = await supabase
          .from('shops')
          .update({
            status: 'active',
            verification_status: 'approved'
          })
          .eq('id', shopId);

        if (shopUpdateError) throw shopUpdateError;
        console.log('   ✅ Shop status updated');
      }
    } else {
      // Create new shop
      console.log('❌ Shop does not exist. Creating new shop...');

      const { data: newShop, error: shopCreateError } = await supabase
        .from('shops')
        .insert([{
          owner_id: userId,
          ...TEST_SHOP,
          status: 'active',
          verification_status: 'approved'
        }])
        .select()
        .single();

      if (shopCreateError) throw shopCreateError;

      shopId = newShop.id;
      console.log(`✅ Shop created successfully`);
      console.log(`   Shop ID: ${shopId}`);
      console.log(`   Name: ${newShop.name}`);
    }

    // Step 3: Create shop services
    console.log('\n📋 Step 3: Setting up shop services...');
    const { data: existingServices } = await supabase
      .from('shop_services')
      .select('id, name')
      .eq('shop_id', shopId);

    if (existingServices && existingServices.length > 0) {
      console.log(`✅ ${existingServices.length} services already exist`);
      existingServices.forEach(service => {
        console.log(`   - ${service.name}`);
      });
    } else {
      console.log('❌ No services found. Creating services...');

      const servicesWithShopId = TEST_SERVICES.map(service => ({
        ...service,
        shop_id: shopId,
        is_active: true
      }));

      const { data: newServices, error: servicesError } = await supabase
        .from('shop_services')
        .insert(servicesWithShopId)
        .select();

      if (servicesError) throw servicesError;

      console.log(`✅ ${newServices.length} services created`);
      newServices.forEach(service => {
        console.log(`   - ${service.name} (${service.price}원, ${service.duration_minutes}분)`);
      });
    }

    // Step 4: Set up operating hours
    console.log('\n📋 Step 4: Setting up operating hours...');
    const { data: existingHours } = await supabase
      .from('shop_operating_hours')
      .select('day_of_week')
      .eq('shop_id', shopId);

    if (existingHours && existingHours.length > 0) {
      console.log(`✅ Operating hours already configured (${existingHours.length} days)`);
    } else {
      console.log('❌ No operating hours found. Creating...');

      const hoursWithShopId = OPERATING_HOURS.map(hour => ({
        ...hour,
        shop_id: shopId
      }));

      const { error: hoursError } = await supabase
        .from('shop_operating_hours')
        .insert(hoursWithShopId);

      if (hoursError) throw hoursError;

      console.log('✅ Operating hours created');
      console.log('   Monday-Friday: 09:00-18:00');
      console.log('   Saturday: 09:00-15:00');
      console.log('   Sunday: Closed');
    }

    // Step 5: Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 TEST SHOP OWNER SETUP COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n📝 Test Credentials:');
    console.log(`   Email:    ${TEST_SHOP_OWNER.email}`);
    console.log(`   Password: ${TEST_SHOP_OWNER.password}`);
    console.log(`\n🏪 Shop Details:`);
    console.log(`   Shop ID:   ${shopId}`);
    console.log(`   Shop Name: ${TEST_SHOP.name}`);
    console.log(`   User ID:   ${userId}`);
    console.log('\n✅ You can now login to the shop admin dashboard:');
    console.log('   http://localhost:3002/login');
    console.log('\n' + '='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error setting up test shop owner:');
    console.error(error);
    process.exit(1);
  }
}

main();
