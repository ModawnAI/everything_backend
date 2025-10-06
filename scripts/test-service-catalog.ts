/**
 * Test Service Catalog Query
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testQuery() {
  console.log('🔍 Testing service catalog queries...\n');

  // Test 1: Check shop_services data
  const { data: services, error: servicesError } = await supabase
    .from('shop_services')
    .select('id, name, category, price_min, is_available')
    .limit(5);

  console.log('1. shop_services table:');
  if (servicesError) {
    console.error('   ❌ Error:', servicesError.message);
  } else {
    console.log(`   ✅ Found ${services?.length || 0} services`);
    services?.forEach(s => console.log(`      - ${s.name} (${s.category})`));
  }

  // Test 2: Check service_images
  const { data: images, error: imagesError } = await supabase
    .from('service_images')
    .select('id')
    .limit(1);

  console.log('\n2. service_images table:');
  if (imagesError) {
    console.error('   ❌ Error:', imagesError.message);
  } else {
    console.log(`   ✅ Table exists (${images?.length || 0} images)`);
  }

  // Test 3: Check service_videos (will likely fail)
  const { data: videos, error: videosError } = await supabase
    .from('service_videos')
    .select('id')
    .limit(1);

  console.log('\n3. service_videos table:');
  if (videosError) {
    console.error('   ❌ Error:', videosError.message);
  } else {
    console.log(`   ✅ Table exists (${videos?.length || 0} videos)`);
  }

  // Test 4: Check before_after_images (will likely fail)
  const { data: beforeAfter, error: beforeAfterError } = await supabase
    .from('before_after_images')
    .select('id')
    .limit(1);

  console.log('\n4. before_after_images table:');
  if (beforeAfterError) {
    console.error('   ❌ Error:', beforeAfterError.message);
  } else {
    console.log(`   ✅ Table exists (${beforeAfter?.length || 0} images)`);
  }

  // Test 5: Try the problematic join query
  console.log('\n5. Testing JOIN query (as used in service catalog):');
  const { data: joinData, error: joinError } = await supabase
    .from('shop_services')
    .select(`
      *,
      service_images:service_images(*),
      service_videos:service_videos(*),
      before_after_images:before_after_images(*)
    `)
    .limit(2);

  if (joinError) {
    console.error('   ❌ JOIN Error:', joinError.message);
    console.error('   Code:', joinError.code);
  } else {
    console.log(`   ✅ JOIN successful, got ${joinData?.length || 0} results`);
  }

  console.log('\n✅ Test complete\n');
  process.exit(0);
}

testQuery();
