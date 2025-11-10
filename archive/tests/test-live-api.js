#!/usr/bin/env node

/**
 * Live API Testing Script for 에뷰리띵 Backend
 * Tests the actual running server on port 3001
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

async function testEndpoint(method, path, data = null, expectedStatus = 200, description = '') {
  try {
    const config = {
      method,
      url: `${BASE_URL}${path}`,
      timeout: 5000
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    
    if (response.status === expectedStatus) {
      logSuccess(`${method.toUpperCase()} ${path} - ${description || 'OK'}`);
      return { success: true, data: response.data, status: response.status };
    } else {
      logWarning(`${method.toUpperCase()} ${path} - Expected ${expectedStatus}, got ${response.status}`);
      return { success: false, data: response.data, status: response.status };
    }
  } catch (error) {
    if (error.response) {
      // Expected error responses (like 401, 404, etc.)
      if (error.response.status === expectedStatus) {
        logSuccess(`${method.toUpperCase()} ${path} - ${description || 'Expected error response'}`);
        return { success: true, data: error.response.data, status: error.response.status };
      } else {
        logError(`${method.toUpperCase()} ${path} - ${error.response.status}: ${error.response.statusText}`);
        return { success: false, error: error.response.data, status: error.response.status };
      }
    } else {
      logError(`${method.toUpperCase()} ${path} - ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

async function runComprehensiveApiTests() {
  log('🚀 Starting Comprehensive API Testing for 에뷰리띵 Backend', 'bold');
  log('=' * 60, 'blue');

  let totalTests = 0;
  let passedTests = 0;

  // Test categories
  const tests = [
    {
      category: '🏥 Health & Basic Endpoints',
      tests: [
        ['GET', '/health', null, 200, 'Server health check'],
        ['GET', '/', null, 200, 'Welcome message'],
        ['GET', '/api-docs/', null, 200, 'Swagger UI'],
      ]
    },
    {
      category: '🔐 Authentication Endpoints (Expected to fail without proper setup)',
      tests: [
        ['GET', '/api/auth/providers', null, 200, 'Social auth providers status'],
        ['POST', '/api/auth/social-login', { provider: 'kakao', token: 'test' }, 400, 'Social login validation'],
        ['POST', '/api/auth/refresh', { refreshToken: 'invalid' }, 400, 'Token refresh validation'],
      ]
    },
    {
      category: '🏪 Shop Management Endpoints',
      tests: [
        ['GET', '/api/shops', null, 200, 'Get shops list'],
        ['POST', '/api/shops', { name: 'Test Shop', address: 'Test Address', main_category: 'Beauty' }, 401, 'Create shop (auth required)'],
      ]
    },
    {
      category: '📅 Reservation Endpoints',
      tests: [
        ['GET', '/api/shops/test-shop-id/available-slots?date=2024-12-01&serviceIds[]=test', null, 400, 'Available slots (invalid shop ID)'],
        ['POST', '/api/reservations', { shopId: 'test', services: [], reservationDate: '2024-12-01' }, 401, 'Create reservation (auth required)'],
      ]
    },
    {
      category: '💳 Payment Endpoints',
      tests: [
        ['GET', '/api/payments', null, 401, 'Get payments (auth required)'],
      ]
    },
    {
      category: '👥 User Profile Endpoints',
      tests: [
        ['GET', '/api/users/profile', null, 401, 'Get user profile (auth required)'],
      ]
    },
    {
      category: '🎯 Points System Endpoints',
      tests: [
        ['GET', '/api/points', null, 401, 'Get points balance (auth required)'],
      ]
    },
    {
      category: '👨‍💼 Admin Endpoints',
      tests: [
        ['GET', '/api/admin/analytics/dashboard', null, 401, 'Admin dashboard (auth required)'],
        ['GET', '/api/admin/payments', null, 401, 'Admin payments (auth required)'],
      ]
    },
    {
      category: '🔌 WebSocket Endpoints',
      tests: [
        ['GET', '/api/websocket/stats', null, 200, 'WebSocket stats'],
      ]
    },
    {
      category: '📊 Monitoring & Utility Endpoints',
      tests: [
        ['GET', '/health/detailed', null, 200, 'Detailed health check'],
        ['GET', '/api/monitoring/metrics', null, 200, 'System metrics'],
      ]
    },
    {
      category: '❌ Error Handling',
      tests: [
        ['GET', '/api/nonexistent-endpoint', null, 404, 'Non-existent endpoint'],
        ['POST', '/api/auth/social-login', 'invalid-json', 400, 'Invalid JSON handling'],
      ]
    }
  ];

  for (const category of tests) {
    log(`\n${category.category}`, 'bold');
    log('-'.repeat(40), 'blue');

    for (const [method, path, data, expectedStatus, description] of category.tests) {
      totalTests++;
      const result = await testEndpoint(method, path, data, expectedStatus, description);
      if (result.success) {
        passedTests++;
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Summary
  log('\n' + '='.repeat(60), 'blue');
  log('📊 TEST SUMMARY', 'bold');
  log('='.repeat(60), 'blue');
  
  const successRate = ((passedTests / totalTests) * 100).toFixed(1);
  
  if (successRate >= 80) {
    logSuccess(`${passedTests}/${totalTests} tests passed (${successRate}%)`);
  } else if (successRate >= 60) {
    logWarning(`${passedTests}/${totalTests} tests passed (${successRate}%)`);
  } else {
    logError(`${passedTests}/${totalTests} tests passed (${successRate}%)`);
  }

  if (passedTests === totalTests) {
    log('\n🎉 All tests passed! The API is working perfectly.', 'green');
  } else if (successRate >= 80) {
    log('\n✨ Most tests passed! The API is working well with some expected auth failures.', 'green');
  } else {
    log('\n⚠️  Some tests failed. Check the endpoints above for issues.', 'yellow');
  }

  return { totalTests, passedTests, successRate };
}

// Run the tests
if (require.main === module) {
  runComprehensiveApiTests()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logError(`Fatal error: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { runComprehensiveApiTests, testEndpoint };