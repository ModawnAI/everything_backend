/**
 * Find All Admin Accounts
 * Lists all admin users in both auth.users and public.users
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function findAllAdmins() {
  console.log('🔍 Finding All Admin Accounts\n');
  console.log('='.repeat(60));

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Check public.users
  console.log('\n📋 Admin accounts in public.users:');
  console.log('-'.repeat(60));

  const { data: publicAdmins, error: publicError } = await serviceClient
    .from('users')
    .select('id, email, name, user_role, user_status, created_at')
    .eq('user_role', 'admin');

  if (publicError) {
    console.error('❌ Error:', publicError.message);
  } else if (!publicAdmins || publicAdmins.length === 0) {
    console.log('⚠️  No admin users found in public.users');
  } else {
    publicAdmins.forEach((admin, index) => {
      console.log(`\n${index + 1}. ${admin.email}`);
      console.log(`   ID: ${admin.id}`);
      console.log(`   Name: ${admin.name}`);
      console.log(`   Status: ${admin.user_status}`);
      console.log(`   Created: ${admin.created_at}`);
    });
  }

  // 2. Check auth.users
  console.log('\n\n📋 Admin accounts in auth.users:');
  console.log('-'.repeat(60));

  const { data: authData, error: authError } = await serviceClient.auth.admin.listUsers();

  if (authError) {
    console.error('❌ Error:', authError.message);
  } else if (!authData || !authData.users) {
    console.log('⚠️  No users found in auth.users');
  } else {
    const authAdmins = authData.users.filter((u: any) =>
      u.email?.includes('admin') ||
      publicAdmins?.some(p => p.id === u.id)
    );

    if (authAdmins.length === 0) {
      console.log('⚠️  No admin-related users found in auth.users');
    } else {
      authAdmins.forEach((admin: any, index: number) => {
        console.log(`\n${index + 1}. ${admin.email}`);
        console.log(`   ID: ${admin.id}`);
        console.log(`   Created: ${admin.created_at}`);
        console.log(`   Last Sign In: ${admin.last_sign_in_at || 'Never'}`);
        console.log(`   Confirmed: ${admin.email_confirmed_at ? 'Yes' : 'No'}`);

        // Check if matches public.users
        const matchingPublic = publicAdmins?.find(p => p.id === admin.id);
        if (matchingPublic) {
          console.log(`   ✅ Linked to public.users: ${matchingPublic.email}`);
        } else {
          console.log(`   ⚠️  No matching record in public.users`);
        }
      });
    }
  }

  // 3. Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total admin accounts in public.users: ${publicAdmins?.length || 0}`);
  console.log(`Total accounts in auth.users: ${authData?.users.length || 0}`);

  // Find orphaned accounts
  const orphanedAuth = authData?.users.filter((au: any) =>
    !publicAdmins?.some(pu => pu.id === au.id)
  );

  const orphanedPublic = publicAdmins?.filter(pu =>
    !authData?.users.some((au: any) => au.id === pu.id)
  );

  if (orphanedAuth && orphanedAuth.length > 0) {
    console.log(`\n⚠️  Orphaned auth.users (no public.users match): ${orphanedAuth.length}`);
    orphanedAuth.forEach((u: any) => {
      console.log(`   - ${u.email} (${u.id})`);
    });
  }

  if (orphanedPublic && orphanedPublic.length > 0) {
    console.log(`\n⚠️  Orphaned public.users (no auth.users match): ${orphanedPublic.length}`);
    orphanedPublic.forEach((u: any) => {
      console.log(`   - ${u.email} (${u.id})`);
    });
  }

  console.log('\n' + '='.repeat(60));
}

findAllAdmins()
  .then(() => {
    console.log('\n✅ Search complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Search failed:', error);
    process.exit(1);
  });
