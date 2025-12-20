/**
 * Review Reply Types
 *
 * Types for review replies and blind request functionality
 */

export interface ReviewReply {
  id: string;
  reviewId: string;
  shopId: string;
  replyText: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReplyDto {
  replyText: string;
}

export interface UpdateReplyDto {
  replyText: string;
}

export type BlindRequestReasonCategory =
  | 'profanity'
  | 'false_info'
  | 'personal_attack'
  | 'spam'
  | 'other';

export type BlindRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ReviewBlindRequest {
  id: string;
  reviewId: string;
  shopId: string;
  reason: string;
  reasonCategory: BlindRequestReasonCategory;
  evidenceUrls?: string[];
  status: BlindRequestStatus;
  adminNotes?: string;
  processedBy?: string;
  processedAt?: Date;
  createdAt: Date;
}

export interface CreateBlindRequestDto {
  reason: string;
  reasonCategory: BlindRequestReasonCategory;
  evidenceUrls?: string[];
}

export interface ProcessBlindRequestDto {
  status: 'approved' | 'rejected';
  adminNotes?: string;
}

export interface ShopReviewWithReply {
  id: string;
  userId: string;
  userName: string;
  userProfileImage?: string;
  rating: number;
  content: string;
  images?: string[];
  createdAt: Date;
  isBlinded: boolean;
  reply?: ReviewReply;
  blindRequest?: ReviewBlindRequest;
}

export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  repliedCount: number;
  unrepliedCount: number;
  blindedCount: number;
  pendingBlindRequests: number;
}

export interface BlindRequestStats {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  totalProcessed: number;
}
