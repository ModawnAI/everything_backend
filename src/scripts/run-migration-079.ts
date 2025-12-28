/**
 * Run migration 079 - Create editor_picks table
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function runMigration() {
  console.log('🚀 Running migration 079_create_editor_picks_table.sql...\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // First check if table already exists
  const { data: existingTable, error: checkError } = await supabase
    .from('editor_picks')
    .select('id')
    .limit(1);

  if (!checkError) {
    console.log('✅ Table editor_picks already exists. Skipping migration.');
    return;
  }

  if (checkError && !checkError.message.includes('does not exist')) {
    console.log('⚠️ Table might exist with RLS blocking access. Checking via query...');
  }

  // Run the CREATE TABLE statement via raw SQL
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS editor_picks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
      title VARCHAR(200),
      description TEXT,
      display_order INT DEFAULT 0,
      active BOOLEAN DEFAULT TRUE,
      start_date DATE,
      end_date DATE,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  // Use Supabase's SQL execution via REST API
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql: createTableSQL }),
  });

  if (!response.ok) {
    // The exec_sql RPC might not exist, let's try using Supabase dashboard SQL editor approach
    console.log('ℹ️ Direct SQL execution not available via REST API.');
    console.log('📋 Please run the following SQL in Supabase Dashboard SQL Editor:\n');
    console.log('==================== SQL ====================');
    const sqlContent = fs.readFileSync(
      path.join(__dirname, '../migrations/079_create_editor_picks_table.sql'),
      'utf-8'
    );
    console.log(sqlContent);
    console.log('=============================================\n');
    console.log('🔗 Dashboard URL: https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh/sql/new');
    return;
  }

  console.log('✅ Migration completed successfully!');

  // Verify
  const { data, error } = await supabase.from('editor_picks').select('id').limit(1);
  if (error) {
    console.log('⚠️ Verification failed:', error.message);
  } else {
    console.log('✅ Table verified successfully!');
  }
}

runMigration().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
