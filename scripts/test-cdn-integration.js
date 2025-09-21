#!/usr/bin/env node

/**
 * Test script for CDN Integration with Supabase Storage
 * Tests the complete CDN workflow including image transformations and caching
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000';
const TEST_SHOP_ID = 'test-shop-id'; // Replace with actual shop ID
const TEST_USER_TOKEN = 'test-user-token'; // Replace with actual user token

/**
 * Test CDN configuration
 */
async function testCDNConfiguration() {
  console.log('\n=== Testing CDN Configuration ===');
  
  try {
    const response = await fetch(`${API_BASE}/api/cdn/config`, {
      headers: {
        'Authorization': `Bearer ${TEST_USER_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch CDN config: ${response.status}`);
    }
    
    const configData = await response.json();
    console.log('✅ CDN Configuration:', {
      enabled: configData.data.config.enabled,
      baseUrl: configData.data.config.baseUrl,
      imageTransformation: configData.data.config.imageTransformation.enabled,
      onDemandResizing: configData.data.config.onDemandResizing.enabled
    });
    
    if (configData.data.validation.valid) {
      console.log('✅ CDN configuration is valid');
    } else {
      console.log('❌ CDN configuration errors:', configData.data.validation.errors);
    }
    
  } catch (error) {
    console.error('❌ Error testing CDN configuration:', error.message);
  }
}

/**
 * Test CDN URL generation
 */
async function testCDNURLGeneration() {
  console.log('\n=== Testing CDN URL Generation ===');
  
  try {
    // Test URL generation for different presets
    const presets = ['thumbnail', 'small', 'medium', 'large', 'original'];
    const testImagePath = 'test-image.jpg';
    
    for (const preset of presets) {
      const response = await fetch(`${API_BASE}/api/cdn/images/${testImagePath}/urls?preset=${preset}&width=800&height=600&quality=85&format=webp`, {
        headers: {
          'Authorization': `Bearer ${TEST_USER_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const urlData = await response.json();
        console.log(`✅ Generated ${preset} URL:`, {
          url: urlData.data.url,
          cdnUrl: urlData.data.cdnUrl,
          transformations: urlData.data.transformations
        });
      } else {
        console.log(`❌ Failed to generate ${preset} URL:`, response.status);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing CDN URL generation:', error.message);
  }
}

/**
 * Test image upload with CDN integration
 */
async function testImageUploadWithCDN() {
  console.log('\n=== Testing Image Upload with CDN Integration ===');
  
  try {
    // Create a test image buffer (1x1 pixel JPEG)
    const testImageBuffer = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A', 'base64');
    
    const formData = new FormData();
    const blob = new Blob([testImageBuffer], { type: 'image/jpeg' });
    formData.append('image', blob, 'test-image.jpg');
    formData.append('shopId', TEST_SHOP_ID);
    formData.append('isPrimary', 'false');
    formData.append('altText', 'Test image for CDN integration');
    
    const response = await fetch(`${API_BASE}/api/shops/${TEST_SHOP_ID}/images`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_USER_TOKEN}`,
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Failed to upload image: ${response.status}`);
    }
    
    const uploadData = await response.json();
    console.log('✅ Image uploaded successfully:', {
      imageUrl: uploadData.data.imageUrl,
      thumbnailUrl: uploadData.data.thumbnailUrl,
      mediumUrl: uploadData.data.mediumUrl,
      largeUrl: uploadData.data.largeUrl,
      cdnOptimized: uploadData.data.metadata?.cdnOptimized,
      transformationStatus: uploadData.data.metadata?.transformationStatus
    });
    
    // Check if CDN URLs were generated
    if (uploadData.data.cdnUrls) {
      console.log('✅ CDN URLs generated:', Object.keys(uploadData.data.cdnUrls));
    }
    
    // Check responsive variants
    if (uploadData.data.responsiveVariants) {
      console.log('✅ Responsive variants generated:', {
        srcSet: uploadData.data.responsiveVariants.srcSet,
        sizes: uploadData.data.responsiveVariants.sizes,
        variantCount: Object.keys(uploadData.data.responsiveVariants.variants).length
      });
    }
    
    return uploadData.data;
    
  } catch (error) {
    console.error('❌ Error testing image upload with CDN:', error.message);
    return null;
  }
}

/**
 * Test CDN cache management
 */
async function testCDNCacheManagement() {
  console.log('\n=== Testing CDN Cache Management ===');
  
  try {
    // Test cache statistics
    const statsResponse = await fetch(`${API_BASE}/api/cdn/cache/stats`, {
      headers: {
        'Authorization': `Bearer ${TEST_USER_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (statsResponse.ok) {
      const statsData = await statsResponse.json();
      console.log('✅ Cache statistics:', statsData.data);
    }
    
    // Test cache cleanup
    const cleanupResponse = await fetch(`${API_BASE}/api/cdn/cache/cleanup`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_USER_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (cleanupResponse.ok) {
      const cleanupData = await cleanupResponse.json();
      console.log('✅ Cache cleanup completed:', cleanupData.data);
    }
    
  } catch (error) {
    console.error('❌ Error testing CDN cache management:', error.message);
  }
}

/**
 * Test CDN performance
 */
async function testCDNPerformance() {
  console.log('\n=== Testing CDN Performance ===');
  
  try {
    // Test CDN connectivity
    const connectivityResponse = await fetch(`${API_BASE}/api/cdn/test`, {
      headers: {
        'Authorization': `Bearer ${TEST_USER_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (connectivityResponse.ok) {
      const connectivityData = await connectivityResponse.json();
      console.log('✅ CDN connectivity test:', {
        success: connectivityData.data.success,
        latency: connectivityData.data.latency,
        error: connectivityData.data.error
      });
    }
    
    // Test image loading performance
    const testUrls = [
      'https://your-cdn-domain.com/shop-images-cdn/test-image.jpg',
      'https://your-cdn-domain.com/shop-images-cdn/test-image.jpg?width=800&height=600&quality=85&format=webp'
    ];
    
    for (const url of testUrls) {
      const startTime = Date.now();
      try {
        const response = await fetch(url, { method: 'HEAD' });
        const loadTime = Date.now() - startTime;
        
        console.log(`✅ Image load test (${url}):`, {
          status: response.status,
          loadTime: `${loadTime}ms`,
          headers: {
            'cache-control': response.headers.get('cache-control'),
            'content-type': response.headers.get('content-type'),
            'content-length': response.headers.get('content-length')
          }
        });
      } catch (error) {
        console.log(`⚠️ Image load test failed (${url}):`, error.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing CDN performance:', error.message);
  }
}

/**
 * Test batch image optimization
 */
async function testBatchImageOptimization() {
  console.log('\n=== Testing Batch Image Optimization ===');
  
  try {
    const testImagePaths = [
      'test-image-1.jpg',
      'test-image-2.jpg',
      'test-image-3.jpg'
    ];
    
    const response = await fetch(`${API_BASE}/api/cdn/images/batch-optimize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEST_USER_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filePaths: testImagePaths,
        bucket: 'shop-images',
        optimizationLevel: 'high'
      })
    });
    
    if (response.ok) {
      const optimizationData = await response.json();
      console.log('✅ Batch optimization completed:', {
        optimized: optimizationData.data.optimized,
        failed: optimizationData.data.failed,
        errors: optimizationData.data.errors
      });
    } else {
      console.log('❌ Batch optimization failed:', response.status);
    }
    
  } catch (error) {
    console.error('❌ Error testing batch image optimization:', error.message);
  }
}

/**
 * Test CDN transformation presets
 */
async function testTransformationPresets() {
  console.log('\n=== Testing CDN Transformation Presets ===');
  
  try {
    const response = await fetch(`${API_BASE}/api/cdn/presets?bucket=shop-images`, {
      headers: {
        'Authorization': `Bearer ${TEST_USER_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const presetsData = await response.json();
      console.log('✅ Available transformation presets:', presetsData.data.map(p => ({
        name: p.transformation_preset,
        config: p.config
      })));
    }
    
  } catch (error) {
    console.error('❌ Error testing transformation presets:', error.message);
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🧪 Starting CDN Integration Tests');
  console.log('=====================================');
  
  try {
    await testCDNConfiguration();
    await testCDNURLGeneration();
    await testTransformationPresets();
    const uploadResult = await testImageUploadWithCDN();
    await testCDNCacheManagement();
    await testCDNPerformance();
    await testBatchImageOptimization();
    
    console.log('\n✅ All CDN integration tests completed');
    
    if (uploadResult) {
      console.log('\n📊 Test Summary:');
      console.log(`- Image uploaded successfully: ${uploadResult.success}`);
      console.log(`- CDN optimized: ${uploadResult.metadata?.cdnOptimized}`);
      console.log(`- Transformation status: ${uploadResult.metadata?.transformationStatus}`);
      console.log(`- CDN URLs generated: ${uploadResult.cdnUrls ? Object.keys(uploadResult.cdnUrls).length : 0}`);
      console.log(`- Responsive variants: ${uploadResult.responsiveVariants ? Object.keys(uploadResult.responsiveVariants.variants).length : 0}`);
    }
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testCDNConfiguration,
  testCDNURLGeneration,
  testImageUploadWithCDN,
  testCDNCacheManagement,
  testCDNPerformance,
  testBatchImageOptimization,
  testTransformationPresets,
  runTests
};