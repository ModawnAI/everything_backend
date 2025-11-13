import { getSupabaseClient } from './src/config/database';

(async () => {
  const supabase = getSupabaseClient();

  // Check if shop owner exists
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, user_type, password_hash')
    .eq('email', 'shopowner@test.com')
    .single();

  if (error) {
    console.log('❌ Shop owner not found:', error.message);
    process.exit(1);
  }

  console.log('✅ Shop owner found:');
  console.log('  Email:', user.email);
  console.log('  User Type:', user.user_type);
  console.log('  Has Password:', !!user.password_hash);
  console.log('  User ID:', user.id);

  // Check if they own any shops
  const { data: shops, error: shopError } = await supabase
    .from('shops')
    .select('id, name, shop_status')
    .eq('owner_id', user.id);

  if (shopError) {
    console.log('Error checking shops:', shopError.message);
  } else {
    console.log('');
    console.log('Owns', shops?.length || 0, 'shops:');
    shops?.forEach(shop => {
      console.log('  -', shop.name, '(', shop.shop_status, ')');
    });
  }

  process.exit(0);
})();
