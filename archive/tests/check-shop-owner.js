const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkShopOwner() {
  const SHOP_ID = '22222222-2222-2222-2222-222222222222';

  console.log(`🔍 Finding owner of shop: ${SHOP_ID}\n`);

  const { data: shop, error } = await supabase
    .from('shops')
    .select('id, name, owner_id')
    .eq('id', SHOP_ID)
    .single();

  if (error) {
    console.log('❌ Error:', error.message);
    return;
  }

  if (!shop) {
    console.log('❌ Shop not found');
    return;
  }

  console.log('✅ Shop found:');
  console.log(`   Name: ${shop.name}`);
  console.log(`   Owner ID: ${shop.owner_id}`);

  // Get owner details
  const { data: owner, error: ownerError } = await supabase
    .from('users')
    .select('id, email, name, user_role')
    .eq('id', shop.owner_id)
    .single();

  if (!ownerError && owner) {
    console.log(`\n✅ Owner details:`);
    console.log(`   Name: ${owner.name}`);
    console.log(`   Email: ${owner.email}`);
    console.log(`   Role: ${owner.user_role}`);
  }

  // Get available reservations for this shop
  const { data: reservations, error: resError } = await supabase
    .from('reservations')
    .select('id, status')
    .eq('shop_id', SHOP_ID)
    .in('status', ['requested', 'confirmed'])
    .limit(3);

  if (!resError && reservations.length > 0) {
    console.log(`\n✅ Reservations available for testing:`);
    reservations.forEach((res, idx) => {
      console.log(`   ${idx + 1}. ID: ${res.id} (${res.status})`);
    });
  }
}

checkShopOwner().then(() => process.exit(0));
