/**
 * Script to run migration 076: Double Booking Prevention
 *
 * This script reads the SQL migration file and executes it against Supabase
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🔧 Running Migration 076: Double Booking Prevention\n');

  // Read the migration file
  const migrationPath = path.join(__dirname, '../src/migrations/076_add_reservation_double_booking_prevention.sql');

  try {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📂 Migration file loaded successfully');
    console.log(`📏 SQL file size: ${(sql.length / 1024).toFixed(2)} KB\n`);

    // Split SQL into individual statements (basic splitting)
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments
      if (statement.startsWith('COMMENT ON')) {
        console.log(`⏩ [${i + 1}/${statements.length}] Skipping comment statement`);
        continue;
      }

      // Extract operation type for logging
      const operationType = statement.split(' ')[0].toUpperCase();

      console.log(`⚙️  [${i + 1}/${statements.length}] Executing: ${operationType}...`);

      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });

        if (error) {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message);
          errorCount++;

          // Don't stop on non-critical errors (like "already exists")
          if (!error.message.includes('already exists') &&
              !error.message.includes('does not exist') &&
              !error.message.includes('duplicate')) {
            console.error('Full error details:', error);
            throw error;
          } else {
            console.log(`⚠️  Non-critical error (likely object already exists), continuing...`);
          }
        } else {
          console.log(`✅ [${i + 1}/${statements.length}] Success`);
          successCount++;
        }
      } catch (error) {
        console.error(`❌ Fatal error executing statement ${i + 1}:`, error.message);
        errorCount++;
        throw error;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📝 Total: ${statements.length}`);
    console.log('='.repeat(60) + '\n');

    if (errorCount === 0) {
      console.log('✨ Migration 076 completed successfully!\n');

      console.log('📋 Next steps:');
      console.log('1. Verify indexes: Check that idx_reservations_no_double_booking exists');
      console.log('2. Test trigger: Try creating duplicate reservations');
      console.log('3. Monitor: Query v_reservation_conflicts view (should be empty)');
      console.log('\nTo verify:');
      console.log('  SELECT * FROM v_reservation_conflicts;  -- Should return 0 rows\n');
    } else {
      console.log('⚠️  Migration completed with some errors. Please review the output above.\n');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Alternative: Direct SQL execution if RPC doesn't work
async function runMigrationDirect() {
  console.log('🔧 Running Migration 076: Double Booking Prevention (Direct SQL)\n');

  const migrationPath = path.join(__dirname, '../src/migrations/076_add_reservation_double_booking_prevention.sql');

  try {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📂 Migration file loaded successfully');
    console.log(`📏 SQL file size: ${(sql.length / 1024).toFixed(2)} KB\n`);

    // Execute the entire SQL file as one query
    const { data, error } = await supabase.rpc('exec', { sql });

    if (error) {
      console.error('❌ Migration failed:', error.message);
      console.error('Error details:', error);
      throw error;
    }

    console.log('✅ Migration completed successfully!');
    console.log('Result:', data);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);

    console.log('\n⚠️  Alternative approach: You can run the migration manually:');
    console.log('1. Copy the contents of src/migrations/076_add_reservation_double_booking_prevention.sql');
    console.log('2. Go to your Supabase dashboard > SQL Editor');
    console.log('3. Paste the SQL and run it');

    process.exit(1);
  }
}

// Run the migration
console.log('🚀 Starting migration process...\n');

runMigrationDirect()
  .then(() => {
    console.log('✨ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration process failed:', error);
    process.exit(1);
  });
