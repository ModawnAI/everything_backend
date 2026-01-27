/**
 * 테스터 계정 생성 스크립트 (Backend - Service Role)
 * Supabase Admin API를 사용하여 테스터 계정을 생성합니다.
 *
 * 실행: node create-tester-account.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase 설정 (Service Role Key 사용)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ysrudwzwnzxrrwjtpuoh.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.');
  console.error('   .env 파일에 SUPABASE_SERVICE_ROLE_KEY를 추가해주세요.');
  process.exit(1);
}

// 테스터 계정 정보
const TESTER_ACCOUNT = {
  email: 'reviewer@ebeautything.com',
  password: 'Review2024!@',
  fullName: 'App Store Reviewer',
  phone: '01012345678',
  birthDate: '1990-01-01',
  gender: 'other',
};

async function createTesterAccount() {
  console.log('🚀 테스터 계정 생성 시작...\n');

  // Supabase Admin 클라이언트 생성
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // 1. Admin API로 사용자 생성 (이메일 확인 자동 처리)
    console.log('📝 Step 1: Supabase Admin API로 사용자 생성...');
    console.log(`   Email: ${TESTER_ACCOUNT.email}\n`);

    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email: TESTER_ACCOUNT.email,
      password: TESTER_ACCOUNT.password,
      email_confirm: true, // 이메일 자동 확인
      user_metadata: {
        full_name: TESTER_ACCOUNT.fullName,
        birth_date: TESTER_ACCOUNT.birthDate,
        gender: TESTER_ACCOUNT.gender,
      },
    });

    if (createError) {
      if (createError.message.includes('already registered') || createError.message.includes('User already registered')) {
        console.log('⚠️  계정이 이미 존재합니다.');
        console.log('   로그인 테스트를 진행합니다...\n');

        // 기존 계정 로그인 테스트
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: TESTER_ACCOUNT.email,
          password: TESTER_ACCOUNT.password,
        });

        if (signInError) {
          console.error('❌ 기존 계정 로그인 실패:', signInError.message);
          console.log('\n비밀번호가 다를 수 있습니다. Supabase Dashboard에서 확인해주세요:');
          console.log('https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh/auth/users\n');
          return;
        }

        console.log('✅ 기존 계정 로그인 성공!');
        console.log(`   User ID: ${signInData.user?.id}`);
        console.log(`   Email: ${signInData.user?.email}`);
        console.log(`   Email Verified: ${signInData.user?.email_confirmed_at ? 'Yes' : 'No'}\n`);

        await supabase.auth.signOut();
        return;
      }
      throw createError;
    }

    console.log('✅ Supabase 사용자 생성 성공!');
    console.log(`   User ID: ${userData.user.id}`);
    console.log(`   Email: ${userData.user.email}`);
    console.log(`   Email Verified: ${userData.user.email_confirmed_at ? 'Yes' : 'No'}\n`);

    // 2. users 테이블에 프로필 생성
    console.log('📝 Step 2: users 테이블에 프로필 생성...');

    const { error: profileError } = await supabase.from('users').insert({
      id: userData.user.id,
      email: TESTER_ACCOUNT.email,
      name: TESTER_ACCOUNT.fullName,
      phone: TESTER_ACCOUNT.phone,
      birth_date: TESTER_ACCOUNT.birthDate,
      gender: TESTER_ACCOUNT.gender,
      marketing_consent: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      if (profileError.code === '23505') { // Unique constraint violation
        console.log('⚠️  프로필이 이미 존재합니다. 건너뜁니다.\n');
      } else {
        console.error('⚠️  프로필 생성 실패:', profileError.message);
        console.log('   첫 로그인 시 자동으로 생성될 수 있습니다.\n');
      }
    } else {
      console.log('✅ 프로필 생성 성공!\n');
    }

    console.log('✅ 테스터 계정 생성 완료!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 테스터 계정 정보:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:    ${TESTER_ACCOUNT.email}`);
    console.log(`   Password: ${TESTER_ACCOUNT.password}`);
    console.log(`   Name:     ${TESTER_ACCOUNT.fullName}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎯 다음 단계:');
    console.log('   1. 앱에서 로그인 테스트');
    console.log('   2. 모든 기능이 정상 작동하는지 확인');
    console.log('   3. 앱스토어/플레이스토어 검수 제출\n');

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    if (error.stack) {
      console.error('\n스택 트레이스:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// 스크립트 실행
createTesterAccount();
