#!/usr/bin/env npx ts-node
/**
 * Check Auth Users Table
 */

import { createClient } from '@supabase/supabase-js';
import { config } from './src/config/environment';

const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceRoleKey
);

async function checkAuthUsers() {
  console.log('🔍 Checking auth.users table...\n');

  const email = 'admin@ebeautything.com';

  try {
    // Use admin API to list users
    const { data: users, error } = await supabase.auth.admin.listUsers();

    if (error) {
      console.error('❌ Error listing users:', error);
      return;
    }

    console.log(`📊 Total users in auth: ${users.users.length}\n`);

    // Find the admin user
    const adminUser = users.users.find(u => u.email === email);

    if (!adminUser) {
      console.log('❌ Admin user not found in auth.users');
      console.log('\n📋 Available users:');
      users.users.forEach((u, i) => {
        console.log(`  ${i + 1}. ${u.email} - ${u.email_confirmed_at ? 'Confirmed' : 'Not confirmed'}`);
      });
      return;
    }

    console.log('✅ Admin user found in auth.users:');
    console.log(JSON.stringify(adminUser, null, 2));

    console.log('\n🔑 Key auth fields:');
    console.log('  ID:', adminUser.id);
    console.log('  Email:', adminUser.email);
    console.log('  Email confirmed:', !!adminUser.email_confirmed_at);
    console.log('  Phone:', adminUser.phone);
    console.log('  Phone confirmed:', !!adminUser.phone_confirmed_at);
    console.log('  Created at:', adminUser.created_at);
    console.log('  Last sign in:', adminUser.last_sign_in_at);
    console.log('  Confirmed at:', adminUser.confirmed_at);
    console.log('  App metadata:', JSON.stringify(adminUser.app_metadata, null, 2));
    console.log('  User metadata:', JSON.stringify(adminUser.user_metadata, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAuthUsers()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
