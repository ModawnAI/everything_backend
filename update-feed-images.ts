import { getSupabaseClient } from './src/config/database';

(async () => {
  const supabase = getSupabaseClient();
  const newImageUrl = 'https://kiarasky.com/cdn/shop/products/2_be391926-9373-43e4-85a3-d044bb866163_800x.png?v=1648858149';

  console.log('Updating all feed images to:', newImageUrl);

  // Update all feed_posts images
  const { data, error } = await supabase
    .from('feed_posts')
    .update({ image_url: newImageUrl })
    .not('image_url', 'is', null)
    .select('id, image_url');

  if (error) {
    console.error('Error updating feed_posts:', error.message);
  } else {
    console.log(`✅ Updated ${data?.length || 0} feed_posts images`);
  }

  // Update feed_images table if it exists
  const { data: feedImages, error: feedImagesError } = await supabase
    .from('feed_images')
    .update({ image_url: newImageUrl })
    .not('image_url', 'is', null)
    .select('id, image_url');

  if (feedImagesError) {
    console.log('feed_images table does not exist or error:', feedImagesError.message);
  } else if (feedImages) {
    console.log(`✅ Updated ${feedImages.length} feed_images records`);
  }

  console.log('\n✅ All feed images updated successfully!');
  process.exit(0);
})();
