#!/usr/bin/env node

/**
 * Test script for Admin Moderation Dashboard API
 * Tests all admin moderation endpoints and functionality
 */

const https = require('https');
const http = require('http');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'test-admin-token';

// Test configuration
const TEST_CONFIG = {
  baseUrl: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ADMIN_TOKEN}`
  },
  timeout: 10000
};

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  errors: [],
  testData: {
    reportId: null,
    shopId: null
  }
};

// Utility functions
function logTest(testName, status, message = '') {
  const statusIcon = status === 'PASS' ? '✅' : '❌';
  console.log(`${statusIcon} ${testName}: ${message}`);
  
  if (status === 'PASS') {
    testResults.passed++;
  } else {
    testResults.failed++;
    testResults.errors.push(`${testName}: ${message}`);
  }
}

function logError(testName, error) {
  const message = error.message || 'Unknown error';
  logTest(testName, 'FAIL', message);
}

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, TEST_CONFIG.baseUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: TEST_CONFIG.headers,
      timeout: TEST_CONFIG.timeout
    };

    const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const responseData = body ? JSON.parse(body) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: body
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test functions
async function testGetShopReports() {
  try {
    console.log('\n🧪 Testing: Get Shop Reports');
    console.log('─'.repeat(50));
    
    // Test basic request
    const response = await makeRequest('GET', '/api/admin/shop-reports');
    
    if (response.statusCode === 200 && response.data.success) {
      logTest('Get Shop Reports - Basic', 'PASS', 
        `Retrieved ${response.data.data?.reports?.length || 0} reports`);
      
      // Store first report ID for other tests
      if (response.data.data?.reports?.length > 0) {
        testResults.testData.reportId = response.data.data.reports[0].id;
        testResults.testData.shopId = response.data.data.reports[0].shop_id;
      }
    } else {
      logTest('Get Shop Reports - Basic', 'FAIL', 
        `Status: ${response.statusCode}, Message: ${response.data?.message || 'Unknown error'}`);
    }
    
    // Test with filters
    const filteredResponse = await makeRequest('GET', '/api/admin/shop-reports?status=pending&limit=5');
    
    if (filteredResponse.statusCode === 200 && filteredResponse.data.success) {
      logTest('Get Shop Reports - Filtered', 'PASS', 
        `Retrieved ${filteredResponse.data.data?.reports?.length || 0} filtered reports`);
    } else {
      logTest('Get Shop Reports - Filtered', 'FAIL', 
        `Status: ${filteredResponse.statusCode}, Message: ${filteredResponse.data?.message || 'Unknown error'}`);
    }
    
    // Test with search
    const searchResponse = await makeRequest('GET', '/api/admin/shop-reports?search=test&sort_by=created_at&sort_order=desc');
    
    if (searchResponse.statusCode === 200 && searchResponse.data.success) {
      logTest('Get Shop Reports - Search', 'PASS', 
        `Search completed successfully`);
    } else {
      logTest('Get Shop Reports - Search', 'FAIL', 
        `Status: ${searchResponse.statusCode}, Message: ${searchResponse.data?.message || 'Unknown error'}`);
    }
    
  } catch (error) {
    logError('Get Shop Reports', error);
  }
}

async function testGetShopReportById() {
  try {
    console.log('\n🧪 Testing: Get Shop Report by ID');
    console.log('─'.repeat(50));
    
    if (!testResults.testData.reportId) {
      logTest('Get Shop Report by ID', 'SKIP', 'No report ID available from previous test');
      return;
    }
    
    const response = await makeRequest('GET', `/api/admin/shop-reports/${testResults.testData.reportId}`);
    
    if (response.statusCode === 200 && response.data.success) {
      logTest('Get Shop Report by ID', 'PASS', 
        `Retrieved report: ${response.data.data?.report?.title || 'Untitled'}`);
    } else {
      logTest('Get Shop Report by ID', 'FAIL', 
        `Status: ${response.statusCode}, Message: ${response.data?.message || 'Unknown error'}`);
    }
    
    // Test with invalid ID
    const invalidResponse = await makeRequest('GET', '/api/admin/shop-reports/invalid-id');
    
    if (invalidResponse.statusCode === 400) {
      logTest('Get Shop Report by ID - Invalid', 'PASS', 'Properly rejected invalid ID');
    } else {
      logTest('Get Shop Report by ID - Invalid', 'FAIL', 
        `Expected 400, got ${invalidResponse.statusCode}`);
    }
    
  } catch (error) {
    logError('Get Shop Report by ID', error);
  }
}

async function testUpdateShopReport() {
  try {
    console.log('\n🧪 Testing: Update Shop Report');
    console.log('─'.repeat(50));
    
    if (!testResults.testData.reportId) {
      logTest('Update Shop Report', 'SKIP', 'No report ID available from previous test');
      return;
    }
    
    // Test updating report status
    const updateData = {
      status: 'under_review',
      admin_notes: 'Test admin note - reviewing content',
      action_type: 'flag',
      reason: 'Content flagged for manual review during testing'
    };
    
    const response = await makeRequest('PUT', `/api/admin/shop-reports/${testResults.testData.reportId}`, updateData);
    
    if (response.statusCode === 200 && response.data.success) {
      logTest('Update Shop Report', 'PASS', 
        `Updated report status to: ${response.data.data?.report?.status || 'unknown'}`);
    } else {
      logTest('Update Shop Report', 'FAIL', 
        `Status: ${response.statusCode}, Message: ${response.data?.message || 'Unknown error'}`);
    }
    
    // Test with invalid data
    const invalidUpdateData = {
      status: 'invalid_status',
      action_type: 'invalid_action'
    };
    
    const invalidResponse = await makeRequest('PUT', `/api/admin/shop-reports/${testResults.testData.reportId}`, invalidUpdateData);
    
    if (invalidResponse.statusCode === 400) {
      logTest('Update Shop Report - Invalid Data', 'PASS', 'Properly rejected invalid data');
    } else {
      logTest('Update Shop Report - Invalid Data', 'FAIL', 
        `Expected 400, got ${invalidResponse.statusCode}`);
    }
    
  } catch (error) {
    logError('Update Shop Report', error);
  }
}

async function testGetShopModerationHistory() {
  try {
    console.log('\n🧪 Testing: Get Shop Moderation History');
    console.log('─'.repeat(50));
    
    if (!testResults.testData.shopId) {
      logTest('Get Shop Moderation History', 'SKIP', 'No shop ID available from previous test');
      return;
    }
    
    const response = await makeRequest('GET', `/api/admin/shops/${testResults.testData.shopId}/moderation-history`);
    
    if (response.statusCode === 200 && response.data.success) {
      const data = response.data.data;
      logTest('Get Shop Moderation History', 'PASS', 
        `Retrieved ${data?.moderation_actions?.length || 0} actions, ${data?.reports?.length || 0} reports`);
    } else {
      logTest('Get Shop Moderation History', 'FAIL', 
        `Status: ${response.statusCode}, Message: ${response.data?.message || 'Unknown error'}`);
    }
    
    // Test with pagination
    const paginatedResponse = await makeRequest('GET', 
      `/api/admin/shops/${testResults.testData.shopId}/moderation-history?limit=5&offset=0`);
    
    if (paginatedResponse.statusCode === 200 && paginatedResponse.data.success) {
      logTest('Get Shop Moderation History - Paginated', 'PASS', 'Pagination working correctly');
    } else {
      logTest('Get Shop Moderation History - Paginated', 'FAIL', 
        `Status: ${paginatedResponse.statusCode}, Message: ${paginatedResponse.data?.message || 'Unknown error'}`);
    }
    
  } catch (error) {
    logError('Get Shop Moderation History', error);
  }
}

async function testBulkAction() {
  try {
    console.log('\n🧪 Testing: Bulk Action on Reports');
    console.log('─'.repeat(50));
    
    if (!testResults.testData.reportId) {
      logTest('Bulk Action', 'SKIP', 'No report ID available from previous test');
      return;
    }
    
    const bulkActionData = {
      report_ids: [testResults.testData.reportId],
      action_type: 'warn',
      reason: 'Bulk action test - warning issued during testing'
    };
    
    const response = await makeRequest('POST', '/api/admin/shop-reports/bulk-action', bulkActionData);
    
    if (response.statusCode === 200 && response.data.success) {
      const results = response.data.data?.results;
      logTest('Bulk Action', 'PASS', 
        `Processed ${results?.total || 0} reports, ${results?.successful?.length || 0} successful, ${results?.failed?.length || 0} failed`);
    } else {
      logTest('Bulk Action', 'FAIL', 
        `Status: ${response.statusCode}, Message: ${response.data?.message || 'Unknown error'}`);
    }
    
    // Test with invalid data
    const invalidBulkData = {
      report_ids: [],
      action_type: 'invalid_action',
      reason: 'Test'
    };
    
    const invalidResponse = await makeRequest('POST', '/api/admin/shop-reports/bulk-action', invalidBulkData);
    
    if (invalidResponse.statusCode === 400) {
      logTest('Bulk Action - Invalid Data', 'PASS', 'Properly rejected invalid bulk action data');
    } else {
      logTest('Bulk Action - Invalid Data', 'FAIL', 
        `Expected 400, got ${invalidResponse.statusCode}`);
    }
    
  } catch (error) {
    logError('Bulk Action', error);
  }
}

async function testGetModerationStats() {
  try {
    console.log('\n🧪 Testing: Get Moderation Statistics');
    console.log('─'.repeat(50));
    
    // Test basic stats request
    const response = await makeRequest('GET', '/api/admin/moderation/stats');
    
    if (response.statusCode === 200 && response.data.success) {
      const stats = response.data.data;
      logTest('Get Moderation Stats', 'PASS', 
        `Total reports: ${stats?.reports?.total || 0}, Total actions: ${stats?.actions?.total || 0}`);
    } else {
      logTest('Get Moderation Stats', 'FAIL', 
        `Status: ${response.statusCode}, Message: ${response.data?.message || 'Unknown error'}`);
    }
    
    // Test with date range
    const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
    const dateTo = new Date().toISOString();
    
    const dateRangeResponse = await makeRequest('GET', 
      `/api/admin/moderation/stats?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`);
    
    if (dateRangeResponse.statusCode === 200 && dateRangeResponse.data.success) {
      logTest('Get Moderation Stats - Date Range', 'PASS', 'Date range filtering working correctly');
    } else {
      logTest('Get Moderation Stats - Date Range', 'FAIL', 
        `Status: ${dateRangeResponse.statusCode}, Message: ${dateRangeResponse.data?.message || 'Unknown error'}`);
    }
    
  } catch (error) {
    logError('Get Moderation Statistics', error);
  }
}

async function testAnalyzeShopContent() {
  try {
    console.log('\n🧪 Testing: Analyze Shop Content');
    console.log('─'.repeat(50));
    
    if (!testResults.testData.shopId) {
      logTest('Analyze Shop Content', 'SKIP', 'No shop ID available from previous test');
      return;
    }
    
    const response = await makeRequest('POST', `/api/admin/shops/${testResults.testData.shopId}/analyze-content`);
    
    if (response.statusCode === 200 && response.data.success) {
      const analysis = response.data.data?.analysis;
      const overallResult = analysis?.overall_result;
      logTest('Analyze Shop Content', 'PASS', 
        `Score: ${overallResult?.score || 0}, Severity: ${overallResult?.severity || 'unknown'}, Action: ${overallResult?.suggested_action || 'unknown'}`);
    } else {
      logTest('Analyze Shop Content', 'FAIL', 
        `Status: ${response.statusCode}, Message: ${response.data?.message || 'Unknown error'}`);
    }
    
    // Test with invalid shop ID
    const invalidResponse = await makeRequest('POST', '/api/admin/shops/invalid-id/analyze-content');
    
    if (invalidResponse.statusCode === 400 || invalidResponse.statusCode === 404) {
      logTest('Analyze Shop Content - Invalid ID', 'PASS', 'Properly rejected invalid shop ID');
    } else {
      logTest('Analyze Shop Content - Invalid ID', 'FAIL', 
        `Expected 400/404, got ${invalidResponse.statusCode}`);
    }
    
  } catch (error) {
    logError('Analyze Shop Content', error);
  }
}

async function testAuthentication() {
  try {
    console.log('\n🧪 Testing: Authentication and Authorization');
    console.log('─'.repeat(50));
    
    // Test without token
    const noTokenResponse = await makeRequest('GET', '/api/admin/shop-reports');
    // Temporarily remove auth header
    const originalHeaders = TEST_CONFIG.headers;
    delete TEST_CONFIG.headers.Authorization;
    
    if (noTokenResponse.statusCode === 401) {
      logTest('Authentication - No Token', 'PASS', 'Properly rejected request without token');
    } else {
      logTest('Authentication - No Token', 'FAIL', 
        `Expected 401, got ${noTokenResponse.statusCode}`);
    }
    
    // Restore auth header
    TEST_CONFIG.headers = originalHeaders;
    
    // Test with invalid token
    const invalidTokenHeaders = { ...originalHeaders };
    invalidTokenHeaders.Authorization = 'Bearer invalid-token';
    
    const originalConfigHeaders = TEST_CONFIG.headers;
    TEST_CONFIG.headers = invalidTokenHeaders;
    
    const invalidTokenResponse = await makeRequest('GET', '/api/admin/shop-reports');
    
    if (invalidTokenResponse.statusCode === 401 || invalidTokenResponse.statusCode === 403) {
      logTest('Authentication - Invalid Token', 'PASS', 'Properly rejected invalid token');
    } else {
      logTest('Authentication - Invalid Token', 'FAIL', 
        `Expected 401/403, got ${invalidTokenResponse.statusCode}`);
    }
    
    // Restore original headers
    TEST_CONFIG.headers = originalConfigHeaders;
    
  } catch (error) {
    logError('Authentication Tests', error);
  }
}

async function testRateLimiting() {
  try {
    console.log('\n🧪 Testing: Rate Limiting');
    console.log('─'.repeat(50));
    
    // Make multiple rapid requests to test rate limiting
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(makeRequest('GET', '/api/admin/shop-reports'));
    }
    
    const responses = await Promise.all(promises);
    
    // Check if all requests were successful (rate limit should allow these)
    const allSuccessful = responses.every(response => response.statusCode === 200);
    
    if (allSuccessful) {
      logTest('Rate Limiting - Normal Load', 'PASS', 'All requests processed successfully');
    } else {
      logTest('Rate Limiting - Normal Load', 'FAIL', 
        `Some requests failed: ${responses.filter(r => r.statusCode !== 200).length}`);
    }
    
  } catch (error) {
    logError('Rate Limiting Tests', error);
  }
}

async function testValidation() {
  try {
    console.log('\n🧪 Testing: Input Validation');
    console.log('─'.repeat(50));
    
    // Test invalid query parameters
    const invalidQueryResponse = await makeRequest('GET', 
      '/api/admin/shop-reports?status=invalid&limit=1000&offset=-1');
    
    if (invalidQueryResponse.statusCode === 400) {
      logTest('Input Validation - Query Params', 'PASS', 'Properly rejected invalid query parameters');
    } else {
      logTest('Input Validation - Query Params', 'FAIL', 
        `Expected 400, got ${invalidQueryResponse.statusCode}`);
    }
    
    // Test invalid UUID format
    const invalidUuidResponse = await makeRequest('GET', '/api/admin/shop-reports/not-a-uuid');
    
    if (invalidUuidResponse.statusCode === 400) {
      logTest('Input Validation - UUID Format', 'PASS', 'Properly rejected invalid UUID format');
    } else {
      logTest('Input Validation - UUID Format', 'FAIL', 
        `Expected 400, got ${invalidUuidResponse.statusCode}`);
    }
    
  } catch (error) {
    logError('Input Validation Tests', error);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Admin Moderation Dashboard API Tests');
  console.log('=' .repeat(60));
  console.log(`API Base URL: ${TEST_CONFIG.baseUrl}`);
  console.log(`Admin Token: ${ADMIN_TOKEN.substring(0, 20)}...`);
  console.log('=' .repeat(60));
  
  try {
    await testAuthentication();
    await testGetShopReports();
    await testGetShopReportById();
    await testUpdateShopReport();
    await testGetShopModerationHistory();
    await testBulkAction();
    await testGetModerationStats();
    await testAnalyzeShopContent();
    await testRateLimiting();
    await testValidation();
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  }
  
  // Print test results
  console.log('\n' + '=' .repeat(60));
  console.log('📊 Test Results Summary');
  console.log('=' .repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);
  
  if (testResults.errors.length > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.errors.forEach(error => console.log(`   - ${error}`));
  }
  
  console.log('\n🏁 Admin moderation API tests completed');
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run tests
runTests().catch(console.error);

