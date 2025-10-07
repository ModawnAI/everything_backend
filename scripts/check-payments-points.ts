import { getSupabaseClient } from '../src/config/database';

const supabase = getSupabaseClient();

async function checkPaymentsAndPoints() {
  console.log('🔍 Checking payments, points, and refunds data...\n');

  // Check payments
  const { data: payments, error: paymentsError, count: paymentsCount } = await supabase
    .from('payments')
    .select('*', { count: 'exact' })
    .limit(3);

  console.log('=== PAYMENTS ===');
  console.log('Total payments count:', paymentsCount);
  console.log('Error:', paymentsError);
  console.log('\nFirst 3 payments:');
  console.log(JSON.stringify(payments, null, 2));

  // Check point_transactions
  const { data: pointTxs, error: pointsError, count: pointsCount } = await supabase
    .from('point_transactions')
    .select('*', { count: 'exact' })
    .limit(3);

  console.log('\n\n=== POINT TRANSACTIONS ===');
  console.log('Total point transactions count:', pointsCount);
  console.log('Error:', pointsError);
  console.log('\nFirst 3 point transactions:');
  console.log(JSON.stringify(pointTxs, null, 2));

  // Check refunds (if table exists)
  const { data: refunds, error: refundsError, count: refundsCount } = await supabase
    .from('refunds')
    .select('*', { count: 'exact' })
    .limit(3);

  console.log('\n\n=== REFUNDS ===');
  console.log('Total refunds count:', refundsCount);
  console.log('Error:', refundsError);
  console.log('\nFirst 3 refunds:');
  console.log(JSON.stringify(refunds, null, 2));

  // Check payment with reservation details
  if (payments && payments.length > 0) {
    console.log('\n\n=== PAYMENT WITH RESERVATION ===');
    const { data: paymentDetail } = await supabase
      .from('payments')
      .select(`
        *,
        reservation:reservations!payments_reservation_id_fkey(
          id,
          reservation_date,
          total_amount,
          user:users!reservations_user_id_fkey(name, email)
        )
      `)
      .eq('id', payments[0].id)
      .single();

    console.log('Payment with reservation details:');
    console.log(JSON.stringify(paymentDetail, null, 2));
  }
}

checkPaymentsAndPoints().catch(console.error);
