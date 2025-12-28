import { getSupabaseClient } from './src/config/database';

(async () => {
  const supabase = getSupabaseClient();
  const newImageUrl = 'https://i.imgur.com/lMNiOrG.png';

  console.log('Replacing ALL user profile images with:', newImageUrl);
  console.log('');

  // Get all users first
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name, email, user_role, shop_id');

  console.log(`Found ${allUsers?.length || 0} total users`);

  let updated = 0;
  let failed = 0;

  // Update each user individually to handle shop_id constraints
  for (const user of allUsers || []) {
    const { error } = await supabase
      .from('users')
      .update({ profile_image_url: newImageUrl })
      .eq('id', user.id);

    if (error) {
      console.log(`❌ Failed to update user ${user.email}: ${error.message}`);
      failed++;
    } else {
      updated++;
    }
  }

  console.log('');
  console.log('=== Summary ===');
  console.log(`✅ Successfully updated: ${updated} users`);
  console.log(`❌ Failed to update: ${failed} users`);
  console.log('All user profile images now point to:', newImageUrl);

  process.exit(0);
})();
