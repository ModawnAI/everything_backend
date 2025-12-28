/**
 * Run Booking Preferences Migrations
 * This script adds booking_preferences columns to users and reservations tables
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigrations() {
  console.log('🚀 Starting booking_preferences migrations...\n');

  try {
    // Migration 1: Add booking_preferences to users table
    console.log('📝 Migration 1: Adding booking_preferences column to users table...');

    const migration1 = `
      -- Add booking_preferences column to users table
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS booking_preferences JSONB DEFAULT '{}'::jsonb;

      -- Add comment
      COMMENT ON COLUMN users.booking_preferences IS 'User booking preferences stored as JSONB. Structure: {
        "skinType": "normal" | "dry" | "oily" | "combination" | "sensitive",
        "allergyInfo": "string describing allergies",
        "preferredStylist": "string with stylist preference",
        "specialRequests": "string with special requests"
      }';

      -- Create index
      CREATE INDEX IF NOT EXISTS idx_users_booking_preferences_gin
      ON users USING gin (booking_preferences);
    `;

    const { error: error1 } = await supabase.rpc('exec_sql', { sql_query: migration1 });

    if (error1) {
      console.error('❌ Migration 1 failed:', error1.message);
      console.log('\n⚠️  Trying alternative method...\n');

      // Alternative: Use direct SQL queries
      const queries1 = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_preferences JSONB DEFAULT '{}'::jsonb",
        "CREATE INDEX IF NOT EXISTS idx_users_booking_preferences_gin ON users USING gin (booking_preferences)"
      ];

      for (const query of queries1) {
        const { error } = await supabase.rpc('exec_sql', { sql_query: query });
        if (error) {
          console.error(`❌ Query failed: ${query}`);
          console.error(`   Error: ${error.message}`);
        } else {
          console.log(`✅ Success: ${query}`);
        }
      }
    } else {
      console.log('✅ Migration 1 completed successfully!');
    }

    console.log('');

    // Migration 2: Add booking_preferences to reservations table
    console.log('📝 Migration 2: Adding booking_preferences column to reservations table...');

    const migration2 = `
      -- Add booking_preferences column to reservations table
      ALTER TABLE reservations
      ADD COLUMN IF NOT EXISTS booking_preferences JSONB DEFAULT '{}'::jsonb;

      -- Add comment
      COMMENT ON COLUMN reservations.booking_preferences IS 'Snapshot of user booking preferences at time of reservation. Structure: {
        "skinType": "normal" | "dry" | "oily" | "combination" | "sensitive",
        "allergyInfo": "string describing allergies",
        "preferredStylist": "string with stylist preference",
        "specialRequests": "string with special requests"
      }. This preserves the preferences even if user changes their profile later.';

      -- Create index
      CREATE INDEX IF NOT EXISTS idx_reservations_booking_preferences_gin
      ON reservations USING gin (booking_preferences);
    `;

    const { error: error2 } = await supabase.rpc('exec_sql', { sql_query: migration2 });

    if (error2) {
      console.error('❌ Migration 2 failed:', error2.message);
      console.log('\n⚠️  Trying alternative method...\n');

      // Alternative: Use direct SQL queries
      const queries2 = [
        "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS booking_preferences JSONB DEFAULT '{}'::jsonb",
        "CREATE INDEX IF NOT EXISTS idx_reservations_booking_preferences_gin ON reservations USING gin (booking_preferences)"
      ];

      for (const query of queries2) {
        const { error } = await supabase.rpc('exec_sql', { sql_query: query });
        if (error) {
          console.error(`❌ Query failed: ${query}`);
          console.error(`   Error: ${error.message}`);
        } else {
          console.log(`✅ Success: ${query}`);
        }
      }
    } else {
      console.log('✅ Migration 2 completed successfully!');
    }

    console.log('');

    // Verify columns were created
    console.log('🔍 Verifying columns...');

    const { data: usersCheck, error: usersError } = await supabase
      .from('users')
      .select('id, booking_preferences')
      .limit(1);

    if (usersError) {
      console.error('❌ Users table verification failed:', usersError.message);
      console.log('\n⚠️  The booking_preferences column may not exist in users table.');
      console.log('   Please run the migration manually in Supabase Dashboard.\n');
    } else {
      console.log('✅ Users table has booking_preferences column');
    }

    const { data: reservationsCheck, error: reservationsError } = await supabase
      .from('reservations')
      .select('id, booking_preferences')
      .limit(1);

    if (reservationsError) {
      console.error('❌ Reservations table verification failed:', reservationsError.message);
      console.log('\n⚠️  The booking_preferences column may not exist in reservations table.');
      console.log('   Please run the migration manually in Supabase Dashboard.\n');
    } else {
      console.log('✅ Reservations table has booking_preferences column');
    }

    console.log('\n✨ Migrations complete!');
    console.log('\n📋 Next steps:');
    console.log('   1. Restart the backend server');
    console.log('   2. Try profile update again');
    console.log('   3. Test reservation creation\n');

  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    console.log('\n⚠️  MANUAL MIGRATION REQUIRED:');
    console.log('   1. Go to https://app.supabase.com');
    console.log('   2. Open SQL Editor');
    console.log('   3. Run the SQL from: supabase/migrations/20251113_add_booking_preferences.sql');
    console.log('   4. Run the SQL from: supabase/migrations/20251113_add_booking_preferences_to_reservations.sql\n');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('🎉 Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Error:', error);
      process.exit(1);
    });
}

export { runMigrations };
