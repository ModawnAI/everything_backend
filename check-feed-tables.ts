import { getSupabaseClient } from './src/config/database';

(async () => {
  const supabase = getSupabaseClient();

  const feedTables = [
    'feed_posts',
    'feed_post',
    'feed_image',
    'feed_images',
    'feed_post_image',
    'feed_post_images',
    'feed_media',
    'feed_content'
  ];

  console.log('Checking feed-related tables:\n');

  for (const tableName of feedTables) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (!error) {
        console.log(`✅ ${tableName}: ${count} rows`);

        // Get sample row to see columns
        const { data } = await supabase.from(tableName).select('*').limit(1);
        if (data && data.length > 0) {
          console.log('   Columns:', Object.keys(data[0]).join(', '));
          console.log('');
        } else {
          console.log('   (empty table)');
          console.log('');
        }
      }
    } catch (e) {
      // Table doesn't exist, skip
    }
  }

  process.exit(0);
})();
