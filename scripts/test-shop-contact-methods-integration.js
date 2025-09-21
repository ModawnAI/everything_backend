#!/usr/bin/env node

/**
 * Test script for Shop Contact Methods Integration
 * Tests the integration of contact methods into existing shop endpoints
 */

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN;

console.log('🚀 Starting Shop Contact Methods Integration Tests...\n');

async function makeRequest(method, endpoint, data = null, token = null) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    const result = await response.json();
    
    return {
      status: response.status,
      data: result,
      success: response.ok
    };
  } catch (error) {
    console.error(`❌ Request failed: ${error.message}`);
    return {
      status: 500,
      data: { error: error.message },
      success: false
    };
  }
}

async function testGetShopById() {
  console.log('📋 Testing GET /api/shops/:id with contact methods...');
  
  // First, let's try to get a shop by ID (we'll need a valid shop ID)
  const response = await makeRequest('GET', '/api/shops/nearby?latitude=37.5665&longitude=126.9780&radius=1');
  
  if (!response.success) {
    console.log('❌ Failed to get nearby shops to find a shop ID');
    return false;
  }

  const shops = response.data.data?.shops || [];
  if (shops.length === 0) {
    console.log('⚠️  No shops found nearby, skipping getShopById test');
    return true;
  }

  const firstShop = shops[0];
  console.log(`📍 Testing with shop: ${firstShop.name} (${firstShop.id})`);

  // Test getShopById endpoint
  const shopResponse = await makeRequest('GET', `/api/shops/${firstShop.id}`);
  
  if (shopResponse.success) {
    const shop = shopResponse.data.data;
    console.log(`✅ Shop retrieved successfully`);
    console.log(`   - Shop ID: ${shop.id}`);
    console.log(`   - Shop Name: ${shop.name}`);
    console.log(`   - Contact Methods: ${shop.contact_methods ? shop.contact_methods.length : 0} methods`);
    
    if (shop.contact_methods && shop.contact_methods.length > 0) {
      console.log(`   - Contact Methods Details:`);
      shop.contact_methods.forEach((method, index) => {
        console.log(`     ${index + 1}. ${method.method_type}: ${method.value}`);
      });
    }
    return true;
  } else {
    console.log(`❌ Failed to get shop by ID: ${shopResponse.data.error?.message || 'Unknown error'}`);
    return false;
  }
}

async function testGetNearbyShops() {
  console.log('\n📋 Testing GET /api/shops/nearby with contact methods...');
  
  const response = await makeRequest('GET', '/api/shops/nearby?latitude=37.5665&longitude=126.9780&radius=5');
  
  if (response.success) {
    const shops = response.data.data?.shops || [];
    console.log(`✅ Nearby shops retrieved successfully`);
    console.log(`   - Total shops: ${shops.length}`);
    
    // Check if contact methods are included
    const shopsWithContactMethods = shops.filter(shop => shop.contact_methods && shop.contact_methods.length > 0);
    console.log(`   - Shops with contact methods: ${shopsWithContactMethods.length}`);
    
    if (shopsWithContactMethods.length > 0) {
      console.log(`   - Sample contact methods:`);
      const sampleShop = shopsWithContactMethods[0];
      sampleShop.contact_methods.forEach((method, index) => {
        console.log(`     ${index + 1}. ${method.method_type}: ${method.value}`);
      });
    }
    return true;
  } else {
    console.log(`❌ Failed to get nearby shops: ${response.data.error?.message || 'Unknown error'}`);
    return false;
  }
}

async function testGetAllShops() {
  console.log('\n📋 Testing GET /api/shops with contact methods...');
  
  const response = await makeRequest('GET', '/api/shops?limit=5');
  
  if (response.success) {
    const shops = response.data.data?.shops || [];
    console.log(`✅ All shops retrieved successfully`);
    console.log(`   - Total shops: ${shops.length}`);
    
    // Check if contact methods are included
    const shopsWithContactMethods = shops.filter(shop => shop.contact_methods && shop.contact_methods.length > 0);
    console.log(`   - Shops with contact methods: ${shopsWithContactMethods.length}`);
    
    if (shopsWithContactMethods.length > 0) {
      console.log(`   - Sample contact methods:`);
      const sampleShop = shopsWithContactMethods[0];
      sampleShop.contact_methods.forEach((method, index) => {
        console.log(`     ${index + 1}. ${method.method_type}: ${method.value}`);
      });
    }
    return true;
  } else {
    console.log(`❌ Failed to get all shops: ${response.data.error?.message || 'Unknown error'}`);
    return false;
  }
}

async function testGetShopsInBounds() {
  console.log('\n📋 Testing GET /api/shops/bounds with contact methods...');
  
  // Seoul bounds
  const response = await makeRequest('GET', '/api/shops/bounds?neLat=37.7&neLng=127.1&swLat=37.4&swLng=126.8');
  
  if (response.success) {
    const shops = response.data.data?.shops || [];
    console.log(`✅ Shops in bounds retrieved successfully`);
    console.log(`   - Total shops: ${shops.length}`);
    
    // Check if contact methods are included
    const shopsWithContactMethods = shops.filter(shop => shop.contact_methods && shop.contact_methods.length > 0);
    console.log(`   - Shops with contact methods: ${shopsWithContactMethods.length}`);
    
    if (shopsWithContactMethods.length > 0) {
      console.log(`   - Sample contact methods:`);
      const sampleShop = shopsWithContactMethods[0];
      sampleShop.contact_methods.forEach((method, index) => {
        console.log(`     ${index + 1}. ${method.method_type}: ${method.value}`);
      });
    }
    return true;
  } else {
    console.log(`❌ Failed to get shops in bounds: ${response.data.error?.message || 'Unknown error'}`);
    return false;
  }
}

async function testCreateShopWithContactMethods() {
  console.log('\n📋 Testing POST /api/shops with contact methods...');
  
  if (!TEST_USER_TOKEN) {
    console.log('⚠️  TEST_USER_TOKEN not provided, skipping authenticated test');
    return true;
  }

  const shopData = {
    name: 'Test Shop with Contact Methods',
    address: '123 Test Street, Seoul',
    detailed_address: 'Test Building, 1st Floor',
    latitude: 37.5665,
    longitude: 126.9780,
    main_category: 'beauty',
    description: 'Test shop for contact methods integration',
    contact_methods: [
      {
        method_type: 'phone',
        value: '+82-10-1234-5678',
        description: 'Main phone number',
        is_primary: true,
        display_order: 1,
        is_active: true
      },
      {
        method_type: 'email',
        value: 'test@example.com',
        description: 'Contact email',
        is_primary: true,
        display_order: 2,
        is_active: true
      },
      {
        method_type: 'kakao_channel',
        value: 'https://pf.kakao.com/_testchannel',
        description: 'Kakao Channel',
        is_primary: false,
        display_order: 3,
        is_active: true
      }
    ]
  };

  const response = await makeRequest('POST', '/api/shops', shopData, TEST_USER_TOKEN);
  
  if (response.success) {
    const shop = response.data.data;
    console.log(`✅ Shop created successfully with contact methods`);
    console.log(`   - Shop ID: ${shop.id}`);
    console.log(`   - Shop Name: ${shop.name}`);
    console.log(`   - Contact Methods: ${shop.contact_methods ? shop.contact_methods.length : 0} methods`);
    
    if (shop.contact_methods && shop.contact_methods.length > 0) {
      console.log(`   - Contact Methods Details:`);
      shop.contact_methods.forEach((method, index) => {
        console.log(`     ${index + 1}. ${method.method_type}: ${method.value} (Primary: ${method.is_primary})`);
      });
    }
    return true;
  } else {
    console.log(`❌ Failed to create shop with contact methods: ${response.data.error?.message || 'Unknown error'}`);
    return false;
  }
}

async function runTests() {
  const tests = [
    { name: 'Get Shop By ID', fn: testGetShopById },
    { name: 'Get Nearby Shops', fn: testGetNearbyShops },
    { name: 'Get All Shops', fn: testGetAllShops },
    { name: 'Get Shops In Bounds', fn: testGetShopsInBounds },
    { name: 'Create Shop With Contact Methods', fn: testCreateShopWithContactMethods }
  ];

  let passed = 0;
  let total = tests.length;

  for (const test of tests) {
    try {
      const result = await test.fn();
      if (result) {
        passed++;
      }
    } catch (error) {
      console.log(`❌ Test "${test.name}" failed with error: ${error.message}`);
    }
  }

  console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Shop contact methods integration is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check the implementation.');
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error.message);
  process.exit(1);
});
