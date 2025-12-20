/**
 * App Popup Types
 *
 * Types for managing app popup banners displayed on app launch.
 * Includes popup configurations, dismissal tracking, and API request/response types.
 */

// =============================================
// DATABASE ENTITY TYPES
// =============================================

/**
 * Link type for popup actions
 */
export type PopupLinkType = 'none' | 'internal' | 'external';

/**
 * Target audience for popups
 */
export type PopupTargetAudience = 'all' | 'new_users' | 'returning';

/**
 * Dismissal type options
 */
export type PopupDismissType = 'close' | 'never_show';

/**
 * App Popup Entity
 * Matches app_popups database table
 */
export interface AppPopup {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  link_type: PopupLinkType;
  display_order: number;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
  target_audience: PopupTargetAudience;
  view_count: number;
  click_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Popup Dismissal Entity
 * Matches popup_dismissals database table
 */
export interface PopupDismissal {
  id: string;
  user_id: string | null;
  device_id: string | null;
  popup_id: string;
  dismiss_type: PopupDismissType;
  dismissed_at: string;
}

// =============================================
// API RESPONSE TYPES
// =============================================

/**
 * Popup Response for Client
 * Cleaned up version for frontend consumption
 */
export interface PopupResponse {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  linkType: PopupLinkType;
  displayOrder: number;
}

/**
 * Active Popups Response
 */
export interface ActivePopupsResponse {
  popups: PopupResponse[];
  total: number;
}

/**
 * Admin Popup Response
 * Full popup details for admin panel
 */
export interface AdminPopupResponse {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string | null;
  linkType: PopupLinkType;
  displayOrder: number;
  active: boolean;
  startDate: string | null;
  endDate: string | null;
  targetAudience: PopupTargetAudience;
  viewCount: number;
  clickCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Admin Popup List Response
 */
export interface AdminPopupListResponse {
  popups: AdminPopupResponse[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// =============================================
// API REQUEST TYPES
// =============================================

/**
 * Get Active Popups Request
 */
export interface GetActivePopupsRequest {
  userId?: string;
  deviceId?: string;
  isNewUser?: boolean;
}

/**
 * Create Popup Request
 */
export interface CreatePopupRequest {
  title: string;
  imageUrl: string;
  linkUrl?: string;
  linkType?: PopupLinkType;
  displayOrder?: number;
  active?: boolean;
  startDate?: string;
  endDate?: string;
  targetAudience?: PopupTargetAudience;
}

/**
 * Update Popup Request
 */
export interface UpdatePopupRequest {
  title?: string;
  imageUrl?: string;
  linkUrl?: string | null;
  linkType?: PopupLinkType;
  displayOrder?: number;
  active?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  targetAudience?: PopupTargetAudience;
}

/**
 * Dismiss Popup Request
 */
export interface DismissPopupRequest {
  popupId: string;
  dismissType: PopupDismissType;
  userId?: string;
  deviceId?: string;
}

/**
 * Record Popup Click Request
 */
export interface RecordPopupClickRequest {
  popupId: string;
}

/**
 * Admin List Popups Request
 */
export interface AdminListPopupsRequest {
  page?: number;
  limit?: number;
  active?: boolean;
  sortBy?: 'display_order' | 'created_at' | 'view_count' | 'click_count';
  sortOrder?: 'asc' | 'desc';
}

// =============================================
// UTILITY TYPES
// =============================================

/**
 * Popup Statistics
 */
export interface PopupStatistics {
  totalPopups: number;
  activePopups: number;
  totalViews: number;
  totalClicks: number;
  averageClickRate: number;
  topPerformingPopups: AdminPopupResponse[];
}

/**
 * Popup Filter Options
 */
export interface PopupFilterOptions {
  active?: boolean;
  targetAudience?: PopupTargetAudience;
  dateRange?: {
    start: string;
    end: string;
  };
}

/**
 * Transform database popup to client response
 */
export function toPopupResponse(popup: AppPopup): PopupResponse {
  return {
    id: popup.id,
    title: popup.title,
    imageUrl: popup.image_url,
    linkUrl: popup.link_url,
    linkType: popup.link_type,
    displayOrder: popup.display_order,
  };
}

/**
 * Transform database popup to admin response
 */
export function toAdminPopupResponse(popup: AppPopup): AdminPopupResponse {
  return {
    id: popup.id,
    title: popup.title,
    imageUrl: popup.image_url,
    linkUrl: popup.link_url,
    linkType: popup.link_type,
    displayOrder: popup.display_order,
    active: popup.active,
    startDate: popup.start_date,
    endDate: popup.end_date,
    targetAudience: popup.target_audience,
    viewCount: popup.view_count,
    clickCount: popup.click_count,
    createdBy: popup.created_by,
    createdAt: popup.created_at,
    updatedAt: popup.updated_at,
  };
}
