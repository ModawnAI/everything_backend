import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findFcmToken() {
  const email = 'dcwpxx42yy@privaterelay.appleid.com';

  console.log('🔍 Searching for user and FCM token...\n');

  // First, find the user by email
  const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('❌ Error fetching auth users:', authError);
    return;
  }

  const user = authUser.users.find(u => u.email === email);

  if (!user) {
    console.log('❌ User not found with email:', email);
    return;
  }

  console.log('✅ User found:');
  console.log('   User ID:', user.id);
  console.log('   Email:', user.email);
  console.log('   Created:', user.created_at);
  console.log('');

  // Now find FCM tokens for this user
  const { data: fcmTokens, error: fcmError } = await supabase
    .from('push_tokens')
    .select('*')
    .eq('user_id', user.id);

  if (fcmError) {
    console.error('❌ Error fetching FCM tokens:', fcmError);
    return;
  }

  if (!fcmTokens || fcmTokens.length === 0) {
    console.log('⚠️  No FCM tokens found for this user');
    return;
  }

  console.log(`📱 FCM Tokens found: ${fcmTokens.length}\n`);

  fcmTokens.forEach((token, index) => {
    console.log(`Token ${index + 1}:`);
    console.log('   Token:', token.token);
    console.log('   Device Type:', token.device_type || 'N/A');
    console.log('   Device ID:', token.device_id || 'N/A');
    console.log('   Created:', token.created_at);
    console.log('   Updated:', token.updated_at);
    console.log('   Is Active:', token.is_active);
    console.log('');
  });
}

findFcmToken().catch(console.error);
