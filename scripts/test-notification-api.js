/**
 * Test notification API endpoints with real Supabase authentication
 */
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

async function testNotificationAPI() {
  console.log('🔍 Testing Notification API with Supabase Auth\n');

  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Step 1: Login as test user
  console.log('Step 1: Logging in as testuser@example.com...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'testuser@example.com',
    password: 'TestUser123!'
  });

  if (authError) {
    console.log('❌ Login failed:', authError.message);
    return;
  }

  console.log('✅ Login successful');
  console.log('   User ID:', authData.user.id);
  console.log('   Access Token:', authData.session.access_token.substring(0, 50) + '...');
  console.log('');

  // Step 2: Test notification list endpoint
  console.log('Step 2: Testing GET /api/user/notifications...');
  try {
    const response1 = await axios.get(
      'http://localhost:3001/api/user/notifications?page=1&limit=10&unreadOnly=false',
      {
        headers: {
          'Authorization': `Bearer ${authData.session.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Notification list endpoint works!');
    console.log('   Status:', response1.status);
    console.log('   Total notifications:', response1.data.data?.length || 0);
    console.log('   Response preview:', JSON.stringify(response1.data, null, 2).substring(0, 500));
  } catch (error) {
    console.log('❌ Notification list failed:');
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('   Error:', error.message);
    }
  }
  console.log('');

  // Step 3: Test notification preferences endpoint
  console.log('Step 3: Testing GET /api/notifications/preferences...');
  try {
    const response2 = await axios.get(
      'http://localhost:3001/api/notifications/preferences',
      {
        headers: {
          'Authorization': `Bearer ${authData.session.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Notification preferences endpoint works!');
    console.log('   Status:', response2.status);
    console.log('   Response:', JSON.stringify(response2.data, null, 2));
  } catch (error) {
    console.log('❌ Notification preferences failed:');
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Error:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('   Error:', error.message);
    }
  }
  console.log('');

  // Step 4: Print implementation guide
  console.log('='.repeat(70));
  console.log('FRONTEND IMPLEMENTATION GUIDE');
  console.log('='.repeat(70));
  console.log('');
  console.log('The access token to use:');
  console.log(authData.session.access_token);
  console.log('');
  console.log('Test the endpoints manually:');
  console.log('');
  console.log('1. Notification List:');
  console.log('   curl -H "Authorization: Bearer <token>" \\');
  console.log('     "http://localhost:3001/api/user/notifications?page=1&limit=10&unreadOnly=false"');
  console.log('');
  console.log('2. Notification Preferences:');
  console.log('   curl -H "Authorization: Bearer <token>" \\');
  console.log('     "http://localhost:3001/api/notifications/preferences"');
}

testNotificationAPI().catch(console.error);
