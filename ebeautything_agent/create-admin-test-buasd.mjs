import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ysrudwzwnzxrrwjtpuoh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzcnVkd3p3bnp4cnJ3anRwdW9oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDQ2OTAwMiwiZXhwIjoyMDcwMDQ1MDAyfQ.d2HQ0w4qW7ulyqaFN558wZaBDVIS_aUF_9PUFU6Rv1s'
);

// Create new admin user
const { data, error } = await supabase.auth.admin.createUser({
  email: 'test@buasd.com',
  password: 'Kyungjin@1',
  email_confirm: true,
  user_metadata: {
    name: 'Test Admin Buasd'
  }
});

if (error) {
  console.error('Error creating user:', error);
} else {
  console.log('User created successfully:', data.user.id);

  // Add to users table
  const { error: insertError } = await supabase
    .from('users')
    .insert({
      id: data.user.id,
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
    console.log('✅ Admin created: test@buasd.com / Kyungjin@1');
  }
}
