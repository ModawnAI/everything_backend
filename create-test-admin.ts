#!/usr/bin/env npx ts-node
/**
 * Create Test Admin Account
 */

import { createClient } from '@supabase/supabase-js';
import { config } from './src/config/environment';

const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function createTestAdmin() {
  const email = 'newadmin@ebeautything.com';
  const password = 'NewAdmin123!';

  console.log('🔐 Creating test admin account...\n');

  try {
    // 1. Create auth user
    console.log('1️⃣ Creating Supabase Auth user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: 'Test Admin',
        role: 'admin'
      }
    });

    if (authError) {
      console.error('❌ Auth user creation failed:', authError.message);
      throw authError;
    }

    console.log('✅ Auth user created:', authData.user.id);

    // 2. Create users table entry
    console.log('\n2️⃣ Creating users table entry...');
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: email,
        name: 'Test Admin',
        user_role: 'admin',
        user_status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (userError) {
      console.error('❌ Users table insertion failed:', userError.message);
      throw userError;
    }

    console.log('✅ Users table entry created');

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test admin account created successfully!');
    console.log('='.repeat(60));
    console.log('📧 Email:', email);
    console.log('🔑 Password:', password);
    console.log('👤 User ID:', authData.user.id);
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

createTestAdmin()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  });
