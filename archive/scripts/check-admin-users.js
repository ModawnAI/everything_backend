const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ysrudwzwnzxrrwjtpuoh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzcnVkd3p3bnp4cnJ3anRwdW9oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDQ2OTAwMiwiZXhwIjoyMDcwMDQ1MDAyfQ.d2HQ0w4qW7ulyqaFN558wZaBDVIS_aUF_9PUFU6Rv1s';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAdminUsers() {
  console.log('Checking for admin users...\n');

  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, role, user_status')
      .in('role', ['admin', 'super_admin', 'platform_admin'])
      .limit(10);

    if (error) {
      console.error('Error:', error.message);
      return;
    }

    if (!data || data.length === 0) {
      console.log('No admin users found in database.');
      console.log('\nChecking for any shop_owner users...');

      const { data: shopOwners, error: ownerError } = await supabase
        .from('users')
        .select('id, email, role, user_status')
        .eq('role', 'shop_owner')
        .limit(5);

      if (!ownerError && shopOwners && shopOwners.length > 0) {
        console.log('\nFound shop owner users:');
        shopOwners.forEach((user, i) => {
          console.log(`${i + 1}. Email: ${user.email}`);
          console.log(`   Role: ${user.role}`);
          console.log(`   Status: ${user.user_status}`);
          console.log('');
        });
      }
      return;
    }

    console.log(`Found ${data.length} admin user(s):\n`);
    data.forEach((user, i) => {
      console.log(`${i + 1}. Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.user_status}`);
      console.log('');
    });

  } catch (err) {
    console.error('Exception:', err.message);
  }
}

checkAdminUsers().then(() => {
  console.log('Check complete!');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
