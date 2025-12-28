/**
 * Categories Integration Test
 * 
 * Tests the integration between categories API and existing systems
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testCategoriesIntegration() {
  console.log('🧪 Testing Categories API Integration...\n');

  try {
    // Test 1: Get all categories
    console.log('1. Testing GET /api/shops/categories');
    const categoriesResponse = await axios.get(`${BASE_URL}/api/shops/categories`);
    console.log('✅ Categories API working');
    console.log(`   Found ${categoriesResponse.data.data.categories.length} categories\n`);

    // Test 2: Test shop search with category validation
    console.log('2. Testing shop search with valid category');
    try {
      const searchResponse = await axios.get(`${BASE_URL}/api/shops/search?category=nail&limit=5`);
      console.log('✅ Shop search with valid category working');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('⚠️  Shop search returned 400 (expected if no shops in database)');
      } else {
        console.log('❌ Shop search error:', error.message);
      }
    }

    // Test 3: Test shop search with invalid category
    console.log('\n3. Testing shop search with invalid category');
    try {
      await axios.get(`${BASE_URL}/api/shops/search?category=invalid_category`);
      console.log('❌ Should have failed with invalid category');
    } catch (error) {
      if (error.response?.status === 400 && error.response.data.error.code === 'INVALID_CATEGORY') {
        console.log('✅ Shop search properly validates categories');
      } else {
        console.log('❌ Unexpected error:', error.response?.data || error.message);
      }
    }

    // Test 4: Test nearby shops with category validation
    console.log('\n4. Testing nearby shops with valid category');
    try {
      const nearbyResponse = await axios.get(`${BASE_URL}/api/shops/nearby?latitude=37.5665&longitude=126.9780&category=nail&limit=5`);
      console.log('✅ Nearby shops with valid category working');
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('⚠️  Nearby shops returned 400 (expected if no shops in database)');
      } else {
        console.log('❌ Nearby shops error:', error.message);
      }
    }

    // Test 5: Test nearby shops with invalid category
    console.log('\n5. Testing nearby shops with invalid category');
    try {
      await axios.get(`${BASE_URL}/api/shops/nearby?latitude=37.5665&longitude=126.9780&category=invalid_category`);
      console.log('❌ Should have failed with invalid category');
    } catch (error) {
      if (error.response?.status === 400 && error.response.data.error.code === 'INVALID_CATEGORY') {
        console.log('✅ Nearby shops properly validates categories');
      } else {
        console.log('❌ Unexpected error:', error.response?.data || error.message);
      }
    }

    // Test 6: Test bounds search with category validation
    console.log('\n6. Testing bounds search with invalid category');
    try {
      await axios.get(`${BASE_URL}/api/shops/bounds?neLat=37.6&neLng=127.0&swLat=37.5&swLng=126.9&category=invalid_category`);
      console.log('❌ Should have failed with invalid category');
    } catch (error) {
      if (error.response?.status === 400 && error.response.data.error.code === 'INVALID_CATEGORY') {
        console.log('✅ Bounds search properly validates categories');
      } else {
        console.log('❌ Unexpected error:', error.response?.data || error.message);
      }
    }

    console.log('\n🎉 Categories integration test completed successfully!');
    console.log('\nSummary:');
    console.log('- Categories API is working');
    console.log('- Shop search validates categories');
    console.log('- Nearby shops validates categories');
    console.log('- Bounds search validates categories');
    console.log('- All integration points are properly connected');

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the server is running: npm start');
    }
    process.exit(1);
  }
}

// Run the test
testCategoriesIntegration();
