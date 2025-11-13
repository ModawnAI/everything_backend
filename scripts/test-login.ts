#!/usr/bin/env ts-node

/**
 * Test script to demonstrate email/password login flow
 * This shows how a frontend app would authenticate users
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import axios from 'axios';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const API_BASE_URL = 'http://localhost:3001';

// Create Supabase client (like a frontend app would)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true
  }
});

async function testLogin() {
  console.log('🔐 Testing Email/Password Login Flow\n');
  console.log('========================================');

  // Test credentials
  const email = 'testuser@example.com';
  const password = 'TestPassword123!';

  try {
    // Step 1: Login with Supabase Auth (Frontend would do this)
    console.log('1️⃣  Authenticating with Supabase Auth...');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password.replace(/./g, '*')}\n`);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError) {
      console.error('❌ Login failed:', authError.message);
      return;
    }

    if (!authData.session) {
      console.error('❌ No session returned');
      return;
    }

    console.log('✅ Supabase Auth successful!');
    console.log('   User ID:', authData.user?.id);
    console.log('   Email:', authData.user?.email);
    console.log('   Access Token:', authData.session.access_token.substring(0, 20) + '...');
    console.log('   Refresh Token:', authData.session.refresh_token?.substring(0, 20) + '...\n');

    // Step 2: Exchange Supabase session for backend JWT (if backend is running)
    console.log('2️⃣  Exchanging Supabase session for backend JWT...');
    console.log('   (This step requires the backend server to be running)\n');

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/supabase-session`,
        {
          fcmToken: 'test-fcm-token-12345',
          deviceInfo: {
            platform: 'web',
            version: '1.0.0',
            deviceId: 'test-device-001'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${authData.session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ Backend session created!');
      console.log('   Backend JWT:', response.data.data?.tokens?.accessToken?.substring(0, 20) + '...');
      console.log('   Refresh Token:', response.data.data?.tokens?.refreshToken?.substring(0, 20) + '...');
      console.log('   User Name:', response.data.data?.user?.name);
      console.log('   User Role:', response.data.data?.user?.user_role);

      // Step 3: Test authenticated API call
      console.log('\n3️⃣  Testing authenticated API call...');

      const testResponse = await axios.get(
        `${API_BASE_URL}/api/user/profile`,
        {
          headers: {
            'Authorization': `Bearer ${response.data.data?.tokens?.accessToken}`
          }
        }
      );

      console.log('✅ Authenticated API call successful!');
      console.log('   Profile data retrieved:', testResponse.data.success);

    } catch (backendError: any) {
      if (backendError.code === 'ECONNREFUSED') {
        console.log('⚠️  Backend server is not running');
        console.log('   Start it with: npm run dev');
        console.log('   Then run this script again to test the full flow');
      } else {
        console.error('❌ Backend error:', backendError.response?.data || backendError.message);
      }
    }

    // Step 4: Show how to use the session in subsequent requests
    console.log('\n========================================');
    console.log('📋 Summary - How Users Login:\n');
    console.log('1. Frontend calls supabase.auth.signInWithPassword()');
    console.log('2. On success, send the Supabase token to backend /api/auth/supabase-session');
    console.log('3. Backend validates the token and returns its own JWT');
    console.log('4. Use the backend JWT for all API calls');
    console.log('5. Refresh tokens when they expire');
    console.log('\n========================================');

    // Cleanup - sign out
    await supabase.auth.signOut();
    console.log('\n🔚 Signed out successfully');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testLogin()
  .then(() => {
    console.log('\n✨ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });