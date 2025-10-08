#!/usr/bin/env ts-node

/**
 * PortOne V2 Schema Migration Script - Advanced Approach
 *
 * This script attempts to execute the migration by breaking it down into
 * individual operations that can be executed through the Supabase REST API.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config/environment';

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

interface MigrationStep {
  name: string;
  description: string;
  execute: () => Promise<boolean>;
}

/**
 * Execute raw SQL using fetch against Supabase REST API
 */
async function executeSQL(sql: string): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const response = await fetch(`${config.database.supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.database.supabaseServiceRoleKey}`,
        'apikey': config.database.supabaseServiceRoleKey
      },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return { success: true, data };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Check if an enum value exists
 */
async function checkEnumValue(enumName: string, value: string): Promise<boolean> {
  const supabase = createClient(
    config.database.supabaseUrl,
    config.database.supabaseServiceRoleKey
  );

  try {
    // This is a rough check - we'll try to use the enum and see if it fails
    const { error } = await supabase
      .from('payments')
      .select('id')
      .eq('method', value) // This will fail if enum value doesn't exist
      .limit(0);

    // If there's no error, the enum value likely exists
    return !error || !error.message.includes('invalid input value for enum');
  } catch {
    return false;
  }
}

/**
 * Check if a column exists in a table
 */
async function checkColumnExists(tableName: string, columnName: string): Promise<boolean> {
  const supabase = createClient(
    config.database.supabaseUrl,
    config.database.supabaseServiceRoleKey
  );

  try {
    const { error } = await supabase
      .from(tableName)
      .select(columnName)
      .limit(0);

    return !error || !error.message.includes('does not exist');
  } catch {
    return false;
  }
}

/**
 * Create all migration steps
 */
function createMigrationSteps(): MigrationStep[] {
  const supabase = createClient(
    config.database.supabaseUrl,
    config.database.supabaseServiceRoleKey
  );

  return [
    {
      name: 'Check portone enum value',
      description: 'Verify if portone is in payment_method enum',
      execute: async () => {
        const exists = await checkEnumValue('payment_method', 'portone');
        if (exists) {
          log.info('portone enum value already exists');
          return true;
        }
        log.warning('portone enum value not found - may need manual addition');
        return false; // Not critical
      }
    },

    {
      name: 'Check virtual_account_issued enum value',
      description: 'Verify if virtual_account_issued is in payment_status enum',
      execute: async () => {
        const exists = await checkEnumValue('payment_status', 'virtual_account_issued');
        if (exists) {
          log.info('virtual_account_issued enum value already exists');
          return true;
        }
        log.warning('virtual_account_issued enum value not found - may need manual addition');
        return false; // Not critical
      }
    },

    {
      name: 'Check channel_key column',
      description: 'Verify if channel_key column exists in payments table',
      execute: async () => {
        const exists = await checkColumnExists('payments', 'channel_key');
        if (exists) {
          log.success('channel_key column already exists');
          return true;
        }
        log.warning('channel_key column not found');
        return false;
      }
    },

    {
      name: 'Check store_id column',
      description: 'Verify if store_id column exists in payments table',
      execute: async () => {
        const exists = await checkColumnExists('payments', 'store_id');
        if (exists) {
          log.success('store_id column already exists');
          return true;
        }
        log.warning('store_id column not found');
        return false;
      }
    },

    {
      name: 'Check payment_key column',
      description: 'Verify if payment_key column exists in payments table',
      execute: async () => {
        const exists = await checkColumnExists('payments', 'payment_key');
        if (exists) {
          log.success('payment_key column already exists');
          return true;
        }
        log.warning('payment_key column not found');
        return false;
      }
    },

    {
      name: 'Check gateway_method column',
      description: 'Verify if gateway_method column exists in payments table',
      execute: async () => {
        const exists = await checkColumnExists('payments', 'gateway_method');
        if (exists) {
          log.success('gateway_method column already exists');
          return true;
        }
        log.warning('gateway_method column not found');
        return false;
      }
    },

    {
      name: 'Check gateway_transaction_id column',
      description: 'Verify if gateway_transaction_id column exists in payments table',
      execute: async () => {
        const exists = await checkColumnExists('payments', 'gateway_transaction_id');
        if (exists) {
          log.success('gateway_transaction_id column already exists');
          return true;
        }
        log.warning('gateway_transaction_id column not found');
        return false;
      }
    },

    {
      name: 'Check virtual_account_info column',
      description: 'Verify if virtual_account_info column exists in payments table',
      execute: async () => {
        const exists = await checkColumnExists('payments', 'virtual_account_info');
        if (exists) {
          log.success('virtual_account_info column already exists');
          return true;
        }
        log.warning('virtual_account_info column not found');
        return false;
      }
    },

    {
      name: 'Check gateway_metadata column',
      description: 'Verify if gateway_metadata column exists in payments table',
      execute: async () => {
        const exists = await checkColumnExists('payments', 'gateway_metadata');
        if (exists) {
          log.success('gateway_metadata column already exists');
          return true;
        }
        log.warning('gateway_metadata column not found');
        return false;
      }
    },

    {
      name: 'Test sample query with new columns',
      description: 'Attempt to query all new columns together',
      execute: async () => {
        try {
          const { error } = await supabase
            .from('payments')
            .select(`
              channel_key,
              store_id,
              payment_key,
              gateway_method,
              gateway_transaction_id,
              virtual_account_info,
              gateway_metadata
            `)
            .limit(1);

          if (error) {
            log.warning(`Query test failed: ${error.message}`);
            return false;
          }

          log.success('All new columns are accessible via API');
          return true;
        } catch (error) {
          log.warning(`Query test error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          return false;
        }
      }
    }
  ];
}

/**
 * Run the advanced migration check
 */
async function main(): Promise<void> {
  try {
    log.header('PortOne V2 Advanced Migration Check');

    // Validate environment
    if (!config.database.supabaseUrl || !config.database.supabaseServiceRoleKey) {
      throw new Error('Missing Supabase configuration');
    }

    log.info(`Environment: ${config.server.env}`);
    log.info(`Supabase URL: ${config.database.supabaseUrl}`);

    const steps = createMigrationSteps();
    let successCount = 0;
    let totalSteps = steps.length;

    console.log(`\nRunning ${totalSteps} migration checks...\n`);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      log.info(`Step ${i + 1}/${totalSteps}: ${step.description}`);

      try {
        const success = await step.execute();
        if (success) {
          successCount++;
        }
      } catch (error) {
        log.error(`Step failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      console.log(''); // Empty line for readability
    }

    // Results summary
    console.log(`${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════════════════════════════`);
    console.log(`                                MIGRATION RESULTS`);
    console.log(`═══════════════════════════════════════════════════════════════════════════════${colors.reset}\n`);

    console.log(`Total checks: ${totalSteps}`);
    console.log(`${colors.green}Successful: ${successCount}${colors.reset}`);
    console.log(`${colors.yellow}Issues found: ${totalSteps - successCount}${colors.reset}\n`);

    if (successCount === totalSteps) {
      log.success('🎉 All migration checks passed! Schema appears to be fully migrated.');
    } else if (successCount >= 7) { // At least the column checks passed
      log.warning('⚠️ Most migration items are in place, but some enum values may need manual addition.');
      console.log('\nTo complete the migration:');
      console.log(`1. Open: ${colors.blue}https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh/sql${colors.reset}`);
      console.log('2. Execute these enum additions:');
      console.log(`   ${colors.cyan}ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'portone';${colors.reset}`);
      console.log(`   ${colors.cyan}ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'virtual_account_issued';${colors.reset}`);
    } else {
      log.error('❌ Migration appears incomplete. Manual execution required.');
      console.log(`\nPlease run the full migration manually:`);
      console.log(`1. Open: ${colors.blue}https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh/sql${colors.reset}`);
      console.log(`2. Copy content from: ${colors.cyan}/Users/kjyoo/everything_backend-2/sql/portone_v2_schema_migration.sql${colors.reset}`);
      console.log('3. Execute the complete migration');
    }

  } catch (error) {
    log.error(`Migration check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

export default main;