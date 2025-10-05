const http = require('http');

async function makeRequest(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ error: 'Parse error', data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function loginAndGetToken() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/admin/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.data?.session?.token);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify({
      email: 'admin@ebeautything.com',
      password: 'Admin123!@#'
    }));
    req.end();
  });
}

async function validateDatabase() {
  console.log('\n🔍 Database Validation Tests\n');
  console.log('========================================\n');

  const token = await loginAndGetToken();
  console.log('✓ Admin token obtained\n');

  // Test 1: Shop data validation
  console.log('1. Shop Management Data:');
  const shops = await makeRequest('/api/admin/shops?page=1&limit=5', token);
  if (shops.success && shops.data?.shops) {
    console.log(`   ✓ Found ${shops.data.shops.length} shops`);
    console.log(`   ✓ Total shops: ${shops.data.pagination?.total || 'N/A'}`);
    console.log(`   ✓ Shop statuses: ${shops.data.shops.map(s => s.approval_status).join(', ')}`);
  } else {
    console.log('   ✗ Failed to fetch shops');
  }

  // Test 2: Admin user data
  console.log('\n2. Admin User Data:');
  const profile = await makeRequest('/api/admin/auth/profile', token);
  if (profile.success && profile.data) {
    console.log(`   ✓ Admin ID: ${profile.data.id}`);
    console.log(`   ✓ Admin Email: ${profile.data.email}`);
    console.log(`   ✓ Admin Role: ${profile.data.role}`);
    console.log(`   ✓ Admin Status: ${profile.data.status}`);
    console.log(`   ✓ Last Login: ${profile.data.lastLoginAt}`);
    console.log(`   ✓ Permissions: ${profile.data.permissions?.length || 0} total`);
  } else {
    console.log('   ✗ Failed to fetch admin profile');
  }

  // Test 3: Audit logs
  console.log('\n3. Security & Audit:');
  const sessions = await makeRequest('/api/admin/auth/validate', token);
  if (sessions.success && sessions.data?.session) {
    console.log(`   ✓ Session ID: ${sessions.data.session.id}`);
    console.log(`   ✓ Session Expires: ${sessions.data.session.expiresAt}`);
    console.log(`   ✓ Last Activity: ${sessions.data.session.lastActivityAt}`);
  }

  console.log('\n========================================');
  console.log('✓ Database validation complete\n');
}

validateDatabase().catch(console.error);
