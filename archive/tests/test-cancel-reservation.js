const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

// Configuration from seed data
const SHOP_OWNER_ID = '00000000-0000-0000-0000-000000000002';
const SHOP_ID = '00000000-0000-0000-0000-000000000101';
const RESERVATION_ID = '00000000-0000-0000-0000-000000000301';
const API_URL = 'http://localhost:3001';

// Create a test JWT token
function createTestToken() {
  const payload = {
    sub: SHOP_OWNER_ID,
    shopId: SHOP_ID,
    role: 'shop_owner',
    email: 'shopowner@example.com',
    aud: 'authenticated',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour from now
    iss: 'ebeautything'
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET);
  return token;
}

// Test cancel reservation endpoint
async function testCancelReservation() {
  console.log('🧪 Testing Cancel Reservation Endpoint\n');
  console.log('Configuration:');
  console.log(`  Shop Owner ID: ${SHOP_OWNER_ID}`);
  console.log(`  Shop ID: ${SHOP_ID}`);
  console.log(`  Reservation ID: ${RESERVATION_ID}\n`);

  try {
    // Create token
    const token = createTestToken();
    console.log('✅ JWT Token created\n');

    // Test cancel endpoint
    const url = `${API_URL}/api/shops/${SHOP_ID}/reservations/${RESERVATION_ID}`;
    console.log(`📡 PATCH ${url}\n`);

    const response = await axios.patch(
      url,
      {
        status: 'cancelled_by_shop',
        reason: '테스트 취소 사유입니다'
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ SUCCESS! Cancel reservation endpoint is working\n');
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));

    return true;
  } catch (error) {
    if (error.response) {
      console.log('❌ FAILED! Server responded with error\n');
      console.log('Status:', error.response.status);
      console.log('Error Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('❌ FAILED! Request error\n');
      console.log('Error:', error.message);
    }

    return false;
  }
}

// Run the test
testCancelReservation()
  .then(success => {
    console.log('\n' + '='.repeat(60));
    if (success) {
      console.log('🎉 TEST PASSED - Cancel endpoint is working correctly!');
      console.log('The 500 error has been fixed.');
    } else {
      console.log('⚠️  TEST FAILED - Please check the error above');
    }
    console.log('='.repeat(60));
    process.exit(success ? 0 : 1);
  });
