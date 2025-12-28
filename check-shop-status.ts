import { getSupabaseClient } from './src/config/database';

(async () => {
  const supabase = getSupabaseClient();

  // Get all shops with their status
  const { data: shops, error } = await supabase
    .from('shops')
    .select('id, shop_name, shop_status, owner_id, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log('📊 Shop Status Report:');
  console.log('=====================');
  console.log('');

  if (!shops || shops.length === 0) {
    console.log('❌ No shops found in database');
    process.exit(0);
  }

  shops.forEach(shop => {
    console.log(`Shop: ${shop.shop_name}`);
    console.log(`  ID: ${shop.id}`);
    console.log(`  Status: ${shop.shop_status}`);
    console.log(`  Owner: ${shop.owner_id}`);
    console.log('');
  });

  // Count by status
  const statusCounts = shops.reduce((acc, shop) => {
    acc[shop.shop_status] = (acc[shop.shop_status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Status Distribution:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  process.exit(0);
})();
