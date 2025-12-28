/**
 * Check if booking_preferences column exists in users table
 */

import { getSupabaseClient } from './src/config/database';

async function checkBookingPreferencesColumn() {
  console.log('='.repeat(80));
  console.log('🔍 Checking booking_preferences Column');
  console.log('='.repeat(80));
  console.log();

  const supabase = getSupabaseClient();

  try {
    // Check if column exists
    const { data: columns, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'users')
      .eq('column_name', 'booking_preferences');

    if (columnError) {
      console.error('❌ Error querying schema:', columnError);

      // Try alternative method using raw query
      console.log('\nTrying alternative query method...');

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, booking_preferences')
        .limit(1);

      if (userError) {
        if (userError.message.includes('booking_preferences')) {
          console.log('❌ COLUMN DOES NOT EXIST!');
          console.log('Error:', userError.message);
          return { exists: false, error: userError.message };
        }
        console.error('Error:', userError);
        return { exists: false, error: userError.message };
      }

      console.log('✅ Column exists (verified by successful query)');
      console.log('Sample data:', JSON.stringify(userData, null, 2));
      return { exists: true };
    }

    if (!columns || columns.length === 0) {
      console.log('❌ COLUMN DOES NOT EXIST!');
      console.log('booking_preferences column not found in users table');
      return { exists: false };
    }

    console.log('✅ COLUMN EXISTS!');
    console.log('Column details:');
    console.log(JSON.stringify(columns[0], null, 2));
    console.log();

    // Try to query some actual data
    console.log('Checking sample user data...');
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, booking_preferences')
      .not('booking_preferences', 'is', null)
      .limit(3);

    if (usersError) {
      console.error('Error fetching users:', usersError);
    } else {
      console.log(`Found ${users.length} users with booking_preferences set`);
      if (users.length > 0) {
        console.log('Sample:');
        users.forEach((user, i) => {
          console.log(`${i + 1}. User ${user.id}:`);
          console.log('   booking_preferences:', JSON.stringify(user.booking_preferences, null, 2));
        });
      }
    }

    return { exists: true, details: columns[0] };

  } catch (error) {
    console.error('❌ Fatal error:', error);
    if (error instanceof Error) {
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
    }
    return { exists: false, error: String(error) };
  }
}

checkBookingPreferencesColumn()
  .then(result => {
    console.log('\n' + '='.repeat(80));
    if (result.exists) {
      console.log('✅ RESULT: booking_preferences column EXISTS');
      console.log('Backend can save and retrieve booking preferences');
    } else {
      console.log('❌ RESULT: booking_preferences column DOES NOT EXIST');
      console.log('Need to add column to database!');
      console.log('\nRun this SQL migration:');
      console.log(`
ALTER TABLE users
ADD COLUMN IF NOT EXISTS booking_preferences JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN users.booking_preferences IS
  'User booking preferences: skin type, allergies, preferred stylist, special requests';

CREATE INDEX IF NOT EXISTS idx_users_booking_preferences
ON users USING gin (booking_preferences);
      `);
    }
    console.log('='.repeat(80));
    process.exit(result.exists ? 0 : 1);
  })
  .catch(error => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
