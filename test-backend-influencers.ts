import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testBackend() {
  console.log('Testing backend influencers endpoint...\n');

  // Test what the backend would return
  const { data: influencers, error } = await supabase
    .from('users')
    .select(`
      id,
      nickname,
      email,
      phone_number,
      phone_verified,
      is_influencer,
      influencer_qualified_at,
      successful_referrals,
      referral_rewards_earned,
      total_referrals,
      created_at
    `)
    .eq('is_influencer', true)
    .order('successful_referrals', { ascending: false })
    .range(0, 19);

  if (error) {
    console.error('Error:', error);
  } else {
    const count = influencers?.length || 0;
    console.log(`Found ${count} influencers\n`);

    if (influencers && influencers.length > 0) {
      console.log('Sample influencer data:');
      influencers.slice(0, 3).forEach(inf => {
        console.log(`\n- ${inf.nickname}`);
        console.log(`  Email: ${inf.email}`);
        console.log(`  Total Referrals: ${inf.total_referrals || 0}`);
        console.log(`  Successful Referrals: ${inf.successful_referrals || 0}`);
        console.log(`  Rewards Earned: ₩${inf.referral_rewards_earned || 0}`);
        console.log(`  Qualified: ${inf.influencer_qualified_at}`);
      });
    }

    // Show what backend needs to return
    console.log('\n\nBackend should return structure like:');
    const backendResponse = {
      success: true,
      data: {
        data: influencers?.map(inf => ({
          id: inf.id,
          nickname: inf.nickname,
          email: inf.email,
          phone: inf.phone_number,
          phoneVerified: inf.phone_verified,
          influencerTier: calculateTier(inf.successful_referrals || 0),
          referralCount: inf.total_referrals || 0,
          successfulReferrals: inf.successful_referrals || 0,
          totalEarnings: inf.referral_rewards_earned || 0,
          createdAt: inf.created_at
        })) || [],
        pagination: {
          page: 1,
          limit: 20,
          total: count,
          totalPages: Math.ceil(count / 20),
          hasMore: false
        }
      }
    };

    console.log(JSON.stringify(backendResponse, null, 2));
  }
}

function calculateTier(referrals: number): string {
  if (referrals >= 100) return 'platinum';
  if (referrals >= 50) return 'gold';
  if (referrals >= 20) return 'silver';
  if (referrals >= 5) return 'bronze';
  return 'none';
}

testBackend();
