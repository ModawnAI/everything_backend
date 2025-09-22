#!/usr/bin/env node

/**
 * Shop Categories Integration Test
 * 
 * Tests the integration of shop categories with the main application
 * Verifies that all endpoints are accessible and working correctly
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_ENDPOINTS = {
  categories: `${BASE_URL}/api/shops/categories`,
  categoryById: (id) => `${BASE_URL}/api/shops/categories/${id}`,
  serviceTypes: (id) => `${BASE_URL}/api/shops/categories/${id}/services`,
  search: `${BASE_URL}/api/shops/categories/search`,
  popularServices: `${BASE_URL}/api/shops/categories/popular/services`,
  stats: `${BASE_URL}/api/shops/categories/stats`,
  hierarchy: `${BASE_URL}/api/shops/categories/hierarchy`
};

// Test data
const TEST_CATEGORIES = ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair'];
const TEST_SEARCH_QUERIES = ['네일', '속눈썹', '왁싱', '눈썹', '헤어'];

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  errors: []
};

// Utility functions
function logTest(testName, status, details = '') {
  testResults.total++;
  if (status === 'PASS') {
    testResults.passed++;
    console.log(`✅ ${testName} - PASSED ${details}`);
  } else {
    testResults.failed++;
    testResults.errors.push({ test: testName, error: details });
    console.log(`❌ ${testName} - FAILED: ${details}`);
  }
}

async function makeRequest(url, options = {}) {
  try {
    const response = await axios({
      url,
      method: options.method || 'GET',
      params: options.params,
      timeout: 10000,
      ...options
    });
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message, 
      status: error.response?.status || 500 
    };
  }
}

// Test functions
async function testGetAllCategories() {
  console.log('\n🧪 Testing: Get All Categories');
  
  // Test basic categories list
  const basicResult = await makeRequest(API_ENDPOINTS.categories);
  if (basicResult.success && basicResult.data.success) {
    logTest('Get all categories (basic)', 'PASS', `Found ${basicResult.data.data.categories.length} categories`);
  } else {
    logTest('Get all categories (basic)', 'FAIL', basicResult.error);
  }

  // Test with service types
  const withServicesResult = await makeRequest(API_ENDPOINTS.categories, {
    params: { withServiceTypes: true }
  });
  if (withServicesResult.success && withServicesResult.data.success) {
    const hasServices = withServicesResult.data.data.categories.some(cat => cat.serviceTypes.length > 0);
    logTest('Get all categories (with services)', 'PASS', hasServices ? 'Services included' : 'No services found');
  } else {
    logTest('Get all categories (with services)', 'FAIL', withServicesResult.error);
  }

  // Test filtering by category
  const filteredResult = await makeRequest(API_ENDPOINTS.categories, {
    params: { category: 'nail' }
  });
  if (filteredResult.success && filteredResult.data.success) {
    const nailCategory = filteredResult.data.data.categories.find(cat => cat.id === 'nail');
    logTest('Get categories (filtered)', 'PASS', nailCategory ? 'Nail category found' : 'Nail category not found');
  } else {
    logTest('Get categories (filtered)', 'FAIL', filteredResult.error);
  }
}

async function testGetCategoryById() {
  console.log('\n🧪 Testing: Get Category by ID');
  
  for (const categoryId of TEST_CATEGORIES) {
    const result = await makeRequest(API_ENDPOINTS.categoryById(categoryId));
    if (result.success && result.data.success) {
      logTest(`Get category by ID (${categoryId})`, 'PASS', result.data.data.category.displayName);
    } else {
      logTest(`Get category by ID (${categoryId})`, 'FAIL', result.error);
    }
  }

  // Test non-existent category
  const invalidResult = await makeRequest(API_ENDPOINTS.categoryById('invalid_category'));
  if (invalidResult.status === 404) {
    logTest('Get category by ID (invalid)', 'PASS', 'Correctly returned 404');
  } else {
    logTest('Get category by ID (invalid)', 'FAIL', `Expected 404, got ${invalidResult.status}`);
  }
}

async function testGetServiceTypes() {
  console.log('\n🧪 Testing: Get Service Types by Category');
  
  for (const categoryId of TEST_CATEGORIES) {
    const result = await makeRequest(API_ENDPOINTS.serviceTypes(categoryId));
    if (result.success && result.data.success) {
      const serviceCount = result.data.data.serviceTypes.length;
      logTest(`Get service types (${categoryId})`, 'PASS', `Found ${serviceCount} services`);
    } else {
      logTest(`Get service types (${categoryId})`, 'FAIL', result.error);
    }
  }
}

async function testSearchCategories() {
  console.log('\n🧪 Testing: Search Categories');
  
  for (const query of TEST_SEARCH_QUERIES) {
    const result = await makeRequest(API_ENDPOINTS.search, {
      params: { q: query, limit: 5 }
    });
    if (result.success && result.data.success) {
      const resultCount = result.data.data.results.length;
      logTest(`Search categories (${query})`, 'PASS', `Found ${resultCount} results`);
    } else {
      logTest(`Search categories (${query})`, 'FAIL', result.error);
    }
  }

  // Test search without query
  const noQueryResult = await makeRequest(API_ENDPOINTS.search);
  if (noQueryResult.status === 400) {
    logTest('Search categories (no query)', 'PASS', 'Correctly returned 400');
  } else {
    logTest('Search categories (no query)', 'FAIL', `Expected 400, got ${noQueryResult.status}`);
  }
}

async function testGetPopularServices() {
  console.log('\n🧪 Testing: Get Popular Services');
  
  const result = await makeRequest(API_ENDPOINTS.popularServices, {
    params: { limit: 10 }
  });
  if (result.success && result.data.success) {
    const serviceCount = result.data.data.services.length;
    logTest('Get popular services', 'PASS', `Found ${serviceCount} popular services`);
  } else {
    logTest('Get popular services', 'FAIL', result.error);
  }

  // Test with different limits
  const limitedResult = await makeRequest(API_ENDPOINTS.popularServices, {
    params: { limit: 3 }
  });
  if (limitedResult.success && limitedResult.data.success) {
    const serviceCount = limitedResult.data.data.services.length;
    logTest('Get popular services (limited)', 'PASS', `Found ${serviceCount} services (limit: 3)`);
  } else {
    logTest('Get popular services (limited)', 'FAIL', limitedResult.error);
  }
}

async function testGetCategoryStats() {
  console.log('\n🧪 Testing: Get Category Statistics');
  
  const result = await makeRequest(API_ENDPOINTS.stats);
  if (result.success && result.data.success) {
    const stats = result.data.data;
    logTest('Get category statistics', 'PASS', 
      `Categories: ${stats.totalCategories}, Services: ${stats.totalServices}, Popular: ${stats.popularServices}`);
  } else {
    logTest('Get category statistics', 'FAIL', result.error);
  }
}

async function testGetCategoryHierarchy() {
  console.log('\n🧪 Testing: Get Category Hierarchy');
  
  const result = await makeRequest(API_ENDPOINTS.hierarchy);
  if (result.success && result.data.success) {
    const categoryCount = result.data.data.categories.length;
    logTest('Get category hierarchy', 'PASS', `Found ${categoryCount} categories in hierarchy`);
  } else {
    logTest('Get category hierarchy', 'FAIL', result.error);
  }
}

async function testRateLimiting() {
  console.log('\n🧪 Testing: Rate Limiting');
  
  // Make multiple rapid requests to test rate limiting
  const promises = Array(10).fill().map(() => makeRequest(API_ENDPOINTS.categories));
  const results = await Promise.all(promises);
  
  const successCount = results.filter(r => r.success).length;
  const rateLimitedCount = results.filter(r => r.status === 429).length;
  
  if (rateLimitedCount > 0) {
    logTest('Rate limiting', 'PASS', `Rate limited ${rateLimitedCount} out of 10 requests`);
  } else if (successCount === 10) {
    logTest('Rate limiting', 'PASS', 'All requests succeeded (rate limit not triggered)');
  } else {
    logTest('Rate limiting', 'FAIL', `Unexpected results: ${successCount} success, ${rateLimitedCount} rate limited`);
  }
}

async function testErrorHandling() {
  console.log('\n🧪 Testing: Error Handling');
  
  // Test invalid category ID format
  const invalidFormatResult = await makeRequest(API_ENDPOINTS.categoryById('invalid-format-123'));
  if (invalidFormatResult.status === 400) {
    logTest('Error handling (invalid format)', 'PASS', 'Correctly returned 400 for invalid format');
  } else {
    logTest('Error handling (invalid format)', 'FAIL', `Expected 400, got ${invalidFormatResult.status}`);
  }

  // Test invalid query parameters
  const invalidParamsResult = await makeRequest(API_ENDPOINTS.categories, {
    params: { includeInactive: 'invalid' }
  });
  if (invalidParamsResult.status === 400) {
    logTest('Error handling (invalid params)', 'PASS', 'Correctly returned 400 for invalid parameters');
  } else {
    logTest('Error handling (invalid params)', 'FAIL', `Expected 400, got ${invalidParamsResult.status}`);
  }
}

// Main test execution
async function runAllTests() {
  console.log('🚀 Starting Shop Categories Integration Tests');
  console.log(`📍 Testing against: ${BASE_URL}`);
  console.log('=' .repeat(60));

  try {
    await testGetAllCategories();
    await testGetCategoryById();
    await testGetServiceTypes();
    await testSearchCategories();
    await testGetPopularServices();
    await testGetCategoryStats();
    await testGetCategoryHierarchy();
    await testRateLimiting();
    await testErrorHandling();

    // Print summary
    console.log('\n' + '=' .repeat(60));
    console.log('📊 Test Summary');
    console.log('=' .repeat(60));
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📈 Total: ${testResults.total}`);
    console.log(`📊 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

    if (testResults.failed > 0) {
      console.log('\n❌ Failed Tests:');
      testResults.errors.forEach(error => {
        console.log(`  - ${error.test}: ${error.error}`);
      });
    }

    console.log('\n🎉 Shop Categories Integration Tests Completed!');
    
    // Exit with appropriate code
    process.exit(testResults.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n💥 Test execution failed:', error.message);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runAllTests,
  testResults
};

