#!/usr/bin/env node

/**
 * Shop Categories Unit Test
 * 
 * Tests the shop categories functionality without requiring database connection
 * Focuses on TypeScript compilation and basic service logic
 */

const fs = require('fs');
const path = require('path');

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

function testFileExists(filePath, description) {
  try {
    if (fs.existsSync(filePath)) {
      logTest(description, 'PASS', `File exists: ${filePath}`);
      return true;
    } else {
      logTest(description, 'FAIL', `File not found: ${filePath}`);
      return false;
    }
  } catch (error) {
    logTest(description, 'FAIL', error.message);
    return false;
  }
}

function testFileContent(filePath, description, checks) {
  try {
    if (!fs.existsSync(filePath)) {
      logTest(description, 'FAIL', `File not found: ${filePath}`);
      return false;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let allPassed = true;

    for (const check of checks) {
      if (check.type === 'contains') {
        if (!content.includes(check.value)) {
          logTest(`${description} - ${check.name}`, 'FAIL', `Expected to contain: ${check.value}`);
          allPassed = false;
        } else {
          logTest(`${description} - ${check.name}`, 'PASS', `Contains: ${check.value}`);
        }
      } else if (check.type === 'notContains') {
        if (content.includes(check.value)) {
          logTest(`${description} - ${check.name}`, 'FAIL', `Should not contain: ${check.value}`);
          allPassed = false;
        } else {
          logTest(`${description} - ${check.name}`, 'PASS', `Does not contain: ${check.value}`);
        }
      }
    }

    return allPassed;
  } catch (error) {
    logTest(description, 'FAIL', error.message);
    return false;
  }
}

function testTypeScriptCompilation() {
  console.log('\n🧪 Testing: TypeScript Compilation');
  
  try {
    const { execSync } = require('child_process');
    
    // Try to compile just the shop categories files
    const filesToCompile = [
      'src/services/shop-categories.service.ts',
      'src/controllers/shop-categories.controller.ts',
      'src/routes/shop-categories.routes.ts'
    ];
    
    for (const file of filesToCompile) {
      try {
        execSync(`npx tsc --noEmit --skipLibCheck ${file}`, { stdio: 'pipe' });
        logTest(`TypeScript compilation - ${file}`, 'PASS', 'Compiles successfully');
      } catch (error) {
        logTest(`TypeScript compilation - ${file}`, 'FAIL', error.message);
      }
    }
    
    return true;
  } catch (error) {
    logTest('TypeScript compilation', 'FAIL', error.message);
    return false;
  }
}

function testFileStructure() {
  console.log('\n🧪 Testing: File Structure');
  
  const requiredFiles = [
    'src/services/shop-categories.service.ts',
    'src/controllers/shop-categories.controller.ts',
    'src/routes/shop-categories.routes.ts',
    'src/migrations/039_create_shop_categories_tables.sql',
    'src/config/openapi.config.ts',
    'scripts/test-shop-categories-integration.js',
    'scripts/test-shop-categories-service.js'
  ];
  
  let allFilesExist = true;
  for (const file of requiredFiles) {
    if (!testFileExists(file, `File exists - ${file}`)) {
      allFilesExist = false;
    }
  }
  
  return allFilesExist;
}

function testServiceImplementation() {
  console.log('\n🧪 Testing: Service Implementation');
  
  const serviceFile = 'src/services/shop-categories.service.ts';
  const checks = [
    { type: 'contains', name: 'ShopCategoriesService class', value: 'class ShopCategoriesService' },
    { type: 'contains', name: 'getAllCategories method', value: 'async getAllCategories' },
    { type: 'contains', name: 'getCategoryById method', value: 'async getCategoryById' },
    { type: 'contains', name: 'getServiceTypesForCategory method', value: 'async getServiceTypesForCategory' },
    { type: 'contains', name: 'searchCategories method', value: 'async searchCategories' },
    { type: 'contains', name: 'getPopularServices method', value: 'async getPopularServices' },
    { type: 'contains', name: 'getCategoryStats method', value: 'async getCategoryStats' },
    { type: 'contains', name: 'getCategoryHierarchy method', value: 'async getCategoryHierarchy' },
    { type: 'contains', name: 'Supabase client', value: 'this.supabase' },
    { type: 'contains', name: 'Error handling', value: 'logger.error' }
  ];
  
  return testFileContent(serviceFile, 'Service implementation', checks);
}

function testControllerImplementation() {
  console.log('\n🧪 Testing: Controller Implementation');
  
  const controllerFile = 'src/controllers/shop-categories.controller.ts';
  const checks = [
    { type: 'contains', name: 'ShopCategoriesController class', value: 'class ShopCategoriesController' },
    { type: 'contains', name: 'getCategories method', value: 'async getCategories' },
    { type: 'contains', name: 'getCategoryById method', value: 'async getCategoryById' },
    { type: 'contains', name: 'getServiceTypes method', value: 'async getServiceTypes' },
    { type: 'contains', name: 'searchCategories method', value: 'async searchCategories' },
    { type: 'contains', name: 'getPopularServices method', value: 'async getPopularServices' },
    { type: 'contains', name: 'getCategoryStats method', value: 'async getCategoryStats' },
    { type: 'contains', name: 'getCategoryHierarchy method', value: 'async getCategoryHierarchy' },
    { type: 'contains', name: 'Service usage', value: 'shopCategoriesService' },
    { type: 'contains', name: 'Error handling', value: 'logger.error' },
    { type: 'contains', name: 'Response formatting', value: 'res.status' }
  ];
  
  return testFileContent(controllerFile, 'Controller implementation', checks);
}

function testRoutesImplementation() {
  console.log('\n🧪 Testing: Routes Implementation');
  
  const routesFile = 'src/routes/shop-categories.routes.ts';
  const checks = [
    { type: 'contains', name: 'Router import', value: "import { Router } from 'express'" },
    { type: 'contains', name: 'Controller import', value: 'shopCategoriesController' },
    { type: 'contains', name: 'Rate limit import', value: 'rateLimit' },
    { type: 'contains', name: 'Validation import', value: 'validateRequest' },
    { type: 'contains', name: 'Joi import', value: "import Joi from 'joi'" },
    { type: 'contains', name: 'GET /categories route', value: "router.get(\n  '/'," },
    { type: 'contains', name: 'GET /categories/:id route', value: "router.get(\n  '/:categoryId'," },
    { type: 'contains', name: 'GET /categories/:id/services route', value: "router.get(\n  '/:categoryId/services'," },
    { type: 'contains', name: 'GET /categories/search route', value: "router.get(\n  '/search'," },
    { type: 'contains', name: 'GET /categories/popular/services route', value: "router.get(\n  '/popular/services'," },
    { type: 'contains', name: 'GET /categories/stats route', value: "router.get(\n  '/stats'," },
    { type: 'contains', name: 'GET /categories/hierarchy route', value: "router.get(\n  '/hierarchy'," },
    { type: 'contains', name: 'Rate limiting', value: 'rateLimit(' },
    { type: 'contains', name: 'Validation schemas', value: 'Joi.object' },
    { type: 'contains', name: 'Router export', value: 'export default router' }
  ];
  
  return testFileContent(routesFile, 'Routes implementation', checks);
}

function testMigrationFile() {
  console.log('\n🧪 Testing: Migration File');
  
  const migrationFile = 'src/migrations/039_create_shop_categories_tables.sql';
  const checks = [
    { type: 'contains', name: 'Shop categories table', value: 'CREATE TABLE IF NOT EXISTS public.shop_categories' },
    { type: 'contains', name: 'Service types table', value: 'CREATE TABLE IF NOT EXISTS public.service_types' },
    { type: 'contains', name: 'Category metadata table', value: 'CREATE TABLE IF NOT EXISTS public.category_metadata' },
    { type: 'contains', name: 'Service type metadata table', value: 'CREATE TABLE IF NOT EXISTS public.service_type_metadata' },
    { type: 'contains', name: 'Category hierarchy table', value: 'CREATE TABLE IF NOT EXISTS public.category_hierarchy' },
    { type: 'contains', name: 'RLS policies', value: 'ALTER TABLE public.shop_categories ENABLE ROW LEVEL SECURITY' },
    { type: 'contains', name: 'Default data', value: 'INSERT INTO public.shop_categories' },
    { type: 'contains', name: 'Database functions', value: 'CREATE OR REPLACE FUNCTION' },
    { type: 'contains', name: 'Statistics function', value: 'get_category_statistics' },
    { type: 'contains', name: 'Hierarchy function', value: 'get_category_hierarchy' }
  ];
  
  return testFileContent(migrationFile, 'Migration file', checks);
}

function testOpenAPISchemas() {
  console.log('\n🧪 Testing: OpenAPI Schemas');
  
  const openApiFile = 'src/config/openapi.config.ts';
  const checks = [
    { type: 'contains', name: 'CategoryMetadata schema', value: 'CategoryMetadata:' },
    { type: 'contains', name: 'ServiceTypeInfo schema', value: 'ServiceTypeInfo:' },
    { type: 'contains', name: 'CategoriesResponse schema', value: 'CategoriesResponse:' },
    { type: 'contains', name: 'CategoryDetailsResponse schema', value: 'CategoryDetailsResponse:' },
    { type: 'contains', name: 'ServiceTypesResponse schema', value: 'ServiceTypesResponse:' },
    { type: 'contains', name: 'CategorySearchResponse schema', value: 'CategorySearchResponse:' },
    { type: 'contains', name: 'PopularServicesResponse schema', value: 'PopularServicesResponse:' }
  ];
  
  return testFileContent(openApiFile, 'OpenAPI schemas', checks);
}

function testAppIntegration() {
  console.log('\n🧪 Testing: App Integration');
  
  const appFile = 'src/app.ts';
  const checks = [
    { type: 'contains', name: 'Shop categories import', value: "import shopCategoriesRoutes from './routes/shop-categories.routes'" },
    { type: 'contains', name: 'Shop categories route registration', value: "app.use('/api/shops/categories', shopCategoriesRoutes)" }
  ];
  
  return testFileContent(appFile, 'App integration', checks);
}

function testTestScripts() {
  console.log('\n🧪 Testing: Test Scripts');
  
  const integrationTestFile = 'scripts/test-shop-categories-integration.js';
  const serviceTestFile = 'scripts/test-shop-categories-service.js';
  
  const integrationChecks = [
    { type: 'contains', name: 'Integration test structure', value: 'Starting Shop Categories Integration Tests' },
    { type: 'contains', name: 'API endpoints testing', value: 'API_ENDPOINTS' },
    { type: 'contains', name: 'Test functions', value: 'testGetAllCategories' },
    { type: 'contains', name: 'Error handling', value: 'Error handling' }
  ];
  
  const serviceChecks = [
    { type: 'contains', name: 'Service test structure', value: 'Starting Shop Categories Service Tests' },
    { type: 'contains', name: 'Database testing', value: 'testDatabaseConnection' },
    { type: 'contains', name: 'Table testing', value: 'testShopCategoriesTable' }
  ];
  
  const integrationPassed = testFileContent(integrationTestFile, 'Integration test script', integrationChecks);
  const servicePassed = testFileContent(serviceTestFile, 'Service test script', serviceChecks);
  
  return integrationPassed && servicePassed;
}

// Main test execution
async function runAllTests() {
  console.log('🚀 Starting Shop Categories Unit Tests');
  console.log('📍 Testing file structure and implementation');
  console.log('=' .repeat(60));

  try {
    await testFileStructure();
    await testServiceImplementation();
    await testControllerImplementation();
    await testRoutesImplementation();
    await testMigrationFile();
    await testOpenAPISchemas();
    await testAppIntegration();
    await testTestScripts();
    await testTypeScriptCompilation();

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

    console.log('\n🎉 Shop Categories Unit Tests Completed!');
    
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
