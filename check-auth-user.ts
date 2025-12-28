import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

(async () => {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Get user from auth
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  const user = users?.find(u => u.email === 'shopowner@test.com');

  if (!user) {
    console.log('User not found in auth');
    process.exit(1);
  }

  console.log('User Status:', user.banned ? 'BANNED' : 'ACTIVE');
  console.log('Email Confirmed:', user.email_confirmed_at ? 'YES' : 'NO');
  console.log('Last Sign In:', user.last_sign_in_at || 'Never');
  console.log('User ID:', user.id);

  // Unban if banned
  if (user.banned) {
    console.log('\nUnbanning user...');
    const { error: unbanError } = await supabase.auth.admin.updateUserById(user.id, {
      ban_duration: 'none'
    });

    if (unbanError) {
      console.error('Failed to unban:', unbanError.message);
    } else {
      console.log('✅ User unbanned successfully');
    }
  }

  process.exit(0);
})();
