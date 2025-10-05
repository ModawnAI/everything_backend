#!/usr/bin/env npx ts-node
/**
 * Test the EXACT same flow as the API
 */

import { createClient } from '@supabase/supabase-js';
import { config } from './src/config/environment';

async function testAPIFlow() {
  console.log('🔐 Testing EXACT API authentication flow...\n');

  const email = 'admin@ebeautything.com';
  const password = 'AdminPassword123!';

  console.log('1️⃣  Creating temp auth client (like API does)...');
  const tempAuthClient = createClient(
    config.database.supabaseUrl,
    config.database.supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
  console.log('✅ Temp auth client created');

  console.log('\n2️⃣  Calling signInWithPassword (attempt 1)...');
  const result1 = await tempAuthClient.auth.signInWithPassword({
    email,
    password
  });

  if (result1.error) {
    console.error('❌ Attempt 1 failed:', result1.error.message);
    console.error('   Error code:', result1.error.status);
    console.error('   Error details:', JSON.stringify(result1.error, null, 2));
  } else {
    console.log('✅ Attempt 1 SUCCESS!');
    console.log('   User ID:', result1.data.user?.id);
    console.log('   Email:', result1.data.user?.email);
  }

  console.log('\n3️⃣  Trying again (attempt 2)...');
  const result2 = await tempAuthClient.auth.signInWithPassword({
    email,
    password
  });

  if (result2.error) {
    console.error('❌ Attempt 2 failed:', result2.error.message);
  } else {
    console.log('✅ Attempt 2 SUCCESS!');
  }

  console.log('\n4️⃣  Creating FRESH client and trying (attempt 3)...');
  const freshClient = createClient(
    config.database.supabaseUrl,
    config.database.supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  const result3 = await freshClient.auth.signInWithPassword({
    email,
    password
  });

  if (result3.error) {
    console.error('❌ Attempt 3 failed:', result3.error.message);
  } else {
    console.log('✅ Attempt 3 SUCCESS!');
  }
}

testAPIFlow()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });
