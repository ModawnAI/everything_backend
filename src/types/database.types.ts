// Database type definitions based on SUPABASE SCHEMA.sql
// This file contains all the enum types and table interfaces

// =============================================
// ENUM TYPES (Consistent with SUPABASE SCHEMA.sql and Enum.txt)
// =============================================

export type UserGender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'deleted';
export type UserRole = 'user' | 'shop_owner' | 'admin' | 'influencer';
export type SocialProvider = 'kakao' | 'apple' | 'google' | 'email';

export type ShopStatus = 'active' | 'inactive' | 'pending_approval' | 'suspended' | 'deleted' | 'flagged' | 'under_review' | 'moderation_blocked';
export type ShopType = 'partnered' | 'non_partnered';
export type ServiceCategory = 'nail' | 'eyelash' | 'waxing' | 'eyebrow_tattoo' | 'hair';
export type ShopVerificationStatus = 'pending' | 'verified' | 'rejected';

export type ReservationStatus = 
  | 'requested' 
  | 'confirmed' 
  | 'completed' 
  | 'cancelled_by_user' 
  | 'cancelled_by_shop' 
  | 'no_show';

export type PaymentStatus = 
  | 'pending' 
  | 'deposit_paid' 
  | 'final_payment_pending' 
  | 'fully_paid' 
  | 'refunded' 
  | 'partially_refunded' 
  | 'failed' 
  | 'deposit_refunded' 
  | 'final_payment_refunded' 
  | 'overdue';

export type PaymentMethod = 
  | 'toss_payments' 
  | 'kakao_pay' 
  | 'naver_pay' 
  | 'card' 
  | 'bank_transfer';

export type PointTransactionType = 
  | 'earned_service' 
  | 'earned_referral' 
  | 'used_service' 
  | 'expired' 
  | 'adjusted' 
  | 'influencer_bonus';

export type PointStatus = 'pending' | 'available' | 'used' | 'expired';

export type NotificationType = 
  | 'reservation_confirmed' 
  | 'reservation_cancelled' 
  | 'point_earned' 
  | 'referral_success' 
  | 'system';

export type NotificationStatus = 'unread' | 'read' | 'deleted';
export type ReportReason = 'spam' | 'inappropriate_content' | 'harassment' | 'other';

// Social Feed Types
export type PostStatus = 'active' | 'hidden' | 'reported' | 'deleted';
export type CommentStatus = 'active' | 'hidden' | 'deleted';
export type PostCategory = 'beauty' | 'lifestyle' | 'review' | 'promotion' | 'general';
export type ModerationStatus = 'approved' | 'flagged' | 'hidden' | 'removed' | 'banned' | 'warned';
export type ModerationAction = 'approve' | 'flag' | 'hide' | 'remove' | 'warn' | 'ban';
export type ContentReportReason = 
  | 'spam' 
  | 'harassment' 
  | 'inappropriate_content' 
  | 'fake_information' 
  | 'violence' 
  | 'hate_speech' 
  | 'copyright_violation' 
  | 'impersonation' 
  | 'scam' 
  | 'adult_content' 
  | 'other';
export type ReportStatus = 'pending' | 'under_review' | 'resolved' | 'dismissed';
export type ContentViolationType = 
  | 'profanity' 
  | 'spam' 
  | 'harassment' 
  | 'inappropriate' 
  | 'fake_content' 
  | 'phishing' 
  | 'hate_speech';
export type ModerationSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AdminActionType = 
  | 'user_suspended' 
  | 'shop_approved' 
  | 'shop_rejected' 
  | 'refund_processed' 
  | 'points_adjusted';

// Split Payment Types
export type SplitPaymentStatus = 'pending' | 'deposit_paid' | 'completed' | 'overdue' | 'cancelled';
export type InstallmentType = 'deposit' | 'remaining';
export type InstallmentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type ReminderType = 'upcoming' | 'due' | 'overdue' | 'final';
export type ReminderStatus = 'scheduled' | 'sent' | 'failed' | 'cancelled';

// Refund Types
export type RefundType = 'full' | 'partial' | 'none';
export type RefundReason = 'cancellation' | 'no_show' | 'service_issue' | 'customer_request' | 'admin_override' | 'system_error';
export type RefundStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'cancelled' | 'failed';
export type RefundMethod = 'automatic' | 'manual' | 'bank_transfer' | 'card_refund' | 'points_credit';
export type ApprovalAction = 'pending_review' | 'approved' | 'rejected';
export type AuditAction = 'created' | 'updated' | 'deleted' | 'approved' | 'rejected' | 'processed' | 'completed';
export type RefundPolicyType = 'full' | 'partial' | 'none' | 'admin_override';

// Payment Retry Types
export type RetryType = 'payment_confirmation' | 'webhook_delivery' | 'refund_processing' | 'split_payment';
export type RetryStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

// =============================================
// TABLE INTERFACES
// =============================================

export interface User {
  id: string; // UUID, references auth.users(id)
  email?: string;
  phone_number?: string;
  phone_verified: boolean;
  name: string;
  nickname?: string;
  gender?: UserGender;
  birth_date?: string; // Date string
  profile_image_url?: string;
  user_role: UserRole;
  user_status: UserStatus;
  is_influencer: boolean;
  influencer_qualified_at?: string; // Timestamp
  social_provider?: SocialProvider;
  social_provider_id?: string;
  referral_code?: string;
  referred_by_code?: string;
  total_points: number;
  available_points: number;
  total_referrals: number;
  successful_referrals: number;
  last_login_at?: string; // Timestamp
  terms_accepted_at?: string; // Timestamp
  privacy_accepted_at?: string; // Timestamp
  marketing_consent: boolean;
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

export interface UserSettings {
  id: string; // UUID
  user_id: string; // References users(id)
  push_notifications_enabled: boolean;
  reservation_notifications: boolean;
  event_notifications: boolean;
  marketing_notifications: boolean;
  location_tracking_enabled: boolean;
  language_preference: string;
  currency_preference: string;
  theme_preference: string;
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

export interface Shop {
  id: string; // UUID
  owner_id?: string; // References users(id)
  name: string;
  description?: string;
  phone_number?: string;
  email?: string;
  address: string;
  detailed_address?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  location?: string; // PostGIS Geography type
  shop_type: ShopType;
  shop_status: ShopStatus;
  verification_status: ShopVerificationStatus;
  business_license_number?: string;
  business_license_image_url?: string;
  main_category: ServiceCategory;
  sub_categories?: ServiceCategory[];
  operating_hours?: Record<string, any>; // JSONB
  payment_methods?: PaymentMethod[];
  kakao_channel_url?: string;
  total_bookings: number;
  partnership_started_at?: string; // Timestamp
  featured_until?: string; // Timestamp
  is_featured: boolean;
  commission_rate: number;
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

export interface ShopImage {
  id: string; // UUID
  shop_id: string; // References shops(id)
  image_url: string;
  alt_text?: string;
  is_primary: boolean;
  display_order: number;
  created_at: string; // Timestamp
}

export interface ShopService {
  id: string; // UUID
  shop_id: string; // References shops(id)
  name: string;
  description?: string;
  category: ServiceCategory;
  price_min?: number;
  price_max?: number;
  duration_minutes?: number;
  deposit_amount?: number;
  deposit_percentage?: number;
  is_available: boolean;
  booking_advance_days: number;
  cancellation_hours: number;
  display_order: number;
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

export interface ServiceImage {
  id: string; // UUID
  service_id: string; // References shop_services(id)
  image_url: string;
  alt_text?: string;
  display_order: number;
  created_at: string; // Timestamp
}

export interface Reservation {
  id: string; // UUID
  user_id: string; // References users(id)
  shop_id: string; // References shops(id)
  reservation_date: string; // Date
  reservation_time: string; // Time
  reservation_datetime: string; // Computed timestamp
  status: ReservationStatus;
  total_amount: number;
  deposit_amount: number;
  remaining_amount?: number;
  points_used: number;
  points_earned: number;
  special_requests?: string;
  cancellation_reason?: string;
  no_show_reason?: string;
  confirmed_at?: string; // Timestamp
  completed_at?: string; // Timestamp
  cancelled_at?: string; // Timestamp
  version: number; // Optimistic locking version field
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

export interface ReservationService {
  id: string; // UUID
  reservation_id: string; // References reservations(id)
  service_id: string; // References shop_services(id)
  quantity: number;
  unit_price: number;
  total_price: number;
  version: number; // Optimistic locking version field
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

export interface Payment {
  id: string; // UUID
  reservation_id: string; // References reservations(id)
  user_id: string; // References users(id)
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  amount: number;
  currency: string;
  payment_provider?: string;
  provider_transaction_id?: string;
  provider_order_id?: string;
  is_deposit: boolean;
  paid_at?: string; // Timestamp
  refunded_at?: string; // Timestamp
  refund_amount: number;
  failure_reason?: string;
  metadata?: Record<string, any>; // JSONB
  version: number; // Optimistic locking version field
  // Enhanced two-stage payment tracking fields
  payment_stage: 'deposit' | 'final' | 'single'; // Payment stage type
  due_date?: string; // Timestamp for final payment due date
  reminder_sent_at?: string; // Timestamp when payment reminder was sent
  reminder_count: number; // Number of reminders sent
  final_payment_grace_period_hours: number; // Grace period after service completion
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

export interface SplitPaymentPlan {
  id: string; // UUID
  reservation_id: string; // References reservations(id)
  user_id: string; // References users(id)
  total_amount: number;
  deposit_amount: number;
  remaining_amount: number;
  deposit_payment_id?: string; // References payments(id)
  remaining_payment_id?: string; // References payments(id)
  deposit_paid_at?: string; // Timestamp
  remaining_paid_at?: string; // Timestamp
  remaining_due_date: string; // Timestamp
  status: SplitPaymentStatus;
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

export interface PaymentInstallment {
  id: string; // UUID
  split_payment_plan_id: string; // References split_payment_plans(id)
  payment_id?: string; // References payments(id)
  installment_number: number;
  installment_type: InstallmentType;
  amount: number;
  due_date: string; // Timestamp
  paid_at?: string; // Timestamp
  status: InstallmentStatus;
  reminder_sent_at?: string; // Timestamp
  reminder_count: number;
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

export interface PaymentReminder {
  id: string; // UUID
  installment_id: string; // References payment_installments(id)
  user_id: string; // References users(id)
  reminder_type: ReminderType;
  scheduled_at: string; // Timestamp
  sent_at?: string; // Timestamp
  notification_id?: string; // UUID
  status: ReminderStatus;
  created_at: string; // Timestamp
}

export interface Refund {
  id: string; // UUID
  payment_id: string; // References payments(id)
  reservation_id: string; // References reservations(id)
  user_id: string; // References users(id)
  refund_type: RefundType;
  refund_reason: RefundReason;
  requested_amount: number;
  approved_amount?: number;
  refunded_amount: number;
  refund_status: RefundStatus;
  refund_method?: RefundMethod;
  bank_code?: string;
  account_number?: string;
  account_holder_name?: string;
  refund_reason_details?: string;
  admin_notes?: string;
  customer_notes?: string;
  requested_at: string; // Timestamp
  approved_at?: string; // Timestamp
  approved_by?: string; // References users(id)
  processed_at?: string; // Timestamp
  completed_at?: string; // Timestamp
  cancelled_at?: string; // Timestamp
  cancelled_by?: string; // References users(id)
  cancellation_reason?: string;
  provider_refund_id?: string;
  provider_transaction_id?: string;
  metadata?: Record<string, any>; // JSONB
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

export interface RefundApproval {
  id: string; // UUID
  refund_id: string; // References refunds(id)
  approver_id: string; // References users(id)
  action: ApprovalAction;
  amount?: number;
  reason?: string;
  notes?: string;
  created_at: string; // Timestamp
}

export interface RefundAuditLog {
  id: string; // UUID
  refund_id: string; // References refunds(id)
  action_performed: AuditAction;
  performed_by: string; // References users(id)
  old_values?: Record<string, any>; // JSONB
  new_values?: Record<string, any>; // JSONB
  action_details?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string; // Timestamp
}

export interface RefundPolicy {
  id: string; // UUID
  policy_name: string;
  policy_type: RefundPolicyType;
  description?: string;
  refund_percentage: number;
  max_refund_amount?: number;
  time_limit_hours?: number;
  requires_approval: boolean;
  auto_approve_for_admin: boolean;
  is_active: boolean;
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

export interface PaymentRetryQueue {
  id: string; // UUID
  payment_id: string; // References payments(id)
  reservation_id: string; // References reservations(id)
  user_id: string; // References users(id)
  retry_type: RetryType;
  retry_status: RetryStatus;
  attempt_number: number;
  max_attempts: number;
  next_retry_at: string; // Timestamp
  last_attempt_at?: string; // Timestamp
  last_failure_reason?: string;
  last_failure_code?: string;
  retry_count: number;
  success_count: number;
  total_processing_time?: number; // in milliseconds
  exponential_backoff_multiplier: number;
  base_retry_delay: number; // in seconds
  max_retry_delay: number; // in seconds
  metadata?: Record<string, any>; // JSONB
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

export interface PaymentRetryHistory {
  id: string; // UUID
  retry_queue_id: string; // References payment_retry_queue(id)
  payment_id: string; // References payments(id)
  attempt_number: number;
  retry_status: RetryStatus;
  started_at: string; // Timestamp
  completed_at?: string; // Timestamp
  processing_time?: number; // in milliseconds
  failure_reason?: string;
  failure_code?: string;
  provider_response?: Record<string, any>; // JSONB
  retry_delay_used?: number; // in seconds
  next_retry_scheduled?: string; // Timestamp
  created_at: string; // Timestamp
}

export interface PaymentRetryConfig {
  id: string; // UUID
  config_name: string;
  retry_type: RetryType;
  max_attempts: number;
  base_retry_delay: number; // in seconds
  max_retry_delay: number; // in seconds
  exponential_backoff_multiplier: number;
  jitter_factor: number;
  is_active: boolean;
  description?: string;
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

export interface PaymentRetryNotification {
  id: string; // UUID
  retry_queue_id: string; // References payment_retry_queue(id)
  user_id: string; // References users(id)
  notification_type: string;
  notification_status: string;
  attempt_number: number;
  message: string;
  sent_at?: string; // Timestamp
  delivered_at?: string; // Timestamp
  failure_reason?: string;
  created_at: string; // Timestamp
}

export interface PointTransaction {
  id: string; // UUID
  user_id: string; // References users(id)
  reservation_id?: string; // References reservations(id)
  transaction_type: PointTransactionType;
  amount: number; // Can be positive or negative
  description?: string;
  status: PointStatus;
  available_from?: string; // Timestamp (for 7-day rule)
  expires_at?: string; // Timestamp
  related_user_id?: string; // References users(id) for referral points
  metadata?: Record<string, any>; // JSONB
  created_at: string; // Timestamp
}

export interface PointBalance {
  user_id: string; // UUID, Primary Key, References users(id)
  total_earned: number;
  total_used: number;
  available_balance: number;
  pending_balance: number;
  last_calculated_at: string; // Timestamp
  updated_at: string; // Timestamp
}

export interface UserFavorite {
  id: string; // UUID
  user_id: string; // References users(id)
  shop_id: string; // References shops(id)
  created_at: string; // Timestamp
}

export interface Notification {
  id: string; // UUID
  user_id: string; // References users(id)
  notification_type: NotificationType;
  title: string;
  message: string;
  status: NotificationStatus;
  related_id?: string; // UUID of related entity
  action_url?: string; // Deep link URL
  scheduled_for?: string; // Timestamp
  sent_at?: string; // Timestamp
  read_at?: string; // Timestamp
  created_at: string; // Timestamp
}

export interface PushToken {
  id: string; // UUID
  user_id: string; // References users(id)
  token: string;
  platform: string; // 'ios' | 'android' | 'web'
  is_active: boolean;
  last_used_at?: string; // Timestamp
  created_at: string; // Timestamp
}

export interface ContentReport {
  id: string; // UUID
  reporter_id: string; // References users(id)
  reported_content_type: string; // 'shop', 'user', etc.
  reported_content_id: string; // UUID of reported content
  reason: ReportReason;
  description?: string;
  status: string; // 'pending', 'reviewed', 'resolved'
  reviewed_by?: string; // References users(id)
  reviewed_at?: string; // Timestamp
  resolution_notes?: string;
  created_at: string; // Timestamp
}

export interface AdminAction {
  id: string; // UUID
  admin_id: string; // References users(id)
  action_type: AdminActionType;
  target_type: string; // 'user' | 'shop' | 'reservation' | etc.
  target_id: string; // UUID of target entity
  reason?: string;
  metadata?: Record<string, any>; // JSONB
  created_at: string; // Timestamp
}

export interface Announcement {
  id: string; // UUID
  title: string;
  content: string;
  is_important: boolean;
  is_active: boolean;
  target_user_type?: UserRole[]; // Array of user roles
  starts_at: string; // Timestamp
  ends_at?: string; // Timestamp
  created_by?: string; // References users(id)
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

export interface FAQ {
  id: string; // UUID
  category: string;
  question: string;
  answer: string;
  display_order: number;
  is_active: boolean;
  view_count: number;
  helpful_count: number;
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

// =============================================
// REFERRAL SYSTEM TABLES (Added for consistency)
// =============================================

export interface Referral {
  id: string; // UUID
  referrer_id: string; // References users(id)
  referred_id: string; // References users(id)
  referral_code: string;
  status: 'pending' | 'completed' | 'cancelled' | 'expired';
  bonus_amount: number;
  bonus_type: 'points' | 'cash' | 'discount' | 'free_service';
  bonus_paid: boolean;
  bonus_paid_at?: string; // Timestamp
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
  completed_at?: string; // Timestamp
  expires_at: string; // Timestamp
  notes?: string;
}

export interface ReferralBonusConfig {
  id: string; // UUID
  bonus_type: 'points' | 'cash' | 'discount' | 'free_service';
  bonus_amount: number;
  minimum_requirement?: string;
  valid_days: number;
  max_referrals_per_user?: number;
  is_active: boolean;
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

// =============================================
// PHONE VERIFICATION TABLES (Added for consistency)
// =============================================

export interface PhoneVerification {
  id: string; // UUID
  user_id?: string; // References users(id) - optional for anonymous verification
  phone_number: string;
  verification_method: 'sms' | 'pass';
  status: 'pending' | 'completed' | 'failed' | 'expired';
  tx_id?: string; // Transaction ID for PASS verification
  otp_code?: string; // For SMS verification
  pass_result?: Record<string, any>; // JSONB for PASS verification result
  ci?: string; // Connecting Information from PASS
  di?: string; // Duplicate Information from PASS
  redirect_url?: string; // PASS redirect URL
  expires_at: string; // Timestamp
  verified_at?: string; // Timestamp
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

// =============================================
// UTILITY INTERFACES
// =============================================

export interface DatabaseTableDefinition {
  tableName: string;
  createQuery: string;
  indexes?: string[];
  constraints?: string[];
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface QueryResult<T> {
  data: T[] | null;
  error: Error | null;
  count?: number;
}

export interface DatabaseError {
  code: string;
  message: string;
  details?: string;
  hint?: string;
}

// =============================================
// UNION TYPE FOR ALL DATABASE RECORDS
// =============================================

export type DatabaseRecord = 
  | User 
  | UserSettings 
  | Shop 
  | ShopImage 
  | ShopService 
  | ServiceImage 
  | Reservation 
  | ReservationService 
  | Payment 
  | SplitPaymentPlan
  | PaymentInstallment
  | PaymentReminder
  | Refund
  | RefundApproval
  | RefundAuditLog
  | RefundPolicy
  | PaymentRetryQueue
  | PaymentRetryHistory
  | PaymentRetryConfig
  | PaymentRetryNotification
  | PointTransaction 
  | PointBalance
  | UserFavorite 
  | Notification
  | PushToken 
  | ContentReport
  | AdminAction
  | Announcement
  | FAQ
  | Referral
  | ReferralBonusConfig
  | PhoneVerification
  | RefreshToken
  | ReservationRescheduleHistory
  | Conflict
  | FeedPost
  | PostImage
  | FeedComment
  | PostLike
  | CommentLike
  | PostReport
  | CommentReport
  | PostView
  | UserFollow
  | Hashtag
  | PostHashtag
  | ModerationResult
  | ModerationLog
  | ModerationQueueItem
  | FeedAnalytics
  | UserAnalytics
  | ContentPerformance
  | TrendingContent
  | ExecutiveDashboard
  | FinancialAnalytics; 

// =============================================
// REFRESH TOKEN INTERFACE (For auth system)
// =============================================

export interface ReservationRescheduleHistory {
  id: string; // UUID
  reservation_id: string; // References reservations(id)
  shop_id: string; // References shops(id)
  old_date: string; // Date
  old_time: string; // Time
  new_date: string; // Date
  new_time: string; // Time
  reason?: string;
  requested_by: 'user' | 'shop' | 'admin';
  requested_by_id: string; // UUID
  fees: number; // Reschedule fees in won
  timestamp: string; // Timestamp
}

export interface RefreshToken {
  id: string;
  token: string;
  user_id: string;
  expires_at: string;
  revoked: boolean;
  created_at: string;
  updated_at: string;
  device_id?: string;
  user_agent?: string;
  ip_address?: string;
  last_used_at?: string;
}

export interface Conflict {
  id: string; // UUID
  type: 'time_overlap' | 'resource_shortage' | 'staff_unavailable' | 'capacity_exceeded' | 'double_booking' | 'service_conflict' | 'payment_conflict';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affected_reservations: string[]; // Array of reservation IDs
  shop_id: string; // References shops(id)
  detected_at: string; // Timestamp
  resolved_at?: string; // Timestamp
  resolved_by?: string; // References users(id)
  resolution_method?: 'automatic_reschedule' | 'manual_reschedule' | 'cancellation' | 'compensation' | 'priority_override' | 'resource_reallocation';
  compensation?: {
    type: 'refund' | 'discount' | 'free_service' | 'points' | 'voucher';
    amount: number;
    currency: string;
    description: string;
    applied: boolean;
    applied_at?: string;
  };
  metadata?: Record<string, any>; // JSONB
}

// =============================================
// SOCIAL FEED INTERFACES
// =============================================

/**
 * Social Feed Post Interface
 * Represents a user-generated content post in the social feed
 */
export interface FeedPost {
  id: string; // UUID
  author_id: string; // References users(id)
  content: string; // Max 2000 characters
  category?: PostCategory;
  location_tag?: string; // Max 100 characters
  tagged_shop_id?: string; // References shops(id)
  hashtags: string[]; // Max 10 hashtags, each max 50 chars
  like_count: number;
  comment_count: number;
  view_count: number;
  share_count: number;
  report_count: number;
  status: PostStatus;
  moderation_status: ModerationStatus;
  moderation_score: number; // 0-100, higher means more problematic
  is_hidden: boolean;
  requires_review: boolean;
  hidden_at?: string; // Timestamp
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
  
  // Computed/joined fields (not stored in DB)
  author?: Pick<User, 'id' | 'name' | 'nickname' | 'profile_image_url' | 'is_influencer'>;
  images?: PostImage[];
  is_liked_by_user?: boolean; // For current user context
  user_like_id?: string; // For current user context
}

/**
 * Post Image Interface
 * Represents images attached to feed posts
 */
export interface PostImage {
  id: string; // UUID
  post_id: string; // References feed_posts(id)
  image_url: string; // Full URL to image
  thumbnail_url?: string; // Optimized thumbnail URL
  alt_text?: string; // Max 200 characters
  display_order: number; // 1-10
  width?: number;
  height?: number;
  file_size?: number; // In bytes
  format?: string; // 'jpeg', 'png', 'webp'
  created_at: string; // Timestamp
}

/**
 * Feed Comment Interface
 * Represents comments on feed posts
 */
export interface FeedComment {
  id: string; // UUID
  post_id: string; // References feed_posts(id)
  author_id: string; // References users(id)
  parent_comment_id?: string; // References feed_comments(id) for replies
  content: string; // Max 500 characters
  like_count: number;
  reply_count: number;
  status: CommentStatus;
  moderation_status: ModerationStatus;
  moderation_score: number; // 0-100
  is_hidden: boolean;
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
  
  // Computed/joined fields
  author?: Pick<User, 'id' | 'name' | 'nickname' | 'profile_image_url'>;
  replies?: FeedComment[];
  is_liked_by_user?: boolean;
}

/**
 * Post Like Interface
 * Represents likes on feed posts
 */
export interface PostLike {
  id: string; // UUID
  post_id: string; // References feed_posts(id)
  user_id: string; // References users(id)
  created_at: string; // Timestamp
}

/**
 * Comment Like Interface
 * Represents likes on comments
 */
export interface CommentLike {
  id: string; // UUID
  comment_id: string; // References feed_comments(id)
  user_id: string; // References users(id)
  created_at: string; // Timestamp
}

/**
 * Post Report Interface
 * Represents user reports on feed posts
 */
export interface PostReport {
  id: string; // UUID
  post_id: string; // References feed_posts(id)
  reporter_id: string; // References users(id)
  reason: ContentReportReason;
  description?: string; // Max 500 characters
  status: ReportStatus;
  admin_action?: ModerationAction;
  admin_reason?: string;
  resolved_by?: string; // References users(id) - admin who resolved
  resolved_at?: string; // Timestamp
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

/**
 * Comment Report Interface
 * Represents user reports on comments
 */
export interface CommentReport {
  id: string; // UUID
  comment_id: string; // References feed_comments(id)
  reporter_id: string; // References users(id)
  reason: ContentReportReason;
  description?: string; // Max 500 characters
  status: ReportStatus;
  admin_action?: ModerationAction;
  admin_reason?: string;
  resolved_by?: string; // References users(id)
  resolved_at?: string; // Timestamp
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

/**
 * Feed View Interface
 * Tracks post views for analytics
 */
export interface PostView {
  id: string; // UUID
  post_id: string; // References feed_posts(id)
  user_id?: string; // References users(id) - null for anonymous views
  ip_address?: string; // For anonymous tracking
  user_agent?: string;
  view_duration?: number; // In seconds
  created_at: string; // Timestamp
}

/**
 * User Follow Interface
 * Represents user following relationships
 */
export interface UserFollow {
  id: string; // UUID
  follower_id: string; // References users(id) - who is following
  following_id: string; // References users(id) - who is being followed
  created_at: string; // Timestamp
}

/**
 * Hashtag Interface
 * Represents trending hashtags
 */
export interface Hashtag {
  id: string; // UUID
  tag: string; // The hashtag without #, max 50 chars
  usage_count: number;
  trending_score: number; // Calculated trending score
  category?: PostCategory;
  is_trending: boolean;
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

/**
 * Post Hashtag Junction Interface
 * Links posts to hashtags
 */
export interface PostHashtag {
  id: string; // UUID
  post_id: string; // References feed_posts(id)
  hashtag_id: string; // References hashtags(id)
  created_at: string; // Timestamp
}

// =============================================
// CONTENT MODERATION INTERFACES
// =============================================

/**
 * Content Violation Interface
 * Represents detected violations in content
 */
export interface ContentViolation {
  type: ContentViolationType;
  description: string;
  severity: ModerationSeverity;
  confidence: number; // 0-100
  context?: string; // Additional context about the violation
}

/**
 * Content Analysis Result Interface
 * Result of automated content moderation analysis
 */
export interface ContentAnalysisResult {
  isAppropriate: boolean;
  severity: ModerationSeverity;
  score: number; // 0-100, higher means more problematic
  violations: ContentViolation[];
  suggestedAction: 'allow' | 'flag' | 'block' | 'review';
  confidence: number; // 0-100, confidence in the analysis
  requiresReview?: boolean;
  autoAction?: 'none' | 'flag' | 'hide' | 'remove';
}

/**
 * Moderation Result Interface
 * Result of content moderation (automated or manual)
 */
export interface ModerationResult {
  id: string; // UUID
  content_id: string; // References the content being moderated
  content_type: 'post' | 'comment';
  moderator_id?: string; // References users(id) - null for automated
  action: ModerationAction;
  reason?: string;
  severity: ModerationSeverity;
  confidence: number;
  violations: ContentViolation[];
  is_automated: boolean;
  reviewed_by?: string; // References users(id) - admin who reviewed
  reviewed_at?: string; // Timestamp
  created_at: string; // Timestamp
  metadata?: Record<string, any>; // Additional moderation data
}

/**
 * Content Moderator Configuration Interface
 * Configuration for automated content moderation
 */
export interface ContentModeratorConfig {
  thresholds: {
    low: number; // Score threshold for low severity (0-40)
    medium: number; // Score threshold for medium severity (40-70)
    flag: number; // Score threshold for flagging (70-85)
    block: number; // Score threshold for blocking (85-100)
  };
  minConfidence: number; // Minimum confidence required for automated actions
  enabledChecks: {
    profanity: boolean;
    spam: boolean;
    harassment: boolean;
    inappropriate: boolean;
    fakeContent: boolean;
    phishing: boolean;
    hateSpeech: boolean;
  };
  languages: string[]; // Supported languages for moderation
  customPatterns?: string[]; // Custom regex patterns for detection
}

/**
 * Moderation Log Interface
 * Audit trail for moderation actions
 */
export interface ModerationLog {
  id: string; // UUID
  content_id: string;
  content_type: 'post' | 'comment';
  action: ModerationAction;
  reason: string;
  moderator_id?: string; // References users(id) - null for automated
  is_automated: boolean;
  previous_status?: ModerationStatus;
  new_status: ModerationStatus;
  metadata?: {
    score?: number;
    violations?: ContentViolation[];
    user_reports_count?: number;
    escalation_reason?: string;
    admin_notes?: string;
  };
  created_at: string; // Timestamp
}

/**
 * Moderation Queue Item Interface
 * Items waiting for manual moderation review
 */
export interface ModerationQueueItem {
  id: string; // UUID
  content_id: string;
  content_type: 'post' | 'comment';
  priority: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  report_count: number;
  moderation_score: number;
  violations: ContentViolation[];
  assigned_to?: string; // References users(id) - admin assigned
  assigned_at?: string; // Timestamp
  due_date?: string; // Timestamp
  created_at: string; // Timestamp
  
  // Computed/joined fields
  content?: Pick<FeedPost | FeedComment, 'id' | 'content' | 'author_id' | 'created_at'>;
  author?: Pick<User, 'id' | 'name' | 'nickname' | 'profile_image_url'>;
  recent_reports?: Pick<PostReport | CommentReport, 'id' | 'reason' | 'description' | 'created_at'>[];
}

// =============================================
// ANALYTICS AND DASHBOARD INTERFACES
// =============================================

/**
 * Feed Analytics Interface
 * Analytics data for social feed performance
 */
export interface FeedAnalytics {
  id: string; // UUID
  date: string; // Date string (YYYY-MM-DD)
  total_posts: number;
  total_comments: number;
  total_likes: number;
  total_views: number;
  total_shares: number;
  total_reports: number;
  active_users: number;
  new_users: number;
  engagement_rate: number; // Percentage
  top_categories: Array<{
    category: PostCategory;
    post_count: number;
    engagement_rate: number;
  }>;
  top_hashtags: Array<{
    hashtag: string;
    usage_count: number;
    engagement_rate: number;
  }>;
  moderation_stats: {
    total_moderated: number;
    auto_moderated: number;
    manual_moderated: number;
    false_positives: number;
    appeals_processed: number;
  };
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

/**
 * User Analytics Interface
 * Analytics data for individual user performance
 */
export interface UserAnalytics {
  id: string; // UUID
  user_id: string; // References users(id)
  date: string; // Date string (YYYY-MM-DD)
  posts_created: number;
  comments_made: number;
  likes_given: number;
  likes_received: number;
  views_received: number;
  shares_received: number;
  followers_gained: number;
  followers_lost: number;
  engagement_rate: number; // Percentage
  reach: number; // Unique users who saw content
  impressions: number; // Total content views
  top_performing_post_id?: string; // References feed_posts(id)
  created_at: string; // Timestamp
}

/**
 * Content Performance Interface
 * Performance metrics for individual content pieces
 */
export interface ContentPerformance {
  id: string; // UUID
  content_id: string; // References feed_posts(id) or feed_comments(id)
  content_type: 'post' | 'comment';
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reports: number;
  engagement_rate: number; // Percentage
  reach: number; // Unique users reached
  impressions: number; // Total impressions
  click_through_rate?: number; // For posts with links
  conversion_rate?: number; // For promotional posts
  demographic_breakdown: {
    age_groups: Record<string, number>; // e.g., "18-24": 150
    genders: Record<string, number>; // e.g., "female": 200
    locations: Record<string, number>; // e.g., "Seoul": 300
  };
  time_metrics: {
    peak_engagement_hour: number; // 0-23
    average_view_duration: number; // In seconds
    bounce_rate: number; // Percentage
  };
  created_at: string; // Timestamp
  updated_at: string; // Timestamp
}

/**
 * Trending Content Interface
 * Content that is currently trending
 */
export interface TrendingContent {
  id: string; // UUID
  content_id: string; // References feed_posts(id)
  content_type: 'post' | 'hashtag' | 'user';
  trending_score: number; // Calculated trending score
  rank: number; // Current trending rank
  category?: PostCategory;
  time_window: '1h' | '6h' | '24h' | '7d'; // Trending time window
  metrics: {
    engagement_velocity: number; // Engagement per hour
    viral_coefficient: number; // Share rate
    quality_score: number; // Content quality assessment
  };
  started_trending_at: string; // Timestamp
  expires_at?: string; // Timestamp
  created_at: string; // Timestamp
}

/**
 * Executive Dashboard Interface
 * High-level metrics for executive reporting
 */
export interface ExecutiveDashboard {
  id: string; // UUID
  report_date: string; // Date string
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  
  // User Metrics
  total_users: number;
  active_users: number;
  new_users: number;
  user_retention_rate: number; // Percentage
  
  // Content Metrics
  total_posts: number;
  total_comments: number;
  content_growth_rate: number; // Percentage
  
  // Engagement Metrics
  total_engagement: number; // Likes + comments + shares
  engagement_rate: number; // Percentage
  average_session_duration: number; // In minutes
  
  // Moderation Metrics
  content_moderated: number;
  moderation_accuracy: number; // Percentage
  user_reports: number;
  
  // Business Metrics
  influencer_count: number;
  shop_integrations: number;
  conversion_rate: number; // Posts to shop visits
  
  // Performance Indicators
  server_uptime: number; // Percentage
  average_response_time: number; // In milliseconds
  error_rate: number; // Percentage
  
  created_at: string; // Timestamp
}

/**
 * Financial Analytics Interface
 * Financial metrics related to social feed
 */
export interface FinancialAnalytics {
  id: string; // UUID
  date: string; // Date string
  period: 'daily' | 'weekly' | 'monthly';
  
  // Revenue Metrics
  total_revenue: number; // In won
  advertising_revenue: number;
  commission_revenue: number;
  subscription_revenue: number;
  
  // Cost Metrics
  content_moderation_cost: number;
  storage_cost: number;
  bandwidth_cost: number;
  ai_processing_cost: number;
  
  // ROI Metrics
  customer_acquisition_cost: number;
  lifetime_value: number;
  return_on_ad_spend: number; // Percentage
  
  // Conversion Metrics
  post_to_shop_visit_rate: number; // Percentage
  shop_visit_to_purchase_rate: number; // Percentage
  influencer_conversion_rate: number; // Percentage
  
  created_at: string; // Timestamp
}

/**
 * Real-time Dashboard Interface
 * Real-time metrics for monitoring
 */
export interface RealTimeDashboard {
  timestamp: string; // Current timestamp
  
  // Live Activity
  active_users_now: number;
  posts_last_hour: number;
  comments_last_hour: number;
  likes_last_hour: number;
  
  // System Health
  server_status: 'healthy' | 'warning' | 'critical';
  response_time_avg: number; // In milliseconds
  error_rate_last_hour: number; // Percentage
  
  // Content Flow
  pending_moderation: number;
  auto_moderated_last_hour: number;
  user_reports_last_hour: number;
  
  // Trending Now
  trending_hashtags: Array<{
    hashtag: string;
    mentions_last_hour: number;
    growth_rate: number;
  }>;
  
  viral_posts: Array<{
    post_id: string;
    engagement_velocity: number;
    current_rank: number;
  }>;
  
  // Alerts
  active_alerts: Array<{
    type: 'performance' | 'moderation' | 'security' | 'business';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    created_at: string;
  }>;
}

// =============================================
// FEED STORAGE INTERFACES
// =============================================

/**
 * Feed Storage Configuration Interface
 * Configuration for feed content storage and caching
 */
export interface FeedStorageConfig {
  cache: {
    ttl: number; // Time to live in seconds
    maxSize: number; // Maximum cache size in MB
    strategy: 'lru' | 'lfu' | 'fifo'; // Cache eviction strategy
  };
  storage: {
    provider: 'supabase' | 'aws_s3' | 'gcp_storage';
    bucket: string;
    region?: string;
    compression: boolean;
    encryption: boolean;
  };
  performance: {
    batchSize: number; // Batch size for bulk operations
    maxConcurrency: number; // Max concurrent operations
    retryAttempts: number;
    retryDelay: number; // In milliseconds
  };
}

/**
 * Feed Storage Interface
 * Main interface for feed content storage operations
 */
export interface FeedStorage {
  // Post Operations
  createPost(post: Omit<FeedPost, 'id' | 'created_at' | 'updated_at'>): Promise<FeedPost>;
  getPost(postId: string, userId?: string): Promise<FeedPost | null>;
  updatePost(postId: string, updates: Partial<FeedPost>): Promise<FeedPost>;
  deletePost(postId: string): Promise<boolean>;
  
  // Batch Operations
  getPosts(filters: FeedPostFilters): Promise<{
    posts: FeedPost[];
    total: number;
    hasMore: boolean;
    nextCursor?: string;
  }>;
  
  // Comment Operations
  createComment(comment: Omit<FeedComment, 'id' | 'created_at' | 'updated_at'>): Promise<FeedComment>;
  getComments(postId: string, filters?: CommentFilters): Promise<{
    comments: FeedComment[];
    total: number;
    hasMore: boolean;
  }>;
  updateComment(commentId: string, updates: Partial<FeedComment>): Promise<FeedComment>;
  deleteComment(commentId: string): Promise<boolean>;
  
  // Like Operations
  likePost(postId: string, userId: string): Promise<PostLike>;
  unlikePost(postId: string, userId: string): Promise<boolean>;
  likeComment(commentId: string, userId: string): Promise<CommentLike>;
  unlikeComment(commentId: string, userId: string): Promise<boolean>;
  
  // Analytics Operations
  recordView(postId: string, userId?: string, metadata?: Record<string, any>): Promise<void>;
  getAnalytics(contentId: string, type: 'post' | 'comment'): Promise<ContentPerformance>;
  
  // Cache Operations
  invalidateCache(key: string): Promise<void>;
  clearUserCache(userId: string): Promise<void>;
  warmCache(contentIds: string[]): Promise<void>;
}

/**
 * Feed Post Filters Interface
 * Filters for querying feed posts
 */
export interface FeedPostFilters {
  // Basic Filters
  authorId?: string;
  category?: PostCategory;
  status?: PostStatus;
  moderationStatus?: ModerationStatus;
  
  // Content Filters
  hashtags?: string[];
  taggedShopId?: string;
  locationTag?: string;
  hasImages?: boolean;
  
  // Engagement Filters
  minLikes?: number;
  maxLikes?: number;
  minComments?: number;
  maxComments?: number;
  minViews?: number;
  
  // Time Filters
  createdAfter?: string; // ISO timestamp
  createdBefore?: string; // ISO timestamp
  updatedAfter?: string;
  updatedBefore?: string;
  
  // Sorting and Pagination
  sortBy?: 'created_at' | 'updated_at' | 'like_count' | 'comment_count' | 'view_count' | 'trending_score';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  cursor?: string; // For cursor-based pagination
  
  // User Context
  userId?: string; // For personalized results
  includeHidden?: boolean; // Include hidden posts (admin only)
  includeReported?: boolean; // Include reported posts (admin only)
}

/**
 * Comment Filters Interface
 * Filters for querying comments
 */
export interface CommentFilters {
  authorId?: string;
  parentCommentId?: string; // For replies
  status?: CommentStatus;
  moderationStatus?: ModerationStatus;
  
  // Engagement Filters
  minLikes?: number;
  maxLikes?: number;
  
  // Time Filters
  createdAfter?: string;
  createdBefore?: string;
  
  // Sorting and Pagination
  sortBy?: 'created_at' | 'like_count';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  
  // User Context
  userId?: string;
  includeHidden?: boolean;
}

/**
 * Storage Operation Result Interface
 * Standardized result format for storage operations
 */
export interface StorageOperationResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  metadata?: {
    executionTime: number; // In milliseconds
    cacheHit?: boolean;
    affectedRows?: number;
    warnings?: string[];
  };
}

/**
 * Bulk Operation Result Interface
 * Result format for bulk storage operations
 */
export interface BulkOperationResult<T = any> {
  success: boolean;
  results: Array<{
    id: string;
    success: boolean;
    data?: T;
    error?: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    executionTime: number;
  };
} 