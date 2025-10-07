#!/usr/bin/env npx ts-node
import { createClient } from '@supabase/supabase-js';
import { config } from './src/config/environment';

const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceRoleKey
);

async function fixNewAdminUser() {
  const userId = 'd4945dcb-28af-441e-83ae-3374a97084e9';
  const email = 'newadmin@ebeautything.com';

  console.log('Adding users table entry for auth user...');

  const { error } = await supabase
    .from('users')
    .insert({
      id: userId,
      email,
      name: 'New Admin',
      user_role: 'admin',
      user_status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log('✅ Done! You can now login with:');
  console.log('Email: newadmin@ebeautything.com');
  console.log('Password: NewAdmin123!');
}

fixNewAdminUser();
