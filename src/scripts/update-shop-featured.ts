import { getSupabaseClient } from '../config/database';

async function updateShopToFeatured() {
  const shopId = '22222222-2222-2222-2222-222222222222';
  const supabase = getSupabaseClient();
  
  console.log(`Updating shop ${shopId} to be featured...`);
  
  const { data, error } = await supabase
    .from('shops')
    .update({
      is_featured: true,
      featured_until: '2026-12-31T23:59:59.000Z',
      updated_at: new Date().toISOString()
    })
    .eq('id', shopId)
    .select();
  
  if (error) {
    console.error('❌ Error updating shop:', error);
    process.exit(1);
  }
  
  console.log('✅ Shop updated successfully!');
  console.log('Shop details:', JSON.stringify(data, null, 2));
  process.exit(0);
}

updateShopToFeatured().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
