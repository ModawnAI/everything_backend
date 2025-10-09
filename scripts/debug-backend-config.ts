#!/usr/bin/env node
/**
 * Debug Backend Configuration
 *
 * Check what config values the backend is actually using
 */

import { config } from '../src/config/environment';
import { createClient } from '@supabase/supabase-js';

console.log('🔍 Backend Configuration Debug\n');

console.log('📍 Supabase URL:', config.database.supabaseUrl);
console.log('🔑 Anon Key (first 20):', config.database.supabaseAnonKey?.substring(0, 20) + '...');
console.log('🔐 Service Key (first 20):', config.database.supabaseServiceRoleKey?.substring(0, 20) + '...');
console.log('🌍 Environment:', config.server.env);
console.log();

// Test with anon key
console.log('🧪 Testing login with ANON KEY (same as backend API)...\n');

const anonClient = createClient(
  config.database.supabaseUrl,
  config.database.supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function testLogin() {
  const { data, error } = await anonClient.auth.signInWithPassword({
    email: 'admin@ebeautything.com',
    password: 'AdminPassword123!'
  });

  if (error) {
    console.log('❌ Login failed:', error.message);
    console.log('❌ Error code:', error.status);
  } else {
    console.log('✅ Login SUCCESS!');
    console.log('✅ User ID:', data.user?.id);
    await anonClient.auth.signOut();
  }
}

testLogin()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
