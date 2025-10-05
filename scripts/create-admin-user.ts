#!/usr/bin/env node
/**
 * Create Admin User Script
 *
 * Creates an admin user in both Supabase Auth and the users table
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config/environment';

const supabaseUrl = config.database.supabaseUrl;
const supabaseServiceKey = config.database.supabaseServiceRoleKey;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface AdminUserData {
  email: string;
  password: string;
  name: string;
  phone_number?: string;
}

async function createAdminUser(userData: AdminUserData) {
  console.log('🔐 Creating admin user...\n');

  try {
    // 1. Create user in Supabase Auth
    console.log('📝 Step 1: Creating auth user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: {
        name: userData.name
      }
    });

    if (authError) {
      console.error('❌ Auth user creation failed:', authError.message);
      throw authError;
    }

    console.log('✅ Auth user created:', authData.user.id);

    // 2. Create/Update user in users table with admin role
    console.log('\n📝 Step 2: Creating/updating users table record...');
    const { data: userData2, error: userError } = await supabase
      .from('users')
      .upsert({
        id: authData.user.id,
        email: userData.email,
        name: userData.name,
        phone_number: userData.phone_number || null,
        user_role: 'admin',
        user_status: 'active',
        is_influencer: false,
        total_points: 0,
        available_points: 0,
        total_referrals: 0,
        social_provider: 'email',
        terms_accepted_at: new Date().toISOString(),
        privacy_accepted_at: new Date().toISOString(),
        marketing_consent: false,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (userError) {
      console.error('❌ Users table update failed:', userError.message);
      throw userError;
    }

    console.log('✅ Users table record created/updated');

    console.log('\n🎉 Admin user created successfully!\n');
    console.log('📧 Email:', userData.email);
    console.log('🔑 Password:', userData.password);
    console.log('👤 Name:', userData.name);
    console.log('🆔 User ID:', authData.user.id);
    console.log('👑 Role: admin');

    return authData.user;

  } catch (error) {
    console.error('\n❌ Failed to create admin user:', error);
    throw error;
  }
}

// Main execution
const adminUserData: AdminUserData = {
  email: process.env.ADMIN_EMAIL || 'admin@ebeautything.com',
  password: process.env.ADMIN_PASSWORD || 'AdminPassword123!',
  name: process.env.ADMIN_NAME || '시스템 관리자',
  phone_number: process.env.ADMIN_PHONE || '010-1234-5678'
};

createAdminUser(adminUserData)
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  });
