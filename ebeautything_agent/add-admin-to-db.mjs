import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ysrudwzwnzxrrwjtpuoh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzcnVkd3p3bnp4cnJ3anRwdW9oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDQ2OTAwMiwiZXhwIjoyMDcwMDQ1MDAyfQ.d2HQ0w4qW7ulyqaFN558wZaBDVIS_aUF_9PUFU6Rv1s'
);

// Get user from Supabase Auth
const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

if (listError) {
  console.error('Error listing users:', listError);
  process.exit(1);
}

const authUser = users.find(u => u.email === 'test@buasd.com');

if (!authUser) {
  console.error('User not found in Supabase Auth');
  process.exit(1);
}

console.log('Found user in Auth:', authUser.id, authUser.email);

// Update password
const { error: passwordError } = await supabase.auth.admin.updateUserById(
  authUser.id,
  { password: 'Kyungjin@1' }
);

if (passwordError) {
  console.error('Error updating password:', passwordError);
} else {
  console.log('✅ Password updated');
}

// Add to users table
const { error: insertError } = await supabase
  .from('users')
  .insert({
    id: authUser.id,
    email: 'test@buasd.com',
    name: 'Test Admin Buasd',
    user_role: 'admin',
    user_status: 'active',
    terms_accepted_at: new Date().toISOString(),
    privacy_accepted_at: new Date().toISOString()
  });

if (insertError) {
  console.error('Error inserting into users table:', insertError);
} else {
  console.log('✅ Admin added to users table: test@buasd.com / Kyungjin@1');
}
