/**
 * Point System Policies v3.2
 * 
 * Comprehensive point calculation policies and constants:
 * - Earning rates and caps
 * - Availability delays and expiration rules
 * - Influencer bonuses and multipliers
 * - Referral system configurations
 */

// Point Earning Policies v3.2
export const POINT_POLICY_V32 = {
  // Core earning configuration
  EARNING_RATE: 0.025, // 2.5% earning rate
  MAX_ELIGIBLE_AMOUNT: 300000, // 300,000 KRW maximum eligible amount per transaction
  
  // Availability and expiration
  AVAILABILITY_DELAY_DAYS: 7, // 7-day delay before points become available
  EXPIRATION_PERIOD_DAYS: 365, // Points expire after 1 year
  
  // Influencer bonuses
  INFLUENCER_MULTIPLIER: 2.0, // 2x bonus for influencers (updated from 1.5x)
  INFLUENCER_MIN_FOLLOWERS: 1000, // Minimum followers to qualify as influencer
  INFLUENCER_MIN_ENGAGEMENT: 0.03, // Minimum 3% engagement rate
  
  // Referral bonuses
  REFERRAL_BASE_BONUS: 1000, // Base referral bonus in points
  REFERRAL_COMPLETION_BONUS: 500, // Additional bonus when referred user completes first service
  
  // Transaction limits
  MIN_TRANSACTION_AMOUNT: 1000, // Minimum transaction amount to earn points (1,000 KRW)
  MAX_DAILY_EARNING_LIMIT: 10000, // Maximum points that can be earned per day
  MAX_MONTHLY_EARNING_LIMIT: 100000, // Maximum points that can be earned per month
  
  // Point usage rules
  MIN_REDEMPTION_AMOUNT: 1000, // Minimum points required for redemption
  MAX_REDEMPTION_PERCENTAGE: 50, // Maximum percentage of payment that can be paid with points
  POINT_TO_KRW_RATIO: 1, // 1 point = 1 KRW
  
  // Special promotions
  FIRST_TIME_USER_BONUS: 2000, // Bonus points for first-time users
  BIRTHDAY_BONUS_MULTIPLIER: 2.0, // 2x points on user's birthday month
  HOLIDAY_BONUS_MULTIPLIER: 1.5, // 1.5x points during special holidays
  
  // Tier system multipliers
  TIER_MULTIPLIERS: {
    'bronze': 1.0,
    'silver': 1.1,
    'gold': 1.2,
    'platinum': 1.3,
    'diamond': 1.5
  } as const,
  
  // Tier requirements (based on total points earned)
  TIER_REQUIREMENTS: {
    'bronze': 0,
    'silver': 10000,
    'gold': 50000,
    'platinum': 100000,
    'diamond': 500000
  } as const
} as const;

// Point transaction types
export const POINT_TRANSACTION_TYPES = {
  // Earning types
  EARNED_SERVICE: 'earned_service',
  EARNED_REFERRAL: 'earned_referral',
  EARNED_BONUS: 'earned_bonus',
  INFLUENCER_BONUS: 'influencer_bonus',
  FIRST_TIME_BONUS: 'first_time_bonus',
  BIRTHDAY_BONUS: 'birthday_bonus',
  HOLIDAY_BONUS: 'holiday_bonus',
  
  // Usage types
  USED_SERVICE: 'used_service',
  USED_PURCHASE: 'used_purchase',
  
  // System types
  EXPIRED: 'expired',
  ADJUSTED: 'adjusted',
  REFUNDED: 'refunded',
  CANCELLED: 'cancelled'
} as const;

// Point status types
export const POINT_STATUS = {
  PENDING: 'pending',
  AVAILABLE: 'available',
  USED: 'used',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled'
} as const;

// Point validation rules
export const POINT_VALIDATION_RULES = {
  // Amount validation
  validateAmount: (amount: number): boolean => {
    return amount > 0 && amount <= POINT_POLICY_V32.MAX_DAILY_EARNING_LIMIT;
  },
  
  // Transaction amount validation for earning points
  validateEligibleAmount: (amount: number): boolean => {
    return amount >= POINT_POLICY_V32.MIN_TRANSACTION_AMOUNT;
  },
  
  // Redemption validation
  validateRedemption: (pointsToRedeem: number, availablePoints: number, paymentAmount: number): boolean => {
    if (pointsToRedeem < POINT_POLICY_V32.MIN_REDEMPTION_AMOUNT) return false;
    if (pointsToRedeem > availablePoints) return false;
    
    const maxRedeemableAmount = paymentAmount * (POINT_POLICY_V32.MAX_REDEMPTION_PERCENTAGE / 100);
    return pointsToRedeem <= maxRedeemableAmount;
  },
  
  // Influencer qualification validation
  validateInfluencerStatus: (followers: number, engagementRate: number): boolean => {
    return followers >= POINT_POLICY_V32.INFLUENCER_MIN_FOLLOWERS && 
           engagementRate >= POINT_POLICY_V32.INFLUENCER_MIN_ENGAGEMENT;
  }
} as const;

// Point calculation helpers
export const POINT_CALCULATIONS = {
  /**
   * Calculate points earned from service completion
   */
  calculateServicePoints: (amount: number, isInfluencer: boolean = false, tierMultiplier: number = 1.0): number => {
    if (!POINT_VALIDATION_RULES.validateEligibleAmount(amount)) {
      return 0;
    }
    
    const eligibleAmount = Math.min(amount, POINT_POLICY_V32.MAX_ELIGIBLE_AMOUNT);
    let points = Math.floor(eligibleAmount * POINT_POLICY_V32.EARNING_RATE);
    
    // Apply influencer multiplier
    if (isInfluencer) {
      points = Math.floor(points * POINT_POLICY_V32.INFLUENCER_MULTIPLIER);
    }
    
    // Apply tier multiplier
    points = Math.floor(points * tierMultiplier);
    
    return points;
  },
  
  /**
   * Calculate availability date (7 days from now)
   */
  calculateAvailabilityDate: (): Date => {
    const now = new Date();
    return new Date(now.getTime() + POINT_POLICY_V32.AVAILABILITY_DELAY_DAYS * 24 * 60 * 60 * 1000);
  },
  
  /**
   * Calculate expiration date (1 year from availability)
   */
  calculateExpirationDate: (availabilityDate?: Date): Date => {
    const baseDate = availabilityDate || new Date();
    return new Date(baseDate.getTime() + POINT_POLICY_V32.EXPIRATION_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  },
  
  /**
   * Get user tier based on total points earned
   */
  getUserTier: (totalPointsEarned: number): keyof typeof POINT_POLICY_V32.TIER_REQUIREMENTS => {
    if (totalPointsEarned >= POINT_POLICY_V32.TIER_REQUIREMENTS.diamond) return 'diamond';
    if (totalPointsEarned >= POINT_POLICY_V32.TIER_REQUIREMENTS.platinum) return 'platinum';
    if (totalPointsEarned >= POINT_POLICY_V32.TIER_REQUIREMENTS.gold) return 'gold';
    if (totalPointsEarned >= POINT_POLICY_V32.TIER_REQUIREMENTS.silver) return 'silver';
    return 'bronze';
  },
  
  /**
   * Get tier multiplier for user
   */
  getTierMultiplier: (totalPointsEarned: number): number => {
    const tier = POINT_CALCULATIONS.getUserTier(totalPointsEarned);
    return POINT_POLICY_V32.TIER_MULTIPLIERS[tier];
  }
} as const;

// Export types for TypeScript
export type PointTransactionType = typeof POINT_TRANSACTION_TYPES[keyof typeof POINT_TRANSACTION_TYPES];
export type PointStatus = typeof POINT_STATUS[keyof typeof POINT_STATUS];
export type UserTier = keyof typeof POINT_POLICY_V32.TIER_REQUIREMENTS;

