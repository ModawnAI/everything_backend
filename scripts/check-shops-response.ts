import { getSupabaseClient } from '../src/config/database';

const supabase = getSupabaseClient();

async function checkShopsData() {
  console.log('🔍 Checking shops data...\n');
  
  const { data: shops, error, count } = await supabase
    .from('shops')
    .select('*', { count: 'exact' })
    .limit(2);
  
  console.log('Total shop count:', count);
  console.log('Error:', error);
  console.log('\nFirst 2 shops:');
  console.log(JSON.stringify(shops, null, 2));
  
  // Check shop_images
  if (shops && shops.length > 0) {
    console.log('\n\n🔍 Checking shop_images for first shop...\n');
    const { data: images } = await supabase
      .from('shop_images')
      .select('*')
      .eq('shop_id', shops[0].id)
      .limit(3);
    
    console.log('Shop images:');
    console.log(JSON.stringify(images, null, 2));
    
    // Check operating_hours
    console.log('\n\n🔍 Checking operating_hours for first shop...\n');
    const { data: hours } = await supabase
      .from('operating_hours')
      .select('*')
      .eq('shop_id', shops[0].id);
    
    console.log('Operating hours:');
    console.log(JSON.stringify(hours, null, 2));
  }
}

checkShopsData();
