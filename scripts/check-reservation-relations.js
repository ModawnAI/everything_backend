const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RESERVATION_ID = '6dc455e9-7f9d-49a4-8e38-56b6ee5f70db';

async function checkRelations() {
  console.log('Checking all relations for reservation', RESERVATION_ID);
  console.log('');

  // Check reservation_services
  const { data: services, error: servicesError } = await supabase
    .from('reservation_services')
    .select('*')
    .eq('reservation_id', RESERVATION_ID);

  console.log('1. Reservation Services:');
  console.log('   Error:', servicesError);
  console.log('   Count:', services?.length || 0);
  if (services && services.length > 0) {
    console.log('   Data:', services);
  } else {
    console.log('   ❌ NO SERVICES FOUND - This breaks the inner join!');
  }
  console.log('');

  // Check reservation_payments
  const { data: payments, error: paymentsError } = await supabase
    .from('reservation_payments')
    .select('*')
    .eq('reservation_id', RESERVATION_ID);

  console.log('2. Reservation Payments:');
  console.log('   Error:', paymentsError);
  console.log('   Count:', payments?.length || 0);
  if (payments && payments.length > 0) {
    console.log('   Data:', payments);
  }
  console.log('');

  // Try the exact query from the service
  console.log('3. Testing the exact service query:');
  const { data, error } = await supabase
    .from('reservations')
    .select(`
      id,
      shop_id,
      user_id,
      status,
      shops!inner(id, name),
      reservation_services(
        id,
        shop_services!inner(id, name)
      )
    `)
    .eq('id', RESERVATION_ID)
    .single();

  console.log('   Error:', error);
  console.log('   Data:', data);
}

checkRelations();
