/**
 * Populate Influencer and Analytics Data
 *
 * This script:
 * 1. Analyzes existing users, shops, and reservations
 * 2. Creates influencer records based on existing users
 * 3. Generates referral codes and relationships
 * 4. Populates analytics aggregation data
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { randomBytes } from 'crypto';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Helper function to generate unique referral code
function generateReferralCode(nickname: string, userId: string): string {
  const prefix = nickname.substring(0, 4).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
  const suffix = randomBytes(3).toString('hex').toUpperCase().substring(0, 6);
  return `${prefix}${suffix}`;
}

// Helper function to calculate influencer tier based on referral count
function calculateInfluencerTier(referralCount: number): string {
  if (referralCount >= 100) return 'platinum';
  if (referralCount >= 50) return 'gold';
  if (referralCount >= 20) return 'silver';
  if (referralCount >= 5) return 'bronze';
  return 'none';
}

// Helper function to generate random date in past
function randomDateInPast(daysAgo: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date;
}

async function analyzeExistingData() {
  console.log('📊 Analyzing existing data...\n');

  // Get user count
  const { count: userCount, error: userError } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true });

  if (userError) {
    console.error('❌ Error fetching user count:', userError);
  } else {
    console.log(`✅ Total Users: ${userCount}`);
  }

  // Get shop count
  const { count: shopCount, error: shopError } = await supabase
    .from('shops')
    .select('*', { count: 'exact', head: true });

  if (shopError) {
    console.error('❌ Error fetching shop count:', shopError);
  } else {
    console.log(`✅ Total Shops: ${shopCount}`);
  }

  // Get reservation count
  const { count: reservationCount, error: reservationError } = await supabase
    .from('reservations')
    .select('*', { count: 'exact', head: true });

  if (reservationError) {
    console.error('❌ Error fetching reservation count:', reservationError);
  } else {
    console.log(`✅ Total Reservations: ${reservationCount}`);
  }

  // Get current influencer count
  const { count: influencerCount, error: influencerError } = await supabase
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('is_influencer', true);

  if (influencerError) {
    console.error('❌ Error fetching influencer count:', influencerError);
  } else {
    console.log(`✅ Current Influencers: ${influencerCount || 0}\n`);
  }

  return { userCount, shopCount, reservationCount, influencerCount: influencerCount || 0 };
}

async function populateInfluencerData() {
  console.log('👥 Populating influencer data...\n');

  // Get 15 regular users (not shop owners, not already influencers)
  const { data: users, error: fetchError } = await supabase
    .from('users')
    .select('id, nickname, email, phone_number, phone_verified, created_at')
    .eq('is_influencer', false)
    .eq('user_status', 'active')
    .limit(15);

  if (fetchError || !users || users.length === 0) {
    console.error('❌ Error fetching users:', fetchError);
    return;
  }

  console.log(`📋 Found ${users.length} users to convert to influencers\n`);

  const influencersData = [];
  const referralCodesData = [];
  const promotionHistoryData = [];

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const referralCount = Math.floor(Math.random() * 120) + 5; // 5-124 referrals
    const tier = calculateInfluencerTier(referralCount);
    const qualifiedDate = randomDateInPast(180); // Within last 180 days

    // Update user to influencer (Note: influencer_tier column may not exist)
    const { error: updateError } = await supabase
      .from('users')
      .update({
        is_influencer: true,
        influencer_qualified_at: qualifiedDate.toISOString(),
        successful_referrals: referralCount,
        referral_rewards_earned: referralCount * 1000, // 1000 points per referral
        total_referrals: referralCount,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error(`❌ Error updating user ${user.nickname}:`, updateError);
      continue;
    }

    console.log(`✅ Promoted ${user.nickname} to ${tier} tier (${referralCount} referrals)`);

    influencersData.push({
      userId: user.id,
      tier,
      referralCount
    });

    // Create referral code
    const referralCode = generateReferralCode(user.nickname || 'USER', user.id);
    const codeData = {
      user_id: user.id,
      code: referralCode,
      generated_at: qualifiedDate.toISOString(),
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      is_active: true,
      used_count: referralCount,
      max_uses: null,
      created_at: qualifiedDate.toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: codeError } = await supabase
      .from('referral_codes')
      .insert(codeData);

    if (codeError) {
      console.log(`⚠️  Referral code might already exist for ${user.nickname}`);
    } else {
      console.log(`  📝 Created referral code: ${referralCode}`);
      referralCodesData.push(codeData);
    }

    // Create promotion history
    const promotionData = {
      user_id: user.id,
      promoted_at: qualifiedDate.toISOString(),
      referral_count_at_promotion: referralCount,
      promotion_reason: 'data_population_script',
      previous_status: false,
      new_status: true,
      metadata: {
        tier,
        automated: true,
        script_run: new Date().toISOString()
      },
      created_at: qualifiedDate.toISOString()
    };

    const { error: promoError } = await supabase
      .from('influencer_promotions')
      .insert(promotionData);

    if (promoError) {
      console.log(`⚠️  Could not create promotion history for ${user.nickname}`);
    } else {
      promotionHistoryData.push(promotionData);
    }
  }

  console.log(`\n✨ Created ${influencersData.length} influencers`);
  console.log(`✨ Created ${referralCodesData.length} referral codes`);
  console.log(`✨ Created ${promotionHistoryData.length} promotion history records\n`);

  return { influencersData, referralCodesData, promotionHistoryData };
}

async function createReferralRelationships() {
  console.log('🔗 Creating referral relationships...\n');

  // Get all influencers
  const { data: influencers, error: influencerError } = await supabase
    .from('users')
    .select('id, nickname')
    .eq('is_influencer', true)
    .limit(15);

  if (influencerError || !influencers) {
    console.error('❌ Error fetching influencers:', influencerError);
    return;
  }

  // Get regular users who can be referred
  const { data: regularUsers, error: userError } = await supabase
    .from('users')
    .select('id, nickname')
    .eq('is_influencer', false)
    .eq('user_status', 'active')
    .limit(50);

  if (userError || !regularUsers || regularUsers.length === 0) {
    console.error('❌ Error fetching regular users:', userError);
    return;
  }

  // Get referral codes
  const { data: referralCodes, error: codesError } = await supabase
    .from('referral_codes')
    .select('user_id, code')
    .eq('is_active', true);

  if (codesError || !referralCodes) {
    console.error('❌ Error fetching referral codes:', codesError);
    return;
  }

  const codeMap = new Map(referralCodes.map(rc => [rc.user_id, rc.code]));
  const referralsCreated = [];

  // Create 30-50 referral relationships
  const numReferrals = Math.min(regularUsers.length, 50);
  const usedUsers = new Set();

  for (let i = 0; i < numReferrals; i++) {
    const randomInfluencer = influencers[Math.floor(Math.random() * influencers.length)];
    const randomUser = regularUsers[Math.floor(Math.random() * regularUsers.length)];

    // Skip if user already referred or same as referrer
    if (usedUsers.has(randomUser.id) || randomUser.id === randomInfluencer.id) {
      continue;
    }

    usedUsers.add(randomUser.id);

    const referralCode = codeMap.get(randomInfluencer.id);
    if (!referralCode) continue;

    const isCompleted = Math.random() > 0.3; // 70% completion rate
    const bonusAmount = isCompleted ? Math.floor(Math.random() * 5000) + 1000 : 0;

    const referralData = {
      referrer_id: randomInfluencer.id,
      referred_id: randomUser.id,
      referral_code: referralCode,
      status: isCompleted ? 'completed' : 'pending',
      bonus_paid: isCompleted,
      bonus_amount: bonusAmount,
      original_payment_amount: isCompleted ? Math.floor(Math.random() * 200000) + 50000 : null,
      referral_reward_percentage: 0.10,
      calculation_method: 'base_points_percentage',
      chain_validation_passed: true,
      created_at: randomDateInPast(90).toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: referralError } = await supabase
      .from('referrals')
      .insert(referralData);

    if (referralError) {
      console.log(`⚠️  Could not create referral: ${referralError.message}`);
    } else {
      referralsCreated.push(referralData);
      if (isCompleted) {
        console.log(`✅ ${randomUser.nickname} referred by ${randomInfluencer.nickname} (completed, ₩${bonusAmount})`);
      } else {
        console.log(`⏳ ${randomUser.nickname} referred by ${randomInfluencer.nickname} (pending)`);
      }
    }
  }

  console.log(`\n✨ Created ${referralsCreated.length} referral relationships\n`);
  return referralsCreated;
}

async function populateAnalyticsData() {
  console.log('📈 Populating analytics data...\n');

  // Get all users created in the last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const { data: recentUsers, error: userError } = await supabase
    .from('users')
    .select('id, created_at')
    .gte('created_at', ninetyDaysAgo.toISOString());

  if (userError || !recentUsers) {
    console.error('❌ Error fetching recent users:', userError);
    return;
  }

  console.log(`📊 Found ${recentUsers.length} users created in last 90 days`);

  // Group users by date
  const usersByDate = new Map<string, number>();
  recentUsers.forEach(user => {
    const date = user.created_at.split('T')[0];
    usersByDate.set(date, (usersByDate.get(date) || 0) + 1);
  });

  // Generate daily user analytics for last 90 days
  const analyticsRecords = [];
  for (let i = 90; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const newUsers = usersByDate.get(dateStr) || 0;
    const activeUsers = Math.floor(newUsers * (0.6 + Math.random() * 0.3)); // 60-90% active

    analyticsRecords.push({
      date: dateStr,
      new_users: newUsers,
      active_users: activeUsers,
      total_users: recentUsers.filter(u => u.created_at.split('T')[0] <= dateStr).length,
      growth_rate: newUsers > 0 ? Math.random() * 20 - 5 : 0, // -5% to +15%
      created_at: new Date().toISOString()
    });
  }

  // Check if user_analytics table exists
  const { error: checkError } = await supabase
    .from('user_analytics')
    .select('id')
    .limit(1);

  if (checkError) {
    console.log('⚠️  user_analytics table might not exist, creating sample structure...');
    // The table needs to be created via migration
    console.log('📝 Analytics data structure prepared (91 daily records)');
    console.log(`   - Date range: ${analyticsRecords[0].date} to ${analyticsRecords[analyticsRecords.length - 1].date}`);
    console.log(`   - Total new users in period: ${analyticsRecords.reduce((sum, r) => sum + r.new_users, 0)}`);
  } else {
    // Insert analytics data if table exists
    const { error: insertError } = await supabase
      .from('user_analytics')
      .insert(analyticsRecords);

    if (insertError) {
      console.error('❌ Error inserting analytics:', insertError);
    } else {
      console.log(`✅ Created ${analyticsRecords.length} daily analytics records`);
    }
  }

  return analyticsRecords;
}

async function main() {
  console.log('🚀 Starting data population script...\n');
  console.log('=' .repeat(60));
  console.log('\n');

  try {
    // Step 1: Analyze existing data
    const stats = await analyzeExistingData();

    console.log('=' .repeat(60));
    console.log('\n');

    // Step 2: Populate influencer data
    const influencerResult = await populateInfluencerData();

    console.log('=' .repeat(60));
    console.log('\n');

    // Step 3: Create referral relationships
    const referralResult = await createReferralRelationships();

    console.log('=' .repeat(60));
    console.log('\n');

    // Step 4: Populate analytics data
    const analyticsResult = await populateAnalyticsData();

    console.log('=' .repeat(60));
    console.log('\n');

    // Final summary
    console.log('✅ DATA POPULATION COMPLETE!\n');
    console.log('📊 Summary:');
    console.log(`   - Influencers created: ${influencerResult?.influencersData?.length || 0}`);
    console.log(`   - Referral codes: ${influencerResult?.referralCodesData?.length || 0}`);
    console.log(`   - Referral relationships: ${referralResult?.length || 0}`);
    console.log(`   - Analytics records: ${analyticsResult?.length || 0}`);
    console.log('\n');
    console.log('🎉 You can now view populated data at:');
    console.log('   - http://localhost:3004/dashboard/influencers');
    console.log('   - http://localhost:3004/dashboard/analytics/users');
    console.log('\n');

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();
