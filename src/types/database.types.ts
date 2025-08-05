// Database type definitions based on SUPABASE SCHEMA.sql
// This file contains all the enum types and table interfaces

// =============================================
// ENUM TYPES (Consistent with SUPABASE SCHEMA.sql and Enum.txt)
// =============================================

export type UserGender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'deleted';
export type UserRole = 'user' | 'shop_owner' | 'admin' | 'influencer';
export type SocialProvider = 'kakao' | 'apple' | 'google' | 'email';

export type ShopStatus = 'active' | 'inactive' | 'pending_approval' | 'suspended' | 'deleted';
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
  | 'fully_paid' 
  | 'refunded' 
  | 'partially_refunded' 
  | 'failed';

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
  created_at: string; // Timestamp
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
  | Conflict; 

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