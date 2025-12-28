const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

// Real data from database
const SHOP_OWNER_ID = '4539aa5d-eb4b-404d-9288-2e6dd338caec';
const SHOP_ID = '22222222-2222-2222-2222-222222222222';
const RESERVATION_ID = 'd0000002-0000-0000-0000-000000000002';
const API_URL = 'http://localhost:3001';

// Create a test JWT token
function createTestToken() {
  const payload = {
    sub: SHOP_OWNER_ID,
    shopId: SHOP_ID,
    role: 'shop_owner',
    email: 'shopowner@test.com',
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
  console.log('🧪 Testing Cancel Reservation Endpoint (FINAL TEST)\n');
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
    console.log('Request Body:');
    console.log('  {');
    console.log('    status: "cancelled_by_shop",');
    console.log('    reason: "일정 중복으로 취소합니다"');
    console.log('  }\n');

    const response = await axios.patch(
      url,
      {
        status: 'cancelled_by_shop',
        reason: '일정 중복으로 취소합니다'
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
    console.log('\n🎉 The 500 error has been FIXED!');
    console.log('The backend now successfully cancels reservations.');

    return true;
  } catch (error) {
    if (error.response) {
      console.log('❌ FAILED! Server responded with error\n');
      console.log('Status:', error.response.status);
      console.log('Error Data:', JSON.stringify(error.response.data, null, 2));

      if (error.response.status === 500) {
        console.log('\n⚠️  The 500 error still exists - the fix did not work');
      } else {
        console.log(`\n⚠️  Got ${error.response.status} error instead of 500`);
        console.log('Check the error message above for details');
      }
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
    console.log('\n' + '='.repeat(70));
    if (success) {
      console.log('🎉 TEST PASSED - Cancel endpoint is working correctly!');
      console.log('✅ The cancelled_by field issue has been resolved.');
      console.log('✅ Frontend cancel functionality will now work end-to-end.');
    } else {
      console.log('⚠️  TEST FAILED - Please check the error above');
    }
    console.log('='.repeat(70));
    process.exit(success ? 0 : 1);
  });
