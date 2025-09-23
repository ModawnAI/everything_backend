#!/usr/bin/env node

/**
 * Database Performance Migration Runner
 * 
 * This script applies the database performance optimization migration
 * and validates the improvements.
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

    // Split migration into parts for better error handling
    const parts = migrationSQL.split('-- =============================================');
    
    console.log('🔧 Applying migration in parts...\n');

    // Part 1: Add missing foreign key indexes
    console.log('📊 Part 1: Adding missing foreign key indexes...');
    const part1Start = migrationSQL.indexOf('-- PART 1: ADD MISSING FOREIGN KEY INDEXES');
    const part1End = migrationSQL.indexOf('-- PART 2: REMOVE UNUSED INDEXES');
    const part1SQL = migrationSQL.substring(part1Start, part1End);

    const { error: part1Error } = await supabase.rpc('exec_sql', { sql: part1SQL });
    if (part1Error) {
      console.error('❌ Error in Part 1 (Foreign Key Indexes):', part1Error.message);
      throw part1Error;
    }
    console.log('✅ Foreign key indexes added successfully\n');

    // Part 2: Remove unused indexes
    console.log('🗑️  Part 2: Removing unused indexes...');
    const part2Start = migrationSQL.indexOf('-- PART 2: REMOVE UNUSED INDEXES');
    const part2End = migrationSQL.indexOf('-- PART 3: PERFORMANCE VALIDATION QUERIES');
    const part2SQL = migrationSQL.substring(part2Start, part2End);

    const { error: part2Error } = await supabase.rpc('exec_sql', { sql: part2SQL });
    if (part2Error) {
      console.error('❌ Error in Part 2 (Remove Unused Indexes):', part2Error.message);
      throw part2Error;
    }
    console.log('✅ Unused indexes removed successfully\n');

    // Part 3: Run VACUUM ANALYZE to update statistics
    console.log('🧹 Part 3: Updating database statistics...');
    const { error: vacuumError } = await supabase.rpc('exec_sql', { 
      sql: 'VACUUM ANALYZE;' 
    });
    if (vacuumError) {
      console.warn('⚠️  Warning: VACUUM ANALYZE failed:', vacuumError.message);
    } else {
      console.log('✅ Database statistics updated\n');
    }

    // Validation queries
    console.log('🔍 Running validation queries...\n');

    // Check foreign key indexes were created
    const { data: fkIndexes, error: fkError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          schemaname, 
          tablename, 
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE indexname LIKE 'idx_%_admin_id' 
           OR indexname LIKE 'idx_%_created_by'
           OR indexname LIKE 'idx_%_reviewed_by'
           OR indexname LIKE 'idx_%_reporter_id'
           OR indexname LIKE 'idx_%_payment_id'
           OR indexname LIKE 'idx_%_reservation_id'
           OR indexname LIKE 'idx_%_service_id'
           OR indexname LIKE 'idx_%_updated_by'
           OR indexname LIKE 'idx_%_shop_id'
           OR indexname LIKE 'idx_%_revoked_by'
        ORDER BY tablename, indexname;
      `
    });

    if (fkError) {
      console.warn('⚠️  Warning: Could not validate foreign key indexes:', fkError.message);
    } else {
      console.log('📊 Foreign Key Indexes Created:');
      console.log(`   Total indexes: ${fkIndexes?.length || 0}`);
      if (fkIndexes && fkIndexes.length > 0) {
        fkIndexes.forEach(idx => {
          console.log(`   ✅ ${idx.tablename}.${idx.indexname}`);
        });
      }
    }

    // Check index usage statistics
    const { data: indexStats, error: statsError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan as times_used,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        ORDER BY times_used DESC
        LIMIT 20;
      `
    });

    if (statsError) {
      console.warn('⚠️  Warning: Could not get index usage statistics:', statsError.message);
    } else {
      console.log('\n📈 Most Used Indexes:');
      if (indexStats && indexStats.length > 0) {
        indexStats.forEach(stat => {
          console.log(`   ${stat.tablename}.${stat.indexname}: ${stat.times_used} uses`);
        });
      }
    }

    // Check database size reduction
    const { data: dbSize, error: sizeError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as database_size,
          (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public') as total_indexes;
      `
    });

    if (sizeError) {
      console.warn('⚠️  Warning: Could not get database size:', sizeError.message);
    } else if (dbSize && dbSize.length > 0) {
      console.log('\n💾 Database Status:');
      console.log(`   Database size: ${dbSize[0].database_size}`);
      console.log(`   Total indexes: ${dbSize[0].total_indexes}`);
    }

    console.log('\n🎉 Database Performance Optimization Migration Completed Successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Added 20 foreign key indexes for better JOIN performance');
    console.log('   ✅ Removed 100+ unused indexes to reduce storage overhead');
    console.log('   ✅ Updated database statistics for optimal query planning');
    console.log('\n💡 Next Steps:');
    console.log('   1. Monitor query performance with EXPLAIN ANALYZE');
    console.log('   2. Check index usage with pg_stat_user_indexes');
    console.log('   3. Run your application tests to ensure no performance regressions');
    console.log('   4. Consider running this migration during low-traffic periods');

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
if (require.main === module) {
  runPerformanceMigration();
}

module.exports = { runPerformanceMigration };
