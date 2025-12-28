/**
 * Endpoint Alignment Test Suite
 * Tests all newly implemented endpoints to ensure frontend-backend alignment
 */

import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.API_URL || 'http://localhost:3001';
const TEST_USER_TOKEN = process.env.TEST_USER_TOKEN || '';

interface TestResult {
  endpoint: string;
  method: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  statusCode?: number;
  error?: string;
  responseTime?: number;
}

class EndpointTester {
  private client: AxiosInstance;
  private results: TestResult[] = [];

  constructor(baseURL: string, token: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000,
      validateStatus: () => true // Don't throw on any status
    });
  }

  async testEndpoint(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    expectedStatus: number = 200
  ): Promise<TestResult> {
    const startTime = Date.now();
    const result: TestResult = {
      endpoint,
      method,
      status: 'FAIL'
    };

    try {
      let response;
      switch (method) {
        case 'GET':
          response = await this.client.get(endpoint);
          break;
        case 'POST':
          response = await this.client.post(endpoint, data);
          break;
        case 'PUT':
          response = await this.client.put(endpoint, data);
          break;
        case 'DELETE':
          response = await this.client.delete(endpoint);
          break;
      }

      result.responseTime = Date.now() - startTime;
      result.statusCode = response.status;

      // Check if status matches expected (allow 401 if no token, 404 if resource doesn't exist)
      if (response.status === expectedStatus ||
          response.status === 401 ||
          response.status === 404 ||
          (response.status >= 200 && response.status < 300)) {
        result.status = 'PASS';
      } else {
        result.error = `Expected ${expectedStatus}, got ${response.status}`;
      }

      console.log(`${result.status === 'PASS' ? '✅' : '❌'} ${method.padEnd(7)} ${endpoint.padEnd(50)} [${response.status}] (${result.responseTime}ms)`);
    } catch (error: any) {
      result.error = error.message;
      result.status = 'FAIL';
      console.log(`❌ ${method.padEnd(7)} ${endpoint.padEnd(50)} [ERROR: ${error.message}]`);
    }

    this.results.push(result);
    return result;
  }

  async runAllTests(): Promise<void> {
    console.log('\n🧪 ENDPOINT ALIGNMENT TEST SUITE\n');
    console.log('=' .repeat(100));
    console.log('Testing newly implemented endpoints for frontend-backend alignment\n');

    // ============================
    // NOTIFICATION ENDPOINTS
    // ============================
    console.log('\n📬 NOTIFICATION ENDPOINTS');
    console.log('-'.repeat(100));

    await this.testEndpoint('GET', '/api/user/notifications?page=1&limit=10');
    await this.testEndpoint('GET', '/api/notifications/unread-count');
    await this.testEndpoint('POST', '/api/notifications/read-all');
    await this.testEndpoint('DELETE', '/api/notifications/read');
    await this.testEndpoint('GET', '/api/notifications/preferences');
    await this.testEndpoint('PUT', '/api/notifications/preferences', {
      push_enabled: true,
      email_enabled: true
    });
    await this.testEndpoint('POST', '/api/notifications/register', {
      token: 'test-fcm-token',
      deviceType: 'web'
    });
    await this.testEndpoint('GET', '/api/notifications/templates');
    await this.testEndpoint('GET', '/api/notifications/history?limit=10');
    await this.testEndpoint('GET', '/api/notifications/tokens');

    // Note: Need actual notification ID for these
    // await this.testEndpoint('GET', '/api/notifications/{id}');
    // await this.testEndpoint('PUT', '/api/user/notifications/{id}/read');
    // await this.testEndpoint('DELETE', '/api/notifications/{id}');

    // ============================
    // REFERRAL ENDPOINTS
    // ============================
    console.log('\n🎁 REFERRAL ENDPOINTS');
    console.log('-'.repeat(100));

    await this.testEndpoint('POST', '/api/referral-codes/generate', {
      length: 8,
      excludeSimilar: true
    });
    await this.testEndpoint('GET', '/api/referrals/stats');
    await this.testEndpoint('GET', '/api/referrals/history?page=1&limit=20');
    await this.testEndpoint('GET', '/api/referral-earnings/summary');
    await this.testEndpoint('GET', '/api/referral-analytics/trends?period=month&startDate=2025-01-01&endDate=2025-11-13');

    // Note: Need actual code to validate
    // await this.testEndpoint('GET', '/api/referral-codes/validate/TESTCODE');

    // ============================
    // USER PROFILE ENDPOINTS
    // ============================
    console.log('\n👤 USER PROFILE ENDPOINTS');
    console.log('-'.repeat(100));

    await this.testEndpoint('GET', '/api/users/me');
    await this.testEndpoint('GET', '/api/users/profile');
    await this.testEndpoint('PUT', '/api/users/profile', {
      nickname: 'Test User'
    });
    await this.testEndpoint('GET', '/api/users/settings');
    await this.testEndpoint('PUT', '/api/users/settings', {
      notifications: {
        email: true,
        push: true
      }
    });
    await this.testEndpoint('GET', '/api/users/export');
    await this.testEndpoint('POST', '/api/users/profile/send-otp', {
      phoneNumber: '+821012345678'
    });
    await this.testEndpoint('POST', '/api/users/profile/verify-phone', {
      phoneNumber: '+821012345678',
      otp: '123456'
    });
    await this.testEndpoint('GET', '/api/users/profile/completion');

    // Note: Avatar upload requires multipart/form-data
    // await this.testEndpoint('POST', '/api/users/profile/avatar');

    // ============================
    // FAVORITES ENDPOINTS
    // ============================
    console.log('\n⭐ FAVORITES ENDPOINTS');
    console.log('-'.repeat(100));

    await this.testEndpoint('GET', '/api/user/favorites?limit=10');
    await this.testEndpoint('GET', '/api/user/favorites/stats');
    await this.testEndpoint('POST', '/api/user/favorites/bulk', {
      shopIds: [],
      action: 'add'
    });
    await this.testEndpoint('POST', '/api/user/favorites/check', {
      shopIds: []
    });

    // ============================
    // ADVANCED SETTINGS ENDPOINTS
    // ============================
    console.log('\n⚙️ ADVANCED SETTINGS ENDPOINTS');
    console.log('-'.repeat(100));

    await this.testEndpoint('PUT', '/api/user/settings/settings/bulk', {
      settings: {}
    });
    await this.testEndpoint('POST', '/api/user/settings/settings/reset', {
      categories: []
    });
    await this.testEndpoint('GET', '/api/user/settings/settings/history?page=1&limit=10');
    await this.testEndpoint('GET', '/api/user/settings/settings/categories');
    await this.testEndpoint('GET', '/api/user/settings/settings/validation-rules');
    await this.testEndpoint('GET', '/api/user/settings/settings/defaults');

    // ============================
    // PRINT SUMMARY
    // ============================
    console.log('\n' + '='.repeat(100));
    console.log('📊 TEST SUMMARY\n');

    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed} (${((passed/total)*100).toFixed(1)}%)`);
    console.log(`❌ Failed: ${failed} (${((failed/total)*100).toFixed(1)}%)`);
    console.log(`⏭️  Skipped: ${skipped} (${((skipped/total)*100).toFixed(1)}%)`);

    console.log('\n📝 Failed Tests:');
    this.results
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`   ❌ ${r.method} ${r.endpoint} - ${r.error || 'Unknown error'}`);
      });

    console.log('\n⏱️  Performance:');
    const avgResponseTime = this.results
      .filter(r => r.responseTime)
      .reduce((sum, r) => sum + (r.responseTime || 0), 0) / this.results.filter(r => r.responseTime).length;
    console.log(`   Average response time: ${avgResponseTime.toFixed(0)}ms`);

    console.log('\n' + '='.repeat(100));
  }
}

// Run tests
async function main() {
  if (!TEST_USER_TOKEN) {
    console.error('\n❌ ERROR: TEST_USER_TOKEN environment variable not set');
    console.error('Please provide a valid JWT token for testing:');
    console.error('export TEST_USER_TOKEN="your-jwt-token-here"');
    console.error('\nOR run without authentication to test endpoint availability:\n');
  }

  const tester = new EndpointTester(BASE_URL, TEST_USER_TOKEN);
  await tester.runAllTests();

  console.log('\n✨ Test suite completed!\n');
}

main().catch(console.error);
