import { getSupabaseClient } from '../src/config/database';

const supabase = getSupabaseClient();

async function checkReservationsData() {
  console.log('🔍 Checking reservations data...\n');
  
  const { data: reservations, error, count } = await supabase
    .from('reservations')
    .select('*', { count: 'exact' })
    .limit(2);
  
  console.log('Total reservation count:', count);
  console.log('Error:', error);
  console.log('\nFirst 2 reservations:');
  console.log(JSON.stringify(reservations, null, 2));
  
  // Check reservation_services junction table
  if (reservations && reservations.length > 0) {
    console.log('\n\n🔍 Checking reservation_services for first reservation...\n');
    const { data: resServices } = await supabase
      .from('reservation_services')
      .select('*')
      .eq('reservation_id', reservations[0].id)
      .limit(3);
    
    console.log('Reservation services:');
    console.log(JSON.stringify(resServices, null, 2));
  }
}

checkReservationsData();
