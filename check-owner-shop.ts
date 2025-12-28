import { getSupabaseClient } from './src/config/database';

(async () => {
  const supabase = getSupabaseClient();
  const userId = '4539aa5d-eb4b-404d-9288-2e6dd338caec';

  // Check if user owns shops
  const { data: shops } = await supabase
    .from('shops')
    .select('id, name, shop_status')
    .eq('owner_id', userId);

  console.log('Shops owned by shopowner@test.com:', shops?.length || 0);

  if (!shops || shops.length === 0) {
    console.log('Creating a test shop...');

    const { data: newShop, error } = await supabase
      .from('shops')
      .insert({
        owner_id: userId,
        name: 'Test Shop Owner Shop',
        description: 'Test shop for shop owner login',
        phone_number: '+82-10-1234-5678',
        email: 'shopowner@test.com',
        address: '서울특별시 강남구',
        shop_type: 'partnered',
        shop_status: 'active',
        main_category: 'hair'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating shop:', error.message);
      process.exit(1);
    }

    console.log('Shop created:', newShop.name, '(', newShop.id, ')');
  } else {
    console.log('Shops:');
    shops.forEach(shop => {
      console.log('  -', shop.name, '(', shop.shop_status, ')');
    });
  }

  process.exit(0);
})();
