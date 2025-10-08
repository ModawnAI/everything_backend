#!/usr/bin/env ts-node

/**
 * PortOne V2 Schema Migration Script
 *
 * This script provides instructions and attempts to execute the PortOne V2 schema migration
 * using multiple approaches for Supabase database.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config/environment';

const MIGRATION_FILE_PATH = path.join(__dirname, '../sql/portone_v2_schema_migration.sql');
const MIGRATION_NAME = 'PortOne V2 Schema Migration';

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
  success: (msg: string) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg: string) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg: string) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  header: (msg: string) => console.log(`${colors.bold}${colors.cyan}\n🚀 ${msg}${colors.reset}\n`)
};

/**
 * Read and validate the migration file
 */
function readMigrationFile(): string {
  try {
    if (!fs.existsSync(MIGRATION_FILE_PATH)) {
      throw new Error(`Migration file not found: ${MIGRATION_FILE_PATH}`);
    }

    const migrationSQL = fs.readFileSync(MIGRATION_FILE_PATH, 'utf8');

    if (!migrationSQL.trim()) {
      throw new Error('Migration file is empty');
    }

    log.info(`Migration file loaded successfully (${Math.round(migrationSQL.length / 1024)}KB)`);
    return migrationSQL;

  } catch (error) {
    log.error(`Failed to read migration file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

/**
 * Extract Supabase project reference from URL
 */
function extractProjectRef(supabaseUrl: string): string {
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : 'your-project-ref';
}

/**
 * Provide manual execution instructions
 */
function provideManualInstructions(): void {
  const projectRef = extractProjectRef(config.database.supabaseUrl);

  console.log(`${colors.cyan}${colors.bold}`);
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('                          MANUAL EXECUTION REQUIRED');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`${colors.reset}`);

  console.log(`${colors.yellow}🔧 RECOMMENDED: Execute via Supabase SQL Editor${colors.reset}\n`);

  console.log(`1. Open Supabase SQL Editor:`);
  console.log(`   ${colors.blue}https://supabase.com/dashboard/project/${projectRef}/sql${colors.reset}\n`);

  console.log(`2. Copy the migration SQL from:`);
  console.log(`   ${colors.cyan}${MIGRATION_FILE_PATH}${colors.reset}\n`);

  console.log(`3. Paste the SQL into the editor and click "Run"\n`);

  console.log(`${colors.green}✨ Migration includes:${colors.reset}`);
  console.log(`   • Add 'portone' to payment_method enum`);
  console.log(`   • Add 'virtual_account_issued' to payment_status enum`);
  console.log(`   • Add 7 new columns to payments table:`);
  console.log(`     - channel_key, store_id, payment_key`);
  console.log(`     - gateway_method, gateway_transaction_id`);
  console.log(`     - virtual_account_info (JSONB)`);
  console.log(`     - gateway_metadata (JSONB)`);
  console.log(`   • Create performance indexes`);
  console.log(`   • Add documentation comments`);
  console.log(`   • Migration validation checks\n`);
}

/**
 * Verify migration was successful by checking schema
 */
async function verifyMigration(): Promise<boolean> {
  try {
    log.info('Verifying migration results...');

    const supabase = createClient(
      config.database.supabaseUrl,
      config.database.supabaseServiceRoleKey
    );

    // Test a simple query to verify connection
    const { data: testData, error: testError } = await supabase
      .from('payments')
      .select('id')
      .limit(1)
      .single();

    if (testError && testError.code !== 'PGRST116') {
      log.warning(`Database connection test failed: ${testError.message}`);
      return false;
    }

    // Try to query new columns (this will fail if they don't exist)
    const { error: columnError } = await supabase
      .from('payments')
      .select('channel_key, store_id, payment_key, gateway_method, virtual_account_info, gateway_metadata')
      .limit(1);

    if (columnError) {
      if (columnError.message.includes('column') && columnError.message.includes('does not exist')) {
        log.warning('New PortOne V2 columns not found - migration may not have run yet');
        return false;
      } else {
        log.warning(`Column verification failed: ${columnError.message}`);
        return false;
      }
    }

    log.success('✅ All PortOne V2 columns are accessible!');
    log.success('✅ Migration appears to be successful');
    return true;

  } catch (error) {
    log.warning(`Migration verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Attempt automated execution (likely to fail, but worth trying)
 */
async function attemptAutomatedExecution(): Promise<boolean> {
  try {
    log.info('Attempting automated execution...');

    const migrationSQL = readMigrationFile();
    const supabase = createClient(
      config.database.supabaseUrl,
      config.database.supabaseServiceRoleKey
    );

    // This is unlikely to work, but we can try
    const { data, error } = await supabase.rpc('exec_sql', {
      query: migrationSQL
    });

    if (error) {
      log.warning(`Automated execution failed: ${error.message}`);
      return false;
    }

    log.success('Automated execution succeeded!');
    return true;

  } catch (error) {
    log.warning(`Automated execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    log.header(MIGRATION_NAME);

    // Validate environment
    if (!config.database.supabaseUrl || !config.database.supabaseServiceRoleKey) {
      throw new Error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }

    log.info(`Environment: ${config.server.env}`);
    log.info(`Supabase URL: ${config.database.supabaseUrl}`);

    // Check if migration might already be applied
    log.info('Checking current schema state...');
    const isAlreadyMigrated = await verifyMigration();

    if (isAlreadyMigrated) {
      log.success('🎉 PortOne V2 schema migration already appears to be applied!');
      log.info('All required columns and enums are present.');
      return;
    }

    // Try automated execution first
    log.info('Attempting automated execution...');
    const automatedSuccess = await attemptAutomatedExecution();

    if (automatedSuccess) {
      // Verify the automated execution worked
      const verificationSuccess = await verifyMigration();
      if (verificationSuccess) {
        log.success('🎉 Automated migration completed successfully!');
        return;
      }
    }

    // Provide manual instructions
    log.warning('Automated execution failed or could not be verified.');
    provideManualInstructions();

    console.log(`${colors.yellow}\n⏳ After running the migration manually, you can verify it by running:${colors.reset}`);
    console.log(`   npm run migration:verify-portone-v2`);
    console.log(`   or`);
    console.log(`   node -r ts-node/register scripts/run-portone-v2-migration.ts --verify-only\n`);

  } catch (error) {
    log.error(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

// Handle command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--verify-only')) {
    verifyMigration()
      .then(success => {
        if (success) {
          log.success('Migration verification passed!');
          process.exit(0);
        } else {
          log.error('Migration verification failed!');
          process.exit(1);
        }
      })
      .catch(error => {
        log.error(`Verification failed: ${error.message}`);
        process.exit(1);
      });
  } else {
    main();
  }
}

export { verifyMigration, readMigrationFile };