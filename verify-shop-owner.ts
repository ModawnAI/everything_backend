import { getSupabaseClient } from './src/config/database';

async function verifyShopOwner() {
  const db = getSupabaseClient();

  console.log('Verifying shop owner and reservation...\n');

  // First, find the shop admin user
  const { data: shopAdmin } = await db
    .from('users')
    .select('id, email, full_name')
    .eq('email', 'shopowner@test.com')
    .single();

  if (!shopAdmin) {
    console.log('❌ Shop admin not found with email shopowner@test.com');
    return;
  }

  console.log('✅ Shop Admin:');
  console.log('  Email:', shopAdmin.email);
  console.log('  ID:', shopAdmin.id);
  console.log('  Name:', shopAdmin.full_name || 'N/A');
  console.log('');

  // Find shops owned by this admin
  const { data: shops } = await db
    .from('shops')
    .select('id, name, owner_id, shop_status')
    .eq('owner_id', shopAdmin.id);

  console.log('Shops owned by shopowner@test.com:');
  if (shops && shops.length > 0) {
    shops.forEach((shop, i) => {
      console.log(`  ${i+1}. ${shop.name}`);
      console.log('     ID:', shop.id);
      console.log('     Status:', shop.shop_status);
    });
  } else {
    console.log('  ❌ No shops found');
  }
  console.log('');

  // Check the reservation we created
  const { data: reservation } = await db
    .from('reservations')
    .select('id, shop_id, user_id, status')
    .eq('id', '9cb8590c-5f83-44a8-a066-4b931e36ac0c')
    .single();

  if (reservation) {
    console.log('Test Reservation:');
    console.log('  ID:', reservation.id);
    console.log('  Shop ID:', reservation.shop_id);
    console.log('  User ID:', reservation.user_id);
    console.log('  Status:', reservation.status);

    // Check if this shop is owned by shopowner@test.com
    const isOwnedByShopOwner = shops?.some(s => s.id === reservation.shop_id);
    console.log('  Owned by shopowner@test.com?', isOwnedByShopOwner ? '✅ YES' : '❌ NO');

    if (!isOwnedByShopOwner && shops && shops.length > 0) {
      console.log('\n⚠️  WARNING: Reservation is NOT at a shop owned by shopowner@test.com');
      console.log('   We need to create a new reservation at the correct shop.');
      console.log('   Correct shop ID should be:', shops[0].id);
    }
    console.log('');
  }
}

verifyShopOwner().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
