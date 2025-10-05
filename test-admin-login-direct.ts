#!/usr/bin/env npx ts-node
/**
 * Test Admin Login Directly with Supabase
 */

import { createClient } from '@supabase/supabase-js';
import { config } from './src/config/environment';

const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseAnonKey
);

async function testAdminLogin() {
  console.log('🔐 Testing admin login directly with Supabase Auth...\n');

  const email = 'admin@ebeautything.com';
  const passwords = ['Admin123!@#', 'AdminPassword123!', 'admin123'];

  try {
    for (const password of passwords) {
      console.log(`\n🔄 Testing password: ${password.substring(0, 5)}***`);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error(`❌ Failed: ${error.message}`);
      } else {
        console.log(`✅ SUCCESS with password: ${password.substring(0, 5)}***`);
        console.log('User ID:', data.user?.id);
        console.log('Email:', data.user?.email);
        console.log('CORRECT PASSWORD:', password);
        break;
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

testAdminLogin()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
