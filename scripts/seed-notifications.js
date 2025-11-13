/**
 * Seed Notifications Script (Plain JS)
 *
 * Populates sample notification data for testing
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function seedNotifications() {
  try {
    console.log('🌱 Starting notification seeding...');

    // Get a test user from the database
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (userError) {
      console.error('❌ Error fetching users:', userError);
      process.exit(1);
    }

    if (!users || users.length === 0) {
      console.error('❌ No users found in database. Please create a user first.');
      process.exit(1);
    }

    const testUserId = users[0].id;
    console.log(`✅ Using test user: ${testUserId}`);

    // Sample notifications
    const notifications = [
      {
        user_id: testUserId,
        notification_type: 'system',
        title: '🎉 에뷰리띵에 오신 것을 환영합니다!',
        message: '에뷰리띵 서비스에 가입해 주셔서 감사합니다. 다양한 뷰티 서비스를 만나보세요.',
        status: 'read',
        action_url: '/explore'
      },
      {
        user_id: testUserId,
        notification_type: 'reservation_confirmed',
        title: '✅ 예약이 확정되었습니다',
        message: '네일아트 전문점 - 2024년 3월 15일 14:00 예약이 확정되었습니다.',
        status: 'unread',
        action_url: '/reservations/1'
      },
      {
        user_id: testUserId,
        notification_type: 'point_earned',
        title: '💰 포인트 적립 완료',
        message: '서비스 이용 완료로 2,500 포인트가 적립되었습니다.',
        status: 'unread',
        action_url: '/points'
      },
      {
        user_id: testUserId,
        notification_type: 'reservation_confirmed',
        title: '✅ 속눈썹 연장 예약 확정',
        message: '속눈썹 연장 전문점 - 2024년 3월 20일 15:30 예약이 확정되었습니다.',
        status: 'unread',
        action_url: '/reservations/2'
      },
      {
        user_id: testUserId,
        notification_type: 'referral_success',
        title: '🎁 추천 보너스 지급',
        message: '친구 추천으로 5,000 포인트 보너스가 지급되었습니다!',
        status: 'read',
        action_url: '/referrals'
      },
      {
        user_id: testUserId,
        notification_type: 'system',
        title: '📢 이번 주 인기 샵 추천',
        message: '강남구에서 가장 인기 있는 뷰티샵을 확인해보세요.',
        status: 'unread',
        action_url: '/shops/featured'
      },
      {
        user_id: testUserId,
        notification_type: 'point_earned',
        title: '💰 리뷰 작성 포인트 적립',
        message: '리뷰 작성으로 500 포인트가 적립되었습니다.',
        status: 'read',
        action_url: '/points'
      },
      {
        user_id: testUserId,
        notification_type: 'reservation_cancelled',
        title: '❌ 예약이 취소되었습니다',
        message: '왁싱 전문점 - 2024년 3월 18일 예약이 샵 사정으로 취소되었습니다.',
        status: 'unread',
        action_url: '/reservations/3'
      },
      {
        user_id: testUserId,
        notification_type: 'system',
        title: '🎯 맞춤 추천 서비스',
        message: '고객님이 관심 있어하실 만한 서비스를 추천해 드립니다.',
        status: 'unread',
        action_url: '/recommendations'
      },
      {
        user_id: testUserId,
        notification_type: 'point_earned',
        title: '💰 첫 예약 보너스 적립',
        message: '첫 예약 완료로 10,000 포인트 보너스가 적립되었습니다!',
        status: 'read',
        action_url: '/points'
      }
    ];

    // Insert notifications
    console.log(`📝 Inserting ${notifications.length} notifications...`);
    const { data: insertedNotifications, error: insertError } = await supabase
      .from('notifications')
      .insert(notifications)
      .select();

    if (insertError) {
      console.error('❌ Failed to insert notifications:', insertError);
      process.exit(1);
    }

    console.log(`✅ Successfully seeded ${insertedNotifications?.length || 0} notifications`);

    // Create notification settings for the user if not exists
    console.log('📝 Creating notification settings...');
    const { error: settingsError } = await supabase
      .from('notification_settings')
      .upsert({
        user_id: testUserId,
        push_enabled: true,
        email_enabled: true,
        sms_enabled: false,
        reservation_updates: true,
        payment_notifications: true,
        promotional_messages: true,
        system_alerts: true
      }, {
        onConflict: 'user_id'
      });

    if (settingsError) {
      console.warn('⚠️  Failed to create notification settings:', settingsError);
    } else {
      console.log('✅ Created notification settings for user');
    }

    console.log('🎉 Notification seeding completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Failed to seed notifications:', error);
    process.exit(1);
  }
}

// Run the seeding
seedNotifications();
