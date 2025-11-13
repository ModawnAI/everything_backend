/**
 * Seed Notifications for Test User
 * Email: testuser@example.com
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

async function seedNotificationsForTestUser() {
  try {
    console.log('🌱 Finding test user: testuser@example.com...');

    // Find the test user by email
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', 'testuser@example.com')
      .limit(1);

    if (userError) {
      console.error('❌ Error fetching user:', userError);
      process.exit(1);
    }

    if (!users || users.length === 0) {
      console.error('❌ No user found with email: testuser@example.com');
      console.log('💡 Creating test user first...');

      // Create the test user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          email: 'testuser@example.com',
          name: 'Test User',
          user_role: 'user',
          user_status: 'active'
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Failed to create test user:', createError);
        process.exit(1);
      }

      console.log('✅ Created test user:', newUser.id);
      users[0] = newUser;
    }

    const testUser = users[0];
    console.log(`✅ Found user: ${testUser.name || testUser.email} (${testUser.id})`);

    // Delete any existing notifications for this user
    console.log('🧹 Cleaning up existing notifications...');
    const { error: deleteError } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', testUser.id);

    if (deleteError) {
      console.warn('⚠️  Failed to delete existing notifications:', deleteError);
    } else {
      console.log('✅ Deleted existing notifications');
    }

    // Sample notifications for the test user
    const notifications = [
      {
        user_id: testUser.id,
        notification_type: 'system',
        title: '🎉 환영합니다!',
        message: '에뷰리띵에 오신 것을 환영합니다. 다양한 뷰티 서비스를 만나보세요.',
        status: 'read',
        action_url: '/home',
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days ago
      },
      {
        user_id: testUser.id,
        notification_type: 'reservation_confirmed',
        title: '✅ 예약 확정',
        message: '네일아트 전문점 - 오늘 오후 2시 예약이 확정되었습니다.',
        status: 'unread',
        action_url: '/reservations/1',
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
      },
      {
        user_id: testUser.id,
        notification_type: 'point_earned',
        title: '💰 포인트 적립',
        message: '서비스 이용 완료로 2,500 포인트가 적립되었습니다.',
        status: 'unread',
        action_url: '/points',
        created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() // 1 hour ago
      },
      {
        user_id: testUser.id,
        notification_type: 'reservation_confirmed',
        title: '✅ 속눈썹 연장 예약 확정',
        message: '3월 20일 오후 3시 30분 예약이 확정되었습니다.',
        status: 'unread',
        action_url: '/reservations/2',
        created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() // 5 hours ago
      },
      {
        user_id: testUser.id,
        notification_type: 'referral_success',
        title: '🎁 추천 보너스',
        message: '친구 추천으로 5,000 포인트 보너스가 지급되었습니다!',
        status: 'read',
        action_url: '/referrals',
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3 days ago
      },
      {
        user_id: testUser.id,
        notification_type: 'system',
        title: '📢 인기 샵 추천',
        message: '이번 주 강남구에서 가장 인기 있는 뷰티샵을 확인해보세요.',
        status: 'unread',
        action_url: '/shops/featured',
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes ago
      },
      {
        user_id: testUser.id,
        notification_type: 'point_earned',
        title: '💰 리뷰 작성 포인트',
        message: '리뷰 작성으로 500 포인트가 적립되었습니다.',
        status: 'read',
        action_url: '/points',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
      },
      {
        user_id: testUser.id,
        notification_type: 'reservation_cancelled',
        title: '❌ 예약 취소',
        message: '왁싱 전문점 - 3월 18일 예약이 샵 사정으로 취소되었습니다.',
        status: 'unread',
        action_url: '/reservations/3',
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // 1 day ago
      },
      {
        user_id: testUser.id,
        notification_type: 'system',
        title: '🎯 맞춤 추천',
        message: '고객님이 관심 있어하실 만한 서비스를 추천해 드립니다.',
        status: 'unread',
        action_url: '/recommendations',
        created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString() // 15 minutes ago
      },
      {
        user_id: testUser.id,
        notification_type: 'point_earned',
        title: '💰 첫 예약 보너스',
        message: '첫 예약 완료로 10,000 포인트 보너스가 적립되었습니다!',
        status: 'read',
        action_url: '/points',
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
      },
      {
        user_id: testUser.id,
        notification_type: 'system',
        title: '🔔 새로운 기능 추가',
        message: '이제 예약 알림을 카카오톡으로도 받을 수 있습니다.',
        status: 'unread',
        action_url: '/settings/notifications',
        created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes ago
      },
      {
        user_id: testUser.id,
        notification_type: 'reservation_confirmed',
        title: '✅ 헤어 컷 예약 확정',
        message: '3월 25일 오전 11시 예약이 확정되었습니다.',
        status: 'unread',
        action_url: '/reservations/4',
        created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() // 3 hours ago
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

    // Show summary
    const unreadCount = notifications.filter(n => n.status === 'unread').length;
    const readCount = notifications.filter(n => n.status === 'read').length;

    console.log('\n📊 Summary:');
    console.log(`   Total: ${notifications.length} notifications`);
    console.log(`   Unread: ${unreadCount}`);
    console.log(`   Read: ${readCount}`);
    console.log(`\n✅ User email: ${testUser.email}`);
    console.log(`✅ User ID: ${testUser.id}`);
    console.log('\n🎉 Notification seeding completed successfully!');

    process.exit(0);

  } catch (error) {
    console.error('❌ Failed to seed notifications:', error);
    process.exit(1);
  }
}

// Run the seeding
seedNotificationsForTestUser();
