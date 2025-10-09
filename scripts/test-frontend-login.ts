#!/usr/bin/env node
/**
 * Test admin login with exact frontend payload
 * Simulates what the Flutter app sends
 */

const password = 'AdminPassword123!';

console.log('\n🔍 Password Analysis:');
console.log('='.repeat(50));
console.log('Password:', password);
console.log('Length:', password.length, '(expected: 17)');
console.log('First 3 chars:', password.substring(0, 3));
console.log('Last 3 chars:', password.substring(password.length - 3));
console.log('Has spaces:', password.includes(' '));
console.log('Matches expected:', password === 'AdminPassword123!');
console.log('='.repeat(50));

// Test with fetch like frontend does
async function testLogin() {
  const payload = {
    email: 'admin@ebeautything.com',
    password: password,
    deviceId: 'test-device-12345'
  };

  console.log('\n📤 Sending request to backend...');
  console.log('Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch('http://localhost:3001/api/admin/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    console.log('\n📥 Response:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('\n✅ LOGIN SUCCESSFUL!');
    } else {
      console.log('\n❌ LOGIN FAILED');
      console.log('Check backend logs for password comparison');
    }
  } catch (error) {
    console.error('\n💥 Error:', error instanceof Error ? error.message : error);
  }
}

testLogin();
