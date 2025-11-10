/**
 * Shop Search with Favorites Integration Test Script
 * 
 * Tests the enhanced shop search functionality that includes
 * favorites marking for authenticated users
 */

const axios = require('axios');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || 'your-test-token-here';
const TEST_SHOP_ID = process.env.TEST_SHOP_ID || 'test-shop-id-here';

// Test configuration
const config = {
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${TEST_USER_TOKEN}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
};

const anonymousConfig = {
  baseURL: BASE_URL,
  headers: {
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
 * Test 1: Anonymous Search (No Favorites)
 */
async function testAnonymousSearch() {
  console.log('\n🔍 Testing Anonymous Shop Search...');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/api/shops/search?limit=10`,
      anonymousConfig
    );

    if (response.status === 200 && response.data.success) {
      const { shops } = response.data.data;
      
      if (Array.isArray(shops)) {
        // Check that favorites fields are undefined for anonymous users
        const hasFavoritesInfo = shops.some(shop => 
          shop.isFavorite !== undefined || shop.favoriteId !== undefined
        );
        
        if (!hasFavoritesInfo) {
          logTest('Anonymous search favorites handling', 'PASS', 
            `Found ${shops.length} shops without favorites information`);
        } else {
          logTest('Anonymous search favorites handling', 'FAIL', 
            'Favorites information found in anonymous search results');
        }
      } else {
        logTest('Anonymous search structure', 'FAIL', 'Invalid shops array structure');
      }
    } else {
      logTest('Anonymous search response', 'FAIL', `Unexpected response: ${response.status}`);
    }
  } catch (error) {
    logTest('Anonymous search', 'FAIL', 
      error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 2: Authenticated Search with Favorites
 */
async function testAuthenticatedSearchWithFavorites() {
  console.log('\n🔍 Testing Authenticated Shop Search with Favorites...');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/api/shops/search?limit=10`,
      config
    );

    if (response.status === 200 && response.data.success) {
      const { shops } = response.data.data;
      
      if (Array.isArray(shops)) {
        // Check that all shops have favorites information
        const allShopsHaveFavoritesInfo = shops.every(shop => 
          typeof shop.isFavorite === 'boolean'
        );
        
        if (allShopsHaveFavoritesInfo) {
          const favoritedShops = shops.filter(shop => shop.isFavorite === true);
          logTest('Authenticated search favorites marking', 'PASS', 
            `Found ${shops.length} shops with favorites info, ${favoritedShops.length} favorited`);
        } else {
          logTest('Authenticated search favorites marking', 'FAIL', 
            'Some shops missing favorites information');
        }
      } else {
        logTest('Authenticated search structure', 'FAIL', 'Invalid shops array structure');
      }
    } else {
      logTest('Authenticated search response', 'FAIL', `Unexpected response: ${response.status}`);
    }
  } catch (error) {
    logTest('Authenticated search', 'FAIL', 
      error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 3: Add Favorite and Search Again
 */
async function testAddFavoriteAndSearch() {
  console.log('\n❤️ Testing Add Favorite and Search...');
  
  try {
    // First, add a shop to favorites
    const addResponse = await axios.post(
      `${BASE_URL}/api/shops/${TEST_SHOP_ID}/favorite`,
      {},
      config
    );

    if (addResponse.status === 200 && addResponse.data.success) {
      logTest('Add favorite for search test', 'PASS', 'Shop added to favorites');
      
      // Now search and check if the shop is marked as favorite
      const searchResponse = await axios.get(
        `${BASE_URL}/api/shops/search?limit=50`,
        config
      );

      if (searchResponse.status === 200 && searchResponse.data.success) {
        const { shops } = searchResponse.data.data;
        const testShop = shops.find(shop => shop.id === TEST_SHOP_ID);
        
        if (testShop && testShop.isFavorite === true) {
          logTest('Search reflects favorite status', 'PASS', 
            `Shop ${TEST_SHOP_ID} correctly marked as favorite in search results`);
        } else {
          logTest('Search reflects favorite status', 'FAIL', 
            `Shop ${TEST_SHOP_ID} not found or not marked as favorite`);
        }
      } else {
        logTest('Search after adding favorite', 'FAIL', 'Search failed after adding favorite');
      }
    } else {
      logTest('Add favorite for search test', 'FAIL', 'Failed to add favorite');
    }
  } catch (error) {
    logTest('Add favorite and search', 'FAIL', 
      error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 4: Remove Favorite and Search Again
 */
async function testRemoveFavoriteAndSearch() {
  console.log('\n❌ Testing Remove Favorite and Search...');
  
  try {
    // First, remove the shop from favorites
    const removeResponse = await axios.delete(
      `${BASE_URL}/api/shops/${TEST_SHOP_ID}/favorite`,
      config
    );

    if (removeResponse.status === 200 && removeResponse.data.success) {
      logTest('Remove favorite for search test', 'PASS', 'Shop removed from favorites');
      
      // Now search and check if the shop is not marked as favorite
      const searchResponse = await axios.get(
        `${BASE_URL}/api/shops/search?limit=50`,
        config
      );

      if (searchResponse.status === 200 && searchResponse.data.success) {
        const { shops } = searchResponse.data.data;
        const testShop = shops.find(shop => shop.id === TEST_SHOP_ID);
        
        if (testShop && testShop.isFavorite === false) {
          logTest('Search reflects removed favorite', 'PASS', 
            `Shop ${TEST_SHOP_ID} correctly marked as not favorite in search results`);
        } else {
          logTest('Search reflects removed favorite', 'FAIL', 
            `Shop ${TEST_SHOP_ID} still marked as favorite or not found`);
        }
      } else {
        logTest('Search after removing favorite', 'FAIL', 'Search failed after removing favorite');
      }
    } else {
      logTest('Remove favorite for search test', 'FAIL', 'Failed to remove favorite');
    }
  } catch (error) {
    logTest('Remove favorite and search', 'FAIL', 
      error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 5: Search with Category Filter and Favorites
 */
async function testCategorySearchWithFavorites() {
  console.log('\n🏷️ Testing Category Search with Favorites...');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/api/shops/search?category=hair&limit=10`,
      config
    );

    if (response.status === 200 && response.data.success) {
      const { shops } = response.data.data;
      
      if (Array.isArray(shops)) {
        // Check that all shops have favorites information
        const allShopsHaveFavoritesInfo = shops.every(shop => 
          typeof shop.isFavorite === 'boolean'
        );
        
        if (allShopsHaveFavoritesInfo) {
          logTest('Category search with favorites', 'PASS', 
            `Found ${shops.length} hair shops with favorites information`);
        } else {
          logTest('Category search with favorites', 'FAIL', 
            'Some shops missing favorites information');
        }
      } else {
        logTest('Category search structure', 'FAIL', 'Invalid shops array structure');
      }
    } else {
      logTest('Category search response', 'FAIL', `Unexpected response: ${response.status}`);
    }
  } catch (error) {
    logTest('Category search with favorites', 'FAIL', 
      error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 6: Location-based Search with Favorites
 */
async function testLocationSearchWithFavorites() {
  console.log('\n📍 Testing Location Search with Favorites...');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/api/shops/search?latitude=37.5665&longitude=126.9780&radius=10&limit=10`,
      config
    );

    if (response.status === 200 && response.data.success) {
      const { shops } = response.data.data;
      
      if (Array.isArray(shops)) {
        // Check that all shops have favorites information
        const allShopsHaveFavoritesInfo = shops.every(shop => 
          typeof shop.isFavorite === 'boolean'
        );
        
        if (allShopsHaveFavoritesInfo) {
          logTest('Location search with favorites', 'PASS', 
            `Found ${shops.length} nearby shops with favorites information`);
        } else {
          logTest('Location search with favorites', 'FAIL', 
            'Some shops missing favorites information');
        }
      } else {
        logTest('Location search structure', 'FAIL', 'Invalid shops array structure');
      }
    } else {
      logTest('Location search response', 'FAIL', `Unexpected response: ${response.status}`);
    }
  } catch (error) {
    logTest('Location search with favorites', 'FAIL', 
      error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 7: Text Search with Favorites
 */
async function testTextSearchWithFavorites() {
  console.log('\n🔤 Testing Text Search with Favorites...');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/api/shops/search?q=hair&limit=10`,
      config
    );

    if (response.status === 200 && response.data.success) {
      const { shops } = response.data.data;
      
      if (Array.isArray(shops)) {
        // Check that all shops have favorites information
        const allShopsHaveFavoritesInfo = shops.every(shop => 
          typeof shop.isFavorite === 'boolean'
        );
        
        if (allShopsHaveFavoritesInfo) {
          logTest('Text search with favorites', 'PASS', 
            `Found ${shops.length} shops matching "hair" with favorites information`);
        } else {
          logTest('Text search with favorites', 'FAIL', 
            'Some shops missing favorites information');
        }
      } else {
        logTest('Text search structure', 'FAIL', 'Invalid shops array structure');
      }
    } else {
      logTest('Text search response', 'FAIL', `Unexpected response: ${response.status}`);
    }
  } catch (error) {
    logTest('Text search with favorites', 'FAIL', 
      error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 8: Pagination with Favorites
 */
async function testPaginationWithFavorites() {
  console.log('\n📄 Testing Pagination with Favorites...');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/api/shops/search?limit=5&offset=0`,
      config
    );

    if (response.status === 200 && response.data.success) {
      const { shops, totalCount, hasMore } = response.data.data;
      
      if (Array.isArray(shops) && shops.length <= 5) {
        // Check that all shops have favorites information
        const allShopsHaveFavoritesInfo = shops.every(shop => 
          typeof shop.isFavorite === 'boolean'
        );
        
        if (allShopsHaveFavoritesInfo) {
          logTest('Pagination with favorites', 'PASS', 
            `Page 1: ${shops.length} shops with favorites info (total: ${totalCount})`);
          
          // Test second page if available
          if (hasMore) {
            const page2Response = await axios.get(
              `${BASE_URL}/api/shops/search?limit=5&offset=5`,
              config
            );
            
            if (page2Response.status === 200 && page2Response.data.success) {
              const { shops: page2Shops } = page2Response.data.data;
              const page2HasFavoritesInfo = page2Shops.every(shop => 
                typeof shop.isFavorite === 'boolean'
              );
              
              if (page2HasFavoritesInfo) {
                logTest('Pagination page 2 with favorites', 'PASS', 
                  `Page 2: ${page2Shops.length} shops with favorites info`);
              } else {
                logTest('Pagination page 2 with favorites', 'FAIL', 
                  'Page 2 shops missing favorites information');
              }
            }
          }
        } else {
          logTest('Pagination with favorites', 'FAIL', 
            'Some shops missing favorites information');
        }
      } else {
        logTest('Pagination structure', 'FAIL', 'Invalid pagination structure');
      }
    } else {
      logTest('Pagination response', 'FAIL', `Unexpected response: ${response.status}`);
    }
  } catch (error) {
    logTest('Pagination with favorites', 'FAIL', 
      error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 9: Cache Behavior with Favorites
 */
async function testCacheBehaviorWithFavorites() {
  console.log('\n💾 Testing Cache Behavior with Favorites...');
  
  try {
    // Make two identical requests and measure response times
    const start1 = Date.now();
    const response1 = await axios.get(
      `${BASE_URL}/api/shops/search?limit=10`,
      config
    );
    const time1 = Date.now() - start1;

    const start2 = Date.now();
    const response2 = await axios.get(
      `${BASE_URL}/api/shops/search?limit=10`,
      config
    );
    const time2 = Date.now() - start2;

    if (response1.status === 200 && response2.status === 200) {
      const { shops: shops1 } = response1.data.data;
      const { shops: shops2 } = response2.data.data;
      
      // Check that favorites information is consistent
      const favoritesConsistent = shops1.every((shop1, index) => {
        const shop2 = shops2.find(s => s.id === shop1.id);
        return shop2 && shop1.isFavorite === shop2.isFavorite;
      });
      
      if (favoritesConsistent) {
        logTest('Cache behavior with favorites', 'PASS', 
          `Consistent favorites info across cached requests (${time1}ms, ${time2}ms)`);
      } else {
        logTest('Cache behavior with favorites', 'FAIL', 
          'Inconsistent favorites information across cached requests');
      }
    } else {
      logTest('Cache behavior test', 'FAIL', 'One or both requests failed');
    }
  } catch (error) {
    logTest('Cache behavior with favorites', 'FAIL', 
      error.response?.data?.error?.message || error.message);
  }
}

/**
 * Test 10: Performance with Large Result Set
 */
async function testPerformanceWithLargeResultSet() {
  console.log('\n⚡ Testing Performance with Large Result Set...');
  
  try {
    const startTime = Date.now();
    const response = await axios.get(
      `${BASE_URL}/api/shops/search?limit=50`,
      config
    );
    const duration = Date.now() - startTime;

    if (response.status === 200 && response.data.success) {
      const { shops } = response.data.data;
      
      if (Array.isArray(shops)) {
        // Check that all shops have favorites information
        const allShopsHaveFavoritesInfo = shops.every(shop => 
          typeof shop.isFavorite === 'boolean'
        );
        
        if (allShopsHaveFavoritesInfo) {
          logTest('Performance with large result set', 'PASS', 
            `${shops.length} shops with favorites info in ${duration}ms`);
        } else {
          logTest('Performance with large result set', 'FAIL', 
            'Some shops missing favorites information');
        }
      } else {
        logTest('Large result set structure', 'FAIL', 'Invalid shops array structure');
      }
    } else {
      logTest('Large result set response', 'FAIL', `Unexpected response: ${response.status}`);
    }
  } catch (error) {
    logTest('Performance with large result set', 'FAIL', 
      error.response?.data?.error?.message || error.message);
  }
}

/**
 * Main test execution
 */
async function runAllTests() {
  console.log('🚀 Starting Shop Search with Favorites Integration Tests...\n');
  
  try {
    await testAnonymousSearch();
    await testAuthenticatedSearchWithFavorites();
    await testAddFavoriteAndSearch();
    await testRemoveFavoriteAndSearch();
    await testCategorySearchWithFavorites();
    await testLocationSearchWithFavorites();
    await testTextSearchWithFavorites();
    await testPaginationWithFavorites();
    await testCacheBehaviorWithFavorites();
    await testPerformanceWithLargeResultSet();
    
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
    
    console.log('\n✅ Shop Search with Favorites Integration Tests Complete!');
    
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
  testAnonymousSearch,
  testAuthenticatedSearchWithFavorites,
  testAddFavoriteAndSearch,
  testRemoveFavoriteAndSearch,
  testCategorySearchWithFavorites,
  testLocationSearchWithFavorites,
  testTextSearchWithFavorites,
  testPaginationWithFavorites,
  testCacheBehaviorWithFavorites,
  testPerformanceWithLargeResultSet
};

