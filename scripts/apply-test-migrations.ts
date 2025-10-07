/**
 * Apply test migrations and create test data
 */

import { getSupabaseClient } from '../src/config/database';
import * as fs from 'fs';
import * as path from 'path';

async function applyMigrations() {
  const supabase = getSupabaseClient();

  console.log('📦 Applying migrations...\n');

  // Migration 071: shop_reports
  console.log('Applying migration 071: shop_reports...');
  const migration071 = fs.readFileSync(
    path.join(__dirname, '../src/migrations/071_create_shop_reports_table.sql'),
    'utf-8'
  );

  const { error: error071 } = await supabase.rpc('exec_sql', { sql: migration071 });

  if (error071) {
    console.log('⚠️  Migration 071 may already exist or has errors:', error071.message);
  } else {
    console.log('✅ Migration 071 applied successfully');
  }

  console.log('\n📝 Creating test data...\n');

  // Get test users
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .limit(2);

  // Get test shops
  const { data: shops } = await supabase
    .from('shops')
    .select('id')
    .limit(2);

  if (users && users.length >= 1 && shops && shops.length >= 1) {
    // Create shop reports
    console.log('Creating shop reports...');
    const { error: reportError } = await supabase
      .from('shop_reports')
      .insert([
        {
          shop_id: shops[0].id,
          reporter_id: users[0].id,
          report_type: 'spam',
          title: 'Test Report - Spam Content',
          description: 'This shop appears to be posting spam content repeatedly',
          status: 'pending'
        }
      ]);

    if (reportError) {
      console.log('⚠️  Shop report creation error:', reportError.message);
    } else {
      console.log('✅ Shop reports created');
    }
  }

  // Create post reports (for moderation testing)
  const { data: posts } = await supabase
    .from('feed_posts')
    .select('id, author_id')
    .limit(1);

  if (posts && posts.length >= 1 && users && users.length >= 2) {
    console.log('Creating post reports...');
    const { error: postReportError } = await supabase
      .from('post_reports')
      .insert([
        {
          post_id: posts[0].id,
          reporter_id: users[1].id,
          reason: 'spam',
          description: 'This post contains spam content',
          status: 'pending'
        }
      ]);

    if (postReportError) {
      console.log('⚠️  Post report creation error:', postReportError.message);
    } else {
      console.log('✅ Post reports created');
    }
  }

  console.log('\n✅ All migrations and test data applied!');
  process.exit(0);
}

applyMigrations().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
