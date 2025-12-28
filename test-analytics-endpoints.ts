import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAnalytics() {
  console.log('Testing what analytics data should look like...\n');

  // Get user counts by date
  const { data: users, error } = await supabase
    .from('users')
    .select('created_at, user_status')
    .order('created_at', { ascending: true });

  if (error || !users) {
    console.error('Error:', error);
    return;
  }

  console.log(`Total users: ${users.length}\n`);

  // Group by date for trends
  const usersByDate = new Map<string, any>();
  users.forEach(user => {
    const date = user.created_at.split('T')[0];
    if (!usersByDate.has(date)) {
      usersByDate.set(date, { newUsers: 0, activeUsers: 0 });
    }
    const stats = usersByDate.get(date)!;
    stats.newUsers++;
    if (user.user_status === 'active') stats.activeUsers++;
  });

  // Get last 30 days of data
  const trends = Array.from(usersByDate.entries())
    .slice(-30)
    .map(([date, stats]) => ({
      date,
      newUsers: stats.newUsers,
      activeUsers: stats.activeUsers,
      totalUsers: users.filter(u => u.created_at.split('T')[0] <= date).length
    }));

  console.log('Sample trends data (last 5 days):');
  console.log(JSON.stringify(trends.slice(-5), null, 2));

  // Dashboard stats
  const activeUsers = users.filter(u => u.user_status === 'active').length;
  const suspendedUsers = users.filter(u => u.user_status === 'suspended').length;
  const totalUsers = users.length;

  const dashboardStats = {
    totalUsers,
    activeUsers,
    suspendedUsers,
    newUsersThisMonth: users.filter(u => {
      const created = new Date(u.created_at);
      const now = new Date();
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length,
    growthRate: 5.2 // Calculate based on previous month
  };

  console.log('\nDashboard stats:');
  console.log(JSON.stringify(dashboardStats, null, 2));

  console.log('\n\nExpected API Response for /api/admin/analytics/trends/users:');
  console.log(JSON.stringify({
    success: true,
    data: trends
  }, null, 2));

  console.log('\n\nExpected API Response for /api/admin/analytics/dashboard:');
  console.log(JSON.stringify({
    success: true,
    data: dashboardStats
  }, null, 2));
}

testAnalytics();
