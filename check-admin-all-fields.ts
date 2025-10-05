#!/usr/bin/env npx ts-node
/**
 * Check ALL Admin User Fields
 */

import { createClient } from '@supabase/supabase-js';
import { config } from './src/config/environment';

const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceRoleKey
);

async function checkAdmin() {
  console.log('🔍 Checking ALL admin user fields...\n');

  const email = 'admin@ebeautything.com';

  try {
    const { data: admin, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      console.error('❌ Query error:', error);
      return;
    }

    if (!admin) {
      console.log('❌ No user found');
      return;
    }

    console.log('✅ Admin user ALL fields:');
    console.log(JSON.stringify(admin, null, 2));

    // Check specifically for lock-related fields
    console.log('\n🔒 Lock-related fields:');
    console.log('  is_locked:', admin.is_locked);
    console.log('  failed_login_attempts:', admin.failed_login_attempts);
    console.log('  last_failed_login:', admin.last_failed_login);
    console.log('  locked_until:', admin.locked_until);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAdmin()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
