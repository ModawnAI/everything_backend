/**
 * Check if KJ Yoo profile data was saved
 */

import { getSupabaseClient } from './src/config/database';

async function checkUserData() {
  const supabase = getSupabaseClient();

  // Find user by name 'KJ Yoo'
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, email, phone_number, gender, booking_preferences, updated_at')
    .eq('name', 'KJ Yoo')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!users || users.length === 0) {
    console.log('❌ No user found with name "KJ Yoo"');

    // Try finding by email
    const { data: emailUsers, error: emailError } = await supabase
      .from('users')
      .select('id, name, email, phone_number, gender, booking_preferences, updated_at')
      .eq('email', 'info@e-beautything.com')
      .limit(1);

    if (emailError) {
      console.error('❌ Error:', emailError);
      return;
    }

    if (!emailUsers || emailUsers.length === 0) {
      console.log('❌ No user found with email "info@e-beautything.com"');
      return;
    }

    console.log('✅ Found user by email!');
    console.log('='.repeat(80));
    const user = emailUsers[0];
    console.log('User ID:', user.id);
    console.log('Name:', user.name);
    console.log('Email:', user.email);
    console.log('Phone:', user.phone_number);
    console.log('Gender:', user.gender);
    console.log('Updated:', user.updated_at);
    console.log();
    console.log('📋 Booking Preferences (from database):');
    console.log(JSON.stringify(user.booking_preferences, null, 2));
    console.log('='.repeat(80));

    const prefs = user.booking_preferences as any;
    console.log();
    console.log('✅ Verification:');
    console.log('  - name:', user.name === 'KJ Yoo' ? '✅ SAVED' : '❌ NOT SAVED');
    console.log('  - email:', user.email === 'info@e-beautything.com' ? '✅ SAVED' : '❌ NOT SAVED');
    console.log('  - phone:', user.phone_number === '01099343991' ? '✅ SAVED' : '❌ NOT SAVED');
    console.log('  - gender:', user.gender === 'male' ? '✅ SAVED' : '❌ NOT SAVED');
    console.log();
    console.log('  Booking Preferences:');
    console.log('  - skin_type:', prefs?.skin_type === 'dry' ? '✅ SAVED (snake_case)' : prefs?.skinType === 'dry' ? '⚠️ SAVED (camelCase)' : '❌ NOT SAVED');
    console.log('  - allergy_info:', prefs?.allergy_info === 'asdf' ? '✅ SAVED (snake_case)' : prefs?.allergyInfo === 'asdf' ? '⚠️ SAVED (camelCase)' : '❌ NOT SAVED');
    console.log('  - preferred_stylist:', prefs?.preferred_stylist === 'asdf' ? '✅ SAVED (snake_case)' : prefs?.preferredStylist === 'asdf' ? '⚠️ SAVED (camelCase)' : '❌ NOT SAVED');
    console.log('  - special_requests:', prefs?.special_requests === 'asdf' ? '✅ SAVED (snake_case)' : prefs?.specialRequests === 'asdf' ? '⚠️ SAVED (camelCase)' : '❌ NOT SAVED');

    return;
  }

  const user = users[0];
  console.log('✅ Found user!');
  console.log('='.repeat(80));
  console.log('User ID:', user.id);
  console.log('Name:', user.name);
  console.log('Email:', user.email);
  console.log('Phone:', user.phone_number);
  console.log('Gender:', user.gender);
  console.log('Updated:', user.updated_at);
  console.log();
  console.log('📋 Booking Preferences (from database):');
  console.log(JSON.stringify(user.booking_preferences, null, 2));
  console.log('='.repeat(80));

  const prefs = user.booking_preferences as any;
  console.log();
  console.log('✅ Verification:');
  console.log('  - name:', user.name === 'KJ Yoo' ? '✅ SAVED' : `❌ NOT SAVED (got: ${user.name})`);
  console.log('  - email:', user.email === 'info@e-beautything.com' ? '✅ SAVED' : `⚠️ Different (got: ${user.email})`);
  console.log('  - phone:', user.phone_number === '01099343991' ? '✅ SAVED' : `⚠️ Different (got: ${user.phone_number})`);
  console.log('  - gender:', user.gender === 'male' ? '✅ SAVED' : `⚠️ Different (got: ${user.gender})`);
  console.log();
  console.log('  Booking Preferences:');
  console.log('  - skin_type:', prefs?.skin_type === 'dry' ? '✅ SAVED (snake_case)' : prefs?.skinType === 'dry' ? '⚠️ SAVED (camelCase)' : '❌ NOT SAVED');
  console.log('  - allergy_info:', prefs?.allergy_info === 'asdf' ? '✅ SAVED (snake_case)' : prefs?.allergyInfo === 'asdf' ? '⚠️ SAVED (camelCase)' : '❌ NOT SAVED');
  console.log('  - preferred_stylist:', prefs?.preferred_stylist === 'asdf' ? '✅ SAVED (snake_case)' : prefs?.preferredStylist === 'asdf' ? '⚠️ SAVED (camelCase)' : '❌ NOT SAVED');
  console.log('  - special_requests:', prefs?.special_requests === 'asdf' ? '✅ SAVED (snake_case)' : prefs?.specialRequests === 'asdf' ? '⚠️ SAVED (camelCase)' : '❌ NOT SAVED');
}

checkUserData()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
