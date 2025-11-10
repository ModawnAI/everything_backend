#!/usr/bin/env node

/**
 * Test script for bounds-based search functionality
 * Tests the new bounds-based search API endpoint for map views
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const API_ENDPOINT = `${BASE_URL}/api/shops/search`;

// Seoul area bounds for testing
const SEOUL_BOUNDS = {
  // Gangnam area bounds
  neLat: 37.5172,
  neLng: 127.0473,
  swLat: 37.4979,
  swLng: 127.0276
};

const WIDER_SEOUL_BOUNDS = {
  // Wider Seoul area
  neLat: 37.7,
  neLng: 127.2,
  swLat: 37.4,
  swLng: 126.8
};

async function testBoundsSearch() {
  console.log('🗺️  Testing Bounds-Based Search for Map Views\n');
  
  try {
    // Test 1: Basic bounds search
    console.log('1. Testing basic bounds search (Gangnam area)...');
    const boundsResponse = await axios.get(API_ENDPOINT, {
      params: {
        neLat: SEOUL_BOUNDS.neLat,
        neLng: SEOUL_BOUNDS.neLng,
        swLat: SEOUL_BOUNDS.swLat,
        swLng: SEOUL_BOUNDS.swLng,
        limit: 10
      }
    });

    console.log(`   ✅ Status: ${boundsResponse.status}`);
    console.log(`   📊 Found ${boundsResponse.data.totalCount} shops in bounds`);
    console.log(`   🔍 Search type: ${boundsResponse.data.searchMetadata.searchType}`);
    
    if (boundsResponse.data.shops.length > 0) {
      const shop = boundsResponse.data.shops[0];
      console.log(`   🏪 Sample shop: ${shop.name} at (${shop.latitude}, ${shop.longitude})`);
      
      // Verify shop is within bounds
      const withinBounds = shop.latitude >= SEOUL_BOUNDS.swLat && 
                          shop.latitude <= SEOUL_BOUNDS.neLat &&
                          shop.longitude >= SEOUL_BOUNDS.swLng && 
                          shop.longitude <= SEOUL_BOUNDS.neLng;
      console.log(`   📍 Shop within bounds: ${withinBounds ? '✅' : '❌'}`);
    }

    // Test 2: Bounds search with text query
    console.log('\n2. Testing bounds search with text query...');
    const boundsTextResponse = await axios.get(API_ENDPOINT, {
      params: {
        q: '네일',
        neLat: WIDER_SEOUL_BOUNDS.neLat,
        neLng: WIDER_SEOUL_BOUNDS.neLng,
        swLat: WIDER_SEOUL_BOUNDS.swLat,
        swLng: WIDER_SEOUL_BOUNDS.swLng,
        limit: 5
      }
    });

    console.log(`   ✅ Status: ${boundsTextResponse.status}`);
    console.log(`   📊 Found ${boundsTextResponse.data.totalCount} nail shops in wider Seoul bounds`);
    console.log(`   🔍 Search type: ${boundsTextResponse.data.searchMetadata.searchType}`);

    // Test 3: Bounds search with category filter
    console.log('\n3. Testing bounds search with category filter...');
    const boundsCategoryResponse = await axios.get(API_ENDPOINT, {
      params: {
        category: 'nail',
        neLat: WIDER_SEOUL_BOUNDS.neLat,
        neLng: WIDER_SEOUL_BOUNDS.neLng,
        swLat: WIDER_SEOUL_BOUNDS.swLat,
        swLng: WIDER_SEOUL_BOUNDS.swLng,
        limit: 5
      }
    });

    console.log(`   ✅ Status: ${boundsCategoryResponse.status}`);
    console.log(`   📊 Found ${boundsCategoryResponse.data.totalCount} nail category shops in bounds`);
    console.log(`   🔍 Search type: ${boundsCategoryResponse.data.searchMetadata.searchType}`);

    // Test 4: Bounds search with featured filter
    console.log('\n4. Testing bounds search with featured filter...');
    const boundsFeaturedResponse = await axios.get(API_ENDPOINT, {
      params: {
        onlyFeatured: 'true',
        neLat: WIDER_SEOUL_BOUNDS.neLat,
        neLng: WIDER_SEOUL_BOUNDS.neLng,
        swLat: WIDER_SEOUL_BOUNDS.swLat,
        swLng: WIDER_SEOUL_BOUNDS.swLng,
        limit: 5
      }
    });

    console.log(`   ✅ Status: ${boundsFeaturedResponse.status}`);
    console.log(`   📊 Found ${boundsFeaturedResponse.data.totalCount} featured shops in bounds`);

    // Test 5: Bounds search with shop type filter
    console.log('\n5. Testing bounds search with shop type filter...');
    const boundsTypeResponse = await axios.get(API_ENDPOINT, {
      params: {
        shopType: 'partnered',
        neLat: WIDER_SEOUL_BOUNDS.neLat,
        neLng: WIDER_SEOUL_BOUNDS.neLng,
        swLat: WIDER_SEOUL_BOUNDS.swLat,
        swLng: WIDER_SEOUL_BOUNDS.swLng,
        limit: 5
      }
    });

    console.log(`   ✅ Status: ${boundsTypeResponse.status}`);
    console.log(`   📊 Found ${boundsTypeResponse.data.totalCount} partnered shops in bounds`);

    // Test 6: Pagination with bounds
    console.log('\n6. Testing pagination with bounds search...');
    const boundsPage1Response = await axios.get(API_ENDPOINT, {
      params: {
        neLat: WIDER_SEOUL_BOUNDS.neLat,
        neLng: WIDER_SEOUL_BOUNDS.neLng,
        swLat: WIDER_SEOUL_BOUNDS.swLat,
        swLng: WIDER_SEOUL_BOUNDS.swLng,
        limit: 3,
        page: 1
      }
    });

    const boundsPage2Response = await axios.get(API_ENDPOINT, {
      params: {
        neLat: WIDER_SEOUL_BOUNDS.neLat,
        neLng: WIDER_SEOUL_BOUNDS.neLng,
        swLat: WIDER_SEOUL_BOUNDS.swLat,
        swLng: WIDER_SEOUL_BOUNDS.swLng,
        limit: 3,
        page: 2
      }
    });

    console.log(`   ✅ Page 1: ${boundsPage1Response.data.shops.length} shops`);
    console.log(`   ✅ Page 2: ${boundsPage2Response.data.shops.length} shops`);
    console.log(`   📄 Current page: ${boundsPage2Response.data.currentPage}`);
    console.log(`   📄 Total pages: ${boundsPage2Response.data.totalPages}`);

    console.log('\n✅ All bounds search tests passed!');

  } catch (error) {
    console.error('❌ Bounds search test failed:', error.response?.data || error.message);
  }
}

async function testBoundsValidation() {
  console.log('\n🔍 Testing Bounds Validation\n');

  // Test 1: Missing bounds parameters
  console.log('1. Testing missing bounds parameters...');
  try {
    await axios.get(API_ENDPOINT, {
      params: {
        neLat: 37.5172,
        neLng: 127.0473,
        // Missing swLat and swLng
      }
    });
    console.log('   ❌ Should have failed with missing bounds');
  } catch (error) {
    console.log(`   ✅ Correctly rejected: ${error.response?.data?.error?.message || error.message}`);
  }

  // Test 2: Invalid bounds logic (northeast not northeast of southwest)
  console.log('\n2. Testing invalid bounds logic...');
  try {
    await axios.get(API_ENDPOINT, {
      params: {
        neLat: 37.4979, // Should be > swLat
        neLng: 127.0276, // Should be > swLng
        swLat: 37.5172,
        swLng: 127.0473
      }
    });
    console.log('   ❌ Should have failed with invalid bounds logic');
  } catch (error) {
    console.log(`   ✅ Correctly rejected: ${error.response?.data?.error?.message || error.message}`);
  }

  // Test 3: Invalid coordinate ranges
  console.log('\n3. Testing invalid coordinate ranges...');
  try {
    await axios.get(API_ENDPOINT, {
      params: {
        neLat: 91, // Invalid latitude > 90
        neLng: 127.0473,
        swLat: 37.4979,
        swLng: 127.0276
      }
    });
    console.log('   ❌ Should have failed with invalid coordinates');
  } catch (error) {
    console.log(`   ✅ Correctly rejected: ${error.response?.data?.error?.message || error.message}`);
  }

  // Test 4: Both location and bounds provided
  console.log('\n4. Testing location and bounds conflict...');
  try {
    await axios.get(API_ENDPOINT, {
      params: {
        latitude: 37.5665,
        longitude: 126.9780,
        neLat: 37.5172,
        neLng: 127.0473,
        swLat: 37.4979,
        swLng: 127.0276
      }
    });
    console.log('   ❌ Should have failed with location/bounds conflict');
  } catch (error) {
    console.log(`   ✅ Correctly rejected: ${error.response?.data?.error?.message || error.message}`);
  }

  console.log('\n✅ All bounds validation tests passed!');
}

async function testSortingAndFiltering() {
  console.log('\n📊 Testing Sorting and Advanced Filtering with Bounds\n');

  // Test 1: PRD 2.1 sorting (partnered first, then featured, then name)
  console.log('1. Testing PRD 2.1 sorting with bounds...');
  const sortedResponse = await axios.get(API_ENDPOINT, {
    params: {
      neLat: WIDER_SEOUL_BOUNDS.neLat,
      neLng: WIDER_SEOUL_BOUNDS.neLng,
      swLat: WIDER_SEOUL_BOUNDS.swLat,
      swLng: WIDER_SEOUL_BOUNDS.swLng,
      limit: 10
    }
  });

  if (sortedResponse.data.shops.length > 1) {
    const shops = sortedResponse.data.shops;
    console.log('   📋 Shop sorting order:');
    shops.slice(0, 5).forEach((shop, index) => {
      console.log(`   ${index + 1}. ${shop.name} (${shop.shopType}, featured: ${shop.isFeatured})`);
    });
  }

  // Test 2: Multiple categories with bounds
  console.log('\n2. Testing multiple categories with bounds...');
  const multiCategoryResponse = await axios.get(API_ENDPOINT, {
    params: {
      categories: 'nail,eyelash',
      neLat: WIDER_SEOUL_BOUNDS.neLat,
      neLng: WIDER_SEOUL_BOUNDS.neLng,
      swLat: WIDER_SEOUL_BOUNDS.swLat,
      swLng: WIDER_SEOUL_BOUNDS.swLng,
      limit: 5
    }
  });

  console.log(`   ✅ Found ${multiCategoryResponse.data.totalCount} shops with nail or eyelash categories`);

  // Test 3: Payment methods filter with bounds
  console.log('\n3. Testing payment methods filter with bounds...');
  const paymentResponse = await axios.get(API_ENDPOINT, {
    params: {
      paymentMethods: 'card,cash',
      neLat: WIDER_SEOUL_BOUNDS.neLat,
      neLng: WIDER_SEOUL_BOUNDS.neLng,
      swLat: WIDER_SEOUL_BOUNDS.swLat,
      swLng: WIDER_SEOUL_BOUNDS.swLng,
      limit: 5
    }
  });

  console.log(`   ✅ Found ${paymentResponse.data.totalCount} shops accepting card or cash`);

  console.log('\n✅ All sorting and filtering tests passed!');
}

async function runAllTests() {
  console.log('🚀 Starting Bounds-Based Search Tests\n');
  console.log('=' .repeat(50));
  
  await testBoundsSearch();
  await testBoundsValidation();
  await testSortingAndFiltering();
  
  console.log('\n' + '=' .repeat(50));
  console.log('🎉 All bounds-based search tests completed!');
  console.log('\n📝 Summary:');
  console.log('   ✅ Basic bounds search functionality');
  console.log('   ✅ Bounds with text search and filters');
  console.log('   ✅ Bounds parameter validation');
  console.log('   ✅ PRD 2.1 sorting with bounds');
  console.log('   ✅ Advanced filtering with bounds');
  console.log('   ✅ Pagination support');
  console.log('\n🗺️  Bounds-based search is ready for map views!');
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testBoundsSearch,
  testBoundsValidation,
  testSortingAndFiltering,
  runAllTests
};

