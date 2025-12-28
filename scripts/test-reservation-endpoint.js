/**
 * Test reservation endpoint with real Supabase authentication
 */
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey);

const RESERVATION_ID = '6dc455e9-7f9d-49a4-8e38-56b6ee5f70db';

async function testReservationEndpoint() {
  try {
    console.log('🔍 Testing reservation endpoint with real Supabase auth...\n');

    // First check if reservation exists (using service role for DB check)
    console.log('Step 1: Checking if reservation exists in database...');
    const { data: reservations, error: dbError } = await serviceSupabase
      .from('reservations')
      .select('*')
      .eq('id', RESERVATION_ID);

    if (dbError) {
      console.log('❌ Database error:', dbError.message);
      return;
    }

    if (!reservations || reservations.length === 0) {
      console.log('❌ Reservation not found');
      return;
    }

    const reservation = reservations[0];

    console.log('✅ Reservation found in database:');
    console.log('   ID:', reservation.id);
    console.log('   User ID:', reservation.user_id);
    console.log('   Shop ID:', reservation.shop_id);
    console.log('   Status:', reservation.status);
    console.log('   Date:', reservation.reservation_date);
    console.log('   Time:', reservation.reservation_time);

    // Try to sign in as the user who owns this reservation
    console.log('\nStep 2: Authenticating as test user...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'testuser@example.com',
      password: 'TestUser123!'
    });

    if (authError) {
      console.log('❌ Authentication failed:', authError.message);
      console.log('   Trying to check if user exists in auth.users...');

      const { data: authUsers, error: listError } = await serviceSupabase.auth.admin.listUsers();

      if (listError) {
        console.log('❌ Cannot list users:', listError.message);
      } else {
        const testUser = authUsers.users.find(u => u.email === 'testuser@example.com');
        if (testUser) {
          console.log('✅ User exists in auth.users:', testUser.id);
        } else {
          console.log('❌ User NOT found in auth.users');
          console.log('   Available users:', authUsers.users.map(u => u.email).join(', '));
        }
      }
      return;
    }

    console.log('✅ Authentication successful');
    console.log('   User ID:', authData.user.id);
    console.log('   Token type:', authData.session.token_type);

    // Check if the authenticated user matches the reservation owner
    if (authData.user.id !== reservation.user_id) {
      console.log('⚠️  Warning: Authenticated user does NOT match reservation owner');
      console.log('   Expected:', reservation.user_id);
      console.log('   Got:', authData.user.id);
    } else {
      console.log('✅ Authenticated user matches reservation owner');
    }

    // Test the API endpoint with real Supabase token
    console.log('\nStep 3: Testing API endpoint...');
    const apiUrl = `http://localhost:3001/api/reservations/${RESERVATION_ID}`;
    console.log('   URL:', apiUrl);

    try {
      const response = await axios.get(apiUrl, {
        headers: {
          'Authorization': `Bearer ${authData.session.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('✅ API call successful!');
      console.log('   Status:', response.status);
      console.log('   Response:', JSON.stringify(response.data, null, 2));

    } catch (apiError) {
      console.log('❌ API call failed:');
      if (apiError.response) {
        console.log('   Status:', apiError.response.status);
        console.log('   Error:', JSON.stringify(apiError.response.data, null, 2));
      } else {
        console.log('   Error:', apiError.message);
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error.stack);
  }
}

testReservationEndpoint();
