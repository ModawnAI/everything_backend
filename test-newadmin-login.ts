#!/usr/bin/env npx ts-node
import fetch from 'node-fetch';

async function testNewAdminLogin() {
  console.log('🔐 Testing newadmin login...\n');

  const loginData = {
    email: 'newadmin@ebeautything.com',
    password: 'NewAdmin123!',
    deviceInfo: {
      userAgent: 'test-script',
      platform: 'CLI',
      ipAddress: '127.0.0.1'
    }
  };

  try {
    const response = await fetch('http://localhost:3001/api/admin/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loginData),
    });

    const data = await response.json();

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.success && data.data?.session?.token) {
      console.log('\n✅ Login successful!');
      console.log('Token:', data.data.session.token.substring(0, 50) + '...');
      process.exit(0);
    } else {
      console.log('\n❌ Login failed');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testNewAdminLogin();
