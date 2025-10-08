#!/usr/bin/env ts-node

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

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

    console.log('📋 Reading migration SQL file...');

    try {
        const migrationSql = readFileSync(
            join(__dirname, 'sql', 'portone_v2_schema_migration.sql'),
            'utf-8'
        );

        console.log('🚀 Executing PortOne V2 schema migration...');

        // Split the migration into smaller chunks to avoid potential issues
        const sqlStatements = migrationSql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        let successCount = 0;
        let totalStatements = sqlStatements.length;

        for (const [index, statement] of sqlStatements.entries()) {
            if (statement.toUpperCase().includes('BEGIN') ||
                statement.toUpperCase().includes('COMMIT')) {
                continue; // Skip transaction control statements
            }

            try {
                console.log(`⏳ Executing statement ${index + 1}/${totalStatements}...`);

                const { data, error } = await supabase.rpc('query', {
                    query: statement
                });

                if (error) {
                    console.warn(`⚠️  Warning on statement ${index + 1}:`, error.message);
                    // Continue with other statements even if one fails
                } else {
                    successCount++;
                }
            } catch (err) {
                console.warn(`⚠️  Error on statement ${index + 1}:`, err);
            }
        }

        console.log(`✅ Migration completed! ${successCount}/${totalStatements} statements executed successfully.`);

    } catch (err) {
        console.error('❌ Error reading migration file:', err);
        process.exit(1);
    }
}

// Run the migration
runPortOneMigration().catch(console.error);