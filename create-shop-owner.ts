import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

(async () => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  console.log('Creating/updating shop owner account...');

  // Create or update shop owner
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'shopowner@test.com',
    password: 'Test1234!',
    email_confirm: true,
    user_metadata: {
      name: 'Test Shop Owner',
      role: 'shop_owner'
    }
  });

  if (authError) {
    console.log('Auth error (might already exist):', authError.message);

    // Try to get existing user
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    const existingUser = users?.find(u => u.email === 'shopowner@test.com');

    if (existingUser) {
      console.log('✅ User exists, updating password...');
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password: 'Test1234!' }
      );

      if (updateError) {
        console.error('❌ Failed to update password:', updateError.message);
        process.exit(1);
      }

      console.log('✅ Password updated successfully');
      console.log('   Email:', existingUser.email);
      console.log('   User ID:', existingUser.id);
    } else {
      console.error('❌ User not found');
      process.exit(1);
    }
  } else {
    console.log('✅ User created successfully');
    console.log('   Email:', authData.user.email);
    console.log('   User ID:', authData.user.id);
  }

  process.exit(0);
})();
