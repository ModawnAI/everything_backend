const https = require('http');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const results = [];

function logTest(name, status, time, details = '') {
  totalTests++;
  const result = {
    name,
    status,
    time: `${time}ms`,
    details
  };
  results.push(result);

  if (status === 'PASS') {
    passedTests++;
    console.log(`${colors.green}✓${colors.reset} ${name} (${time}ms)`);
  } else {
    failedTests++;
    console.log(`${colors.red}✗${colors.reset} ${name}`);
    if (details) console.log(`  ${colors.red}Error: ${details}${colors.reset}`);
  }
}

async function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const startTime = Date.now();
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const endTime = Date.now();
        try {
          const parsed = data ? JSON.parse(data) : null;
          resolve({
            status: res.statusCode,
            data: parsed,
            time: endTime - startTime
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data,
            time: endTime - startTime
          });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}eBeautything API E2E Test Suite${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);

  let adminToken = null;

  // Test 1: Health Check
  console.log(`${colors.yellow}[TEST 1] Backend Health Check${colors.reset}`);
  try {
    const health = await makeRequest('GET', '/health');
    if (health.status === 200) {
      logTest('Backend Health Check', 'PASS', health.time);
    } else {
      logTest('Backend Health Check', 'FAIL', health.time, `Status: ${health.status}`);
    }
  } catch (e) {
    logTest('Backend Health Check', 'FAIL', 0, e.message);
  }

  // Test 2: Admin Login
  console.log(`\n${colors.yellow}[TEST 2] Admin Authentication${colors.reset}`);
  try {
    const login = await makeRequest('POST', '/api/admin/auth/login', {
      email: 'admin@ebeautything.com',
      password: 'Admin123!@#'
    });

    if (login.status === 200 && login.data?.success) {
      adminToken = login.data.data?.session?.token;
      logTest('Admin Login', 'PASS', login.time);

      // Validate token structure
      if (adminToken && adminToken.split('.').length === 3) {
        logTest('JWT Token Structure', 'PASS', 0);
      } else {
        logTest('JWT Token Structure', 'FAIL', 0, 'Invalid JWT');
      }
    } else {
      logTest('Admin Login', 'FAIL', login.time, JSON.stringify(login.data));
    }
  } catch (e) {
    logTest('Admin Login', 'FAIL', 0, e.message);
  }

  // Test 3: Session Validation
  if (adminToken) {
    console.log(`\n${colors.yellow}[TEST 3] Session Validation${colors.reset}`);
    try {
      const validate = await makeRequest('GET', '/api/admin/auth/validate', null, {
        'Authorization': `Bearer ${adminToken}`
      });

      if (validate.status === 200 && validate.data?.success) {
        logTest('Session Validation', 'PASS', validate.time);

        // Check admin data
        const admin = validate.data.data?.admin;
        if (admin?.id && admin?.email && admin?.role) {
          logTest('Admin Data Integrity', 'PASS', 0);
        } else {
          logTest('Admin Data Integrity', 'FAIL', 0, 'Missing admin data');
        }
      } else {
        logTest('Session Validation', 'FAIL', validate.time, `Status: ${validate.status}`);
      }
    } catch (e) {
      logTest('Session Validation', 'FAIL', 0, e.message);
    }
  }

  // Test 4: Profile Retrieval
  if (adminToken) {
    console.log(`\n${colors.yellow}[TEST 4] Admin Profile${colors.reset}`);
    try {
      const profile = await makeRequest('GET', '/api/admin/auth/profile', null, {
        'Authorization': `Bearer ${adminToken}`
      });

      if (profile.status === 200 && profile.data?.success) {
        logTest('Profile Retrieval', 'PASS', profile.time);

        const data = profile.data.data;
        if (data?.permissions && Array.isArray(data.permissions) && data.permissions.length > 0) {
          logTest('Admin Permissions Check', 'PASS', 0, `${data.permissions.length} permissions`);
        } else {
          logTest('Admin Permissions Check', 'FAIL', 0, 'No permissions found');
        }
      } else {
        logTest('Profile Retrieval', 'FAIL', profile.time, `Status: ${profile.status}`);
      }
    } catch (e) {
      logTest('Profile Retrieval', 'FAIL', 0, e.message);
    }
  }

  // Test 5: Shop Management
  if (adminToken) {
    console.log(`\n${colors.yellow}[TEST 5] Shop Management${colors.reset}`);
    try {
      const shops = await makeRequest('GET', '/api/admin/shops?page=1&limit=10', null, {
        'Authorization': `Bearer ${adminToken}`
      });

      if (shops.status === 200) {
        logTest('Shop List API', 'PASS', shops.time);

        if (shops.data?.data?.shops) {
          logTest('Shop Data Structure', 'PASS', 0, `Found ${shops.data.data.shops.length} shops`);
        }
      } else {
        logTest('Shop List API', 'FAIL', shops.time, `Status: ${shops.status}`);
      }
    } catch (e) {
      logTest('Shop List API', 'FAIL', 0, e.message);
    }
  }

  // Test 6: Unauthorized Access
  console.log(`\n${colors.yellow}[TEST 6] Security Tests${colors.reset}`);
  try {
    const unauth = await makeRequest('GET', '/api/admin/auth/profile');
    if (unauth.status === 401 || unauth.status === 403) {
      logTest('Unauthorized Access Blocked', 'PASS', unauth.time);
    } else {
      logTest('Unauthorized Access Blocked', 'FAIL', unauth.time, `Expected 401/403, got ${unauth.status}`);
    }
  } catch (e) {
    logTest('Unauthorized Access Blocked', 'FAIL', 0, e.message);
  }

  // Test 7: Token Refresh
  if (adminToken) {
    console.log(`\n${colors.yellow}[TEST 7] Token Management${colors.reset}`);
    try {
      // Get refresh token from login
      const login2 = await makeRequest('POST', '/api/admin/auth/login', {
        email: 'admin@ebeautything.com',
        password: 'Admin123!@#'
      });

      const refreshToken = login2.data?.data?.session?.refreshToken;

      if (refreshToken) {
        const refresh = await makeRequest('POST', '/api/admin/auth/refresh', {
          refreshToken
        });

        if (refresh.status === 200 && refresh.data?.success) {
          logTest('Token Refresh', 'PASS', refresh.time);
        } else {
          logTest('Token Refresh', 'FAIL', refresh.time, `Status: ${refresh.status}`);
        }
      } else {
        logTest('Token Refresh', 'FAIL', 0, 'No refresh token available');
      }
    } catch (e) {
      logTest('Token Refresh', 'FAIL', 0, e.message);
    }
  }

  // Test 8: Logout
  if (adminToken) {
    console.log(`\n${colors.yellow}[TEST 8] Admin Logout${colors.reset}`);
    try {
      const logout = await makeRequest('POST', '/api/admin/auth/logout', null, {
        'Authorization': `Bearer ${adminToken}`
      });

      if (logout.status === 200 && logout.data?.success) {
        logTest('Admin Logout', 'PASS', logout.time);
      } else {
        logTest('Admin Logout', 'FAIL', logout.time, `Status: ${logout.status}`);
      }
    } catch (e) {
      logTest('Admin Logout', 'FAIL', 0, e.message);
    }
  }

  // Summary
  console.log(`\n${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}Test Summary${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`Total Tests: ${totalTests}`);
  console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(2)}%`);
  console.log(`${colors.blue}========================================${colors.reset}\n`);

  // Write detailed results
  const fs = require('fs');
  fs.writeFileSync('./detailed_test_results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      successRate: ((passedTests / totalTests) * 100).toFixed(2) + '%'
    },
    tests: results
  }, null, 2));

  console.log(`${colors.green}Detailed results saved to: detailed_test_results.json${colors.reset}\n`);

  process.exit(failedTests > 0 ? 1 : 0);
}

runTests().catch(console.error);
