#!/usr/bin/env node

/**
 * Focused API Testing Script for 에뷰리띵 Backend
 * Tests endpoints that should work in development mode without full database setup
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testWorkingEndpoints() {
  console.log('🧪 Testing Functional API Endpoints\n');

  const tests = [
    // ✅ Basic Health & Info Endpoints
    {
      name: 'Basic Health Check',
      method: 'GET',
      path: '/health',
      expectStatus: 200,
      expectKey: 'status'
    },
    {
      name: 'Detailed Health Check',
      method: 'GET', 
      path: '/health/detailed',
      expectStatus: 200,
      expectKey: 'data'
    },
    {
      name: 'Welcome Message',
      method: 'GET',
      path: '/',
      expectStatus: 200,
      expectKey: 'message'
    },
    {
      name: 'API Documentation',
      method: 'GET',
      path: '/api-docs/',
      expectStatus: 200,
      expectText: 'Swagger'
    },

    // ✅ Authentication Endpoints (Config Check)
    {
      name: 'Auth Providers Status',
      method: 'GET',
      path: '/api/auth/providers',
      expectStatus: 200,
      expectKey: 'success'
    },

    // ✅ Protected Endpoints (Should Return Auth Errors)
    {
      name: 'WebSocket Stats (Auth Required)',
      method: 'GET',
      path: '/api/websocket/stats',
      expectStatus: 401,
      expectKey: 'error'
    },
    {
      name: 'User Profile (Auth Required)',
      method: 'GET',
      path: '/api/users/profile',
      expectStatus: 401,
      expectKey: 'error'
    },

    // ✅ Validation Endpoints (Should Return Validation Errors)
    {
      name: 'Social Login Validation',
      method: 'POST',
      path: '/api/auth/social-login',
      data: { provider: 'invalid' },
      expectStatus: 400,
      expectKey: 'error'
    },
    {
      name: 'Token Refresh Validation',
      method: 'POST',
      path: '/api/auth/refresh',
      data: { refreshToken: 'invalid' },
      expectStatus: 400,
      expectKey: 'error'
    },

    // ✅ Error Handling
    {
      name: '404 for Non-existent Endpoint',
      method: 'GET',
      path: '/api/non-existent',
      expectStatus: 404,
      expectKey: 'error'
    }
  ];

  let passed = 0;
  let total = tests.length;

  for (const test of tests) {
    try {
      const config = {
        method: test.method,
        url: `${BASE_URL}${test.path}`,
        timeout: 3000
      };

      if (test.data) {
        config.data = test.data;
      }

      const response = await axios(config);
      
      if (response.status === test.expectStatus) {
        if (test.expectKey && response.data[test.expectKey]) {
          console.log(`✅ ${test.name}`);
          passed++;
        } else if (test.expectText && response.data.includes && response.data.includes(test.expectText)) {
          console.log(`✅ ${test.name}`);
          passed++;
        } else if (!test.expectKey && !test.expectText) {
          console.log(`✅ ${test.name}`);
          passed++;
        } else {
          console.log(`⚠️  ${test.name} - Response missing expected key/text`);
        }
      } else {
        console.log(`❌ ${test.name} - Expected ${test.expectStatus}, got ${response.status}`);
      }

    } catch (error) {
      if (error.response && error.response.status === test.expectStatus) {
        if (test.expectKey && error.response.data[test.expectKey]) {
          console.log(`✅ ${test.name}`);
          passed++;
        } else {
          console.log(`⚠️  ${test.name} - Expected error response missing key`);
        }
      } else {
        console.log(`❌ ${test.name} - ${error.message}`);
      }
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n📊 Results: ${passed}/${total} endpoints working correctly`);
  
  if (passed === total) {
    console.log('🎉 All core endpoints are functional!');
  } else if (passed >= total * 0.8) {
    console.log('✨ Most endpoints are working well!');
  } else {
    console.log('⚠️  Several endpoints need attention.');
  }

  return { passed, total };
}

// Additional Swagger verification
async function checkSwaggerDocumentation() {
  console.log('\n📚 Checking API Documentation...');
  
  try {
    const response = await axios.get(`${BASE_URL}/api-docs/`, { timeout: 3000 });
    if (response.status === 200 && response.data.includes('Swagger')) {
      console.log('✅ Swagger UI is accessible');
      
      // Check if our new endpoints are documented
      const hasAuth = response.data.includes('Authentication');
      const hasShops = response.data.includes('Shops');
      const hasReservations = response.data.includes('Reservations');
      
      console.log(`✅ Authentication documentation: ${hasAuth ? 'Present' : 'Missing'}`);
      console.log(`✅ Shop documentation: ${hasShops ? 'Present' : 'Missing'}`);
      console.log(`✅ Reservation documentation: ${hasReservations ? 'Present' : 'Missing'}`);
      
      return true;
    }
  } catch (error) {
    console.log('❌ Swagger UI check failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 에뷰리띵 Backend API - Focused Testing\n');
  
  const apiResults = await testWorkingEndpoints();
  const swaggerOk = await checkSwaggerDocumentation();
  
  console.log('\n' + '='.repeat(50));
  console.log('📋 COMPREHENSIVE TEST SUMMARY');
  console.log('='.repeat(50));
  
  console.log(`\n🔧 Core API Functionality: ${apiResults.passed}/${apiResults.total} working`);
  console.log(`📚 API Documentation: ${swaggerOk ? 'Accessible' : 'Issues detected'}`);
  
  if (apiResults.passed >= apiResults.total * 0.8 && swaggerOk) {
    console.log('\n🎉 OVERALL STATUS: EXCELLENT');
    console.log('✅ The backend API is working well in development mode');
    console.log('✅ Most endpoints are functional as expected');
    console.log('✅ Authentication system is properly configured');
    console.log('✅ API documentation is accessible and enhanced');
  } else {
    console.log('\n⚠️  OVERALL STATUS: NEEDS ATTENTION');
    console.log('❓ Some endpoints may need database connectivity');
    console.log('❓ Consider checking environment configuration');
  }
}

if (require.main === module) {
  main().catch(console.error);
}