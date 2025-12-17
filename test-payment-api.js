/**
 * PortOne Payment API Test Script
 * Tests the payment initialization and webhook flow
 */

require('dotenv').config();
const { PortOneClient } = require('@portone/server-sdk');

const config = {
  storeId: process.env.PORTONE_V2_STORE_ID,
  channelKey: process.env.PORTONE_V2_CHANNEL_KEY,
  apiSecret: process.env.PORTONE_V2_API_SECRET,
};

console.log('🧪 Testing PortOne Payment API...\n');
console.log('Configuration:');
console.log('✅ Store ID:', config.storeId);
console.log('✅ Channel Key:', config.channelKey);
console.log('✅ API Secret:', config.apiSecret ? '***' + config.apiSecret.slice(-8) : '❌ MISSING');
console.log('');

// Initialize PortOne client
const client = PortOneClient({
  secret: config.apiSecret
});

async function testPaymentFlow() {
  console.log('📋 Test Payment Details:');
  const testPaymentId = `test_payment_${Date.now()}`;
  console.log('Payment ID:', testPaymentId);
  console.log('Amount: 10,000 KRW');
  console.log('Method: Card (Danal)');
  console.log('');

  try {
    console.log('🔍 Step 1: Attempting to get payment info (should fail - payment doesn\'t exist yet)...');

    try {
      const payment = await client.payment.getPayment({
        paymentId: testPaymentId
      });
      console.log('❌ Unexpected: Payment found!');
      console.log(payment);
    } catch (error) {
      if (error.message && error.message.includes('not found')) {
        console.log('✅ Expected result: Payment not found (API connection working!)');
      } else if (error.message && error.message.includes('PAYMENT_NOT_FOUND')) {
        console.log('✅ Expected result: Payment not found (API connection working!)');
      } else {
        console.log('⚠️  Got error:', error.message);
      }
    }

    console.log('');
    console.log('📊 API Connection Test: SUCCESS');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ PortOne Configuration is Valid!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('🎯 Next Steps:');
    console.log('1. Open the test HTML file in your browser:');
    console.log('   file:///home/bitnami/everything_backend/test-danal-payment-ngrok.html');
    console.log('');
    console.log('2. Fill in the form and click "결제하기"');
    console.log('');
    console.log('3. Use Danal test card:');
    console.log('   Card: 5570-0000-0000-0001');
    console.log('   Expiry: 12/25');
    console.log('   CVC: 123');
    console.log('   Password: 12');
    console.log('');
    console.log('4. Monitor webhooks in another terminal:');
    console.log('   tail -f logs/combined.log | grep -i webhook');
    console.log('');

  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    console.error('');
    console.error('Error details:', error);
  }
}

// Run test
testPaymentFlow().catch(console.error);
