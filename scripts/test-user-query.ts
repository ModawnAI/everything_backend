#!/usr/bin/env node
/**
 * Test User Query with Auth Session
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config/environment';

const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceRoleKey
);

async function testUserQuery() {
  console.log('🧪 Testing user query after signInWithPassword...\n');

  try {
    // Step 1: Sign in
    console.log('Step 1: Signing in with password...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'admin@ebeautything.com',
      password: 'Admin123!@#'
    });

    if (authError || !authData.user) {
      console.error('❌ Sign in failed:', authError);
      return;
    }

    console.log('✅ Sign in successful:', authData.user.id);

    // Step 2: Query users table
    console.log('\nStep 2: Querying users table by ID...');
    const { data: admin, error: adminError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .eq('user_role', 'admin')
      .eq('user_status', 'active')
      .maybeSingle();

    if (adminError) {
      console.error('❌ Query error:', adminError);
    } else if (!admin) {
      console.error('❌ No data returned (RLS blocked?)');
    } else {
      console.log('✅ User found:', {
        id: admin.id,
        email: admin.email,
        role: admin.user_role,
        status: admin.user_status
      });
    }

    // Step 3: Sign out
    console.log('\nStep 3: Signing out...');
    await supabase.auth.signOut();
    console.log('✅ Signed out');

    // Step 4: Query again after sign out (should work with service role)
    console.log('\nStep 4: Querying users table after sign out...');
    const { data: admin2, error: adminError2 } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .eq('user_role', 'admin')
      .eq('user_status', 'active')
      .maybeSingle();

    if (adminError2) {
      console.error('❌ Query error:', adminError2);
    } else if (!admin2) {
      console.error('❌ No data returned');
    } else {
      console.log('✅ User found after signOut:', {
        id: admin2.id,
        email: admin2.email
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testUserQuery()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
