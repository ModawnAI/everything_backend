#!/usr/bin/env node

/**
 * Direct SQL execution for spatial index migration
 * This script runs the composite spatial indexes migration using Supabase
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Simple Supabase client setup
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQLFile(filePath) {
  try {
    console.log(`📖 Reading SQL file: ${filePath}`);
    const sqlContent = fs.readFileSync(filePath, 'utf-8');
    
    // Split the SQL content into individual statements
    // This is a simple approach - for production, you'd want a proper SQL parser
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));
    
    console.log(`🔄 Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`   Executing statement ${i + 1}/${statements.length}...`);
          const { data, error } = await supabase.rpc('exec_sql', {
            sql: statement
          });
          
          if (error) {
            console.error(`❌ Error in statement ${i + 1}:`, error.message);
            console.error(`Statement: ${statement.substring(0, 100)}...`);
          } else {
            console.log(`   ✅ Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.error(`❌ Exception in statement ${i + 1}:`, err.message);
        }
      }
    }
    
    console.log('✅ SQL file execution completed');
    
  } catch (error) {
    console.error('❌ Failed to execute SQL file:', error.message);
    throw error;
  }
}

async function checkIndexes() {
  try {
    console.log('\n📊 Checking created indexes...');
    
    const { data, error } = await supabase
      .from('pg_indexes')
      .select('indexname, indexdef')
      .eq('tablename', 'shops')
      .order('indexname');
    
    if (error) {
      console.error('❌ Failed to check indexes:', error.message);
      return;
    }
    
    console.log('\n📋 Current indexes on shops table:');
    data.forEach(index => {
      console.log(`   - ${index.indexname}`);
    });
    
  } catch (error) {
    console.error('❌ Failed to check indexes:', error.message);
  }
}

async function main() {
  try {
    console.log('🚀 Starting spatial indexes migration...\n');
    
    // Execute the migration file
    await executeSQLFile('src/migrations/031_create_composite_spatial_indexes.sql');
    
    // Check the results
    await checkIndexes();
    
    console.log('\n🎉 Spatial indexes migration completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Migration failed:', error.message);
    process.exit(1);
  }
}

// Run the migration
main();

