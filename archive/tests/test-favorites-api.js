/**
 * Favorites API Test Script
 * 
 * Comprehensive testing of user favorites functionality
 * including CRUD operations, bulk operations, and statistics
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || 'your-test-token-here';
const TEST_SHOP_IDS = [
  process.env.TEST_SHOP_ID_1 || 'test-shop-id-1',
  process.env.TEST_SHOP_ID_2 || 'test-shop-id-2',
  process.env.TEST_SHOP_ID_3 || 'test-shop-id-3'
];

// Test configuration
const config = {
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${TEST_USER_TOKEN}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
};

// Test results tracking
const testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: []
};

/**
 * Utility functions
 */
function logTest(testName, status, details = '') {
  testResults.total++;
  if (status === 'PASS') {
    testResults.passed++;
    console.log(`✅ ${testName}: PASS`);
  } else {
    testResults.failed++;
    console.log(`❌ ${testName}: FAIL - ${details}`);
  }
  testResults.details.push({ testName, status, details });
}

/**
 * Test 1: Add Shop to Favorites
 */
async function testAddFavorite() {
  console.log('\n❤️ Testing Add Favorite...');
  
  try {
    const response = await axios.post(
      `${BASE_URL}/api/shops/${TEST_SHOP_IDS[0]}/favorite`,
      {},
      config
    );

    if (response.status === 200 && response.data.success) {
      const { isFavorite, favoriteId, message } = response.data.data;
      
      if (isFavorite && favoriteId) {
        logTest('Add favorite shop', 'PASS', `Favorite ID: ${favoriteId}`);
      } else {
        logTest('Add favorite shop', 'FAIL', 'Missing favorite ID or incorrect status');
      }
    } else {
      logTest('Add favorite shop', 'FAIL', `Unexpected response: ${response.status}`);
    }
  } catch (error) {
    logTest('Add favorite shop', 'FAIL', 
      error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 2: Check Favorite Status
 */
async function testCheckFavoriteStatus() {
  console.log('\n🔍 Testing Check Favorite Status...');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/api/shops/${TEST_SHOP_IDS[0]}/favorite/status`,
      config
    );

    if (response.status === 200 && response.data.success) {
      const { shopId, isFavorite } = response.data.data;
      
      if (shopId === TEST_SHOP_IDS[0] && isFavorite === true) {
        logTest('Check favorite status', 'PASS', 'Status correctly returned as favorited');
      } else {
        logTest('Check favorite status', 'FAIL', 'Incorrect favorite status returned');
      }
    } else {
      logTest('Check favorite status', 'FAIL', `Unexpected response: ${response.status}`);
    }
  } catch (error) {
    logTest('Check favorite status', 'FAIL', 
      error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 3: Get User Favorites
 */
async function testGetFavorites() {
  console.log('\n📋 Testing Get User Favorites...');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/api/user/favorites?limit=10&sortBy=recent`,
      config
    );

    if (response.status === 200 && response.data.success) {
      const { favorites, totalCount, pagination } = response.data.data;
      
      if (Array.isArray(favorites) && typeof totalCount === 'number') {
        logTest('Get user favorites', 'PASS', 
          `Retrieved ${favorites.length} favorites (total: ${totalCount})`);
        
        // Check if our test shop is in the list
        const testShopInFavorites = favorites.some(fav => fav.shopId === TEST_SHOP_IDS[0]);
        if (testShopInFavorites) {
          logTest('Test shop in favorites list', 'PASS', 'Test shop found in favorites');
        } else {
          logTest('Test shop in favorites list', 'FAIL', 'Test shop not found in favorites');
        }
      } else {
        logTest('Get user favorites', 'FAIL', 'Invalid response structure');
      }
    } else {
      logTest('Get user favorites', 'FAIL', `Unexpected response: ${response.status}`);
    }
  } catch (error) {
    logTest('Get user favorites', 'FAIL', 
      error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 4: Toggle Favorite Status
 */
async function testToggleFavorite() {
  console.log('\n🔄 Testing Toggle Favorite...');
  
  try {
    const response = await axios.put(
      `${BASE_URL}/api/shops/${TEST_SHOP_IDS[1]}/favorite`,
      {},
      config
    );

    if (response.status === 200 && response.data.success) {
      const { isFavorite, message } = response.data.data;
      
      logTest('Toggle favorite (add)', 'PASS', `Shop ${isFavorite ? 'added to' : 'removed from'} favorites`);
      
      // Toggle again to test removal
      const toggleResponse = await axios.put(
        `${BASE_URL}/api/shops/${TEST_SHOP_IDS[1]}/favorite`,
        {},
        config
      );

      if (toggleResponse.status === 200 && toggleResponse.data.success) {
        const { isFavorite: newStatus } = toggleResponse.data.data;
        
        if (newStatus !== isFavorite) {
          logTest('Toggle favorite (remove)', 'PASS', 'Successfully toggled off');
        } else {
          logTest('Toggle favorite (remove)', 'FAIL', 'Toggle did not change status');
        }
      } else {
        logTest('Toggle favorite (remove)', 'FAIL', 'Second toggle failed');
      }
    } else {
      logTest('Toggle favorite (add)', 'FAIL', `Unexpected response: ${response.status}`);
    }
  } catch (error) {
    logTest('Toggle favorite', 'FAIL', 
      error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 5: Bulk Add Favorites
 */
async function testBulkAddFavorites() {
  console.log('\n📦 Testing Bulk Add Favorites...');
  
  try {
    const response = await axios.post(
      `${BASE_URL}/api/user/favorites/bulk`,
      {
        shopIds: [TEST_SHOP_IDS[1], TEST_SHOP_IDS[2]],
        action: 'add'
      },
      config
    );

    if (response.status === 200 && response.data.success) {
      const { added, removed, failed, summary } = response.data.data;
      
      if (Array.isArray(added) && Array.isArray(removed) && Array.isArray(failed)) {
        logTest('Bulk add favorites', 'PASS', 
          `Added: ${added.length}, Failed: ${failed.length}, Summary: ${summary.successful}/${summary.total}`);
      } else {
        logTest('Bulk add favorites', 'FAIL', 'Invalid response structure');
      }
    } else {
      logTest('Bulk add favorites', 'FAIL', `Unexpected response: ${response.status}`);
    }
  } catch (error) {
    logTest('Bulk add favorites', 'FAIL', 
      error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 6: Check Multiple Favorites
 */
async function testCheckMultipleFavorites() {
  console.log('\n🔍 Testing Check Multiple Favorites...');
  
  try {
    const response = await axios.post(
      `${BASE_URL}/api/user/favorites/check`,
      {
        shopIds: TEST_SHOP_IDS
      },
      config
    );

    if (response.status === 200 && response.data.success) {
      const { favorites, summary } = response.data.data;
      
      if (typeof favorites === 'object' && summary) {
        logTest('Check multiple favorites', 'PASS', 
          `Checked ${summary.total} shops, ${summary.favorited} favorited, ${summary.notFavorited} not favorited`);
        
        // Verify the structure
        const expectedKeys = TEST_SHOP_IDS.every(id => id in favorites);
        if (expectedKeys) {
          logTest('Multiple favorites response structure', 'PASS', 'All shop IDs present in response');
        } else {
          logTest('Multiple favorites response structure', 'FAIL', 'Missing shop IDs in response');
        }
      } else {
        logTest('Check multiple favorites', 'FAIL', 'Invalid response structure');
      }
    } else {
      logTest('Check multiple favorites', 'FAIL', `Unexpected response: ${response.status}`);
    }
  } catch (error) {
    logTest('Check multiple favorites', 'FAIL', 
      error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 7: Get Favorites Statistics
 */
async function testGetFavoritesStats() {
  console.log('\n📊 Testing Get Favorites Statistics...');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/api/user/favorites/stats`,
      config
    );

    if (response.status === 200 && response.data.success) {
      const { totalFavorites, favoriteCategories, recentlyAdded } = response.data.data;
      
      if (typeof totalFavorites === 'number' && 
          Array.isArray(favoriteCategories) && 
          Array.isArray(recentlyAdded)) {
        logTest('Get favorites statistics', 'PASS', 
          `Total: ${totalFavorites}, Categories: ${favoriteCategories.length}, Recent: ${recentlyAdded.length}`);
      } else {
        logTest('Get favorites statistics', 'FAIL', 'Invalid statistics structure');
      }
    } else {
      logTest('Get favorites statistics', 'FAIL', `Unexpected response: ${response.status}`);
    }
  } catch (error) {
    logTest('Get favorites statistics', 'FAIL', 
      error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 8: Remove Favorite
 */
async function testRemoveFavorite() {
  console.log('\n❌ Testing Remove Favorite...');
  
  try {
    const response = await axios.delete(
      `${BASE_URL}/api/shops/${TEST_SHOP_IDS[0]}/favorite`,
      config
    );

    if (response.status === 200 && response.data.success) {
      const { isFavorite, message } = response.data.data;
      
      if (isFavorite === false) {
        logTest('Remove favorite', 'PASS', 'Shop successfully removed from favorites');
      } else {
        logTest('Remove favorite', 'FAIL', 'Shop still marked as favorite');
      }
    } else {
      logTest('Remove favorite', 'FAIL', `Unexpected response: ${response.status}`);
    }
  } catch (error) {
    logTest('Remove favorite', 'FAIL', 
      error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 9: Bulk Remove Favorites
 */
async function testBulkRemoveFavorites() {
  console.log('\n📦 Testing Bulk Remove Favorites...');
  
  try {
    const response = await axios.post(
      `${BASE_URL}/api/user/favorites/bulk`,
      {
        shopIds: [TEST_SHOP_IDS[1], TEST_SHOP_IDS[2]],
        action: 'remove'
      },
      config
    );

    if (response.status === 200 && response.data.success) {
      const { added, removed, failed, summary } = response.data.data;
      
      if (Array.isArray(removed)) {
        logTest('Bulk remove favorites', 'PASS', 
          `Removed: ${removed.length}, Failed: ${failed.length}, Summary: ${summary.successful}/${summary.total}`);
      } else {
        logTest('Bulk remove favorites', 'FAIL', 'Invalid response structure');
      }
    } else {
      logTest('Bulk remove favorites', 'FAIL', `Unexpected response: ${response.status}`);
    }
  } catch (error) {
    logTest('Bulk remove favorites', 'FAIL', 
      error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 10: Error Handling
 */
async function testErrorHandling() {
  console.log('\n⚠️ Testing Error Handling...');
  
  try {
    // Test with invalid shop ID
    const response = await axios.post(
      `${BASE_URL}/api/shops/invalid-uuid/favorite`,
      {},
      config
    );

    logTest('Invalid shop ID handling', 'FAIL', 'Should have returned 400 error');
  } catch (error) {
    if (error.response?.status === 400) {
      logTest('Invalid shop ID handling', 'PASS', 'Properly rejected invalid UUID');
    } else {
      logTest('Invalid shop ID handling', 'FAIL', `Unexpected error: ${error.response?.status}`);
    }
  }

  try {
    // Test with invalid bulk request
    const response = await axios.post(
      `${BASE_URL}/api/user/favorites/bulk`,
      {
        shopIds: 'invalid-array',
        action: 'add'
      },
      config
    );

    logTest('Invalid bulk request handling', 'FAIL', 'Should have returned 400 error');
  } catch (error) {
    if (error.response?.status === 400) {
      logTest('Invalid bulk request handling', 'PASS', 'Properly rejected invalid request');
    } else {
      logTest('Invalid bulk request handling', 'FAIL', `Unexpected error: ${error.response?.status}`);
    }
  }
}

/**
 * Test 11: Performance Testing
 */
async function testPerformance() {
  console.log('\n⚡ Testing Performance...');
  
  try {
    const startTime = Date.now();
    const promises = [];
    
    // Generate 20 concurrent favorite status checks
    for (let i = 0; i < 20; i++) {
      promises.push(
        axios.get(
          `${BASE_URL}/api/shops/${TEST_SHOP_IDS[0]}/favorite/status`,
          config
        ).catch(error => ({ error }))
      );
    }

    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const successful = results.filter(r => !r.error).length;
    const failed = results.filter(r => r.error).length;
    
    logTest('Favorites API performance', 'PASS', 
      `${successful} successful, ${failed} failed in ${duration}ms (avg: ${(duration/20).toFixed(2)}ms per request)`);
  } catch (error) {
    logTest('Favorites API performance', 'FAIL', error.message);
  }
}

/**
 * Test 12: Rate Limiting
 */
async function testRateLimiting() {
  console.log('\n🚦 Testing Rate Limiting...');
  
  try {
    const promises = [];
    
    // Generate 60 requests (should trigger rate limiting)
    for (let i = 0; i < 60; i++) {
      promises.push(
        axios.get(
          `${BASE_URL}/api/user/favorites/stats`,
          config
        ).catch(error => ({ error, status: error.response?.status }))
      );
    }

    const results = await Promise.all(promises);
    const rateLimited = results.filter(r => r.status === 429).length;
    
    if (rateLimited > 0) {
      logTest('Rate limiting', 'PASS', `Rate limiting triggered for ${rateLimited} requests`);
    } else {
      logTest('Rate limiting', 'FAIL', 'Rate limiting not triggered');
    }
  } catch (error) {
    logTest('Rate limiting', 'FAIL', error.message);
  }
}

/**
 * Main test execution
 */
async function runAllTests() {
  console.log('🚀 Starting Favorites API Tests...\n');
  
  try {
    await testAddFavorite();
    await testCheckFavoriteStatus();
    await testGetFavorites();
    await testToggleFavorite();
    await testBulkAddFavorites();
    await testCheckMultipleFavorites();
    await testGetFavoritesStats();
    await testRemoveFavorite();
    await testBulkRemoveFavorites();
    await testErrorHandling();
    await testPerformance();
    await testRateLimiting();
    
    // Print summary
    console.log('\n📊 Test Summary:');
    console.log(`Total Tests: ${testResults.total}`);
    console.log(`Passed: ${testResults.passed}`);
    console.log(`Failed: ${testResults.failed}`);
    console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(2)}%`);
    
    if (testResults.failed > 0) {
      console.log('\n❌ Failed Tests:');
      testResults.details
        .filter(test => test.status === 'FAIL')
        .forEach(test => console.log(`  - ${test.testName}: ${test.details}`));
    }
    
    console.log('\n✅ Favorites API Tests Complete!');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  testAddFavorite,
  testCheckFavoriteStatus,
  testGetFavorites,
  testToggleFavorite,
  testBulkAddFavorites,
  testCheckMultipleFavorites,
  testGetFavoritesStats,
  testRemoveFavorite,
  testBulkRemoveFavorites,
  testErrorHandling,
  testPerformance,
  testRateLimiting
};

