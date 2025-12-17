import { config } from 'dotenv';
config(); // Load .env file

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    const migrationFile = path.join(__dirname, '../supabase/migrations/20251226_portone_v2_enhancements.sql');
    console.log(`📄 Reading migration: ${migrationFile}`);
    const sql = fs.readFileSync(migrationFile, 'utf-8');

    console.log(`🔄 Executing PortOne V2 enhancements migration...`);
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📊 Changes applied:');
    console.log('   ✓ Added payment_stage, cancelled_amount, cancellable_amount columns to payments table');
    console.log('   ✓ Created webhook_logs table for idempotency');
    console.log('   ✓ Created billing_keys table for saved payment methods');
    console.log('   ✓ Added indexes and RLS policies');
    console.log('   ✓ Updated existing payment records');
    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

runMigration();
