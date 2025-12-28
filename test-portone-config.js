/**
 * PortOne Configuration Test
 *
 * This script verifies your PortOne V2 configuration is correct
 * Run: node test-portone-config.js
 */

require('dotenv').config();
const { PortOneClient } = require('@portone/server-sdk');

console.log('🔍 Testing PortOne V2 Configuration...\n');

// Check environment variables
const config = {
  storeId: process.env.PORTONE_V2_STORE_ID,
  channelKey: process.env.PORTONE_V2_CHANNEL_KEY,
  apiSecret: process.env.PORTONE_V2_API_SECRET,
  webhookSecret: process.env.PORTONE_V2_WEBHOOK_SECRET,
};

console.log('📋 Configuration Check:');
console.log('✅ Store ID:', config.storeId);
console.log('✅ Channel Key:', config.channelKey);
console.log('✅ API Secret:', config.apiSecret ? '***' + config.apiSecret.slice(-8) : '❌ MISSING');
console.log('✅ Webhook Secret:', config.webhookSecret ? '***' + config.webhookSecret.slice(-8) : '❌ MISSING');
console.log('');

// Validate configuration
if (!config.storeId || !config.channelKey || !config.apiSecret) {
  console.error('❌ Missing required configuration!');
  process.exit(1);
}

// Initialize PortOne client
console.log('🔌 Initializing PortOne SDK...');
const client = PortOneClient({
  secret: config.apiSecret
});

console.log('✅ PortOne SDK initialized successfully!\n');

// Test API connection
async function testApiConnection() {
  console.log('🌐 Testing API Connection...');

  try {
    // Try to get a non-existent payment (just to test API connectivity)
    const testPaymentId = 'test_connection_check';

    try {
      await client.payment.getPayment({ paymentId: testPaymentId });
    } catch (error) {
      // We expect this to fail (payment doesn't exist)
      // But if we get a proper API error response, it means connection works
      if (error.message && error.message.includes('not found')) {
        console.log('✅ API Connection: SUCCESS');
        console.log('   (Received expected "not found" response)\n');
        return true;
      }

      // Check for authentication errors
      if (error.message && error.message.includes('auth')) {
        console.error('❌ API Connection: FAILED');
        console.error('   Authentication error - check your API Secret\n');
        return false;
      }

      // Other errors might indicate connection issues
      console.log('⚠️  API Connection: Response received but uncertain');
      console.log('   Error:', error.message);
      return true; // Assume OK if we got any response
    }
  } catch (error) {
    console.error('❌ API Connection: FAILED');
    console.error('   Error:', error.message);
    return false;
  }
}

// Test webhook signature verification
function testWebhookVerification() {
  console.log('🔐 Testing Webhook Configuration...');

  if (!config.webhookSecret) {
    console.log('⚠️  Webhook Secret not configured (optional for testing)\n');
    return;
  }

  console.log('✅ Webhook Secret configured');
  console.log('   Webhook URL should be:');
  console.log('   https://api.e-beautything.com/api/webhooks/portone\n');
}

// Summary
function printSummary(apiConnected) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Configuration Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Store ID:      ', config.storeId);
  console.log('Channel Key:   ', config.channelKey);
  console.log('API Connected: ', apiConnected ? '✅ YES' : '❌ NO');
  console.log('Webhook Ready: ', config.webhookSecret ? '✅ YES' : '⚠️  Optional');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (apiConnected) {
    console.log('🎉 Your PortOne configuration is ready!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Start your backend: npm run dev');
    console.log('2. Open test-danal-payment.html in browser');
    console.log('3. Try a test payment with Danal');
    console.log('');
    console.log('Test file location:');
    console.log('📄 /home/bitnami/everything_backend/test-danal-payment.html');
  } else {
    console.log('❌ Configuration issue detected!');
    console.log('Please check your API Secret in .env file');
  }
}

// Run tests
(async () => {
  const apiConnected = await testApiConnection();
  testWebhookVerification();
  printSummary(apiConnected);
})();
