#!/usr/bin/env npx ts-node
/**
 * Check Admin User Details
 */

import { createClient } from '@supabase/supabase-js';
import { config } from './src/config/environment';

const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceRoleKey
);

async function checkAdmin() {
  console.log('🔍 Checking admin user details...\n');

  const email = 'admin@ebeautything.com';

  try {
    // Check the exact query the service uses
    const { data: admin, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .eq('user_role', 'admin')
      .eq('user_status', 'active')
      .maybeSingle();

    if (error) {
      console.error('❌ Query error:', error);
      return;
    }

    if (!admin) {
      console.log('❌ No admin found with query:');
      console.log('  email =', email);
      console.log('  user_role = admin');
      console.log('  user_status = active');

      // Try without filters
      console.log('\n🔍 Trying without role/status filters...\n');
      const { data: anyUser, error: anyError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (anyError) {
        console.error('❌ Error:', anyError);
      } else if (anyUser) {
        console.log('✅ Found user:');
        console.log('  ID:', anyUser.id);
        console.log('  Email:', anyUser.email);
        console.log('  user_role:', JSON.stringify(anyUser.user_role));
        console.log('  user_status:', JSON.stringify(anyUser.user_status));
        console.log('  All fields:', JSON.stringify(anyUser, null, 2));
      }
    } else {
      console.log('✅ Admin found successfully:');
      console.log('  ID:', admin.id);
      console.log('  Email:', admin.email);
      console.log('  user_role:', admin.user_role);
      console.log('  user_status:', admin.user_status);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAdmin()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
