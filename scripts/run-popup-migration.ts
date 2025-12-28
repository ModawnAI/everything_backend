/**
 * Script to run migration 080: App Popups
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Split SQL into executable statements
function splitSqlStatements(sql: string): string[] {
  // Handle $$ blocks (functions/triggers)
  const statements: string[] = [];
  let currentStatement = '';
  let inDollarBlock = false;

  const lines = sql.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('--')) {
      continue;
    }

    // Check for $$ block start/end
    if (trimmedLine.includes('$$')) {
      const dollarCount = (trimmedLine.match(/\$\$/g) || []).length;
      if (dollarCount === 2) {
        // Both start and end on same line
        currentStatement += line + '\n';
      } else if (dollarCount === 1) {
        inDollarBlock = !inDollarBlock;
        currentStatement += line + '\n';
      }
    } else {
      currentStatement += line + '\n';
    }

    // If not in dollar block and line ends with ;, statement is complete
    if (!inDollarBlock && trimmedLine.endsWith(';')) {
      const stmt = currentStatement.trim();
      if (stmt) {
        statements.push(stmt);
      }
      currentStatement = '';
    }
  }

  // Handle any remaining statement
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  return statements;
}

async function runMigration() {
  console.log('🔧 Running Migration 080: App Popups\n');

  const migrationPath = path.join(__dirname, '../src/migrations/080_create_popup_tables.sql');

  try {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📂 Migration file loaded successfully');
    console.log(`📏 SQL file size: ${(sql.length / 1024).toFixed(2)} KB\n`);

    const statements = splitSqlStatements(sql);

    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Extract operation type for logging
      const firstWord = statement.split(/\s+/)[0].toUpperCase();

      console.log(`⚙️  [${i + 1}/${statements.length}] Executing: ${firstWord}...`);

      try {
        // Use raw SQL execution through postgrest
        const { error } = await supabase.from('_exec').select().limit(0);

        // Actually execute via RPC - try different methods
        let result;

        // Try using the SQL function if available
        result = await supabase.rpc('query', { sql_text: statement });

        if (result.error) {
          // Try alternative function name
          result = await supabase.rpc('execute_sql', { query: statement });
        }

        if (result.error) {
          console.error(`❌ Error executing statement ${i + 1}:`, result.error.message);

          // Check for non-critical errors
          if (result.error.message.includes('already exists') ||
              result.error.message.includes('does not exist') ||
              result.error.message.includes('duplicate')) {
            console.log(`⚠️  Non-critical error, continuing...`);
            successCount++;
          } else if (result.error.code === 'PGRST202') {
            // RPC function not found - need to run manually
            console.log('\n⚠️  Database RPC function not available.');
            console.log('Please run the migration manually via Supabase SQL Editor.');
            throw new Error('RPC function not available');
          } else {
            errorCount++;
          }
        } else {
          console.log(`✅ [${i + 1}/${statements.length}] Success`);
          successCount++;
        }
      } catch (err: any) {
        console.error(`❌ Error executing statement ${i + 1}:`, err.message);
        errorCount++;

        // Continue on non-critical errors
        if (!err.message.includes('RPC function not available')) {
          continue;
        }
        throw err;
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
      console.log('✨ Migration 080 completed successfully!\n');
    } else {
      console.log('⚠️  Migration completed with some errors.\n');
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);

    console.log('\n📋 Alternative: Run migration manually');
    console.log('1. Go to your Supabase dashboard > SQL Editor');
    console.log('2. Open file: src/migrations/080_create_popup_tables.sql');
    console.log('3. Paste the contents and run\n');

    // Print the SQL for easy copy-paste
    console.log('📄 SQL to run:');
    console.log('='.repeat(60));
    try {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      console.log(sql);
    } catch {
      console.log('(Unable to read migration file)');
    }

    process.exit(1);
  }
}

runMigration()
  .then(() => {
    console.log('✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration process failed:', error.message);
    process.exit(1);
  });
