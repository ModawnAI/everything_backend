/**
 * Admin Authentication Diagnostic Script
 * Checks auth.users and public.users sync status for admin account
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const ADMIN_EMAIL = 'admin@ebeautything.com';

async function checkAdminAuth() {
  console.log('🔍 Admin Authentication Diagnostic\n');
  console.log('=' .repeat(60));

  // Create clients
  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // 1. Check public.users table
  console.log('\n📋 Step 1: Checking public.users table');
  console.log('-'.repeat(60));

  const { data: publicUser, error: publicError } = await serviceClient
    .from('users')
    .select('id, email, user_role, user_status, created_at, last_login_at')
    .eq('email', ADMIN_EMAIL)
    .eq('user_role', 'admin')
    .maybeSingle();

  if (publicError) {
    console.error('❌ Error querying public.users:', publicError.message);
  } else if (!publicUser) {
    console.log('⚠️  Admin user NOT FOUND in public.users');
  } else {
    console.log('✅ Admin found in public.users:');
    console.log('   - ID:', publicUser.id);
    console.log('   - Email:', publicUser.email);
    console.log('   - Role:', publicUser.user_role);
    console.log('   - Status:', publicUser.user_status);
    console.log('   - Created:', publicUser.created_at);
    console.log('   - Last Login:', publicUser.last_login_at || 'Never');
  }

  // 2. Check auth.users table (using admin API)
  console.log('\n📋 Step 2: Checking auth.users table');
  console.log('-'.repeat(60));

  const { data: authUsers, error: authError } = await serviceClient.auth.admin.listUsers();

  if (authError) {
    console.error('❌ Error querying auth.users:', authError.message);
  } else if (!authUsers || !authUsers.users) {
    console.error('❌ No users data returned from auth.users');
  } else {
    const authUser = authUsers.users.find((u: any) => u.email === ADMIN_EMAIL);

    if (!authUser) {
      console.log('❌ Admin user NOT FOUND in auth.users');
      console.log('   This is the problem! Auth verification will always fail.');
    } else {
      console.log('✅ Admin found in auth.users:');
      console.log('   - ID:', authUser.id);
      console.log('   - Email:', authUser.email);
      console.log('   - Created:', authUser.created_at);
      console.log('   - Last Sign In:', authUser.last_sign_in_at || 'Never');
      console.log('   - Confirmed:', authUser.email_confirmed_at ? 'Yes' : 'No');

      // Check if IDs match
      if (publicUser && authUser.id !== publicUser.id) {
        console.log('⚠️  WARNING: ID mismatch between auth.users and public.users!');
        console.log('   - auth.users ID:', authUser.id);
        console.log('   - public.users ID:', publicUser.id);
      }
    }
  }

  // 3. Test password authentication
  console.log('\n📋 Step 3: Testing password authentication');
  console.log('-'.repeat(60));

  const testPasswords = [
    'admin123',
    'Admin123!',
    'password',
    'admin@123'
  ];

  console.log('⚠️  Note: This will try common test passwords');
  console.log('   If none work, you need to reset the password in Supabase\n');

  for (const password of testPasswords) {
    const { data, error } = await anonClient.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: password
    });

    if (!error && data.user) {
      console.log(`✅ SUCCESS! Password is: "${password}"`);
      console.log('   User ID:', data.user.id);

      // Sign out
      await anonClient.auth.signOut();
      break;
    } else {
      console.log(`❌ Password "${password}" failed:`, error?.message || 'Unknown error');
    }
  }

  // 4. Check admin_sessions table
  console.log('\n📋 Step 4: Checking admin_sessions table');
  console.log('-'.repeat(60));

  const { data: sessions, error: sessionsError } = await serviceClient
    .from('admin_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (sessionsError) {
    console.error('❌ Error querying admin_sessions:', sessionsError.message);
  } else if (!sessions || sessions.length === 0) {
    console.log('📭 No admin sessions found (no successful logins yet)');
  } else {
    console.log(`📊 Found ${sessions.length} recent sessions:`);
    sessions.forEach((session, index) => {
      console.log(`\n   Session ${index + 1}:`);
      console.log('   - Admin ID:', session.admin_id);
      console.log('   - IP:', session.ip_address);
      console.log('   - Active:', session.is_active);
      console.log('   - Created:', session.created_at);
      console.log('   - Expires:', session.expires_at);
    });
  }

  // 5. Summary and recommendations
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY & RECOMMENDATIONS');
  console.log('='.repeat(60));

  if (!publicUser) {
    console.log('\n🔴 CRITICAL: Admin user does not exist in public.users');
    console.log('   → Run seed script to create admin user');
  } else if (!authUsers?.users || !authUsers.users.find((u: any) => u.email === ADMIN_EMAIL)) {
    console.log('\n🔴 CRITICAL: Admin exists in public.users but NOT in auth.users');
    console.log('   → This is why login fails at password verification');
    console.log('\n💡 SOLUTIONS:');
    console.log('   1. Create admin in Supabase Dashboard:');
    console.log('      - Go to Authentication > Users');
    console.log('      - Add user with email:', ADMIN_EMAIL);
    console.log('      - Use the same ID as public.users:', publicUser.id);
    console.log('\n   2. Or use Supabase Admin API to create auth user:');
    console.log('      - See create-admin-auth-user.ts script');
  } else {
    console.log('\n✅ Both public.users and auth.users have admin account');
    console.log('   → If login still fails, check password or try reset');
  }

  console.log('\n' + '='.repeat(60));
}

// Run diagnostic
checkAdminAuth()
  .then(() => {
    console.log('\n✅ Diagnostic complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Diagnostic failed:', error);
    process.exit(1);
  });
