const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkReservations() {
  console.log('🔍 Checking reservations in database...\n');

  // Check all reservations
  const { data: allReservations, error: allError } = await supabase
    .from('reservations')
    .select('id, status, shop_id, user_id')
    .limit(10);

  if (allError) {
    console.log('❌ Error fetching reservations:', allError.message);
    return;
  }

  console.log(`Found ${allReservations.length} reservations in database:`);
  allReservations.forEach((res, idx) => {
    console.log(`  ${idx + 1}. ID: ${res.id}`);
    console.log(`     Status: ${res.status}`);
    console.log(`     Shop: ${res.shop_id}`);
    console.log('');
  });

  // Find reservations that can be cancelled
  const { data: confirmableReservations, error: confirmError } = await supabase
    .from('reservations')
    .select('id, status, shop_id, user_id')
    .in('status', ['requested', 'confirmed'])
    .limit(5);

  if (confirmError) {
    console.log('❌ Error fetching confirmable reservations:', confirmError.message);
    return;
  }

  console.log(`\n✅ Found ${confirmableReservations.length} reservations that can be cancelled:`);
  confirmableReservations.forEach((res, idx) => {
    console.log(`  ${idx + 1}. ID: ${res.id}`);
    console.log(`     Status: ${res.status}`);
    console.log(`     Shop: ${res.shop_id}`);
    console.log('');
  });

  if (confirmableReservations.length > 0) {
    console.log('💡 Use one of these reservation IDs to test the cancel endpoint');
  }
}

checkReservations().then(() => process.exit(0));
