import { getSupabaseClient } from './src/config/database';

(async () => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('shops')
    .select('id, name, shop_status');

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log('📊 Shop Status Summary:');
  console.log('======================');
  console.log('');

  if (!data || data.length === 0) {
    console.log('❌ No shops found');
    process.exit(0);
  }

  data.forEach((shop) => {
    console.log(`${shop.name}: ${shop.shop_status}`);
  });

  console.log('');
  console.log('Status Counts:');
  const counts = data.reduce((acc, shop) => {
    acc[shop.shop_status] = (acc[shop.shop_status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  Object.entries(counts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  process.exit(0);
})();
