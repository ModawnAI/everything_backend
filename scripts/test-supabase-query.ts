import { getSupabaseClient } from '../src/config/database';

async function testQuery() {
  const supabase = getSupabaseClient();

  console.log('Testing direct Supabase query...');

  try {
    const { data, count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(0, 2);

    if (error) {
      console.error('Error:', error);
    } else {
      console.log('Success! Count:', count, 'Results:', data?.length);
      console.log('First user:', data?.[0]?.email);
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

testQuery()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
