#!/usr/bin/env node

/**
 * Simple spatial indexes creation script
 */

const fs = require('fs');
require('dotenv').config();

// Simple Supabase client setup
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQL(sql) {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      throw error;
    }
    return data;
  } catch (error) {
    console.error('SQL Error:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Creating spatial indexes...\n');
    
    const sqlStatements = [
      "DROP INDEX IF EXISTS public.idx_shops_category",
      "DROP INDEX IF EXISTS public.idx_shops_status", 
      "DROP INDEX IF EXISTS public.idx_shops_type",
      
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_active_category_location 
       ON public.shops USING GIST (location, main_category) 
       WHERE shop_status = 'active' AND location IS NOT NULL`,
       
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_type_status_location 
       ON public.shops USING GIST (location, shop_type) 
       WHERE shop_status = 'active' AND location IS NOT NULL`,
       
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_category_status_location 
       ON public.shops USING GIST (location, main_category, shop_status) 
       WHERE location IS NOT NULL`,
       
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_featured_location 
       ON public.shops USING GIST (location) 
       WHERE is_featured = true AND featured_until > NOW() AND shop_status = 'active' AND location IS NOT NULL`,
       
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_category_active 
       ON public.shops (main_category) WHERE shop_status = 'active'`,
       
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_type_active 
       ON public.shops (shop_type) WHERE shop_status = 'active'`,
       
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_status_btree 
       ON public.shops (shop_status)`,
       
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_featured_time 
       ON public.shops (is_featured, featured_until) WHERE shop_status = 'active'`,
       
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_type_category_active 
       ON public.shops (shop_type, main_category) WHERE shop_status = 'active'`,
       
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shops_owner_status 
       ON public.shops (owner_id, shop_status)`,
       
      "ANALYZE public.shops"
    ];
    
    for (let i = 0; i < sqlStatements.length; i++) {
      const sql = sqlStatements[i];
      console.log(`📝 Executing statement ${i + 1}/${sqlStatements.length}...`);
      console.log(`   ${sql.substring(0, 80)}...`);
      
      try {
        await executeSQL(sql);
        console.log(`   ✅ Success`);
      } catch (error) {
        console.log(`   ⚠️  Warning: ${error.message}`);
        // Continue with other statements even if one fails
      }
    }
    
    console.log('\n🎉 Spatial indexes creation completed!');
    
  } catch (error) {
    console.error('\n💥 Failed:', error.message);
    process.exit(1);
  }
}

main();
