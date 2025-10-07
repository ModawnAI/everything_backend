import { getSupabaseClient } from '../src/config/database';

const supabase = getSupabaseClient();

async function checkUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, phone_number, name')
    .limit(20);
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Found ${data?.length || 0} users:`);
    console.table(data);
  }
}

checkUsers();
