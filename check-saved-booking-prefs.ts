/**
 * Check if booking preferences were saved by the user
 */

import { getSupabaseClient } from './src/config/database';

async function checkBookingPrefs() {
  const supabase = getSupabaseClient();

  // Get user with booking preferences (find by name 'asdfasd' which was just saved)
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, email, booking_preferences')
    .eq('name', 'asdfasd')
    .limit(1);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!users || users.length === 0) {
    console.log('❌ No user found with name "asdfasd"');
    console.log('\nChecking recent users with booking_preferences...');

    const { data: recentUsers, error: recentError } = await supabase
      .from('users')
      .select('id, name, email, booking_preferences, updated_at')
      .not('booking_preferences', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(3);

    if (recentError) {
      console.error('❌ Error:', recentError);
      return;
    }

    console.log('\n📋 Recent users with booking_preferences:');
    recentUsers?.forEach((user, i) => {
      console.log(`\n${i + 1}. User: ${user.name || 'No name'} (${user.email || 'No email'})`);
      console.log('   Updated:', user.updated_at);
      console.log('   Booking Preferences:');
      console.log('   ' + JSON.stringify(user.booking_preferences, null, 2).replace(/\n/g, '\n   '));
    });
    return;
  }

  const user = users[0];
  console.log('✅ Found user!');
  console.log('='.repeat(80));
  console.log('User ID:', user.id);
  console.log('Name:', user.name);
  console.log('Email:', user.email || 'Not set');
  console.log();
  console.log('📋 Booking Preferences (from database):');
  console.log(JSON.stringify(user.booking_preferences, null, 2));
  console.log('='.repeat(80));

  // Verify each field
  const prefs = user.booking_preferences as any;
  console.log('\n✅ Verification:');
  console.log('  - skinType:', prefs?.skin_type || 'NOT SAVED');
  console.log('  - allergyInfo:', prefs?.allergy_info || 'NOT SAVED');
  console.log('  - preferredStylist:', prefs?.preferred_stylist || 'NOT SAVED');
  console.log('  - specialRequests:', prefs?.special_requests || 'NOT SAVED');

  if (prefs?.skin_type === 'dry' &&
      prefs?.allergy_info === 'sadf' &&
      prefs?.preferred_stylist === 'asdf' &&
      prefs?.special_requests === 'dasf') {
    console.log('\n🎉 ALL DATA SAVED CORRECTLY!');
  } else {
    console.log('\n⚠️ Some data may not match');
  }
}

checkBookingPrefs()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
