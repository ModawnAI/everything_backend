import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Helper function to calculate influencer tier based on referral count
 */
function calculateInfluencerTier(referralCount: number): string {
  if (referralCount >= 100) return 'platinum';
  if (referralCount >= 50) return 'gold';
  if (referralCount >= 20) return 'silver';
  if (referralCount >= 5) return 'bronze';
  return 'none';
}

/**
 * GET /api/admin/influencers
 * Get list of influencers with pagination
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - tier: Filter by tier (bronze, silver, gold, platinum)
 * - sortBy: Sort field (referrals, earnings, joined) - default: referrals
 * - sortOrder: Sort order (asc, desc) - default: desc
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "data": [
 *       {
 *         "id": "uuid",
 *         "nickname": "User Name",
 *         "email": "user@example.com",
 *         "phone": "+82-10-1234-5678",
 *         "phoneVerified": true,
 *         "influencerTier": "gold",
 *         "referralCount": 75,
 *         "successfulReferrals": 65,
 *         "totalEarnings": 650000,
 *         "createdAt": "2024-01-01T00:00:00Z"
 *       }
 *     ],
 *     "pagination": {
 *       "page": 1,
 *       "limit": 20,
 *       "total": 150,
 *       "totalPages": 8,
 *       "hasMore": true
 *     }
 *   }
 * }
 */
export async function getInfluencers(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const tier = req.query.tier as string;
    const sortBy = req.query.sortBy as string || 'referrals';
    const sortOrder = (req.query.sortOrder as string || 'desc') as 'asc' | 'desc';

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
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
      `, { count: 'exact' })
      .eq('is_influencer', true);

    // Sort by field
    const sortField = sortBy === 'earnings' ? 'referral_rewards_earned' :
                      sortBy === 'joined' ? 'influencer_qualified_at' :
                      'successful_referrals'; // default: referrals

    query = query.order(sortField, { ascending: sortOrder === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: influencers, error, count } = await query;

    if (error) {
      console.error('[Admin Influencers] Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch influencers'
      });
    }

    // Transform data to match frontend expectations
    const transformedData = influencers?.map(inf => {
      const tier = calculateInfluencerTier(inf.successful_referrals || 0);

      return {
        id: inf.id,
        nickname: inf.nickname,
        email: inf.email,
        phone: inf.phone_number,
        phoneVerified: inf.phone_verified || false,
        influencerTier: tier,
        referralCount: inf.total_referrals || 0,
        successfulReferrals: inf.successful_referrals || 0,
        totalEarnings: inf.referral_rewards_earned || 0,
        createdAt: inf.created_at
      };
    }) || [];

    // Filter by tier if specified (client-side filter for now)
    const filteredData = tier
      ? transformedData.filter(inf => inf.influencerTier === tier)
      : transformedData;

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return res.json({
      success: true,
      data: {
        data: filteredData,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages
        }
      }
    });

  } catch (error) {
    console.error('[Admin Influencers] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

/**
 * GET /api/admin/influencers/stats
 * Get influencer statistics
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "totalInfluencers": 150,
 *     "totalReferrals": 5000,
 *     "totalEarnings": 50000000,
 *     "byTier": {
 *       "bronze": 50,
 *       "silver": 40,
 *       "gold": 35,
 *       "platinum": 25
 *     }
 *   }
 * }
 */
export async function getInfluencerStats(req: Request, res: Response) {
  try {
    const { data: influencers, error } = await supabase
      .from('users')
      .select('successful_referrals, referral_rewards_earned, total_referrals')
      .eq('is_influencer', true);

    if (error) {
      console.error('[Admin Influencer Stats] Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch influencer statistics'
      });
    }

    const totalInfluencers = influencers?.length || 0;
    const totalReferrals = influencers?.reduce((sum, inf) => sum + (inf.total_referrals || 0), 0) || 0;
    const totalEarnings = influencers?.reduce((sum, inf) => sum + (inf.referral_rewards_earned || 0), 0) || 0;

    // Count by tier
    const byTier = {
      bronze: 0,
      silver: 0,
      gold: 0,
      platinum: 0
    };

    influencers?.forEach(inf => {
      const tier = calculateInfluencerTier(inf.successful_referrals || 0);
      if (tier !== 'none') {
        byTier[tier as keyof typeof byTier]++;
      }
    });

    return res.json({
      success: true,
      data: {
        totalInfluencers,
        totalReferrals,
        totalEarnings,
        byTier
      }
    });

  } catch (error) {
    console.error('[Admin Influencer Stats] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
