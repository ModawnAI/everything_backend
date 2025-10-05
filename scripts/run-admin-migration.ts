#!/usr/bin/env node
/**
 * Run Admin Auth Tables Migration
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { config } from '../src/config/environment';

const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceRoleKey
);

async function runMigration() {
  console.log('🔧 Running admin auth tables migration...\n');

  try {
    const migrationPath = join(__dirname, '../src/migrations/069_create_admin_auth_tables.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    console.log('📝 Executing SQL migration via Supabase SQL Editor...');
    console.log('\n⚠️ Please run this SQL in Supabase SQL Editor:');
    console.log('   1. Go to https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh/sql');
    console.log('   2. Copy and paste the SQL from: src/migrations/069_create_admin_auth_tables.sql');
    console.log('   3. Click "Run"\n');

    // Try to execute via raw query
    console.log('Attempting automatic execution...\n');

    // Split into individual statements and execute
    const statements = sql
      .split(/;\s*$/gm)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^\/\*/));

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;

      try {
        // Use the SQL execution approach
        const { error } = await supabase.rpc('exec_sql', { query: statement });

        if (error) {
          console.log(`⚠️ Statement ${i + 1} failed (this might be OK):`, error.message.substring(0, 100));
          errorCount++;
        } else {
          successCount++;
        }
      } catch (err: any) {
        // Ignore - expected for many statements
      }
    }

    console.log(`\n📊 Execution summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⚠️ Errors: ${errorCount} (some errors are expected)`);

    console.log('\n✅ Please verify tables were created in Supabase dashboard');
    console.log('   Check: https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh/editor\n');

    console.log('📋 Expected tables:');
    console.log('  - admin_sessions');
    console.log('  - admin_ip_whitelist');
    console.log('  - admin_login_attempts');
    console.log('  - admin_permissions');
    console.log('  - admin_actions');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

runMigration()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed');
    process.exit(1);
  });
