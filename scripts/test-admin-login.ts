/**
 * Test Admin Login Script
 * Tests the admin login endpoint with correct credentials
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import axios from 'axios';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const ADMIN_EMAIL = 'admin@ebeautything.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'AdminPassword123!';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function testAdminLogin() {
  console.log('🧪 Admin Login Test\n');
  console.log('=' .repeat(60));

  // Test 1: Supabase Auth Direct Login
  console.log('\n📋 Test 1: Supabase Auth Direct Login');
  console.log('-'.repeat(60));

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD
  });

  if (authError) {
    console.error('❌ Supabase Auth login failed:', authError.message);
  } else {
    console.log('✅ Supabase Auth login successful!');
    console.log('   - User ID:', authData.user?.id);
    console.log('   - Email:', authData.user?.email);
    console.log('   - Session:', authData.session ? 'Active' : 'None');
    await authClient.auth.signOut();
  }

  // Test 2: Backend Admin Login API
  console.log('\n📋 Test 2: Backend Admin Login API');
  console.log('-'.repeat(60));

  try {
    const response = await axios.post(
      `${BACKEND_URL}/api/admin/auth/login`,
      {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        validateStatus: () => true // Accept any status code
      }
    );

    if (response.status === 200 && response.data.success) {
      console.log('✅ Backend Admin login successful!');
      console.log('   - Admin ID:', response.data.admin?.id);
      console.log('   - Email:', response.data.admin?.email);
      console.log('   - Role:', response.data.admin?.role);
      console.log('   - Token:', response.data.session?.token ? 'Generated' : 'Missing');
    } else {
      console.error('❌ Backend Admin login failed');
      console.error('   - Status:', response.status);
      console.error('   - Response:', JSON.stringify(response.data, null, 2));
    }
  } catch (error: any) {
    console.error('❌ Backend Admin login request failed');
    console.error('   - Error:', error.message);
    if (error.response) {
      console.error('   - Status:', error.response.status);
      console.error('   - Data:', JSON.stringify(error.response.data, null, 2));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log('\n✅ If both tests passed, admin login is working correctly!');
  console.log('🔑 Credentials:');
  console.log('   - Email:', ADMIN_EMAIL);
  console.log('   - Password:', ADMIN_PASSWORD);
  console.log('\n💡 Next steps:');
  console.log('   1. Try logging in from the frontend');
  console.log('   2. If it works, consider changing the password');
  console.log('   3. Save these credentials securely');
  console.log('='.repeat(60));
}

// Run test
testAdminLogin()
  .then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
