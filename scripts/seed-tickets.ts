/**
 * Seed Support Tickets
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const randomPastDate = (daysAgo: number = 60) => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date.toISOString();
};

async function seedTickets() {
  console.log('🎫 Seeding support tickets...\n');

  // Get existing users
  const { data: users } = await supabase
    .from('users')
    .select('id, email')
    .eq('user_role', 'user')
    .limit(5);

  if (!users || users.length === 0) {
    // Use any user if no regular users exist
    const { data: anyUsers } = await supabase
      .from('users')
      .select('id, email')
      .limit(5);

    if (!anyUsers || anyUsers.length === 0) {
      console.log('❌ No users found in database');
      process.exit(1);
    }
    users.push(...anyUsers);
  }

  const ticketTemplates = [
    { subject: '결제가 완료되지 않았어요', category: 'payment', priority: 'high', status: 'open' },
    { subject: '예약 시간 변경 요청', category: 'reservation', priority: 'medium', status: 'pending' },
    { subject: '계정 비밀번호 재설정 문의', category: 'account', priority: 'low', status: 'resolved' },
    { subject: '앱이 자주 멈춰요', category: 'technical', priority: 'high', status: 'open' },
    { subject: '예약 취소 환불 문의', category: 'payment', priority: 'medium', status: 'pending' },
    { subject: '샵 정보가 잘못되어 있어요', category: 'general', priority: 'low', status: 'closed' },
    { subject: '포인트가 적립되지 않았습니다', category: 'payment', priority: 'medium', status: 'open' },
    { subject: '로그인이 안 돼요', category: 'technical', priority: 'urgent', status: 'open' },
    { subject: '리뷰 작성 방법 문의', category: 'general', priority: 'low', status: 'resolved' },
    { subject: '예약 확인 메시지가 안 와요', category: 'reservation', priority: 'medium', status: 'pending' },
    { subject: '회원 탈퇴 절차 문의', category: 'account', priority: 'medium', status: 'open' },
    { subject: '적립 포인트 유효기간 문의', category: 'general', priority: 'low', status: 'resolved' },
    { subject: '결제 오류 - 중복 결제됨', category: 'payment', priority: 'urgent', status: 'open' },
    { subject: '샵 예약이 취소되었는데 환불이 안돼요', category: 'payment', priority: 'high', status: 'pending' },
    { subject: '앱 업데이트 후 로그인 불가', category: 'technical', priority: 'high', status: 'open' }
  ];

  let created = 0;
  let errors = 0;

  for (const template of ticketTemplates) {
    const user = users[Math.floor(Math.random() * users.length)];

    const ticket = {
      user_id: user.id,
      subject: template.subject,
      description: `${template.subject}에 대한 자세한 설명입니다.\n\n문제 발생 시간: ${new Date().toLocaleString('ko-KR')}\n빠른 도움 부탁드립니다.`,
      status: template.status,
      priority: template.priority,
      category: template.category,
      created_at: randomPastDate(30),
      updated_at: randomPastDate(15)
    };

    const { error } = await supabase.from('support_tickets').insert([ticket]);

    if (error) {
      console.error(`  ❌ Error: ${template.subject} - ${error.message}`);
      errors++;
    } else {
      console.log(`  ✅ Created: [${template.category}/${template.priority}] ${template.subject} - ${template.status}`);
      created++;
    }
  }

  console.log(`\n📊 Summary: ${created} created, ${errors} errors`);
  console.log('🏁 Seeding complete!\n');
}

seedTickets()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
