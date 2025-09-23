#!/usr/bin/env node

/**
 * Database Performance Monitor
 * 
 * This script monitors database performance metrics and index usage
 * to help track the impact of the performance optimization migration.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getDatabaseMetrics() {
  try {
    console.log('📊 Database Performance Metrics\n');
    console.log('=' .repeat(60));

    // Database size and basic info
    const { data: dbInfo, error: dbError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          current_database() as database_name,
          pg_size_pretty(pg_database_size(current_database())) as total_size,
          (SELECT count(*) FROM pg_tables WHERE schemaname = 'public') as table_count,
          (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public') as index_count,
          (SELECT count(*) FROM pg_stat_user_tables) as active_tables;
      `
    });

    if (dbError) {
      console.error('❌ Error getting database info:', dbError.message);
      return;
    }

    if (dbInfo && dbInfo.length > 0) {
      const info = dbInfo[0];
      console.log('🗄️  Database Overview:');
      console.log(`   Database: ${info.database_name}`);
      console.log(`   Total Size: ${info.total_size}`);
      console.log(`   Tables: ${info.table_count}`);
      console.log(`   Indexes: ${info.index_count}`);
      console.log(`   Active Tables: ${info.active_tables}\n`);
    }

    // Index usage statistics
    const { data: indexUsage, error: usageError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan as times_used,
          idx_tup_read as tuples_read,
          idx_tup_fetch as tuples_fetched,
          CASE 
            WHEN idx_scan = 0 THEN 'UNUSED'
            WHEN idx_scan < 10 THEN 'LOW_USAGE'
            WHEN idx_scan < 100 THEN 'MEDIUM_USAGE'
            ELSE 'HIGH_USAGE'
          END as usage_level
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        ORDER BY times_used DESC
        LIMIT 30;
      `
    });

    if (usageError) {
      console.error('❌ Error getting index usage:', usageError.message);
    } else {
      console.log('📈 Index Usage Statistics:');
      console.log('   (Top 30 most used indexes)\n');
      
      if (indexUsage && indexUsage.length > 0) {
        indexUsage.forEach((idx, i) => {
          const status = idx.times_used === 0 ? '🔴' : 
                        idx.times_used < 10 ? '🟡' : 
                        idx.times_used < 100 ? '🟠' : '🟢';
          console.log(`   ${status} ${idx.tablename}.${idx.indexname}`);
          console.log(`      Used: ${idx.times_used} times | Read: ${idx.tuples_read} tuples | Level: ${idx.usage_level}`);
        });
      }
    }

    // Unused indexes (should be minimal after migration)
    const { data: unusedIndexes, error: unusedError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          schemaname,
          tablename,
          indexname,
          pg_size_pretty(pg_relation_size(indexrelid)) as index_size
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public' 
          AND idx_scan = 0
        ORDER BY pg_relation_size(indexrelid) DESC
        LIMIT 20;
      `
    });

    if (unusedError) {
      console.error('❌ Error getting unused indexes:', unusedError.message);
    } else {
      console.log('\n🔴 Unused Indexes:');
      if (unusedIndexes && unusedIndexes.length > 0) {
        console.log(`   Found ${unusedIndexes.length} unused indexes:\n`);
        unusedIndexes.forEach(idx => {
          console.log(`   ⚠️  ${idx.tablename}.${idx.indexname} (${idx.index_size})`);
        });
      } else {
        console.log('   ✅ No unused indexes found!');
      }
    }

    // Foreign key constraint performance
    const { data: fkConstraints, error: fkError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          tc.table_name,
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          CASE 
            WHEN i.indexname IS NOT NULL THEN 'INDEXED'
            ELSE 'NOT_INDEXED'
          END as index_status
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        LEFT JOIN pg_indexes i ON i.tablename = tc.table_name 
          AND i.indexdef LIKE '%' || kcu.column_name || '%'
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name, tc.constraint_name;
      `
    });

    if (fkError) {
      console.error('❌ Error getting foreign key constraints:', fkError.message);
    } else {
      console.log('\n🔗 Foreign Key Constraints:');
      if (fkConstraints && fkConstraints.length > 0) {
        const indexed = fkConstraints.filter(fk => fk.index_status === 'INDEXED').length;
        const notIndexed = fkConstraints.filter(fk => fk.index_status === 'NOT_INDEXED').length;
        
        console.log(`   Total FK constraints: ${fkConstraints.length}`);
        console.log(`   ✅ Indexed: ${indexed}`);
        console.log(`   ❌ Not indexed: ${notIndexed}`);
        
        if (notIndexed > 0) {
          console.log('\n   Unindexed foreign keys:');
          fkConstraints
            .filter(fk => fk.index_status === 'NOT_INDEXED')
            .forEach(fk => {
              console.log(`   ⚠️  ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
            });
        }
      }
    }

    // Table statistics
    const { data: tableStats, error: tableError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
        ORDER BY n_live_tup DESC
        LIMIT 15;
      `
    });

    if (tableError) {
      console.error('❌ Error getting table statistics:', tableError.message);
    } else {
      console.log('\n📋 Table Statistics (Top 15 by row count):');
      if (tableStats && tableStats.length > 0) {
        tableStats.forEach(table => {
          console.log(`   📊 ${table.tablename}:`);
          console.log(`      Rows: ${table.live_tuples.toLocaleString()} | Inserts: ${table.inserts} | Updates: ${table.updates} | Deletes: ${table.deletes}`);
          if (table.dead_tuples > 0) {
            console.log(`      ⚠️  Dead tuples: ${table.dead_tuples} (consider VACUUM)`);
          }
        });
      }
    }

    // Query performance recommendations
    console.log('\n💡 Performance Recommendations:');
    
    if (unusedIndexes && unusedIndexes.length > 0) {
      console.log('   🔴 Consider removing unused indexes to reduce storage overhead');
    }
    
    if (fkConstraints) {
      const notIndexed = fkConstraints.filter(fk => fk.index_status === 'NOT_INDEXED').length;
      if (notIndexed > 0) {
        console.log('   🔴 Add indexes for unindexed foreign key constraints');
      }
    }

    const tablesNeedingVacuum = tableStats?.filter(table => table.dead_tuples > 1000) || [];
    if (tablesNeedingVacuum.length > 0) {
      console.log('   🧹 Consider running VACUUM on tables with many dead tuples');
      tablesNeedingVacuum.forEach(table => {
        console.log(`      - ${table.tablename} (${table.dead_tuples} dead tuples)`);
      });
    }

    console.log('\n✅ Performance monitoring complete!');
    console.log('\n📝 To run this monitor regularly:');
    console.log('   node scripts/monitor-db-performance.js');

  } catch (error) {
    console.error('❌ Error monitoring database performance:', error.message);
    process.exit(1);
  }
}

// Run the monitor
if (require.main === module) {
  getDatabaseMetrics();
}

module.exports = { getDatabaseMetrics };
