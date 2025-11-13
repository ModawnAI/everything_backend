/**
 * Run Migration: Add booking_preferences column to users table
 *
 * This script applies the 20251113_add_booking_preferences.sql migration
 * to the Supabase database.
 */

import { getSupabaseClient } from '../src/config/database';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  console.log('🚀 Starting migration: Add booking_preferences column');

  const supabase = getSupabaseClient();

  try {
    // Read the migration SQL file
    const migrationPath = join(__dirname, '../supabase/migrations/20251113_add_booking_preferences.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('📄 Migration SQL loaded from:', migrationPath);
    console.log('\n--- SQL TO EXECUTE ---');
    console.log(migrationSQL);
    console.log('--- END SQL ---\n');

    // Execute the migration
    console.log('⏳ Executing migration...');

    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: migrationSQL
    });

    if (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }

    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Verifying column exists...');

    // Verify the column was created
    const { data: verifyData, error: verifyError } = await supabase
      .from('users')
      .select('id, booking_preferences')
      .limit(1);

    if (verifyError) {
      console.warn('⚠️ Could not verify column (might need to refresh schema cache)');
      console.warn('Error:', verifyError.message);
    } else {
      console.log('✅ Column verified! booking_preferences is now available.');
    }

    console.log('\n✨ Migration complete! You can now:');
    console.log('   1. Restart the backend server');
    console.log('   2. Test profile updates with booking preferences');
    console.log('   3. Use queries like:');
    console.log('      SELECT * FROM users WHERE booking_preferences->>\'skinType\' = \'oily\';');

  } catch (error) {
    console.error('❌ Error running migration:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\n🎉 Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Fatal error:', error);
      process.exit(1);
    });
}

export { runMigration };
