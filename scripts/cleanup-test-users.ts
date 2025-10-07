import { getSupabaseClient } from '../src/config/database';

const supabase = getSupabaseClient();

async function cleanup() {
  console.log('🗑️ Cleaning up ALL existing users (for fresh seed)...\n');

  // Delete all users
  const { error } = await supabase
    .from('users')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (dummy condition)

  if (error) {
    console.error('Error during cleanup:', error);
  } else {
    console.log('✅ Cleanup complete!\n');
  }
}

cleanup();
