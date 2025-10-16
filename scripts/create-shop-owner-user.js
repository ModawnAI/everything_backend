const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Use both service role (for creating auth user) and anon key (for sign up)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function createShopOwnerUser() {
  const email = 'shopowner@test.com';
  const password = 'ShopOwner123!@#';
  const name = 'Shop Owner Test';

  console.log('Creating shop owner user...');
  console.log('Email:', email);
  console.log('Password:', password);

  try {
    // First, create the auth user using admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role: 'shop-owner'
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      // Check if user already exists
      if (authError.message.includes('already registered')) {
        console.log('User already exists in auth, trying to get existing user...');
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) {
          console.error('Error listing users:', listError);
          process.exit(1);
        }
        const existingUser = users.find(u => u.email === email);
        if (!existingUser) {
          console.error('Could not find existing user');
          process.exit(1);
        }
        console.log('Found existing user:', existingUser.id);

        // Update the existing user's metadata
        await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
          email_confirm: true,
          password,
          user_metadata: {
            name,
            role: 'shop-owner'
          }
        });

        authData.user = existingUser;
      } else {
        process.exit(1);
      }
    }

    console.log('✅ Auth user created/updated:', authData.user.id);

    // Now create/update the user in the users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('id', authData.user.id)
      .single();

    if (existingUser) {
      // Update existing user
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          email,
          name,
          user_role: 'shop-owner',
          user_status: 'active',
          phone_verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', authData.user.id);

      if (updateError) {
        console.error('Error updating user:', updateError);
        process.exit(1);
      }
      console.log('✅ User updated in users table');
    } else {
      // Insert new user
      const { error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          name,
          user_role: 'shop-owner',
          user_status: 'active',
          phone_verified: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error('Error inserting user:', insertError);
        process.exit(1);
      }
      console.log('✅ User created in users table');
    }

    console.log('\n✅ Shop owner user ready!');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('User ID:', authData.user.id);
    console.log('\nYou can now use these credentials to test shop-owner dashboard.');

  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

createShopOwnerUser();
