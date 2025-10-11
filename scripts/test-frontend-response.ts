/**
 * Test Frontend Response Structure
 * Simulates exactly what the frontend axios client receives
 */

import axios from 'axios';

const BACKEND_URL = 'http://localhost:3001';

async function testFrontendResponse() {
  console.log('🧪 Testing Frontend Response Structure\n');
  console.log('=' .repeat(80));

  try {
    const response = await axios.post(`${BACKEND_URL}/api/admin/auth/login`, {
      email: 'superadmin@ebeautything.com',
      password: 'SuperAdmin2025!'
    });

    console.log('\n✅ LOGIN SUCCESSFUL\n');
    console.log('Full Response Object Structure:');
    console.log('response.status:', response.status);
    console.log('response.statusText:', response.statusText);
    console.log('\nresponse.data structure:', JSON.stringify(response.data, null, 2));
    console.log('\n' + '='.repeat(80));

    console.log('\n📊 Token Access Patterns:');
    console.log('response.token:', response.data?.token ? '✅ EXISTS' : '❌ UNDEFINED');
    console.log('response.refreshToken:', response.data?.refreshToken ? '✅ EXISTS' : '❌ UNDEFINED');
    console.log('response.data.token:', response.data?.token ? '✅ EXISTS' : '❌ UNDEFINED');
    console.log('response.data.refreshToken:', response.data?.refreshToken ? '✅ EXISTS' : '❌ UNDEFINED');

    console.log('\n' + '='.repeat(80));
    console.log('\n📋 What Frontend Should Use:');
    if (response.data?.token && response.data?.refreshToken) {
      console.log('✅ Frontend should access: response.data.token');
      console.log('✅ Frontend should access: response.data.refreshToken');
      console.log('\nToken preview:', response.data.token.substring(0, 50) + '...');
      console.log('RefreshToken preview:', response.data.refreshToken.substring(0, 50) + '...');
    } else {
      console.log('❌ Tokens not found in expected location');
    }

  } catch (error: any) {
    console.error('\n❌ LOGIN FAILED\n');
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
  }

  console.log('\n' + '='.repeat(80));
}

testFrontendResponse();
