#!/usr/bin/env ts-node

/**
 * Add PortOne V2 Columns Script
 *
 * This script attempts to add the missing PortOne V2 columns individually
 * using the Supabase client with targeted DDL operations.
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

interface ColumnDefinition {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: string;
  comment: string;
}

const PORTONE_COLUMNS: ColumnDefinition[] = [
  {
    name: 'channel_key',
    type: 'VARCHAR(255)',
    nullable: true,
    comment: 'PortOne V2 channel key for payment processing'
  },
  {
    name: 'store_id',
    type: 'VARCHAR(255)',
    nullable: true,
    comment: 'PortOne V2 store identifier'
  },
  {
    name: 'payment_key',
    type: 'VARCHAR(255)',
    nullable: true,
    comment: 'PortOne V2 unique payment identifier'
  },
  {
    name: 'gateway_method',
    type: 'VARCHAR(100)',
    nullable: true,
    comment: 'PortOne V2 specific payment method (e.g., card, virtual_account, phone)'
  },
  {
    name: 'gateway_transaction_id',
    type: 'VARCHAR(255)',
    nullable: true,
    comment: 'PortOne V2 transaction ID for tracking'
  },
  {
    name: 'virtual_account_info',
    type: 'JSONB',
    nullable: true,
    comment: 'Virtual account details from PortOne (bank, account number, holder name, due date)'
  },
  {
    name: 'gateway_metadata',
    type: 'JSONB',
    nullable: true,
    defaultValue: "'{}'::jsonb",
    comment: 'PortOne V2 specific metadata and additional fields'
  }
];

/**
 * Check if column exists
 */
async function columnExists(columnName: string): Promise<boolean> {
  const supabase = createClient(
    config.database.supabaseUrl,
    config.database.supabaseServiceRoleKey
  );

  try {
    const { error } = await supabase
      .from('payments')
      .select(columnName)
      .limit(0);

    return !error || !error.message.includes('does not exist');
  } catch {
    return false;
  }
}

/**
 * Execute a raw SQL statement using fetch
 */
async function executeRawSQL(sql: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Try using supabase-js RPC first
    const supabase = createClient(
      config.database.supabaseUrl,
      config.database.supabaseServiceRoleKey
    );

    const { data, error } = await supabase.rpc('exec', { sql });

    if (!error) {
      return { success: true };
    }

    log.warning(`RPC failed: ${error.message}, trying manual approach`);

    // Fall back to direct REST API call
    const response = await fetch(`${config.database.supabaseUrl}/rest/v1/rpc/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.database.supabaseServiceRoleKey}`,
        'apikey': config.database.supabaseServiceRoleKey
      },
      body: JSON.stringify({ query: sql })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    return { success: true };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Add a single column to the payments table
 */
async function addColumn(column: ColumnDefinition): Promise<boolean> {
  try {
    // Check if column already exists
    if (await columnExists(column.name)) {
      log.info(`Column ${column.name} already exists`);
      return true;
    }

    log.info(`Adding column ${column.name}...`);

    // Build the ALTER TABLE statement
    let sql = `ALTER TABLE payments ADD COLUMN ${column.name} ${column.type}`;

    if (!column.nullable) {
      sql += ' NOT NULL';
    }

    if (column.defaultValue) {
      sql += ` DEFAULT ${column.defaultValue}`;
    }

    sql += ';';

    log.info(`Executing: ${sql.substring(0, 100)}...`);

    const result = await executeRawSQL(sql);

    if (result.success) {
      log.success(`Added column ${column.name}`);

      // Add comment if successful
      const commentSQL = `COMMENT ON COLUMN payments.${column.name} IS '${column.comment}';`;
      const commentResult = await executeRawSQL(commentSQL);

      if (commentResult.success) {
        log.info(`Added comment for ${column.name}`);
      }

      return true;
    } else {
      log.error(`Failed to add column ${column.name}: ${result.error}`);
      return false;
    }

  } catch (error) {
    log.error(`Error adding column ${column.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Add indexes for PortOne columns
 */
async function addIndexes(): Promise<boolean> {
  const indexes = [
    {
      name: 'idx_payments_payment_key',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_payment_key ON payments(payment_key) WHERE payment_key IS NOT NULL;'
    },
    {
      name: 'idx_payments_channel_key',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_channel_key ON payments(channel_key) WHERE channel_key IS NOT NULL;'
    },
    {
      name: 'idx_payments_store_id',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_store_id ON payments(store_id) WHERE store_id IS NOT NULL;'
    },
    {
      name: 'idx_payments_gateway_transaction_id',
      sql: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_gateway_transaction_id ON payments(gateway_transaction_id) WHERE gateway_transaction_id IS NOT NULL;'
    }
  ];

  let successCount = 0;

  for (const index of indexes) {
    log.info(`Creating index ${index.name}...`);

    const result = await executeRawSQL(index.sql);

    if (result.success) {
      log.success(`Created index ${index.name}`);
      successCount++;
    } else {
      log.warning(`Failed to create index ${index.name}: ${result.error}`);
    }
  }

  return successCount > 0;
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  try {
    log.header('PortOne V2 Column Addition');

    // Validate environment
    if (!config.database.supabaseUrl || !config.database.supabaseServiceRoleKey) {
      throw new Error('Missing Supabase configuration');
    }

    log.info(`Environment: ${config.server.env}`);
    log.info(`Supabase URL: ${config.database.supabaseUrl}`);

    let successCount = 0;

    console.log(`\nAdding ${PORTONE_COLUMNS.length} PortOne V2 columns...\n`);

    for (let i = 0; i < PORTONE_COLUMNS.length; i++) {
      const column = PORTONE_COLUMNS[i];
      log.info(`Column ${i + 1}/${PORTONE_COLUMNS.length}: ${column.name}`);

      const success = await addColumn(column);
      if (success) {
        successCount++;
      }

      console.log(''); // Empty line for readability
    }

    // Add indexes
    log.info('Adding performance indexes...');
    const indexSuccess = await addIndexes();

    // Summary
    console.log(`${colors.cyan}${colors.bold}═══════════════════════════════════════════════════════════════════════════════`);
    console.log(`                              ADDITION RESULTS`);
    console.log(`═══════════════════════════════════════════════════════════════════════════════${colors.reset}\n`);

    console.log(`Total columns: ${PORTONE_COLUMNS.length}`);
    console.log(`${colors.green}Successfully added: ${successCount}${colors.reset}`);
    console.log(`${colors.yellow}Skipped/Failed: ${PORTONE_COLUMNS.length - successCount}${colors.reset}`);
    console.log(`${colors.blue}Indexes: ${indexSuccess ? 'Added' : 'Some failed'}${colors.reset}\n`);

    if (successCount === PORTONE_COLUMNS.length) {
      log.success('🎉 All PortOne V2 columns added successfully!');
      log.info('Run verification script to confirm: npm run migrate:portone-v2:verify');
    } else if (successCount > 0) {
      log.warning('⚠️ Some columns were added, but not all operations succeeded.');
      log.info('You may need to run the full migration manually for remaining items.');
    } else {
      log.error('❌ Unable to add columns automatically.');
      log.info('Please execute the migration manually via Supabase SQL Editor.');
    }

  } catch (error) {
    log.error(`Column addition failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

export default main;