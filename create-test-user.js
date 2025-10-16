const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  'https://ysrudwzwnzxrrwjtpuoh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzcnVkd3p3bnp4cnJ3anRwdW9oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDQ2OTAwMiwiZXhwIjoyMDcwMDQ1MDAyfQ.d2HQ0w4qW7ulyqaFN558wZaBDVIS_aUF_9PUFU6Rv1s'
);

async function createTestUser() {
  console.log('🔐 Creating test admin user...\n');

  const email = 'testadmin@ebeautything.com';
  const password = 'TestAdmin123!';
  const role = 'admin';

  try {
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    console.log('✅ Password hashed successfully');

    // Insert the user
    const { data, error } = await supabase
      .from('admin_users')
      .insert([
        {
          email: email,
          password_hash: passwordHash,
          role: role,
          name: 'Test Admin',
          created_at: new Date().toISOString()
        }
      ])
      .select();

    if (error) {
      console.error('❌ Error creating user:', error.message);
      console.error('   Details:', JSON.stringify(error, null, 2));
      return;
    }

    console.log('\n✅ Test user created successfully!');
    console.log('\n📋 User Details:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('   Role:', role);
    console.log('   ID:', data[0].id);

    // Verify the user can be queried
    const { data: verifyData, error: verifyError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .single();

    if (verifyError) {
      console.error('\n⚠️  Warning: Could not verify user creation:', verifyError.message);
    } else {
      console.log('\n✅ User verification successful');

      // Test password
      const match = await bcrypt.compare(password, verifyData.password_hash);
      console.log('   Password verification:', match ? '✅ PASS' : '❌ FAIL');
    }

  } catch (err) {
    console.error('❌ Fatal error:', err.message);
    console.error('   Stack:', err.stack);
  }
}

createTestUser().catch(console.error);
