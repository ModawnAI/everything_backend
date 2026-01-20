/**
 * Referral System Types
 * 
 * Types for referral code generation, tracking, bonus calculation,
 * and referral history management
 */

// Consistent with database schema
export type ReferralStatus = 'pending' | 'completed' | 'cancelled' | 'expired';
export type BonusType = 'points' | 'cash' | 'discount' | 'free_service';

/**
 * Referral record in database
 */
export interface ReferralRecord {
  id: string;
  referrer_id: string; // User who provided the referral code
  referred_id: string; // User who used the referral code
  referral_code: string;
  status: ReferralStatus;
  bonus_amount: number;
  bonus_type: BonusType;
  bonus_paid: boolean;
  bonus_paid_at?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  expires_at: string;
  notes?: string;
}

/**
 * Referral bonus configuration
 */
export interface ReferralBonusConfig {
  id: string;
  bonus_type: BonusType;
  bonus_amount: number;
  minimum_requirement?: string; // e.g., "profile_complete", "phone_verified"
  valid_days: number; // How long the referral is valid
  max_referrals_per_user?: number; // Optional limit
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Referral statistics for a user
 */
export interface ReferralStats {
  totalReferrals: number;
  completedReferrals: number;
  pendingReferrals: number;
  totalBonusEarned: number;
  totalBonusPaid: number;
  referralCode: string;
  lastReferralDate?: string;
  averageCompletionTime?: number; // in days
}

/**
 * Referral history item
 */
export interface ReferralHistoryItem {
  id: string;
  referredUser: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    joinedAt: string;
  };
  status: ReferralStatus;
  bonusAmount: number;
  totalEarnings: number; // 추가: 친구로부터 받은 총 적립 포인트
  bonusType: BonusType;
  bonusPaid: boolean;
  bonusPaidAt?: string;
  createdAt: string;
  completedAt?: string;
  expiresAt: string;
}

/**
 * Create referral record request
 */
export interface CreateReferralRequest {
  referrerId: string;
  referredId: string;
  referralCode: string;
  bonusType?: BonusType;
  bonusAmount?: number;
  notes?: string;
}

/**
 * Update referral status request
 */
export interface UpdateReferralStatusRequest {
  referralId: string;
  status: ReferralStatus;
  notes?: string;
}

/**
 * Referral bonus payout request
 */
export interface ReferralBonusPayoutRequest {
  referralId: string;
  payoutMethod: 'points' | 'cash' | 'bank_transfer';
  payoutDetails?: {
    accountNumber?: string;
    bankName?: string;
    recipientName?: string;
  };
}

/**
 * Referral system response interfaces
 */
export interface ReferralStatsResponse {
  success: boolean;
  data?: {
    stats: ReferralStats;
    recentReferrals: ReferralHistoryItem[];
  };
  error?: {
    code: string;
    message: string;
    timestamp: string;
  };
}

export interface ReferralHistoryResponse {
  success: boolean;
  data?: {
    referrals: ReferralHistoryItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  error?: {
    code: string;
    message: string;
    timestamp: string;
  };
}

export interface ReferralBonusPayoutResponse {
  success: boolean;
  data?: {
    referralId: string;
    payoutAmount: number;
    payoutMethod: string;
    payoutStatus: 'pending' | 'completed' | 'failed';
    payoutDate: string;
    transactionId?: string;
  };
  error?: {
    code: string;
    message: string;
    timestamp: string;
  };
}

/**
 * Referral system configuration
 */
export interface ReferralSystemConfig {
  defaultBonusType: BonusType;
  defaultBonusAmount: number;
  referralValidityDays: number;
  maxReferralsPerUser?: number;
  minimumRequirements: string[];
  autoPayoutEnabled: boolean;
  payoutThreshold: number;
}

/**
 * Referral analytics data
 */
export interface ReferralAnalytics {
  totalReferrals: number;
  conversionRate: number; // Percentage of referrals that complete
  averageBonusAmount: number;
  totalBonusPaid: number;
  topReferrers: Array<{
    userId: string;
    name: string;
    totalReferrals: number;
    totalBonusEarned: number;
  }>;
  monthlyStats: Array<{
    month: string;
    referrals: number;
    completed: number;
    bonusPaid: number;
  }>;
}

/**
 * Referral system errors
 */
export class ReferralError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ReferralError';
  }
}

export class ReferralCodeNotFoundError extends ReferralError {
  constructor(code: string) {
    super(
      `추천코드 '${code}'를 찾을 수 없습니다.`,
      'REFERRAL_CODE_NOT_FOUND',
      404
    );
    this.name = 'ReferralCodeNotFoundError';
  }
}

export class ReferralCodeExpiredError extends ReferralError {
  constructor(code: string) {
    super(
      `추천코드 '${code}'가 만료되었습니다.`,
      'REFERRAL_CODE_EXPIRED',
      410
    );
    this.name = 'ReferralCodeExpiredError';
  }
}

export class ReferralLimitExceededError extends ReferralError {
  constructor(userId: string, limit: number) {
    super(
      `추천 한도(${limit}개)를 초과했습니다.`,
      'REFERRAL_LIMIT_EXCEEDED',
      429
    );
    this.name = 'ReferralLimitExceededError';
  }
}

export class ReferralBonusPayoutError extends ReferralError {
  constructor(referralId: string, reason: string) {
    super(
      `추천 보너스 지급에 실패했습니다: ${reason}`,
      'REFERRAL_BONUS_PAYOUT_ERROR',
      500
    );
    this.name = 'ReferralBonusPayoutError';
  }
}

export class ReferralValidationError extends ReferralError {
  constructor(field: string, message: string) {
    super(
      `추천 시스템 검증 오류 (${field}): ${message}`,
      'REFERRAL_VALIDATION_ERROR',
      400
    );
    this.name = 'ReferralValidationError';
  }
} 