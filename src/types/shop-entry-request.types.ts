/**
 * Shop Entry Request Types
 *
 * Types for managing shop entry requests.
 * Users can request shops to be added to the platform.
 */

// =============================================
// DATABASE ENTITY TYPES
// =============================================

/**
 * Shop entry request status values
 */
export type ShopEntryRequestStatus = 'pending' | 'contacted' | 'registered' | 'rejected';

/**
 * Shop category values
 */
export type ShopCategory = 'nail' | 'eyelash' | 'waxing' | 'hair' | 'other';

/**
 * Shop Entry Request Entity
 * Matches shop_entry_requests database table
 */
export interface ShopEntryRequest {
  id: string;
  requester_user_id: string | null;
  requester_email: string | null;
  requester_phone: string | null;
  shop_name: string;
  shop_address: string | null;
  shop_phone: string | null;
  shop_category: string | null;
  additional_info: string | null;
  status: ShopEntryRequestStatus;
  admin_notes: string | null;
  processed_by: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Shop Entry Request with requester info (from join)
 */
export interface ShopEntryRequestWithRequester extends ShopEntryRequest {
  requester?: {
    nickname: string | null;
    email: string | null;
  } | null;
  processor?: {
    nickname: string | null;
    email: string | null;
  } | null;
}

// =============================================
// API RESPONSE TYPES
// =============================================

/**
 * Shop Entry Request Response for Client
 * Cleaned up version for frontend consumption
 */
export interface ShopEntryRequestResponse {
  id: string;
  shopName: string;
  shopAddress: string | null;
  shopPhone: string | null;
  shopCategory: string | null;
  additionalInfo: string | null;
  status: ShopEntryRequestStatus;
  createdAt: string;
}

/**
 * Admin Shop Entry Request Response
 * Full details for admin panel
 */
export interface AdminShopEntryRequestResponse {
  id: string;
  requesterUserId: string | null;
  requesterEmail: string | null;
  requesterPhone: string | null;
  requesterNickname: string | null;
  shopName: string;
  shopAddress: string | null;
  shopPhone: string | null;
  shopCategory: string | null;
  additionalInfo: string | null;
  status: ShopEntryRequestStatus;
  adminNotes: string | null;
  processedBy: string | null;
  processedByNickname: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Admin Shop Entry Request List Response
 */
export interface AdminShopEntryRequestListResponse {
  requests: AdminShopEntryRequestResponse[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// =============================================
// API REQUEST TYPES
// =============================================

/**
 * Create Shop Entry Request
 */
export interface CreateShopEntryRequest {
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  shopCategory?: ShopCategory | string;
  additionalInfo?: string;
  requesterEmail?: string;
  requesterPhone?: string;
}

/**
 * Update Shop Entry Request Status (Admin)
 */
export interface UpdateShopEntryRequestStatus {
  status: ShopEntryRequestStatus;
  adminNotes?: string | null;
}

/**
 * Admin List Shop Entry Requests Request
 */
export interface AdminListShopEntryRequestsRequest {
  page?: number;
  limit?: number;
  status?: ShopEntryRequestStatus;
  sortBy?: 'created_at' | 'status' | 'shop_name';
  sortOrder?: 'asc' | 'desc';
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * Transform database shop entry request to client response
 */
export function toShopEntryRequestResponse(request: ShopEntryRequest): ShopEntryRequestResponse {
  return {
    id: request.id,
    shopName: request.shop_name,
    shopAddress: request.shop_address,
    shopPhone: request.shop_phone,
    shopCategory: request.shop_category,
    additionalInfo: request.additional_info,
    status: request.status,
    createdAt: request.created_at,
  };
}

/**
 * Transform database shop entry request to admin response
 */
export function toAdminShopEntryRequestResponse(
  request: ShopEntryRequestWithRequester
): AdminShopEntryRequestResponse {
  return {
    id: request.id,
    requesterUserId: request.requester_user_id,
    requesterEmail: request.requester_email || request.requester?.email || null,
    requesterPhone: request.requester_phone,
    requesterNickname: request.requester?.nickname || null,
    shopName: request.shop_name,
    shopAddress: request.shop_address,
    shopPhone: request.shop_phone,
    shopCategory: request.shop_category,
    additionalInfo: request.additional_info,
    status: request.status,
    adminNotes: request.admin_notes,
    processedBy: request.processed_by,
    processedByNickname: request.processor?.nickname || null,
    processedAt: request.processed_at,
    createdAt: request.created_at,
    updatedAt: request.updated_at,
  };
}

/**
 * Status display labels (Korean)
 */
export const SHOP_ENTRY_REQUEST_STATUS_LABELS: Record<ShopEntryRequestStatus, string> = {
  pending: '대기중',
  contacted: '연락완료',
  registered: '입점완료',
  rejected: '거절',
};

/**
 * Category display labels (Korean)
 */
export const SHOP_CATEGORY_LABELS: Record<ShopCategory, string> = {
  nail: '네일',
  eyelash: '속눈썹',
  waxing: '왁싱/눈썹문신',
  hair: '헤어',
  other: '기타',
};
