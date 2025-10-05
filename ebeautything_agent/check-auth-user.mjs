import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ysrudwzwnzxrrwjtpuoh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzcnVkd3p3bnp4cnJ3anRwdW9oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDQ2OTAwMiwiZXhwIjoyMDcwMDQ1MDAyfQ.d2HQ0w4qW7ulyqaFN558wZaBDVIS_aUF_9PUFU6Rv1s'
);

const { data, error } = await supabase.auth.admin.listUsers();
if (error) console.error('Error:', error);
else {
  const adminUser = data.users.find(u => u.email === 'admin@ebeautything.com');
  console.log('Admin user in Supabase Auth:', JSON.stringify(adminUser, null, 2));
}
