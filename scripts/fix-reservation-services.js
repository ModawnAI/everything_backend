/**
 * Migration script to fix existing reservations that don't have reservation_services records
 *
 * Service mapping for shop 22222222-2222-2222-2222-222222222222:
 * - 35000 → ce98e031-b8d2-4050-9594-0015cd87d57f (프리미엄 헤어컷)
 * - 80000 → ca6cabe2-494f-4bbc-bbe7-d3c5d23359ef (전체 염색)
 * - 120000 → 5ded0aca-70a5-4fcb-a89b-9b7ed883f4e0 (디지털 펌)
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Service mapping by price for shop 22222222-2222-2222-2222-222222222222
const SERVICE_MAPPING = {
  35000: 'ce98e031-b8d2-4050-9594-0015cd87d57f',  // 프리미엄 헤어컷
  80000: 'ca6cabe2-494f-4bbc-bbe7-d3c5d23359ef',  // 전체 염색
  120000: '5ded0aca-70a5-4fcb-a89b-9b7ed883f4e0', // 디지털 펌
};

async function fixReservationServices() {
  console.log('Starting reservation services fix...');

  // 1. Get all reservations for the shop
  const { data: reservations, error: resError } = await supabase
    .from('reservations')
    .select('id, total_amount, shop_id')
    .eq('shop_id', '22222222-2222-2222-2222-222222222222');

  if (resError) {
    console.error('Error fetching reservations:', resError);
    return;
  }

  console.log(`Found ${reservations?.length || 0} reservations`);

  // 2. Get existing reservation_services
  const { data: existingServices, error: existingError } = await supabase
    .from('reservation_services')
    .select('reservation_id');

  if (existingError) {
    console.error('Error fetching existing services:', existingError);
    return;
  }

  const existingIds = new Set(existingServices?.map(s => s.reservation_id) || []);
  console.log(`Found ${existingIds.size} reservations with existing services`);

  // 3. Find reservations without services
  const missingReservations = reservations?.filter(r => {
    return !existingIds.has(r.id);
  }) || [];

  console.log(`Found ${missingReservations.length} reservations missing services`);

  if (missingReservations.length === 0) {
    console.log('No reservations need fixing!');
    return;
  }

  // 4. Insert missing services
  let successCount = 0;
  let errorCount = 0;

  for (const reservation of missingReservations) {
    const serviceId = SERVICE_MAPPING[reservation.total_amount];

    if (!serviceId) {
      console.log(`No service mapping for amount ${reservation.total_amount} (reservation ${reservation.id})`);
      errorCount++;
      continue;
    }

    const record = {
      reservation_id: reservation.id,
      service_id: serviceId,
      quantity: 1,
      unit_price: reservation.total_amount,
      total_price: reservation.total_amount,
      version: 1
    };

    const { error: insertError } = await supabase
      .from('reservation_services')
      .insert(record);

    if (insertError) {
      console.error(`Error inserting service for reservation ${reservation.id}:`, insertError.message);
      errorCount++;
    } else {
      console.log(`Fixed reservation ${reservation.id} with service ${serviceId}`);
      successCount++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log('Done!');
}

fixReservationServices().catch(console.error);
