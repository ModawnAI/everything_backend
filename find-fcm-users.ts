import { getSupabaseClient } from './src/config/database';

async function findUsersWithFCM() {
  const db = getSupabaseClient();

  console.log('Finding users with FCM tokens...');
  console.log('');

  // Get all FCM tokens grouped by user
  const { data: tokens, error } = await db
    .from('push_tokens')
    .select('user_id, token, platform, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  if (!tokens || tokens.length === 0) {
    console.log('No FCM tokens found in database');
    return;
  }

  // Group by user
  const userTokens = new Map();
  tokens.forEach(token => {
    if (!userTokens.has(token.user_id)) {
      userTokens.set(token.user_id, []);
    }
    userTokens.get(token.user_id).push(token);
  });

  console.log(`Found ${userTokens.size} users with FCM tokens`);
  console.log('');

  // Get user details for each
  for (const [userId, userTokensList] of userTokens.entries()) {
    const { data: user } = await db
      .from('users')
      .select('id, email, full_name')
      .eq('id', userId)
      .single();

    console.log(`User: ${user?.email || 'Unknown'}`);
    console.log(`  ID: ${userId}`);
    console.log(`  Name: ${user?.full_name || 'N/A'}`);
    console.log(`  Tokens: ${userTokensList.length}`);
    userTokensList.forEach((t: any, i: number) => {
      console.log(`    ${i+1}. ${t.platform}: ${t.token.substring(0, 40)}...`);
    });
    console.log('');
  }

  // Return first user with token for testing
  const firstUserId = Array.from(userTokens.keys())[0];
  console.log(`TEST USER ID: ${firstUserId}`);
}

findUsersWithFCM().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
