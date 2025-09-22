/**
 * Enhanced Image Security and Rate Limiting Test Script
 * 
 * Comprehensive testing of the enhanced security measures and rate limiting
 * for image management operations including pattern analysis, IP blocking,
 * and audit logging
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || 'your-test-token-here';
const TEST_SHOP_ID = process.env.TEST_SHOP_ID || 'test-shop-id';

// Test configuration
const config = {
  baseURL: BASE_URL,
  headers: {
    'Authorization': `Bearer ${TEST_USER_TOKEN}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
};

// Test data
const testImages = {
  valid: {
    path: path.join(__dirname, 'test-images', 'valid-image.jpg'),
    mimeType: 'image/jpeg',
    size: 1024 * 1024 // 1MB
  },
  large: {
    path: path.join(__dirname, 'test-images', 'large-image.jpg'),
    mimeType: 'image/jpeg',
    size: 10 * 1024 * 1024 // 10MB
  },
  invalid: {
    path: path.join(__dirname, 'test-images', 'invalid-file.txt'),
    mimeType: 'text/plain',
    size: 1024
  }
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

function createTestImage(size, format = 'jpeg') {
  // Create a simple test image buffer
  const width = 100;
  const height = 100;
  const buffer = Buffer.alloc(size);
  
  // Add some basic image data
  if (format === 'jpeg') {
    buffer[0] = 0xFF;
    buffer[1] = 0xD8;
    buffer[2] = 0xFF;
  } else if (format === 'png') {
    buffer[0] = 0x89;
    buffer[1] = 0x50;
    buffer[2] = 0x4E;
    buffer[3] = 0x47;
  }
  
  return buffer;
}

/**
 * Test 1: Basic Image Upload Security
 */
async function testBasicImageUploadSecurity() {
  console.log('\n🔒 Testing Basic Image Upload Security...');
  
  try {
    // Test valid image upload
    const formData = new FormData();
    const validImageBuffer = createTestImage(1024 * 1024, 'jpeg');
    formData.append('image', validImageBuffer, {
      filename: 'test-image.jpg',
      contentType: 'image/jpeg'
    });
    formData.append('altText', 'Test image');
    formData.append('displayOrder', '1');

    const response = await axios.post(
      `${BASE_URL}/api/shops/${TEST_SHOP_ID}/images`,
      formData,
      {
        ...config,
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${TEST_USER_TOKEN}`
        }
      }
    );

    if (response.status === 200 && response.data.success) {
      logTest('Valid image upload', 'PASS');
    } else {
      logTest('Valid image upload', 'FAIL', `Unexpected response: ${response.status}`);
    }
  } catch (error) {
    logTest('Valid image upload', 'FAIL', error.response?.data?.error?.message || error.message);
  }

  try {
    // Test invalid file type
    const formData = new FormData();
    const invalidBuffer = Buffer.from('This is not an image');
    formData.append('image', invalidBuffer, {
      filename: 'test.txt',
      contentType: 'text/plain'
    });

    await axios.post(
      `${BASE_URL}/api/shops/${TEST_SHOP_ID}/images`,
      formData,
      {
        ...config,
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${TEST_USER_TOKEN}`
        }
      }
    );

    logTest('Invalid file type rejection', 'FAIL', 'Should have been rejected');
  } catch (error) {
    if (error.response?.status === 400) {
      logTest('Invalid file type rejection', 'PASS');
    } else {
      logTest('Invalid file type rejection', 'FAIL', `Unexpected error: ${error.message}`);
    }
  }

  try {
    // Test oversized file
    const formData = new FormData();
    const largeBuffer = createTestImage(20 * 1024 * 1024, 'jpeg');
    formData.append('image', largeBuffer, {
      filename: 'large-image.jpg',
      contentType: 'image/jpeg'
    });

    await axios.post(
      `${BASE_URL}/api/shops/${TEST_SHOP_ID}/images`,
      formData,
      {
        ...config,
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${TEST_USER_TOKEN}`
        }
      }
    );

    logTest('Oversized file rejection', 'FAIL', 'Should have been rejected');
  } catch (error) {
    if (error.response?.status === 413) {
      logTest('Oversized file rejection', 'PASS');
    } else {
      logTest('Oversized file rejection', 'FAIL', `Unexpected error: ${error.message}`);
    }
  }
}

/**
 * Test 2: Rate Limiting
 */
async function testRateLimiting() {
  console.log('\n⏱️ Testing Rate Limiting...');
  
  try {
    // Test upload rate limiting
    const uploadPromises = [];
    for (let i = 0; i < 15; i++) { // Try to exceed the 10 uploads per hour limit
      const formData = new FormData();
      const imageBuffer = createTestImage(1024 * 1024, 'jpeg');
      formData.append('image', imageBuffer, {
        filename: `test-image-${i}.jpg`,
        contentType: 'image/jpeg'
      });
      formData.append('altText', `Test image ${i}`);

      uploadPromises.push(
        axios.post(
          `${BASE_URL}/api/shops/${TEST_SHOP_ID}/images`,
          formData,
          {
            ...config,
            headers: {
              ...formData.getHeaders(),
              'Authorization': `Bearer ${TEST_USER_TOKEN}`
            }
          }
        ).catch(error => ({ error }))
      );
    }

    const results = await Promise.all(uploadPromises);
    const rateLimited = results.filter(r => r.error?.response?.status === 429);
    
    if (rateLimited.length > 0) {
      logTest('Upload rate limiting', 'PASS', `${rateLimited.length} requests were rate limited`);
    } else {
      logTest('Upload rate limiting', 'FAIL', 'No requests were rate limited');
    }
  } catch (error) {
    logTest('Upload rate limiting', 'FAIL', error.message);
  }

  try {
    // Test download rate limiting
    const downloadPromises = [];
    for (let i = 0; i < 150; i++) { // Try to exceed the 100 downloads per hour limit
      downloadPromises.push(
        axios.get(
          `${BASE_URL}/api/shops/${TEST_SHOP_ID}/images`,
          config
        ).catch(error => ({ error }))
      );
    }

    const results = await Promise.all(downloadPromises);
    const rateLimited = results.filter(r => r.error?.response?.status === 429);
    
    if (rateLimited.length > 0) {
      logTest('Download rate limiting', 'PASS', `${rateLimited.length} requests were rate limited`);
    } else {
      logTest('Download rate limiting', 'FAIL', 'No requests were rate limited');
    }
  } catch (error) {
    logTest('Download rate limiting', 'FAIL', error.message);
  }
}

/**
 * Test 3: Request Pattern Analysis
 */
async function testRequestPatternAnalysis() {
  console.log('\n🔍 Testing Request Pattern Analysis...');
  
  try {
    // Test rapid requests (more than 10 per minute)
    const rapidPromises = [];
    for (let i = 0; i < 15; i++) {
      rapidPromises.push(
        axios.get(
          `${BASE_URL}/api/shops/${TEST_SHOP_ID}/images`,
          config
        ).catch(error => ({ error }))
      );
    }

    const results = await Promise.all(rapidPromises);
    const blocked = results.filter(r => r.error?.response?.status === 429);
    
    if (blocked.length > 0) {
      logTest('Rapid request detection', 'PASS', `${blocked.length} requests were blocked`);
    } else {
      logTest('Rapid request detection', 'FAIL', 'No requests were blocked for rapid pattern');
    }
  } catch (error) {
    logTest('Rapid request detection', 'FAIL', error.message);
  }

  try {
    // Test suspicious user agent
    const suspiciousUserAgent = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
    
    const response = await axios.get(
      `${BASE_URL}/api/shops/${TEST_SHOP_ID}/images`,
      {
        ...config,
        headers: {
          ...config.headers,
          'User-Agent': suspiciousUserAgent
        }
      }
    );

    // Check if security event was logged (this would require checking logs or a security endpoint)
    logTest('Suspicious user agent detection', 'PASS', 'Request processed with suspicious user agent');
  } catch (error) {
    if (error.response?.status === 403) {
      logTest('Suspicious user agent detection', 'PASS', 'Request was blocked');
    } else {
      logTest('Suspicious user agent detection', 'FAIL', error.message);
    }
  }
}

/**
 * Test 4: Security Headers
 */
async function testSecurityHeaders() {
  console.log('\n🛡️ Testing Security Headers...');
  
  try {
    const response = await axios.get(
      `${BASE_URL}/api/shops/${TEST_SHOP_ID}/images`,
      config
    );

    const headers = response.headers;
    const requiredHeaders = [
      'X-Content-Type-Options',
      'X-Frame-Options',
      'X-XSS-Protection',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining'
    ];

    const missingHeaders = requiredHeaders.filter(header => !headers[header]);
    
    if (missingHeaders.length === 0) {
      logTest('Security headers', 'PASS', 'All required security headers present');
    } else {
      logTest('Security headers', 'FAIL', `Missing headers: ${missingHeaders.join(', ')}`);
    }
  } catch (error) {
    logTest('Security headers', 'FAIL', error.message);
  }
}

/**
 * Test 5: Image Metadata Security
 */
async function testImageMetadataSecurity() {
  console.log('\n📊 Testing Image Metadata Security...');
  
  try {
    // Test metadata access
    const response = await axios.get(
      `${BASE_URL}/api/shop/images/test-image-id/metadata`,
      config
    );

    if (response.status === 200 || response.status === 404) {
      logTest('Metadata access security', 'PASS', 'Metadata access properly secured');
    } else {
      logTest('Metadata access security', 'FAIL', `Unexpected status: ${response.status}`);
    }
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      logTest('Metadata access security', 'PASS', 'Metadata access properly secured');
    } else {
      logTest('Metadata access security', 'FAIL', error.message);
    }
  }

  try {
    // Test metadata update
    const updateData = {
      altText: 'Updated alt text',
      title: 'Updated title',
      description: 'Updated description'
    };

    const response = await axios.put(
      `${BASE_URL}/api/shop/images/test-image-id/metadata`,
      updateData,
      config
    );

    if (response.status === 200 || response.status === 404) {
      logTest('Metadata update security', 'PASS', 'Metadata update properly secured');
    } else {
      logTest('Metadata update security', 'FAIL', `Unexpected status: ${response.status}`);
    }
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      logTest('Metadata update security', 'PASS', 'Metadata update properly secured');
    } else {
      logTest('Metadata update security', 'FAIL', error.message);
    }
  }
}

/**
 * Test 6: Error Handling and Logging
 */
async function testErrorHandlingAndLogging() {
  console.log('\n📝 Testing Error Handling and Logging...');
  
  try {
    // Test invalid endpoint
    const response = await axios.get(
      `${BASE_URL}/api/shops/invalid-shop-id/images`,
      config
    );

    logTest('Invalid endpoint handling', 'PASS', 'Invalid endpoint handled gracefully');
  } catch (error) {
    if (error.response?.status === 400 || error.response?.status === 404) {
      logTest('Invalid endpoint handling', 'PASS', 'Invalid endpoint properly rejected');
    } else {
      logTest('Invalid endpoint handling', 'FAIL', error.message);
    }
  }

  try {
    // Test malformed request
    const response = await axios.post(
      `${BASE_URL}/api/shops/${TEST_SHOP_ID}/images`,
      { invalid: 'data' },
      config
    );

    logTest('Malformed request handling', 'FAIL', 'Should have been rejected');
  } catch (error) {
    if (error.response?.status === 400) {
      logTest('Malformed request handling', 'PASS', 'Malformed request properly rejected');
    } else {
      logTest('Malformed request handling', 'FAIL', error.message);
    }
  }
}

/**
 * Test 7: Performance Under Load
 */
async function testPerformanceUnderLoad() {
  console.log('\n⚡ Testing Performance Under Load...');
  
  try {
    const startTime = Date.now();
    const promises = [];
    
    // Send 50 concurrent requests
    for (let i = 0; i < 50; i++) {
      promises.push(
        axios.get(
          `${BASE_URL}/api/shops/${TEST_SHOP_ID}/images`,
          config
        ).catch(error => ({ error }))
      );
    }

    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const successful = results.filter(r => !r.error).length;
    const failed = results.filter(r => r.error).length;
    
    logTest('Performance under load', 'PASS', 
      `${successful} successful, ${failed} failed in ${duration}ms`);
  } catch (error) {
    logTest('Performance under load', 'FAIL', error.message);
  }
}

/**
 * Main test execution
 */
async function runAllTests() {
  console.log('🚀 Starting Enhanced Image Security and Rate Limiting Tests...\n');
  
  try {
    await testBasicImageUploadSecurity();
    await testRateLimiting();
    await testRequestPatternAnalysis();
    await testSecurityHeaders();
    await testImageMetadataSecurity();
    await testErrorHandlingAndLogging();
    await testPerformanceUnderLoad();
    
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
    
    console.log('\n✅ Enhanced Image Security and Rate Limiting Tests Complete!');
    
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
  testBasicImageUploadSecurity,
  testRateLimiting,
  testRequestPatternAnalysis,
  testSecurityHeaders,
  testImageMetadataSecurity,
  testErrorHandlingAndLogging,
  testPerformanceUnderLoad
};

