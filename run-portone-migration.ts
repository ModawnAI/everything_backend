#!/usr/bin/env ts-node

/**
 * PortOne V2 Database Migration Execution Script
 *
 * This script executes the PortOne V2 database migration by running individual
 * ALTER TABLE statements against the Supabase database.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
 * Individual SQL statements for the PortOne V2 migration
 */
const migrationStatements = [
  // 1. Add 'portone' to payment_method enum if it doesn't exist
  {
    name: "Add 'portone' to payment_method enum",
    sql: `
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM pg_enum
              WHERE enumlabel = 'portone'
              AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_method')
          ) THEN
              ALTER TYPE payment_method ADD VALUE 'portone';
              RAISE NOTICE 'Added portone to payment_method enum';
          ELSE
              RAISE NOTICE 'portone already exists in payment_method enum';
          END IF;
      END
      $$;
    `
  },

  // 2. Add 'virtual_account_issued' to payment_status enum
  {
    name: "Add 'virtual_account_issued' to payment_status enum",
    sql: `
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM pg_enum
              WHERE enumlabel = 'virtual_account_issued'
              AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_status')
          ) THEN
              ALTER TYPE payment_status ADD VALUE 'virtual_account_issued';
              RAISE NOTICE 'Added virtual_account_issued to payment_status enum';
          ELSE
              RAISE NOTICE 'virtual_account_issued already exists in payment_status enum';
          END IF;
      END
      $$;
    `
  },

  // 3. Add channel_key column
  {
    name: "Add channel_key column",
    sql: `
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'payments' AND column_name = 'channel_key'
          ) THEN
              ALTER TABLE payments ADD COLUMN channel_key VARCHAR(255);
              RAISE NOTICE 'Added channel_key column to payments table';
          ELSE
              RAISE NOTICE 'channel_key column already exists in payments table';
          END IF;
      END
      $$;
    `
  },

  // 4. Add store_id column
  {
    name: "Add store_id column",
    sql: `
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'payments' AND column_name = 'store_id'
          ) THEN
              ALTER TABLE payments ADD COLUMN store_id VARCHAR(255);
              RAISE NOTICE 'Added store_id column to payments table';
          ELSE
              RAISE NOTICE 'store_id column already exists in payments table';
          END IF;
      END
      $$;
    `
  },

  // 5. Add payment_key column
  {
    name: "Add payment_key column",
    sql: `
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'payments' AND column_name = 'payment_key'
          ) THEN
              ALTER TABLE payments ADD COLUMN payment_key VARCHAR(255);
              RAISE NOTICE 'Added payment_key column to payments table';
          ELSE
              RAISE NOTICE 'payment_key column already exists in payments table';
          END IF;
      END
      $$;
    `
  },

  // 6. Add gateway_method column
  {
    name: "Add gateway_method column",
    sql: `
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'payments' AND column_name = 'gateway_method'
          ) THEN
              ALTER TABLE payments ADD COLUMN gateway_method VARCHAR(100);
              RAISE NOTICE 'Added gateway_method column to payments table';
          ELSE
              RAISE NOTICE 'gateway_method column already exists in payments table';
          END IF;
      END
      $$;
    `
  },

  // 7. Add gateway_transaction_id column
  {
    name: "Add gateway_transaction_id column",
    sql: `
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'payments' AND column_name = 'gateway_transaction_id'
          ) THEN
              ALTER TABLE payments ADD COLUMN gateway_transaction_id VARCHAR(255);
              RAISE NOTICE 'Added gateway_transaction_id column to payments table';
          ELSE
              RAISE NOTICE 'gateway_transaction_id column already exists in payments table';
          END IF;
      END
      $$;
    `
  },

  // 8. Add virtual_account_info JSONB column
  {
    name: "Add virtual_account_info JSONB column",
    sql: `
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'payments' AND column_name = 'virtual_account_info'
          ) THEN
              ALTER TABLE payments ADD COLUMN virtual_account_info JSONB;
              RAISE NOTICE 'Added virtual_account_info column to payments table';
          ELSE
              RAISE NOTICE 'virtual_account_info column already exists in payments table';
          END IF;
      END
      $$;
    `
  },

  // 9. Add gateway_metadata JSONB column with default
  {
    name: "Add gateway_metadata JSONB column",
    sql: `
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns
              WHERE table_name = 'payments' AND column_name = 'gateway_metadata'
          ) THEN
              ALTER TABLE payments ADD COLUMN gateway_metadata JSONB DEFAULT '{}'::jsonb;
              RAISE NOTICE 'Added gateway_metadata column to payments table';
          ELSE
              RAISE NOTICE 'gateway_metadata column already exists in payments table';
          END IF;
      END
      $$;
    `
  }
];

/**
 * Performance indexes to create after column additions
 */
const indexStatements = [
  {
    name: "Index on payment_key",
    sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_payment_key ON payments(payment_key) WHERE payment_key IS NOT NULL;"
  },
  {
    name: "Index on channel_key",
    sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_channel_key ON payments(channel_key) WHERE channel_key IS NOT NULL;"
  },
  {
    name: "Index on store_id",
    sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_store_id ON payments(store_id) WHERE store_id IS NOT NULL;"
  },
  {
    name: "Index on gateway_transaction_id",
    sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_gateway_transaction_id ON payments(gateway_transaction_id) WHERE gateway_transaction_id IS NOT NULL;"
  },
  {
    name: "Composite PortOne lookup index",
    sql: "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_portone_lookup ON payments(payment_method, payment_key, payment_status) WHERE payment_method = 'portone' AND payment_key IS NOT NULL;"
  }
];

/**
 * Documentation comments for the new columns
 */
const commentStatements = [
  {
    name: "Comment on channel_key",
    sql: "COMMENT ON COLUMN payments.channel_key IS 'PortOne V2 channel key for payment processing';"
  },
  {
    name: "Comment on store_id",
    sql: "COMMENT ON COLUMN payments.store_id IS 'PortOne V2 store identifier';"
  },
  {
    name: "Comment on payment_key",
    sql: "COMMENT ON COLUMN payments.payment_key IS 'PortOne V2 unique payment identifier';"
  },
  {
    name: "Comment on gateway_method",
    sql: "COMMENT ON COLUMN payments.gateway_method IS 'PortOne V2 specific payment method (e.g., card, virtual_account, phone)';"
  },
  {
    name: "Comment on gateway_transaction_id",
    sql: "COMMENT ON COLUMN payments.gateway_transaction_id IS 'PortOne V2 transaction ID for tracking';"
  },
  {
    name: "Comment on virtual_account_info",
    sql: "COMMENT ON COLUMN payments.virtual_account_info IS 'Virtual account details from PortOne (bank, account number, holder name, due date)';"
  },
  {
    name: "Comment on gateway_metadata",
    sql: "COMMENT ON COLUMN payments.gateway_metadata IS 'PortOne V2 specific metadata and additional fields';"
  }
];

/**
 * Execute a single SQL statement using Supabase
 */
async function executeSQLStatement(supabase: any, statement: { name: string; sql: string }): Promise<boolean> {
  try {
    log.info(`Executing: ${statement.name}`);

    const { data, error } = await supabase.rpc('execute_sql', {
      sql_query: statement.sql
    });

    if (error) {
      log.error(`Failed to execute ${statement.name}: ${error.message}`);
      return false;
    }

    log.success(`Completed: ${statement.name}`);
    return true;
  } catch (error) {
    log.error(`Error executing ${statement.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Verify that the migration was successful
 */
async function verifyMigration(supabase: any): Promise<boolean> {
  try {
    log.info('Verifying migration results...');

    // Try to query all new columns
    const { error } = await supabase
      .from('payments')
      .select('channel_key, store_id, payment_key, gateway_method, gateway_transaction_id, virtual_account_info, gateway_metadata')
      .limit(1);

    if (error) {
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        log.error('Some PortOne V2 columns are missing from the payments table');
        return false;
      }
      log.warning(`Column verification query failed: ${error.message}`);
      return false;
    }

    log.success('All PortOne V2 columns are accessible!');
    return true;
  } catch (error) {
    log.error(`Migration verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

/**
 * Main migration execution function
 */
async function runMigration(): Promise<void> {
  try {
    log.header('PortOne V2 Database Migration');

    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }

    log.info(`Supabase URL: ${SUPABASE_URL}`);
    log.info('Initializing Supabase client with service role key...');

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Test connection
    log.info('Testing database connection...');
    const { data: testData, error: testError } = await supabase
      .from('payments')
      .select('id')
      .limit(1);

    if (testError && testError.code !== 'PGRST116') {
      throw new Error(`Database connection failed: ${testError.message}`);
    }
    log.success('Database connection successful');

    // Check if migration is already applied
    const alreadyMigrated = await verifyMigration(supabase);
    if (alreadyMigrated) {
      log.success('🎉 Migration appears to already be applied successfully!');
      return;
    }

    // Execute migration statements
    log.info('Starting migration execution...');
    let successCount = 0;
    let failureCount = 0;

    // Execute column additions
    log.info('Phase 1: Adding columns and updating enums...');
    for (const statement of migrationStatements) {
      const success = await executeSQLStatement(supabase, statement);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    // Execute index creation
    log.info('Phase 2: Creating performance indexes...');
    for (const statement of indexStatements) {
      const success = await executeSQLStatement(supabase, statement);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    // Execute comment additions
    log.info('Phase 3: Adding documentation comments...');
    for (const statement of commentStatements) {
      const success = await executeSQLStatement(supabase, statement);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    // Final verification
    log.info('Phase 4: Verifying migration...');
    const migrationSuccess = await verifyMigration(supabase);

    // Report results
    console.log('\n' + '='.repeat(70));
    log.info(`Migration Summary:`);
    log.success(`Successful operations: ${successCount}`);
    if (failureCount > 0) {
      log.warning(`Failed operations: ${failureCount}`);
    }

    if (migrationSuccess) {
      log.success('🎉 PortOne V2 migration completed successfully!');
      log.success('All required columns and indexes have been created.');
    } else {
      log.warning('⚠️ Migration completed with some issues. Manual verification recommended.');
    }

  } catch (error) {
    log.error(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

// Execute the migration
if (require.main === module) {
  runMigration();
}

export { runMigration };