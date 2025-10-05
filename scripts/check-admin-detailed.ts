#!/usr/bin/env node
/**
 * Detailed Admin User Check
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config/environment';

const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceRoleKey
);

async function checkDetailedAdmin() {
  console.log('🔍 Detailed admin user check...\n');

  try {
    // Check ALL users with admin role
    const { data: allAdmins, error: allError } = await supabase
      .from('users')
      .select('*')
      .eq('user_role', 'admin');

    console.log(`📊 Total users with role='admin': ${allAdmins?.length || 0}`);
    allAdmins?.forEach((user, index) => {
      console.log(`\n${index + 1}. User ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Status: ${user.user_status}`);
      console.log(`   Created: ${user.created_at}`);
    });

    // Check active admins with specific email
    console.log('\n---\n');
    const { data: activeAdmins, error: activeError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@ebeautything.com')
      .eq('user_role', 'admin')
      .eq('user_status', 'active');

    console.log(`📊 Active admins with email 'admin@ebeautything.com': ${activeAdmins?.length || 0}`);
    if (activeError) {
      console.error('Error:', activeError);
    }
    activeAdmins?.forEach((user, index) => {
      console.log(`\n${index + 1}. User ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Status: ${user.user_status}`);
      console.log(`   Role: ${user.user_role}`);
    });

    // Try single query
    console.log('\n---\nTrying .single() query...\n');
    const { data: singleAdmin, error: singleError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@ebeautything.com')
      .eq('user_role', 'admin')
      .eq('user_status', 'active')
      .single();

    if (singleError) {
      console.error('❌ .single() error:', singleError);
    } else {
      console.log('✅ .single() success:', singleAdmin.email);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkDetailedAdmin()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
