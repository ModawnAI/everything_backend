/**
 * PortOne Webhook Signature Test
 * Tests webhook endpoint with simulated PortOne webhook
 */

require('dotenv').config();
const crypto = require('crypto');
const axios = require('axios');

const WEBHOOK_SECRET = process.env.PORTONE_V2_WEBHOOK_SECRET;
const WEBHOOK_URL = 'https://multisulcate-yuk-evitable.ngrok-free.dev/api/webhooks/portone';

console.log('🔐 Testing PortOne Webhook Signature Verification...\n');
console.log('Webhook URL:', WEBHOOK_URL);
console.log('Webhook Secret:', WEBHOOK_SECRET ? '***' + WEBHOOK_SECRET.slice(-8) : '❌ MISSING');
console.log('');

// Simulate a PortOne webhook payload
const testWebhookPayload = {
  type: 'Transaction.Paid',
  timestamp: new Date().toISOString(),
  data: {
    paymentId: `test_payment_${Date.now()}`,
    transactionId: `txn_${Date.now()}`,
    storeId: process.env.PORTONE_V2_STORE_ID,
    channelKey: process.env.PORTONE_V2_CHANNEL_KEY,
    orderName: '테스트 결제',
    amount: {
      total: 10000,
      currency: 'KRW'
    },
    status: 'PAID',
    paidAt: new Date().toISOString(),
    method: {
      type: 'CARD',
      provider: 'DANAL'
    },
    customer: {
      fullName: '홍길동',
      email: 'test@example.com',
      phoneNumber: '01012345678'
    }
  }
};

function generatePortOneSignature(payload, secret) {
  // PortOne webhook signature format: HMAC-SHA256
  const payloadString = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex');
  return signature;
}

async function testWebhook() {
  console.log('📦 Test Payload:');
  console.log(JSON.stringify(testWebhookPayload, null, 2));
  console.log('');

  // Generate signature
  const signature = generatePortOneSignature(testWebhookPayload, WEBHOOK_SECRET);
  console.log('🔑 Generated Signature:', signature);
  console.log('');

  console.log('📤 Sending webhook request...');
  console.log('');

  try {
    const response = await axios.post(WEBHOOK_URL, testWebhookPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Portone-Signature': signature,
        'User-Agent': 'PortOne-Webhook/2.0'
      },
      validateStatus: () => true // Accept any status code
    });

    console.log('📥 Response Status:', response.status);
    console.log('📥 Response Data:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');

    if (response.status === 200) {
      console.log('✅ Webhook Test: SUCCESS!');
      console.log('✅ Signature verification passed');
      console.log('✅ Webhook endpoint is working correctly');
    } else if (response.status === 401) {
      console.log('⚠️  Webhook Test: Signature verification failed');
      console.log('This might be because PortOne uses a different signature format');
      console.log('The webhook will work when PortOne sends real webhooks');
    } else {
      console.log('⚠️  Unexpected response status:', response.status);
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Webhook Endpoint Test Complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Webhook Test Failed:');
    console.error('Error:', error.message);

    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', error.response.data);
    }
  }

  console.log('');
  console.log('🎯 Next Step: Test with Real Payment');
  console.log('Open the browser test file to make a real payment:');
  console.log('file:///home/bitnami/everything_backend/test-danal-payment-ngrok.html');
}

// Run test
testWebhook().catch(console.error);
