#!/usr/bin/env node

/**
 * Database Performance Migration Runner (Simple Version)
 * 
 * This script applies the database performance optimization migration
 * using direct SQL execution through Supabase client.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runPerformanceMigration() {
  try {
    console.log('🚀 Starting Database Performance Optimization Migration...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'src', 'migrations', '068_database_performance_optimization.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully');
    console.log(`📏 Migration size: ${(migrationSQL.length / 1024).toFixed(2)} KB\n`);

    // Split migration into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`🔧 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.trim().length === 0) continue;

      try {
        console.log(`📝 Executing statement ${i + 1}/${statements.length}...`);
        
        // Execute each statement individually
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
        
        if (error) {
          console.warn(`⚠️  Statement ${i + 1} failed:`, error.message);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.warn(`⚠️  Statement ${i + 1} failed:`, err.message);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successful statements: ${successCount}`);
    console.log(`❌ Failed statements: ${errorCount}`);

    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
    } else if (successCount > 0) {
      console.log('\n⚠️  Migration completed with some warnings. Check the output above for details.');
    } else {
      console.log('\n❌ Migration failed. Please check the errors above.');
      process.exit(1);
    }

    // Run VACUUM ANALYZE to update statistics
    console.log('\n🧹 Updating database statistics...');
    try {
      const { error: vacuumError } = await supabase.rpc('exec_sql', { 
        sql: 'VACUUM ANALYZE;' 
      });
      if (vacuumError) {
        console.warn('⚠️  VACUUM ANALYZE failed:', vacuumError.message);
      } else {
        console.log('✅ Database statistics updated');
      }
    } catch (err) {
      console.warn('⚠️  VACUUM ANALYZE failed:', err.message);
    }

    console.log('\n🔍 Running validation queries...\n');

    // Check if indexes were created
    try {
      const { data: indexes, error: indexError } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT 
            schemaname, 
            tablename, 
            indexname
          FROM pg_indexes 
          WHERE indexname LIKE 'idx_%_admin_id' 
             OR indexname LIKE 'idx_%_created_by'
             OR indexname LIKE 'idx_%_reviewed_by'
             OR indexname LIKE 'idx_%_reporter_id'
          ORDER BY tablename, indexname;
        `
      });

      if (indexError) {
        console.warn('⚠️  Could not validate indexes:', indexError.message);
      } else {
        console.log('📊 Foreign key indexes created:');
        if (indexes && indexes.length > 0) {
          indexes.forEach(idx => {
            console.log(`   ✅ ${idx.tablename}.${idx.indexname}`);
          });
        } else {
          console.log('   ⚠️  No foreign key indexes found');
        }
      }
    } catch (err) {
      console.warn('⚠️  Could not validate indexes:', err.message);
    }

    console.log('\n🎯 Migration completed! Check your database for performance improvements.');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check that SUPABASE_SERVICE_ROLE_KEY has sufficient permissions');
    console.error('   2. Ensure the database is not under heavy load');
    console.error('   3. Verify the migration SQL syntax is correct');
    console.error('   4. Check Supabase logs for detailed error information');
    process.exit(1);
  }
}

// Run the migration
runPerformanceMigration();
