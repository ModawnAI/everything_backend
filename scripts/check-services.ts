import { getSupabaseClient } from '../src/config/database';

const supabase = getSupabaseClient();

async function checkData() {
  console.log('🔍 Checking shop_services data...\n');
  
  const { data: services, error, count } = await supabase
    .from('shop_services')
    .select('*', { count: 'exact' })
    .limit(5);
  
  console.log('Total count:', count);
  console.log('Error:', error);
  console.log('\nFirst 5 services:');
  console.log(JSON.stringify(services, null, 2));
  
  // Also check with filters
  console.log('\n\n🔍 Checking with is_available filter...\n');
  const { data: available, count: availableCount } = await supabase
    .from('shop_services')
    .select('*', { count: 'exact' })
    .eq('is_available', true)
    .limit(3);
  
  console.log('Available count:', availableCount);
  console.log('Available services:', JSON.stringify(available, null, 2));
}

checkData();
