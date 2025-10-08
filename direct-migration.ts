#!/usr/bin/env ts-node

import { createClient } from '@supabase/supabase-js';

async function runPortOneMigration() {
    console.log('🔧 Initializing Supabase client...');

    const supabaseUrl = 'https://ysrudwzwnzxrrwjtpuoh.supabase.co';
    const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzcnVkd3p3bnp4cnJ3anRwdW9oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDQ2OTAwMiwiZXhwIjoyMDcwMDQ1MDAyfQ.d2HQ0w4qW7ulyqaFN558wZaBDVIS_aUF_9PUFU6Rv1s';

    // Create Supabase client with service role key for admin operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    console.log('🚀 Starting PortOne V2 schema migration...');

    try {
        // Step 1: Check and add 'portone' to payment_method enum
        console.log('📋 Step 1: Adding "portone" to payment_method enum...');
        const { data: enumCheck, error: enumError } = await supabase.rpc('check_enum_value', {
            enum_name: 'payment_method',
            enum_value: 'portone'
        });

        if (enumError) {
            console.log('ℹ️  Enum check function not available, proceeding with direct query...');
        }

        // Step 2: Add new columns to payments table
        console.log('📋 Step 2: Adding new columns to payments table...');

        const newColumns = [
            { name: 'channel_key', type: 'VARCHAR(255)', comment: 'PortOne V2 channel key for payment processing' },
            { name: 'store_id', type: 'VARCHAR(255)', comment: 'PortOne V2 store identifier' },
            { name: 'payment_key', type: 'VARCHAR(255)', comment: 'PortOne V2 unique payment identifier' },
            { name: 'gateway_method', type: 'VARCHAR(100)', comment: 'PortOne V2 specific payment method (e.g., card, virtual_account, phone)' },
            { name: 'gateway_transaction_id', type: 'VARCHAR(255)', comment: 'PortOne V2 transaction ID for tracking' },
            { name: 'virtual_account_info', type: 'JSONB', comment: 'Virtual account details from PortOne (bank, account number, holder name, due date)' },
            { name: 'gateway_metadata', type: 'JSONB DEFAULT \'{}\'::jsonb', comment: 'PortOne V2 specific metadata and additional fields' }
        ];

        for (const column of newColumns) {
            console.log(`⏳ Adding column: ${column.name}...`);
            try {
                // Try to add column using a simple approach
                const { data, error } = await supabase
                    .from('information_schema.columns')
                    .select('column_name')
                    .eq('table_name', 'payments')
                    .eq('column_name', column.name);

                if (error) {
                    console.log(`ℹ️  Column ${column.name} check failed, assuming it doesn't exist`);
                }

                if (!data || data.length === 0) {
                    console.log(`✅ Column ${column.name} needs to be added`);
                } else {
                    console.log(`ℹ️  Column ${column.name} already exists`);
                }
            } catch (err) {
                console.log(`⚠️  Could not check column ${column.name}, proceeding...`);
            }
        }

        // Step 3: Test connection by querying the payments table structure
        console.log('📋 Step 3: Verifying payments table structure...');
        const { data: tableInfo, error: tableError } = await supabase
            .from('information_schema.columns')
            .select('column_name, data_type')
            .eq('table_name', 'payments');

        if (tableError) {
            console.error('❌ Cannot access table structure:', tableError);
        } else {
            console.log('✅ Current payments table columns:', tableInfo?.map(col => col.column_name).join(', '));
        }

        console.log('🎉 Migration inspection completed!');
        console.log('ℹ️  Note: Due to Supabase client limitations, actual DDL operations need to be performed through the SQL editor in the Supabase Dashboard or using the CLI.');

    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

// Run the migration
runPortOneMigration().catch(console.error);