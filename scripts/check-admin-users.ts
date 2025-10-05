#!/usr/bin/env node
/**
 * Check Admin Users
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config/environment';

const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceRoleKey
);

async function checkAdminUsers() {
  console.log('🔍 Checking admin users...\n');

  try {
    // Check all users with admin email
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@ebeautything.com');

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log(`Found ${users?.length || 0} users with email admin@ebeautything.com:\n`);

    users?.forEach((user, index) => {
      console.log(`User ${index + 1}:`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.user_role}`);
      console.log(`  Status: ${user.user_status}`);
      console.log(`  Created: ${user.created_at}`);
      console.log('');
    });

    // Check auth users
    const { data, error: authError } = await supabase.auth.admin.listUsers();

    if (!authError && data && data.users) {
      const adminAuthUsers = data.users.filter((u: any) => u.email === 'admin@ebeautything.com');
      console.log(`\nAuth users with email admin@ebeautything.com: ${adminAuthUsers.length}`);
      adminAuthUsers.forEach((user: any, index: number) => {
        console.log(`  ${index + 1}. ${user.id} - ${user.email}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAdminUsers()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
