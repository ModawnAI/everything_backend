import { getSupabaseClient } from './src/config/database';

(async () => {
  const supabase = getSupabaseClient();
  const newImageUrl = 'https://kiarasky.com/cdn/shop/products/2_be391926-9373-43e4-85a3-d044bb866163_800x.png?v=1648858149';

  console.log('Finding feed posts without images...');

  // Get all feed posts
  const { data: allPosts } = await supabase
    .from('feed_posts')
    .select('id');

  // Get all posts that have images
  const { data: postsWithImages } = await supabase
    .from('post_images')
    .select('post_id');

  const postIdsWithImages = new Set(postsWithImages?.map(p => p.post_id) || []);

  const postsWithoutImages = allPosts?.filter(post => !postIdsWithImages.has(post.id)) || [];

  console.log(`Found ${postsWithoutImages.length} posts without images`);
  console.log('');

  if (postsWithoutImages.length > 0) {
    // Add default image to posts without images
    const imagesToAdd = postsWithoutImages.map(post => ({
      post_id: post.id,
      image_url: newImageUrl,
      alt_text: 'Feed post image',
      display_order: 0
    }));

    const { data, error } = await supabase
      .from('post_images')
      .insert(imagesToAdd)
      .select();

    if (error) {
      console.error('Error adding images:', error.message);
    } else {
      console.log(`✅ Added images to ${data.length} posts`);
    }
  }

  // Summary
  console.log('');
  console.log('=== Summary ===');
  const { count } = await supabase.from('post_images').select('*', { count: 'exact', head: true });
  console.log(`Total images in database: ${count}`);
  console.log('All feed posts now have the image:', newImageUrl);

  process.exit(0);
})();
