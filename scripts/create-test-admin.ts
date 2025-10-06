import { getSupabaseClient } from '../src/config/database';

async function createTestAdmin() {
  const supabase = getSupabaseClient();

  console.log('Creating admin user with email: test@admin.com');

  // Create admin in Supabase Auth first
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'test@admin.com',
    password: 'test123',
    email_confirm: true,
    user_metadata: {
      name: 'Test Admin',
      role: 'admin'
    }
  });

  if (authError) {
    console.error('❌ Auth creation failed:', authError);
    process.exit(1);
  }

  console.log('✅ Supabase Auth user created:', authData.user.id);

  // Update user role in users table
  const { error: updateError } = await supabase
    .from('users')
    .update({
      user_role: 'admin',
      user_status: 'active',
      name: 'Test Admin'
    })
    .eq('id', authData.user.id);

  if (updateError) {
    console.error('❌ Failed to update user role:', updateError);
    process.exit(1);
  }

  console.log('✅ User role updated to admin');

  // Verify the user exists
  const { data: verifyData, error: verifyError } = await supabase
    .from('users')
    .select('id, email, user_role, user_status, name')
    .eq('email', 'test@admin.com')
    .single();

  if (verifyError || !verifyData) {
    console.error('❌ Verification failed:', verifyError);
    process.exit(1);
  }

  console.log('✅ Admin created successfully!');
  console.log(JSON.stringify(verifyData, null, 2));
  console.log('');
  console.log('Login credentials:');
  console.log('  Email: test@admin.com');
  console.log('  Password: test123');
}

createTestAdmin()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
