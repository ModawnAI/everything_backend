/**
 * Test FCM Push Notification Flow
 *
 * This script simulates a shop admin confirming a reservation
 * to trigger the push notification to the user's device.
 */

import jwt from 'jsonwebtoken';
import axios from 'axios';

// Test data
const SHOP_OWNER_ID = '22e51e7e-4cf2-4a52-82ce-3b9dd3e31026'; // Owner of shop 11111111-1111-1111-1111-111111111111
const RESERVATION_ID = 'dcc716de-6dae-4be8-b942-f5bd243ded58';
const API_BASE_URL = 'http://localhost:3001';
const JWT_SECRET = process.env.JWT_SECRET || 'b40a731a8234f26fc04c7611f2f4e990a39510090e8f81080b13729dad46242d';

async function testPushNotification() {
  console.log('='.repeat(80));
  console.log('🧪 FCM Push Notification Test');
  console.log('='.repeat(80));
  console.log();

  try {
    // Step 1: Generate JWT token for shop owner
    console.log('📝 Step 1: Generating JWT token for shop owner');
    console.log('-'.repeat(80));

    const token = jwt.sign(
      {
        sub: SHOP_OWNER_ID,
        email: 'shop-owner@test.com',
        role: 'authenticated',
        aud: 'authenticated',
        iss: 'https://ysrudwzwnzxrrwjtpuoh.supabase.co/auth/v1'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('✅ JWT token generated');
    console.log('Token preview:', token.substring(0, 50) + '...');
    console.log();

    // Step 2: Call the confirm reservation API endpoint
    console.log('📤 Step 2: Calling confirm reservation API');
    console.log('-'.repeat(80));
    console.log('Endpoint:', `PUT ${API_BASE_URL}/api/shop-owner/reservations/${RESERVATION_ID}/confirm`);
    console.log('Shop Owner ID:', SHOP_OWNER_ID);
    console.log('Reservation ID:', RESERVATION_ID);
    console.log();

    const response = await axios.put(
      `${API_BASE_URL}/api/shop-owner/reservations/${RESERVATION_ID}/confirm`,
      {
        notes: 'FCM 푸시 알림 테스트 - 예약이 확정되었습니다!'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ API Response:', response.status, response.statusText);
    console.log();
    console.log('Response Data:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log();

    // Step 3: Wait a bit for push notification to be sent
    console.log('⏳ Step 3: Waiting for push notification to be sent...');
    console.log('-'.repeat(80));
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log();

    // Step 4: Check notification history
    console.log('📋 Step 4: Checking notification logs');
    console.log('-'.repeat(80));
    console.log('Check the backend logs for FCM push notification');
    console.log('Look for messages like:');
    console.log('  - "Sending push notification"');
    console.log('  - "FCM message sent successfully"');
    console.log('  - "Push notification sent"');
    console.log();

    console.log('='.repeat(80));
    console.log('✅ TEST COMPLETE!');
    console.log('='.repeat(80));
    console.log();
    console.log('Next steps:');
    console.log('1. Check backend logs for FCM push notification activity');
    console.log('2. Check if notification appeared on user device (user ID: b374307c-d553-4520-ac13-d3fd813c596f)');
    console.log('3. Verify push_tokens table for active FCM tokens');
    console.log();

    process.exit(0);

  } catch (error) {
    console.error();
    console.error('❌ TEST FAILED');
    console.error('='.repeat(80));

    if (axios.isAxiosError(error)) {
      console.error('HTTP Error:', error.response?.status, error.response?.statusText);
      console.error('Response Data:', JSON.stringify(error.response?.data, null, 2));
      console.error('Request URL:', error.config?.url);
      console.error('Request Headers:', error.config?.headers);
    } else if (error instanceof Error) {
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
    } else {
      console.error('Unknown error:', error);
    }

    console.error();
    console.error('Troubleshooting tips:');
    console.error('1. Ensure backend server is running on port 3001');
    console.error('2. Check JWT_SECRET matches backend configuration');
    console.error('3. Verify shop owner ID exists and owns the shop');
    console.error('4. Confirm reservation ID is valid and in "requested" status');
    console.error();

    process.exit(1);
  }
}

testPushNotification();
