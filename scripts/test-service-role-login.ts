#!/usr/bin/env node
/**
 * Test Admin Password with Service Role Key
 *
 * Tests if using Service Role Key makes a difference
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config/environment';

const supabaseUrl = config.database.supabaseUrl;
const anonKey = config.database.supabaseAnonKey;
const serviceKey = config.database.supabaseServiceRoleKey;

async function testKeys() {
  const email = 'admin@ebeautything.com';
  const password = 'AdminPassword123!';

  console.log('🔐 Testing with ANON KEY...\n');
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data: anonData, error: anonError } = await anonClient.auth.signInWithPassword({
    email,
    password
  });

  if (anonError) {
    console.log('❌ Anon Key Failed:', anonError.message);
  } else {
    console.log('✅ Anon Key Success!');
    console.log('   User ID:', anonData.user?.id);
    await anonClient.auth.signOut();
  }

  console.log('\n🔐 Testing with SERVICE ROLE KEY...\n');
  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data: serviceData, error: serviceError } = await serviceClient.auth.signInWithPassword({
    email,
    password
  });

  if (serviceError) {
    console.log('❌ Service Key Failed:', serviceError.message);
  } else {
    console.log('✅ Service Key Success!');
    console.log('   User ID:', serviceData.user?.id);
    await serviceClient.auth.signOut();
  }
}

testKeys()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
