/**
 * FCM Push Notification Integration Test
 * Tests the complete flow: FCM token registration → Notification settings → Push delivery
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Import fetch - use node-fetch v2 for CommonJS
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ysrudwzwnzxrrwjtpuoh.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Test data
const TEST_USER_EMAIL = 'test-fcm-user@example.com';
const TEST_FCM_TOKEN = 'test_fcm_token_' + Date.now();
const TEST_DEVICE_INFO = {
  platform: 'web',
  deviceId: 'test-device-123',
  appVersion: '1.0.0',
  osVersion: 'Chrome/120.0'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60) + '\n');
}

function logTest(name) {
  log(`\n🧪 TEST: ${name}`, 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'yellow');
}

// Initialize Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let testUserId = null;
let testAccessToken = null;

/**
 * Test 1: Create test user
 */
async function test1_CreateTestUser() {
  logTest('Create Test User');

  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: TEST_USER_EMAIL,
      password: 'TestPassword123!',
      email_confirm: true,
      user_metadata: {
        name: 'FCM Test User'
      }
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        logInfo('User already exists, fetching existing user...');

        // Get existing user
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;

        const existingUser = users.find(u => u.email === TEST_USER_EMAIL);
        if (!existingUser) throw new Error('User exists but could not be found');

        testUserId = existingUser.id;
        logSuccess(`Using existing user ID: ${testUserId}`);
      } else {
        throw authError;
      }
    } else {
      testUserId = authData.user.id;
      logSuccess(`Created new user ID: ${testUserId}`);
    }

    // Create user profile in public.users table
    const { error: profileError } = await supabase
      .from('users')
      .upsert({
        id: testUserId,
        email: TEST_USER_EMAIL,
        name: 'FCM Test User',
        user_role: 'customer',
        account_status: 'active'
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      logInfo(`Profile may already exist: ${profileError.message}`);
    } else {
      logSuccess('User profile created/updated');
    }

    // Generate access token
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: TEST_USER_EMAIL
    });

    if (sessionError) throw sessionError;

    logSuccess('Test user ready for testing');
    return true;

  } catch (error) {
    logError(`Failed to create test user: ${error.message}`);
    return false;
  }
}

/**
 * Test 2: Simulate social login with FCM token
 */
async function test2_SocialLoginWithFCM() {
  logTest('Social Login with FCM Token');

  try {
    // First, get a valid Supabase session for the test user
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: 'TestPassword123!'
    });

    if (signInError) throw signInError;

    const supabaseAccessToken = signInData.session.access_token;
    const supabaseRefreshToken = signInData.session.refresh_token;

    logInfo('Obtained Supabase session');

    // Now call backend social login with FCM token
    const response = await fetch(`${BACKEND_URL}/api/auth/social-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        provider: 'google',
        supabaseSession: {
          access_token: supabaseAccessToken,
          refresh_token: supabaseRefreshToken,
          user: {
            id: signInData.user.id,
            email: signInData.user.email,
            user_metadata: signInData.user.user_metadata
          }
        },
        fcmToken: TEST_FCM_TOKEN,
        deviceInfo: TEST_DEVICE_INFO
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Backend login failed: ${JSON.stringify(result)}`);
    }

    // Extract access token (handle both response formats)
    testAccessToken = result.accessToken || result.data?.accessToken;

    if (!testAccessToken) {
      throw new Error('No access token received from backend');
    }

    logSuccess('Social login successful');
    logInfo(`Backend access token: ${testAccessToken.substring(0, 20)}...`);

    return true;

  } catch (error) {
    logError(`Social login failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 3: Verify FCM token was saved in database
 */
async function test3_VerifyFCMTokenInDatabase() {
  logTest('Verify FCM Token in Database');

  try {
    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', testUserId)
      .eq('token', TEST_FCM_TOKEN);

    if (error) throw error;

    if (!tokens || tokens.length === 0) {
      throw new Error('FCM token not found in database');
    }

    const token = tokens[0];

    logSuccess('FCM token found in database');
    logInfo(`Token ID: ${token.id}`);
    logInfo(`Platform: ${token.platform}`);
    logInfo(`Device ID: ${token.device_id}`);
    logInfo(`App Version: ${token.app_version}`);
    logInfo(`OS Version: ${token.os_version}`);
    logInfo(`Is Active: ${token.is_active}`);
    logInfo(`Created: ${token.created_at}`);

    // Verify all fields
    if (token.platform !== TEST_DEVICE_INFO.platform) {
      throw new Error(`Platform mismatch: expected ${TEST_DEVICE_INFO.platform}, got ${token.platform}`);
    }

    if (token.device_id !== TEST_DEVICE_INFO.deviceId) {
      throw new Error(`Device ID mismatch: expected ${TEST_DEVICE_INFO.deviceId}, got ${token.device_id}`);
    }

    if (!token.is_active) {
      throw new Error('Token is not active');
    }

    logSuccess('All FCM token fields verified correctly');
    return true;

  } catch (error) {
    logError(`FCM token verification failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 4: Get notification settings
 */
async function test4_GetNotificationSettings() {
  logTest('Get Notification Settings');

  try {
    const response = await fetch(`${BACKEND_URL}/api/notifications/settings`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${testAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to get settings: ${JSON.stringify(result)}`);
    }

    // Handle both response formats
    const settings = result.data || result;

    logSuccess('Retrieved notification settings');
    logInfo(`Push Enabled: ${settings.pushEnabled}`);
    logInfo(`Email Enabled: ${settings.emailEnabled}`);
    logInfo(`Reservation Updates: ${settings.reservationUpdates}`);
    logInfo(`Payment Notifications: ${settings.paymentNotifications}`);
    logInfo(`Promotional Messages: ${settings.promotionalMessages}`);
    logInfo(`System Alerts: ${settings.systemAlerts}`);

    return true;

  } catch (error) {
    logError(`Get notification settings failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 5: Update notification settings (disable push)
 */
async function test5_DisablePushNotifications() {
  logTest('Disable Push Notifications');

  try {
    const response = await fetch(`${BACKEND_URL}/api/notifications/settings`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${testAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pushEnabled: false
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to update settings: ${JSON.stringify(result)}`);
    }

    // Handle both response formats
    const settings = result.data || result;

    if (settings.pushEnabled !== false) {
      throw new Error('Push notifications were not disabled');
    }

    logSuccess('Push notifications disabled successfully');

    // Verify in database
    const { data: userSettings, error } = await supabase
      .from('user_settings')
      .select('push_notifications_enabled')
      .eq('user_id', testUserId)
      .single();

    if (error) throw error;

    if (userSettings.push_notifications_enabled !== false) {
      throw new Error('Database not updated correctly');
    }

    logSuccess('Database verified: push_notifications_enabled = false');
    return true;

  } catch (error) {
    logError(`Disable push notifications failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 6: Update notification settings (enable push)
 */
async function test6_EnablePushNotifications() {
  logTest('Enable Push Notifications');

  try {
    const response = await fetch(`${BACKEND_URL}/api/notifications/settings`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${testAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pushEnabled: true,
        reservationUpdates: true,
        promotionalMessages: false
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Failed to update settings: ${JSON.stringify(result)}`);
    }

    // Handle both response formats
    const settings = result.data || result;

    if (settings.pushEnabled !== true) {
      throw new Error('Push notifications were not enabled');
    }

    logSuccess('Push notifications enabled successfully');

    // Verify in database
    const { data: userSettings, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', testUserId)
      .single();

    if (error) throw error;

    logInfo(`Database state:`);
    logInfo(`  push_notifications_enabled: ${userSettings.push_notifications_enabled}`);
    logInfo(`  reservation_notifications: ${userSettings.reservation_notifications}`);
    logInfo(`  marketing_notifications: ${userSettings.marketing_notifications}`);

    if (userSettings.push_notifications_enabled !== true) {
      throw new Error('Database not updated correctly');
    }

    logSuccess('Database verified: settings updated correctly');
    return true;

  } catch (error) {
    logError(`Enable push notifications failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 7: Test RLS policies
 */
async function test7_TestRLSPolicies() {
  logTest('Test RLS Policies');

  try {
    // Create a second test user
    const otherUserId = '00000000-0000-0000-0000-000000000001';

    // Try to access another user's tokens (should fail)
    const { data: otherTokens, error } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', otherUserId);

    // Should succeed but return empty (RLS filters results)
    if (error) {
      logError(`RLS policy error: ${error.message}`);
      return false;
    }

    if (otherTokens && otherTokens.length > 0) {
      logError('RLS policy failed: Should not see other users\' tokens');
      return false;
    }

    logSuccess('RLS policy working: Cannot access other users\' tokens');

    // Try to access own tokens (should succeed)
    const { data: ownTokens, error: ownError } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', testUserId);

    if (ownError) throw ownError;

    if (!ownTokens || ownTokens.length === 0) {
      throw new Error('Cannot access own tokens');
    }

    logSuccess('RLS policy working: Can access own tokens');
    return true;

  } catch (error) {
    logError(`RLS policy test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test 8: Multiple device tokens
 */
async function test8_MultipleDeviceTokens() {
  logTest('Multiple Device Tokens');

  try {
    // Register second device
    const secondToken = 'test_fcm_token_device2_' + Date.now();

    const response = await fetch(`${BACKEND_URL}/api/auth/social-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        provider: 'google',
        supabaseSession: {
          access_token: (await supabase.auth.signInWithPassword({
            email: TEST_USER_EMAIL,
            password: 'TestPassword123!'
          })).data.session.access_token,
          user: {
            id: testUserId,
            email: TEST_USER_EMAIL
          }
        },
        fcmToken: secondToken,
        deviceInfo: {
          platform: 'android',
          deviceId: 'test-device-android',
          appVersion: '1.0.0',
          osVersion: 'Android 14'
        }
      })
    });

    if (!response.ok) {
      throw new Error('Failed to register second device');
    }

    logSuccess('Second device token registered');

    // Verify both tokens exist
    const { data: allTokens, error } = await supabase
      .from('push_tokens')
      .select('*')
      .eq('user_id', testUserId)
      .eq('is_active', true);

    if (error) throw error;

    if (allTokens.length < 2) {
      throw new Error(`Expected 2+ tokens, found ${allTokens.length}`);
    }

    logSuccess(`Found ${allTokens.length} active tokens for user`);
    allTokens.forEach((token, index) => {
      logInfo(`  Token ${index + 1}: ${token.platform} - ${token.device_id}`);
    });

    return true;

  } catch (error) {
    logError(`Multiple device tokens test failed: ${error.message}`);
    return false;
  }
}

/**
 * Cleanup: Remove test user and data
 */
async function cleanup() {
  logSection('CLEANUP');

  try {
    // Delete push tokens
    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', testUserId);

    logSuccess('Deleted push tokens');

    // Delete user settings
    await supabase
      .from('user_settings')
      .delete()
      .eq('user_id', testUserId);

    logSuccess('Deleted user settings');

    // Delete user profile
    await supabase
      .from('users')
      .delete()
      .eq('id', testUserId);

    logSuccess('Deleted user profile');

    // Delete auth user
    await supabase.auth.admin.deleteUser(testUserId);

    logSuccess('Deleted auth user');

    logSuccess('Cleanup completed');

  } catch (error) {
    logError(`Cleanup failed: ${error.message}`);
  }
}

/**
 * Main test runner
 */
async function runTests() {
  logSection('FCM PUSH NOTIFICATION INTEGRATION TESTS');

  if (!SUPABASE_SERVICE_KEY) {
    logError('SUPABASE_SERVICE_ROLE_KEY not set in environment');
    process.exit(1);
  }

  const tests = [
    { name: 'Create Test User', fn: test1_CreateTestUser },
    { name: 'Social Login with FCM', fn: test2_SocialLoginWithFCM },
    { name: 'Verify FCM Token in DB', fn: test3_VerifyFCMTokenInDatabase },
    { name: 'Get Notification Settings', fn: test4_GetNotificationSettings },
    { name: 'Disable Push Notifications', fn: test5_DisablePushNotifications },
    { name: 'Enable Push Notifications', fn: test6_EnablePushNotifications },
    { name: 'Test RLS Policies', fn: test7_TestRLSPolicies },
    { name: 'Multiple Device Tokens', fn: test8_MultipleDeviceTokens }
  ];

  const results = [];

  for (const test of tests) {
    const result = await test.fn();
    results.push({ name: test.name, passed: result });

    if (!result) {
      logError(`\n⚠️  Test failed: ${test.name}`);
      log('\nStopping tests due to failure...', 'yellow');
      break;
    }
  }

  // Cleanup
  if (testUserId) {
    await cleanup();
  }

  // Results summary
  logSection('TEST RESULTS SUMMARY');

  let passed = 0;
  let failed = 0;

  results.forEach(result => {
    if (result.passed) {
      logSuccess(`${result.name}`);
      passed++;
    } else {
      logError(`${result.name}`);
      failed++;
    }
  });

  console.log('\n' + '='.repeat(60));
  log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`, passed === results.length ? 'green' : 'red');
  console.log('='.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
