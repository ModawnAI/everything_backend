#!/usr/bin/env node

/**
 * Simple SQL Migration Runner
 * Executes SQL migration files directly against Supabase database
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`${colors.bold}${colors.cyan}\n🔄 ${msg}${colors.reset}\n`)
};

async function runMigration(filePath) {
  try {
    log.header(`Running migration: ${path.basename(filePath)}`);
    
    // Read the SQL file
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Split SQL into individual statements and execute them
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim()) {
        const { data, error } = await supabase.from('_dummy').select('*').limit(0); // Test connection
        if (error && error.code !== 'PGRST116') { // PGRST116 is expected for dummy table
          throw error;
        }
        
        // Execute the statement using the REST API
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({ sql_query: statement.trim() })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`SQL execution failed: ${errorText}`);
        }
      }
    }
    
    if (error) {
      throw error;
    }
    
    log.success(`Migration completed successfully: ${path.basename(filePath)}`);
    return true;
    
  } catch (error) {
    log.error(`Migration failed: ${path.basename(filePath)}`);
    log.error(`Error: ${error.message}`);
    
    // If the error is about missing tables, provide helpful information
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      log.warning('This error suggests that required tables are missing. Make sure to run migrations in the correct order.');
    }
    
    return false;
  }
}

async function main() {
  const migrationFile = process.argv[2];
  
  if (!migrationFile) {
    log.error('Please provide a migration file path');
    console.log('Usage: node scripts/run-sql-migration.js <migration-file.sql>');
    process.exit(1);
  }
  
  const migrationPath = path.resolve(migrationFile);
  
  if (!fs.existsSync(migrationPath)) {
    log.error(`Migration file not found: ${migrationPath}`);
    process.exit(1);
  }
  
  const success = await runMigration(migrationPath);
  
  if (!success) {
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    log.error(`Script failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runMigration };
