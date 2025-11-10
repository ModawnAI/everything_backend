#!/usr/bin/env node

/**
 * Test script for Shop Reporting API endpoints
 * Tests all CRUD operations for shop reporting functionality
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || 'your-test-user-jwt-token-here';
const TEST_SHOP_ID = process.env.TEST_SHOP_ID || 'your-test-shop-id-here';

// Test data
const testReportData = {
  report_type: 'inappropriate_content',
  title: 'Test Report - Inappropriate Content',
  description: 'This is a test report for inappropriate content. The shop has posted content that violates community guidelines.',
  evidence_urls: [
    'https://example.com/evidence1.jpg',
    'https://example.com/evidence2.jpg'
  ]
};

const testReportData2 = {
  report_type: 'spam',
  title: 'Test Report - Spam Content',
  description: 'This is a test report for spam content. The shop appears to be posting irrelevant promotional content.',
  evidence_urls: [
    'https://example.com/spam-evidence.jpg'
  ]
};

const updatedReportData = {
  title: 'Updated Test Report - Inappropriate Content',
  description: 'This is an updated test report for inappropriate content with additional details.',
  evidence_urls: [
    'https://example.com/updated-evidence1.jpg',
    'https://example.com/updated-evidence2.jpg',
    'https://example.com/updated-evidence3.jpg'
  ]
};

// Axios instance with default headers
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TEST_USER_TOKEN}`
  },
  timeout: 10000
});

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  errors: []
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
  const message = error.response?.data?.message || error.message || 'Unknown error';
  const status = error.response?.status || 'Unknown';
  logTest(testName, 'FAIL', `${status} - ${message}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test functions
async function testCreateShopReport() {
  try {
    console.log('\n🧪 Testing: Create Shop Report');
    console.log('─'.repeat(50));
    
    const response = await api.post(`/shops/${TEST_SHOP_ID}/report`, testReportData);
    
    if (response.status === 201 && response.data.success) {
      logTest('Create Shop Report', 'PASS', `Report created with ID: ${response.data.data.report.id}`);
      return response.data.data.report.id;
    } else {
      logTest('Create Shop Report', 'FAIL', 'Unexpected response format');
      return null;
    }
  } catch (error) {
    logError('Create Shop Report', error);
    return null;
  }
}

async function testCreateDuplicateReport() {
  try {
    console.log('\n🧪 Testing: Create Duplicate Report (Should Fail)');
    console.log('─'.repeat(50));
    
    await api.post(`/shops/${TEST_SHOP_ID}/report`, testReportData2);
    logTest('Create Duplicate Report', 'FAIL', 'Should have failed but succeeded');
  } catch (error) {
    if (error.response?.status === 409) {
      logTest('Create Duplicate Report', 'PASS', 'Correctly rejected duplicate report');
    } else {
      logError('Create Duplicate Report', error);
    }
  }
}

async function testCreateInvalidReport() {
  try {
    console.log('\n🧪 Testing: Create Invalid Report (Should Fail)');
    console.log('─'.repeat(50));
    
    const invalidData = {
      report_type: 'invalid_type',
      title: 'Short',
      description: 'Too short'
    };
    
    await api.post(`/shops/${TEST_SHOP_ID}/report`, invalidData);
    logTest('Create Invalid Report', 'FAIL', 'Should have failed but succeeded');
  } catch (error) {
    if (error.response?.status === 400) {
      logTest('Create Invalid Report', 'PASS', 'Correctly rejected invalid report data');
    } else {
      logError('Create Invalid Report', error);
    }
  }
}

async function testGetUserReports() {
  try {
    console.log('\n🧪 Testing: Get User Reports');
    console.log('─'.repeat(50));
    
    const response = await api.get('/shops/reports');
    
    if (response.status === 200 && response.data.success) {
      const reportCount = response.data.data.reports.length;
      logTest('Get User Reports', 'PASS', `Retrieved ${reportCount} reports`);
      return response.data.data.reports;
    } else {
      logTest('Get User Reports', 'FAIL', 'Unexpected response format');
      return [];
    }
  } catch (error) {
    logError('Get User Reports', error);
    return [];
  }
}

async function testGetUserReportsWithPagination() {
  try {
    console.log('\n🧪 Testing: Get User Reports with Pagination');
    console.log('─'.repeat(50));
    
    const response = await api.get('/shops/reports?limit=1&offset=0');
    
    if (response.status === 200 && response.data.success) {
      const { reports, pagination } = response.data.data;
      logTest('Get User Reports with Pagination', 'PASS', 
        `Retrieved ${reports.length} reports, total: ${pagination.total}`);
      return reports[0]?.id;
    } else {
      logTest('Get User Reports with Pagination', 'FAIL', 'Unexpected response format');
      return null;
    }
  } catch (error) {
    logError('Get User Reports with Pagination', error);
    return null;
  }
}

async function testGetReportById(reportId) {
  if (!reportId) {
    logTest('Get Report by ID', 'FAIL', 'No report ID provided');
    return;
  }
  
  try {
    console.log('\n🧪 Testing: Get Report by ID');
    console.log('─'.repeat(50));
    
    const response = await api.get(`/shops/reports/${reportId}`);
    
    if (response.status === 200 && response.data.success) {
      logTest('Get Report by ID', 'PASS', `Retrieved report: ${response.data.data.report.title}`);
    } else {
      logTest('Get Report by ID', 'FAIL', 'Unexpected response format');
    }
  } catch (error) {
    logError('Get Report by ID', error);
  }
}

async function testGetNonExistentReport() {
  try {
    console.log('\n🧪 Testing: Get Non-Existent Report (Should Fail)');
    console.log('─'.repeat(50));
    
    await api.get('/shops/reports/00000000-0000-0000-0000-000000000000');
    logTest('Get Non-Existent Report', 'FAIL', 'Should have failed but succeeded');
  } catch (error) {
    if (error.response?.status === 404) {
      logTest('Get Non-Existent Report', 'PASS', 'Correctly returned 404 for non-existent report');
    } else {
      logError('Get Non-Existent Report', error);
    }
  }
}

async function testUpdateReport(reportId) {
  if (!reportId) {
    logTest('Update Report', 'FAIL', 'No report ID provided');
    return;
  }
  
  try {
    console.log('\n🧪 Testing: Update Report');
    console.log('─'.repeat(50));
    
    const response = await api.put(`/shops/reports/${reportId}`, updatedReportData);
    
    if (response.status === 200 && response.data.success) {
      logTest('Update Report', 'PASS', `Updated report: ${response.data.data.report.title}`);
    } else {
      logTest('Update Report', 'FAIL', 'Unexpected response format');
    }
  } catch (error) {
    logError('Update Report', error);
  }
}

async function testUpdateInvalidReport() {
  try {
    console.log('\n🧪 Testing: Update Report with Invalid Data (Should Fail)');
    console.log('─'.repeat(50));
    
    const invalidData = {
      title: 'Short',
      description: 'Too short',
      evidence_urls: ['invalid-url']
    };
    
    // Use a valid UUID format but non-existent ID
    await api.put('/shops/reports/00000000-0000-0000-0000-000000000000', invalidData);
    logTest('Update Invalid Report', 'FAIL', 'Should have failed but succeeded');
  } catch (error) {
    if (error.response?.status === 400 || error.response?.status === 404) {
      logTest('Update Invalid Report', 'PASS', 'Correctly rejected invalid update data');
    } else {
      logError('Update Invalid Report', error);
    }
  }
}

async function testDeleteReport(reportId) {
  if (!reportId) {
    logTest('Delete Report', 'FAIL', 'No report ID provided');
    return;
  }
  
  try {
    console.log('\n🧪 Testing: Delete Report');
    console.log('─'.repeat(50));
    
    const response = await api.delete(`/shops/reports/${reportId}`);
    
    if (response.status === 200 && response.data.success) {
      logTest('Delete Report', 'PASS', 'Report deleted successfully');
    } else {
      logTest('Delete Report', 'FAIL', 'Unexpected response format');
    }
  } catch (error) {
    logError('Delete Report', error);
  }
}

async function testDeleteNonExistentReport() {
  try {
    console.log('\n🧪 Testing: Delete Non-Existent Report (Should Fail)');
    console.log('─'.repeat(50));
    
    await api.delete('/shops/reports/00000000-0000-0000-0000-000000000000');
    logTest('Delete Non-Existent Report', 'FAIL', 'Should have failed but succeeded');
  } catch (error) {
    if (error.response?.status === 404) {
      logTest('Delete Non-Existent Report', 'PASS', 'Correctly returned 404 for non-existent report');
    } else {
      logError('Delete Non-Existent Report', error);
    }
  }
}

async function testUnauthorizedAccess() {
  try {
    console.log('\n🧪 Testing: Unauthorized Access (Should Fail)');
    console.log('─'.repeat(50));
    
    // Test without authorization header
    const unauthorizedApi = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    await unauthorizedApi.get('/shops/reports');
    logTest('Unauthorized Access', 'FAIL', 'Should have failed but succeeded');
  } catch (error) {
    if (error.response?.status === 401) {
      logTest('Unauthorized Access', 'PASS', 'Correctly rejected unauthorized access');
    } else {
      logError('Unauthorized Access', error);
    }
  }
}

async function testRateLimit() {
  try {
    console.log('\n🧪 Testing: Rate Limiting (Should Fail After 5 Reports)');
    console.log('─'.repeat(50));
    
    // Try to create 6 reports to test rate limiting
    let successCount = 0;
    for (let i = 0; i < 6; i++) {
      try {
        const testData = {
          ...testReportData2,
          title: `Rate Limit Test Report ${i + 1}`,
          description: `This is rate limit test report number ${i + 1}`
        };
        
        await api.post(`/shops/${TEST_SHOP_ID}/report`, testData);
        successCount++;
      } catch (error) {
        if (error.response?.status === 429) {
          logTest('Rate Limiting', 'PASS', `Rate limit enforced after ${successCount} reports`);
          return;
        } else if (error.response?.status === 409) {
          // Duplicate report error is expected
          continue;
        } else {
          throw error;
        }
      }
    }
    
    logTest('Rate Limiting', 'FAIL', `Rate limit not enforced, created ${successCount} reports`);
  } catch (error) {
    logError('Rate Limiting', error);
  }
}

// Main test runner
async function runTests() {
  console.log('🚀 Starting Shop Reporting API Tests');
  console.log('=' .repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Test Shop ID: ${TEST_SHOP_ID}`);
  console.log(`Test User Token: ${TEST_USER_TOKEN.substring(0, 20)}...`);
  console.log('=' .repeat(60));
  
  // Check if server is running
  try {
    await api.get('/health');
    console.log('✅ Server is running');
  } catch (error) {
    console.log('❌ Server is not running. Please start the server first.');
    console.log('Run: npm run dev');
    process.exit(1);
  }
  
  let reportId = null;
  
  try {
    // Test creating a report
    reportId = await testCreateShopReport();
    
    // Test duplicate report creation
    await testCreateDuplicateReport();
    
    // Test invalid report creation
    await testCreateInvalidReport();
    
    // Test getting user reports
    await testGetUserReports();
    
    // Test pagination
    const paginationReportId = await testGetUserReportsWithPagination();
    
    // Test getting specific report
    await testGetReportById(reportId);
    
    // Test getting non-existent report
    await testGetNonExistentReport();
    
    // Test updating report
    await testUpdateReport(reportId);
    
    // Test updating with invalid data
    await testUpdateInvalidReport();
    
    // Test deleting report
    await testDeleteReport(reportId);
    
    // Test deleting non-existent report
    await testDeleteNonExistentReport();
    
    // Test unauthorized access
    await testUnauthorizedAccess();
    
    // Test rate limiting
    await testRateLimit();
    
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
  
  console.log('\n🏁 Test execution completed');
  
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

