/**
 * Debug script to test push notifications
 * Tests sending a notification to a specific user with FCM token
 */

const axios = require('axios');

const TEST_USER_ID = 'b374307c-d553-4520-ac13-d3fd813c596f'; // User with active FCM tokens
const BACKEND_URL = 'http://localhost:3001';

async function testPushNotification() {
  console.log('🔍 Starting push notification debug test...\n');

  try {
    // Test 1: Check if server is running
    console.log('1️⃣ Checking if backend server is running...');
    try {
      const healthCheck = await axios.get(`${BACKEND_URL}/health`);
      console.log('✅ Server is running:', healthCheck.data);
    } catch (error) {
      console.error('❌ Server is not running. Please start the backend with: npm run dev');
      process.exit(1);
    }

    // Test 2: Send a test notification
    console.log('\n2️⃣ Sending test push notification...');
    const notificationPayload = {
      userId: TEST_USER_ID,
      title: '🧪 Test Notification from Debug Script',
      body: 'This is a test notification to verify FCM integration. Time: ' + new Date().toLocaleTimeString('ko-KR'),
      data: {
        type: 'debug_test',
        timestamp: new Date().toISOString(),
        test_id: 'debug_' + Date.now()
      }
    };

    console.log('Payload:', JSON.stringify(notificationPayload, null, 2));

    // Try sending via admin endpoint (if available)
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/admin/send-push-notification`,
        notificationPayload,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      console.log('\n✅ Notification sent successfully!');
      console.log('Response:', JSON.stringify(response.data, null, 2));
    } catch (adminError) {
      console.log('\n⚠️ Admin endpoint failed, trying direct service...');
      console.log('Error:', adminError.response?.data || adminError.message);

      // Try alternative endpoint
      try {
        const altResponse = await axios.post(
          `${BACKEND_URL}/api/notifications/send`,
          notificationPayload,
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 10000
          }
        );

        console.log('\n✅ Notification sent via alternative endpoint!');
        console.log('Response:', JSON.stringify(altResponse.data, null, 2));
      } catch (altError) {
        console.error('\n❌ Both endpoints failed');
        console.error('Admin error:', adminError.response?.data || adminError.message);
        console.error('Alt error:', altError.response?.data || altError.message);
      }
    }

    // Test 3: Check notification history
    console.log('\n3️⃣ Checking notification history from database...');
    try {
      const historyResponse = await axios.get(
        `${BACKEND_URL}/api/admin/notification-history?userId=${TEST_USER_ID}&limit=5`,
        { timeout: 5000 }
      );

      console.log('Recent notifications:');
      console.log(JSON.stringify(historyResponse.data, null, 2));
    } catch (historyError) {
      console.log('⚠️ Could not fetch history:', historyError.response?.data || historyError.message);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Status:', error.response.status);
    }
    process.exit(1);
  }
}

// Run the test
console.log('=' .repeat(60));
console.log('Push Notification Debug Test');
console.log('=' .repeat(60));
testPushNotification()
  .then(() => {
    console.log('\n' + '='.repeat(60));
    console.log('✅ Debug test completed');
    console.log('='.repeat(60));
  })
  .catch(error => {
    console.error('\n' + '='.repeat(60));
    console.error('❌ Debug test failed:', error);
    console.error('='.repeat(60));
    process.exit(1);
  });
