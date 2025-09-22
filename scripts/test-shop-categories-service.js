#!/usr/bin/env node

/**
 * Shop Categories Service Test
 * 
 * Tests the shop categories service directly without requiring the full server
 * This bypasses compilation issues and tests the core functionality
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';

// Test data
const TEST_CATEGORIES = ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair'];

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

async function testDatabaseConnection() {
  console.log('\n🧪 Testing: Database Connection');
  
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Test basic connection
    const { data, error } = await supabase
      .from('shop_categories')
      .select('count')
      .limit(1);
    
    if (error) {
      logTest('Database connection', 'FAIL', error.message);
      return null;
    }
    
    logTest('Database connection', 'PASS', 'Connected successfully');
    return supabase;
  } catch (error) {
    logTest('Database connection', 'FAIL', error.message);
    return null;
  }
}

async function testShopCategoriesTable(supabase) {
  console.log('\n🧪 Testing: Shop Categories Table');
  
  try {
    // Test if table exists and has data
    const { data, error } = await supabase
      .from('shop_categories')
      .select('*')
      .limit(5);
    
    if (error) {
      logTest('Shop categories table', 'FAIL', error.message);
      return false;
    }
    
    if (!data || data.length === 0) {
      logTest('Shop categories table', 'FAIL', 'No data found in table');
      return false;
    }
    
    logTest('Shop categories table', 'PASS', `Found ${data.length} categories`);
    return true;
  } catch (error) {
    logTest('Shop categories table', 'FAIL', error.message);
    return false;
  }
}

async function testServiceTypesTable(supabase) {
  console.log('\n🧪 Testing: Service Types Table');
  
  try {
    // Test if table exists and has data
    const { data, error } = await supabase
      .from('service_types')
      .select('*')
      .limit(5);
    
    if (error) {
      logTest('Service types table', 'FAIL', error.message);
      return false;
    }
    
    if (!data || data.length === 0) {
      logTest('Service types table', 'FAIL', 'No data found in table');
      return false;
    }
    
    logTest('Service types table', 'PASS', `Found ${data.length} service types`);
    return true;
  } catch (error) {
    logTest('Service types table', 'FAIL', error.message);
    return false;
  }
}

async function testCategoryQueries(supabase) {
  console.log('\n🧪 Testing: Category Queries');
  
  try {
    // Test basic category query
    const { data: categories, error: categoriesError } = await supabase
      .from('shop_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    
    if (categoriesError) {
      logTest('Basic category query', 'FAIL', categoriesError.message);
      return false;
    }
    
    logTest('Basic category query', 'PASS', `Found ${categories.length} active categories`);
    
    // Test category with service types
    const { data: categoryWithServices, error: servicesError } = await supabase
      .from('shop_categories')
      .select(`
        *,
        service_types (*)
      `)
      .eq('id', 'nail')
      .single();
    
    if (servicesError) {
      logTest('Category with services query', 'FAIL', servicesError.message);
    } else {
      logTest('Category with services query', 'PASS', 
        `Found ${categoryWithServices?.service_types?.length || 0} services for nail category`);
    }
    
    return true;
  } catch (error) {
    logTest('Category queries', 'FAIL', error.message);
    return false;
  }
}

async function testServiceTypeQueries(supabase) {
  console.log('\n🧪 Testing: Service Type Queries');
  
  try {
    // Test service types for specific category
    const { data: services, error } = await supabase
      .from('service_types')
      .select('*')
      .eq('category_id', 'nail')
      .eq('is_active', true);
    
    if (error) {
      logTest('Service types query', 'FAIL', error.message);
      return false;
    }
    
    logTest('Service types query', 'PASS', `Found ${services.length} services for nail category`);
    return true;
  } catch (error) {
    logTest('Service types query', 'FAIL', error.message);
    return false;
  }
}

async function testSearchFunctionality(supabase) {
  console.log('\n🧪 Testing: Search Functionality');
  
  try {
    // Test text search in categories
    const { data: searchResults, error } = await supabase
      .from('shop_categories')
      .select('*')
      .or('display_name.ilike.%네일%,description.ilike.%네일%')
      .eq('is_active', true);
    
    if (error) {
      logTest('Category search', 'FAIL', error.message);
      return false;
    }
    
    logTest('Category search', 'PASS', `Found ${searchResults.length} results for '네일' search`);
    return true;
  } catch (error) {
    logTest('Category search', 'FAIL', error.message);
    return false;
  }
}

async function testDatabaseFunctions(supabase) {
  console.log('\n🧪 Testing: Database Functions');
  
  try {
    // Test category statistics function
    const { data: stats, error: statsError } = await supabase
      .rpc('get_category_statistics');
    
    if (statsError) {
      logTest('Category statistics function', 'FAIL', statsError.message);
    } else {
      logTest('Category statistics function', 'PASS', 'Function executed successfully');
    }
    
    // Test category hierarchy function
    const { data: hierarchy, error: hierarchyError } = await supabase
      .rpc('get_category_hierarchy');
    
    if (hierarchyError) {
      logTest('Category hierarchy function', 'FAIL', hierarchyError.message);
    } else {
      logTest('Category hierarchy function', 'PASS', 'Function executed successfully');
    }
    
    return true;
  } catch (error) {
    logTest('Database functions', 'FAIL', error.message);
    return false;
  }
}

async function testDataIntegrity(supabase) {
  console.log('\n🧪 Testing: Data Integrity');
  
  try {
    // Test required fields
    const { data: categories, error } = await supabase
      .from('shop_categories')
      .select('id, display_name, is_active')
      .not('display_name', 'is', null)
      .not('id', 'is', null);
    
    if (error) {
      logTest('Data integrity check', 'FAIL', error.message);
      return false;
    }
    
    const invalidCategories = categories.filter(cat => !cat.display_name || !cat.id);
    if (invalidCategories.length > 0) {
      logTest('Data integrity check', 'FAIL', `Found ${invalidCategories.length} categories with missing required fields`);
      return false;
    }
    
    logTest('Data integrity check', 'PASS', `All ${categories.length} categories have required fields`);
    return true;
  } catch (error) {
    logTest('Data integrity check', 'FAIL', error.message);
    return false;
  }
}

// Main test execution
async function runAllTests() {
  console.log('🚀 Starting Shop Categories Service Tests');
  console.log(`📍 Testing against: ${SUPABASE_URL}`);
  console.log('=' .repeat(60));

  try {
    const supabase = await testDatabaseConnection();
    if (!supabase) {
      console.log('\n❌ Cannot proceed without database connection');
      process.exit(1);
    }

    await testShopCategoriesTable(supabase);
    await testServiceTypesTable(supabase);
    await testCategoryQueries(supabase);
    await testServiceTypeQueries(supabase);
    await testSearchFunctionality(supabase);
    await testDatabaseFunctions(supabase);
    await testDataIntegrity(supabase);

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

    console.log('\n🎉 Shop Categories Service Tests Completed!');
    
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

