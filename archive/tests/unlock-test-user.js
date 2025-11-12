const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ysrudwzwnzxrrwjtpuoh.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzcnVkd3p3bnp4cnJ3anRwdW9oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDQ2OTAwMiwiZXhwIjoyMDcwMDQ1MDAyfQ.d2HQ0w4qW7ulyqaFN558wZaBDVIS_aUF_9PUFU6Rv1s'
);

(async () => {
  console.log('Unlocking test shop owner user...\n');

  // Unlock the user
  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update({
      is_locked: false,
      locked_at: null,
      user_status: 'active'
    })
    .eq('email', 'shopowner@test.com')
    .select()
    .single();

  if (updateError) {
    console.error('Error unlocking user:', updateError);
    return;
  }

  console.log('User unlocked successfully');
  console.log('   User ID:', updatedUser.id);
  console.log('   Email:', updatedUser.email);
  console.log('   Role:', updatedUser.user_role);
  console.log('   Status:', updatedUser.user_status);
  console.log('   Shop ID:', updatedUser.shop_id);
  console.log('   Shop Name:', updatedUser.shop_name);

  // Check if shop exists
  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('*')
    .eq('id', updatedUser.shop_id)
    .single();

  if (shopError) {
    console.log('\nShop not found in shops table');
  } else {
    console.log('\nShop Details:');
    console.log('   Shop ID:', shop.id);
    console.log('   Name:', shop.name);
    console.log('   Status:', shop.shop_status);
    console.log('   Verification:', shop.verification_status);
    console.log('   Address:', shop.address);
    console.log('   Phone:', shop.phone_number);

    // Ensure shop is active and approved
    if (shop.shop_status !== 'active' || shop.verification_status !== 'approved') {
      console.log('\n   Updating shop status...');
      const { error: shopUpdateError } = await supabase
        .from('shops')
        .update({
          shop_status: 'active',
          verification_status: 'approved'
        })
        .eq('id', shop.id);

      if (!shopUpdateError) {
        console.log('   Shop status updated to active and approved');
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST SHOP OWNER READY!');
  console.log('='.repeat(60));
  console.log('\nCredentials:');
  console.log('   Email:    shopowner@test.com');
  console.log('   Password: Test1234!');
  console.log('\nLogin URL:');
  console.log('   Shop Admin: http://localhost:3002/login');
  console.log('='.repeat(60));
})();
