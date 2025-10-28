const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ysrudwzwnzxrrwjtpuoh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzcnVkd3p3bnp4cnJ3anRwdW9oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDQ2OTAwMiwiZXhwIjoyMDcwMDQ1MDAyfQ.d2HQ0w4qW7ulyqaFN558wZaBDVIS_aUF_9PUFU6Rv1s';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testAnalytics() {
  console.log('Testing Supabase Analytics...\n');

  // Test 1: Check if materialized view exists
  console.log('1. Checking for dashboard_quick_metrics materialized view...');
  try {
    const { data, error } = await supabase
      .from('dashboard_quick_metrics')
      .select('*')
      .single();

    if (error) {
      console.error('❌ Error:', error.message);
      console.log('   Code:', error.code);
      console.log('   Details:', error.details);
    } else {
      console.log('✅ Materialized view exists!');
      console.log('   Data:', JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }

  console.log('\n2. Checking available tables...');
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Error checking users table:', error.message);
    } else {
      console.log('✅ users table exists');
    }
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }

  console.log('\n3. Checking shops table...');
  try {
    const { data, error } = await supabase
      .from('shops')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Error checking shops table:', error.message);
    } else {
      console.log('✅ shops table exists');
    }
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }

  console.log('\n4. Checking reservations table...');
  try {
    const { data, error } = await supabase
      .from('reservations')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Error checking reservations table:', error.message);
    } else {
      console.log('✅ reservations table exists');
    }
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }

  console.log('\n5. Checking payments table...');
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Error checking payments table:', error.message);
    } else {
      console.log('✅ payments table exists');
    }
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }

  console.log('\n6. Getting actual counts...');
  try {
    const [users, shops, reservations, payments] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('shops').select('*', { count: 'exact', head: true }),
      supabase.from('reservations').select('*', { count: 'exact', head: true }),
      supabase.from('payments').select('*', { count: 'exact', head: true })
    ]);

    console.log('   Users count:', users.count);
    console.log('   Shops count:', shops.count);
    console.log('   Reservations count:', reservations.count);
    console.log('   Payments count:', payments.count);
  } catch (err) {
    console.error('❌ Exception:', err.message);
  }
}

testAnalytics().then(() => {
  console.log('\nTest complete!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
