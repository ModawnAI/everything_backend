#!/usr/bin/env node

/**
 * Upload Supabase Schema Script
 * 
 * This script uploads the complete database schema to Supabase using the service role key.
 * It reads the SUPABASE SCHEMA.sql file and executes it against the remote database.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✅' : '❌');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function uploadSchema() {
  try {
    console.log('🚀 Starting schema upload to Supabase...');
    console.log('📡 Project URL:', supabaseUrl);
    
    // Read the schema file
    const schemaPath = path.join(__dirname, '..', 'SUPABASE SCHEMA.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }
    
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    console.log('📄 Schema file loaded:', `${(schemaSQL.length / 1024).toFixed(1)}KB`);
    
    // Split the SQL into individual statements
    // Remove comments and empty lines, then split by semicolon
    const statements = schemaSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--') && line.trim() !== '')
      .join('\n')
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute statements in batches to avoid timeout
    const batchSize = 10;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i += batchSize) {
      const batch = statements.slice(i, i + batchSize);
      console.log(`\n🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(statements.length / batchSize)}`);
      
      for (let j = 0; j < batch.length; j++) {
        const statement = batch[j];
        if (!statement) continue;
        
        try {
          // Execute the SQL statement
          const { data, error } = await supabase.rpc('exec_sql', { sql: statement });
          
          if (error) {
            console.error(`❌ Statement ${i + j + 1} failed:`, error.message);
            errorCount++;
          } else {
            successCount++;
            if (j % 5 === 0) {
              console.log(`   ✅ Executed ${i + j + 1}/${statements.length} statements`);
            }
          }
        } catch (err) {
          console.error(`❌ Statement ${i + j + 1} error:`, err.message);
          errorCount++;
        }
      }
      
      // Small delay between batches
      if (i + batchSize < statements.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('\n📊 Upload Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📝 Total: ${statements.length}`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Schema upload completed successfully!');
    } else {
      console.log('\n⚠️  Schema upload completed with some errors. Please check the logs above.');
    }
    
  } catch (error) {
    console.error('💥 Schema upload failed:', error.message);
    process.exit(1);
  }
}

// Check if exec_sql function exists, if not create it
async function ensureExecSqlFunction() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
    if (error && error.message.includes('function exec_sql')) {
      console.log('🔧 Creating exec_sql function...');
      
      const createFunctionSQL = `
        CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
        RETURNS TEXT
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          EXECUTE sql;
          RETURN 'OK';
        EXCEPTION
          WHEN OTHERS THEN
            RAISE EXCEPTION 'SQL execution failed: %', SQLERRM;
        END;
        $$;
      `;
      
      const { error: createError } = await supabase.rpc('exec_sql', { sql: createFunctionSQL });
      if (createError) {
        throw new Error(`Failed to create exec_sql function: ${createError.message}`);
      }
      
      console.log('✅ exec_sql function created');
    }
  } catch (error) {
    console.error('❌ Failed to ensure exec_sql function:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    await ensureExecSqlFunction();
    await uploadSchema();
  } catch (error) {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { uploadSchema, ensureExecSqlFunction };
