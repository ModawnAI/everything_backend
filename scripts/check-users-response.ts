import { getSupabaseClient } from '../src/config/database';

const supabase = getSupabaseClient();

async function checkUsersData() {
  console.log('🔍 Checking users data...\n');
  
  const { data: users, error, count } = await supabase
    .from('users')
    .select('*', { count: 'exact' })
    .eq('user_role', 'user')
    .limit(3);
  
  console.log('Total user count:', count);
  console.log('Error:', error);
  console.log('\nFirst 3 users:');
  console.log(JSON.stringify(users, null, 2));
  
  // Check admin_users table
  console.log('\n\n🔍 Checking admin_users data...\n');
  const { data: admins, count: adminCount } = await supabase
    .from('admin_users')
    .select('*', { count: 'exact' })
    .limit(2);
  
  console.log('Total admin count:', adminCount);
  console.log('\nFirst 2 admins:');
  console.log(JSON.stringify(admins, null, 2));
}

checkUsersData();
