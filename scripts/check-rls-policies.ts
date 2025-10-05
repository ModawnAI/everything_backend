#!/usr/bin/env node
/**
 * Check RLS Policies on admin_sessions table
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config/environment';

const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceRoleKey
);

async function checkRLSPolicies() {
  console.log('🔍 Checking RLS policies on admin_sessions table...\n');

  try {
    // Check if table exists and RLS is enabled
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT
            schemaname,
            tablename,
            rowsecurity
          FROM pg_tables
          WHERE tablename = 'admin_sessions'
        `
      });

    console.log('📋 Table info:', tableInfo);

    // Check policies
    const { data: policies, error: policiesError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT
            policyname,
            permissive,
            roles,
            cmd,
            qual,
            with_check
          FROM pg_policies
          WHERE tablename = 'admin_sessions'
        `
      });

    if (policiesError) {
      console.error('❌ Error fetching policies:', policiesError);
    } else {
      console.log('\n📜 RLS Policies on admin_sessions:');
      console.log(JSON.stringify(policies, null, 2));
    }

    // Try to insert a test session
    console.log('\n🧪 Testing session insertion with service role...');
    const { data: testInsert, error: insertError } = await supabase
      .from('admin_sessions')
      .insert({
        admin_id: '9a4e2c68-a28a-4ec2-b831-c64a8e421b62',
        token: 'test_token_' + Date.now(),
        refresh_token: 'test_refresh_' + Date.now(),
        ip_address: '127.0.0.1',
        user_agent: 'test',
        device_id: 'test_device',
        is_active: true,
        last_activity_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        refresh_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Insert failed:', insertError);
    } else {
      console.log('✅ Insert succeeded:', testInsert);

      // Clean up test session
      await supabase
        .from('admin_sessions')
        .delete()
        .eq('id', testInsert.id);
      console.log('🧹 Test session cleaned up');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkRLSPolicies()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
