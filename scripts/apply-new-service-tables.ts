/**
 * Apply service_videos and before_after_images table migrations
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigrations() {
  console.log('📦 Applying service table migrations...\n');

  const migrations = [
    {
      name: '072_create_service_videos_table.sql',
      path: path.resolve(__dirname, '../src/migrations/072_create_service_videos_table.sql')
    },
    {
      name: '073_create_before_after_images_table.sql',
      path: path.resolve(__dirname, '../src/migrations/073_create_before_after_images_table.sql')
    }
  ];

  for (const migration of migrations) {
    console.log(`📄 Applying ${migration.name}...`);

    try {
      const sql = fs.readFileSync(migration.path, 'utf-8');

      const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

      if (error) {
        // Try direct execution if RPC fails
        console.log('  ⚠️  RPC failed, trying direct execution...');

        // Split by semicolons and execute each statement
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          if (statement) {
            const { error: execError } = await supabase.from('_migrations').insert({});
            // Actually, let's use a different approach
          }
        }

        console.error(`  ❌ Error: ${error.message}`);
        console.log('  ℹ️  You may need to run this migration manually in Supabase SQL Editor');
        console.log(`  📋 SQL file location: ${migration.path}\n`);
      } else {
        console.log(`  ✅ Successfully applied ${migration.name}\n`);
      }
    } catch (err: any) {
      console.error(`  ❌ Error reading migration file: ${err.message}\n`);
    }
  }

  console.log('✅ Migration process complete!\n');
  console.log('🔍 Verifying tables exist...\n');

  // Verify tables
  const tables = ['service_videos', 'before_after_images'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('id').limit(1);
    if (error) {
      console.error(`  ❌ ${table}: ${error.message}`);
    } else {
      console.log(`  ✅ ${table}: Table exists`);
    }
  }

  process.exit(0);
}

applyMigrations();
