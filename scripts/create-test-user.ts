#!/usr/bin/env ts-node

/**
 * Script to create a test user account with email/password authentication
 * This user can be used to test the login flow
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { logger } from '../src/utils/logger';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create Supabase admin client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUser() {
  console.log('🚀 Creating test user account...\n');

  // Test user credentials
  const testUser = {
    email: 'testuser@example.com',
    password: 'TestPassword123!',
    name: 'Test User',
    phone_number: '+821012345678',
    birth_date: '1990-01-01',
    gender: 'other',
    nickname: 'TestUser'
  };

  try {
    // Step 1: Create auth user in Supabase Auth
    console.log('📧 Creating auth user with email:', testUser.email);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testUser.email,
      password: testUser.password,
      email_confirm: true, // Auto-confirm email for testing
      user_metadata: {
        name: testUser.name,
        phone_number: testUser.phone_number,
        birth_date: testUser.birth_date,
        gender: testUser.gender,
        nickname: testUser.nickname
      }
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log('⚠️  User already exists. Attempting to update...');

        // Try to get the existing user
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
          filter: `email.eq.${testUser.email}`
        });

        if (listError) throw listError;

        if (users && users.length > 0) {
          const existingUser = users[0];
          console.log('✅ Found existing user with ID:', existingUser.id);

          // Update password for existing user
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            {
              password: testUser.password,
              user_metadata: {
                name: testUser.name,
                phone_number: testUser.phone_number,
                birth_date: testUser.birth_date,
                gender: testUser.gender,
                nickname: testUser.nickname
              }
            }
          );

          if (updateError) {
            console.error('❌ Error updating user:', updateError);
            throw updateError;
          }

          console.log('✅ Updated existing user password and metadata');

          // Step 2: Ensure user exists in users table
          await ensureUserInTable(existingUser.id, testUser);

          console.log('\n========================================');
          console.log('✅ Test user is ready!');
          console.log('========================================');
          console.log('📧 Email:', testUser.email);
          console.log('🔑 Password:', testUser.password);
          console.log('🆔 User ID:', existingUser.id);
          console.log('========================================\n');
          return;
        }
      } else {
        throw authError;
      }
    }

    if (authData?.user) {
      console.log('✅ Auth user created with ID:', authData.user.id);

      // Step 2: Create/update user record in users table
      await ensureUserInTable(authData.user.id, testUser);

      console.log('\n========================================');
      console.log('✅ Test user created successfully!');
      console.log('========================================');
      console.log('📧 Email:', testUser.email);
      console.log('🔑 Password:', testUser.password);
      console.log('🆔 User ID:', authData.user.id);
      console.log('========================================\n');
    }

  } catch (error) {
    console.error('❌ Error creating test user:', error);
    process.exit(1);
  }
}

async function ensureUserInTable(userId: string, userData: any) {
  console.log('📝 Ensuring user exists in users table...');

  // Check if user exists in users table
  const { data: existingUser, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found
    console.error('❌ Error fetching user:', fetchError);
    throw fetchError;
  }

  if (existingUser) {
    console.log('✅ User already exists in users table');

    // Update user data if needed (using correct column names)
    const { error: updateError } = await supabase
      .from('users')
      .update({
        name: userData.name,
        email: userData.email,
        phone_number: userData.phone_number,
        birth_date: userData.birth_date,
        gender: userData.gender,
        nickname: userData.nickname,
        phone_verified: false,
        user_role: 'user',
        user_status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('❌ Error updating user in table:', updateError);
      throw updateError;
    }

    console.log('✅ User data updated in users table');
  } else {
    // Create new user in table (using correct column names)
    const { error: insertError } = await supabase
      .from('users')
      .insert({
        id: userId,
        name: userData.name,
        email: userData.email,
        phone_number: userData.phone_number,
        birth_date: userData.birth_date,
        gender: userData.gender,
        nickname: userData.nickname,
        phone_verified: false,
        user_role: 'user',
        user_status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('❌ Error creating user in table:', insertError);
      throw insertError;
    }

    console.log('✅ User created in users table');
  }
}

// Run the script
createTestUser()
  .then(() => {
    console.log('🎉 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });