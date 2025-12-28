const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  'https://ysrudwzwnzxrrwjtpuoh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzcnVkd3p3bnp4cnJ3anRwdW9oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDQ2OTAwMiwiZXhwIjoyMDcwMDQ1MDAyfQ.d2HQ0w4qW7ulyqaFN558wZaBDVIS_aUF_9PUFU6Rv1s'
);

async function checkUser() {
  // First, list all admin users to see what exists
  console.log('📋 Listing all admin users in database:\n');
  const { data: allUsers, error: allError } = await supabase
    .from('admin_users')
    .select('*');

  if (allError) {
    console.log('❌ Error listing all users:', allError.message);
  } else if (allUsers && allUsers.length > 0) {
    console.log(`Found ${allUsers.length} admin user(s):\n`);
    allUsers.forEach((user, i) => {
      console.log(`${i + 1}. Email: ${user.email}`);
      console.log(`    Role: ${user.role || 'N/A'}`);
      console.log(`    ID: ${user.id}`);
      console.log(`    Has Password: ${!!user.password_hash}`);
      console.log('');
    });
  } else {
    console.log('No admin users found in database');
  }

  console.log('\n' + '='.repeat(60) + '\n');
  console.log('🔍 Now checking for testadmin@ebeautything.com specifically:\n');

  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('email', 'testadmin@ebeautything.com');

  if (error) {
    console.log('❌ Error querying user:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('❌ User testadmin@ebeautything.com NOT found in database');
    console.log('\n💡 Suggestion: Create this user or update tests to use an existing email');
    return;
  }

  console.log(`\n📊 Found ${data.length} user(s) with email testadmin@ebeautything.com\n`);

  for (let i = 0; i < data.length; i++) {
    const user = data[i];
    console.log(`\n=== User ${i + 1} ===`);
    console.log('  - ID:', user.id);
    console.log('  - Email:', user.email);
    console.log('  - Role:', user.role);
    console.log('  - Active:', user.is_active);
    console.log('  - Has password hash:', !!user.password_hash);
    console.log('  - Password hash length:', user.password_hash?.length || 0);

    // Test password verification
    console.log('\n  🔐 Testing password verification:');
    try {
      const match1 = await bcrypt.compare('TestAdmin123!', user.password_hash);
      console.log('    - TestAdmin123! matches:', match1 ? '✅ YES' : '❌ NO');

      const match2 = await bcrypt.compare('admin123', user.password_hash);
      console.log('    - admin123 matches:', match2 ? '✅ YES' : '❌ NO');

      const match3 = await bcrypt.compare('Admin123!', user.password_hash);
      console.log('    - Admin123! matches:', match3 ? '✅ YES' : '❌ NO');
    } catch (err) {
      console.log('    ❌ Password verification error:', err.message);
    }
  }
}

checkUser().catch(err => console.error('Fatal error:', err));
