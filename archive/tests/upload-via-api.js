#!/usr/bin/env node

/**
 * Upload Schema via Supabase REST API
 * 
 * This script uses the Supabase REST API to execute SQL directly
 */

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SERVICE_ROLE_KEY ? '✅' : '❌');
  process.exit(1);
}

async function uploadSchemaViaAPI() {
  try {
    console.log('🚀 Starting schema upload via Supabase REST API...');
    console.log('📡 Project URL:', SUPABASE_URL);
    
    // Read the combined schema file
    const schemaPath = path.join(__dirname, '..', 'schema-chunks', 'combined_schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }
    
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    console.log('📄 Schema file loaded:', `${(schemaSQL.length / 1024).toFixed(1)}KB`);
    
    // Split into smaller chunks for API execution
    const maxChunkSize = 10000; // 10KB per request
    const statements = schemaSQL.split(';').filter(stmt => stmt.trim());
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    // Execute statements in batches
    for (let i = 0; i < statements.length; i += 10) {
      const batch = statements.slice(i, i + 10);
      const batchSQL = batch.join(';') + ';';
      
      console.log(`🔄 Executing batch ${Math.floor(i / 10) + 1}/${Math.ceil(statements.length / 10)} (${batch.length} statements)...`);
      
      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'apikey': SERVICE_ROLE_KEY
          },
          body: JSON.stringify({
            sql: batchSQL
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log(`   ✅ Batch executed successfully`);
        successCount += batch.length;
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`   ❌ Batch failed:`, error.message);
        errors.push({ batch: Math.floor(i / 10) + 1, error: error.message });
        errorCount += batch.length;
      }
    }
    
    // Summary
    console.log('\n📊 Upload Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   📝 Total: ${statements.length}`);
    
    if (errorCount > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach(({ batch, error }) => {
        console.log(`   - Batch ${batch}: ${error}`);
      });
    }
    
    if (successCount === statements.length) {
      console.log('\n🎉 Schema uploaded successfully via API!');
    } else if (successCount > 0) {
      console.log('\n⚠️  Partial upload completed. Please check the errors above.');
    } else {
      console.log('\n💥 Upload failed completely. Please check your credentials and try again.');
    }
    
  } catch (error) {
    console.error('💥 Upload script failed:', error.message);
    process.exit(1);
  }
}

// Check if exec_sql function exists, if not create it
async function ensureExecSqlFunction() {
  try {
    console.log('🔧 Checking for exec_sql function...');
    
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
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY
      },
      body: JSON.stringify({
        sql: createFunctionSQL
      })
    });
    
    if (response.ok) {
      console.log('✅ exec_sql function is available');
      return true;
    } else {
      console.log('⚠️  exec_sql function not available, trying to create it...');
      
      // Try to create the function using a different approach
      const createResponse = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY
        },
        body: JSON.stringify({
          query: createFunctionSQL
        })
      });
      
      if (createResponse.ok) {
        console.log('✅ exec_sql function created successfully');
        return true;
      } else {
        console.log('❌ Could not create exec_sql function');
        return false;
      }
    }
  } catch (error) {
    console.log('⚠️  Could not check/create exec_sql function:', error.message);
    return false;
  }
}

// Main execution
async function main() {
  try {
    const hasExecSql = await ensureExecSqlFunction();
    
    if (!hasExecSql) {
      console.log('\n💡 Alternative approach: Use the Supabase SQL Editor');
      console.log('1. Go to: https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh/sql');
      console.log('2. Upload: schema-chunks/combined_schema.sql');
      console.log('3. Execute the SQL');
      return;
    }
    
    await uploadSchemaViaAPI();
  } catch (error) {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { uploadSchemaViaAPI, ensureExecSqlFunction };
