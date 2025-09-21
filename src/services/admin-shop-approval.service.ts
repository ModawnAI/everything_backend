import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { ShopStatus, ShopVerificationStatus, ServiceCategory } from '../types/database.types';
import { notificationService } from './notification.service';

export interface ShopApprovalFilters {
  status?: ShopStatus;
  verificationStatus?: ShopVerificationStatus;
  category?: ServiceCategory;
  search?: string; // Search in name, description, address
  startDate?: string; // Created date range
  endDate?: string;
  hasBusinessLicense?: boolean;
  isFeatured?: boolean;
  sortBy?: 'created_at' | 'name' | 'verification_status' | 'total_bookings';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface ShopApprovalResponse {
  shops: Array<{
    id: string;
    name: string;
    description?: string;
    phoneNumber?: string;
    email?: string;
    address: string;
    detailedAddress?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    shopType: string;
    shopStatus: ShopStatus;
    verificationStatus: ShopVerificationStatus;
    businessLicenseNumber?: string;
    businessLicenseImageUrl?: string;
    mainCategory: ServiceCategory;
    subCategories?: ServiceCategory[];
    operatingHours?: Record<string, any>;
    paymentMethods?: string[];
    kakaoChannelUrl?: string;
    totalBookings: number;
    partnershipStartedAt?: string;
    featuredUntil?: string;
    isFeatured: boolean;
    commissionRate: number;
    createdAt: string;
    updatedAt: string;
    // Owner information
    owner?: {
      id: string;
      name: string;
      email?: string;
      phoneNumber?: string;
      userStatus: string;
    };
    // Verification details
    verificationDetails?: {
      submittedAt: string;
      reviewedAt?: string;
      reviewedBy?: string;
      reviewNotes?: string;
      rejectionReason?: string;
      documentsSubmitted: string[];
    };
    // Computed fields
    daysSinceSubmission?: number;
    isUrgent: boolean;
    hasCompleteDocuments: boolean;
  }>;
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
  filters: ShopApprovalFilters;
}

export interface ShopApprovalRequest {
  action: 'approve' | 'reject';
  reason?: string;
  adminNotes?: string;
  verificationNotes?: string;
  notifyOwner?: boolean;
  autoActivate?: boolean; // Auto-activate shop after approval
}

export interface ShopApprovalResult {
  success: boolean;
  shop: {
    id: string;
    name: string;
    previousStatus: ShopStatus;
    newStatus: ShopStatus;
    previousVerificationStatus: ShopVerificationStatus;
    newVerificationStatus: ShopVerificationStatus;
    updatedAt: string;
  };
  action: {
    type: 'approval' | 'rejection';
    reason?: string;
    adminNotes?: string;
    verificationNotes?: string;
    performedBy: string;
    performedAt: string;
  };
}

export interface ShopBulkApprovalRequest {
  shopIds: string[];
  action: 'approve' | 'reject';
  reason?: string;
  adminNotes?: string;
  autoActivate?: boolean;
}

export interface ShopBulkApprovalResponse {
  success: boolean;
  results: Array<{
    shopId: string;
    success: boolean;
    error?: string;
  }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface ShopVerificationStatistics {
  totalShops: number;
  pendingShops: number;
  approvedShops: number;
  rejectedShops: number;
  verifiedShops: number;
  newShopsThisMonth: number;
  newShopsThisWeek: number;
  shopsByCategory: Record<ServiceCategory, number>;
  shopsByStatus: Record<ShopStatus, number>;
  shopsByVerificationStatus: Record<ShopVerificationStatus, number>;
  averageApprovalTime: number; // in days
  topCategories: Array<{
    category: ServiceCategory;
    count: number;
    percentage: number;
  }>;
  recentApprovals: Array<{
    id: string;
    shopName: string;
    action: string;
    adminName: string;
    timestamp: string;
  }>;
}

export class AdminShopApprovalService {
  private supabase = getSupabaseClient();

  /**
   * Get shops with approval and verification filtering
   */
  async getShopsForApproval(filters: ShopApprovalFilters = {}, adminId: string): Promise<ShopApprovalResponse> {
    try {
      logger.info('Admin shop approval search', { adminId, filters });

      const {
        status,
        verificationStatus,
        category,
        search,
        startDate,
        endDate,
        hasBusinessLicense,
        isFeatured,
        sortBy = 'created_at',
        sortOrder = 'desc',
        page = 1,
        limit = 20
      } = filters;

      const offset = (page - 1) * limit;

      // Build base query with owner information
      let query = this.supabase
        .from('shops')
        .select(`
          *,
          owner:users!shops_owner_id_fkey(
            id,
            name,
            email,
            phone_number,
            user_status
          )
        `, { count: 'exact' });

      // Apply status filter
      if (status) {
        query = query.eq('shop_status', status);
      }

      // Apply verification status filter
      if (verificationStatus) {
        query = query.eq('verification_status', verificationStatus);
      }

      // Apply category filter
      if (category) {
        query = query.eq('main_category', category);
      }

      // Apply search filter
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,address.ilike.%${search}%`);
      }

      // Apply date range filters
      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      // Apply business license filter
      if (hasBusinessLicense !== undefined) {
        if (hasBusinessLicense) {
          query = query.not('business_license_number', 'is', null);
        } else {
          query = query.is('business_license_number', null);
        }
      }

      // Apply featured filter
      if (isFeatured !== undefined) {
        query = query.eq('is_featured', isFeatured);
      }

      // Get total count first
      const { count, error: countError } = await query;

      if (countError) {
        throw new Error(`Failed to get shop count: ${countError.message}`);
      }

      // Apply sorting and pagination
      const { data: shops, error } = await query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get shops: ${error.message}`);
      }

      // Process and enrich shop data
      const enrichedShops = (shops || []).map(shop => {
        const now = new Date();
        const createdAt = new Date(shop.created_at);
        const daysSinceSubmission = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

        // Check if shop has complete documents
        const hasCompleteDocuments = !!(
          shop.business_license_number &&
          shop.business_license_image_url &&
          shop.name &&
          shop.address &&
          shop.main_category
        );

        // Determine if approval is urgent (pending for more than 7 days)
        const isUrgent = shop.verification_status === 'pending' && daysSinceSubmission > 7;

        return {
          id: shop.id,
          name: shop.name,
          description: shop.description,
          phoneNumber: shop.phone_number,
          email: shop.email,
          address: shop.address,
          detailedAddress: shop.detailed_address,
          postalCode: shop.postal_code,
          latitude: shop.latitude,
          longitude: shop.longitude,
          shopType: shop.shop_type,
          shopStatus: shop.shop_status,
          verificationStatus: shop.verification_status,
          businessLicenseNumber: shop.business_license_number,
          businessLicenseImageUrl: shop.business_license_image_url,
          mainCategory: shop.main_category,
          subCategories: shop.sub_categories,
          operatingHours: shop.operating_hours,
          paymentMethods: shop.payment_methods,
          kakaoChannelUrl: shop.kakao_channel_url,
          totalBookings: shop.total_bookings,
          partnershipStartedAt: shop.partnership_started_at,
          featuredUntil: shop.featured_until,
          isFeatured: shop.is_featured,
          commissionRate: shop.commission_rate,
          createdAt: shop.created_at,
          updatedAt: shop.updated_at,
          // Owner information
          owner: shop.owner ? {
            id: shop.owner.id,
            name: shop.owner.name,
            email: shop.owner.email,
            phoneNumber: shop.owner.phone_number,
            userStatus: shop.owner.user_status
          } : undefined,
          // Computed fields
          daysSinceSubmission,
          isUrgent,
          hasCompleteDocuments
        };
      });

      const totalPages = Math.ceil((count || 0) / limit);
      const hasMore = page < totalPages;

      const response: ShopApprovalResponse = {
        shops: enrichedShops,
        totalCount: count || 0,
        hasMore,
        currentPage: page,
        totalPages,
        filters
      };

      // Log admin action
      await this.logAdminAction(adminId, 'shop_approval_search', {
        filters,
        resultCount: enrichedShops.length,
        totalCount: count || 0
      });

      logger.info('Admin shop approval search completed', { 
        adminId, 
        resultCount: enrichedShops.length,
        totalCount: count || 0 
      });

      return response;
    } catch (error) {
      logger.error('Admin shop approval search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        filters
      });
      throw error;
    }
  }

  /**
   * Approve or reject a shop
   */
  async processShopApproval(
    shopId: string, 
    request: ShopApprovalRequest, 
    adminId: string
  ): Promise<ShopApprovalResult> {
    try {
      logger.info('Admin processing shop approval', { adminId, shopId, request });

      // Get current shop
      const { data: shop, error: shopError } = await this.supabase
        .from('shops')
        .select('*')
        .eq('id', shopId)
        .single();

      if (shopError || !shop) {
        throw new Error('Shop not found');
      }

      const previousStatus = shop.shop_status;
      const previousVerificationStatus = shop.verification_status;

      // Determine new statuses based on action
      let newStatus: ShopStatus;
      let newVerificationStatus: ShopVerificationStatus;

      if (request.action === 'approve') {
        newVerificationStatus = 'verified';
        newStatus = request.autoActivate ? 'active' : 'inactive';
      } else {
        newVerificationStatus = 'rejected';
        newStatus = 'inactive';
      }

      // Update shop status
      const updateData: any = {
        verification_status: newVerificationStatus,
        updated_at: new Date().toISOString()
      };

      // Only update shop status if it's changing
      if (newStatus !== previousStatus) {
        updateData.shop_status = newStatus;
      }

      // If approving and auto-activating, set partnership start date
      if (request.action === 'approve' && request.autoActivate) {
        updateData.partnership_started_at = new Date().toISOString();
      }

      const { error: updateError } = await this.supabase
        .from('shops')
        .update(updateData)
        .eq('id', shopId);

      if (updateError) {
        throw new Error(`Failed to update shop: ${updateError.message}`);
      }

      // Create verification history record
      await this.supabase
        .from('shop_verification_history')
        .insert({
          shop_id: shopId,
          previous_verification_status: previousVerificationStatus,
          new_verification_status: newVerificationStatus,
          previous_shop_status: previousStatus,
          new_shop_status: newStatus,
          action: request.action,
          reason: request.reason,
          admin_notes: request.adminNotes,
          verification_notes: request.verificationNotes,
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString()
        });

      // Log admin action
      await this.logAdminAction(adminId, `shop_${request.action}`, {
        shopId,
        shopName: shop.name,
        previousStatus,
        newStatus,
        previousVerificationStatus,
        newVerificationStatus,
        reason: request.reason,
        adminNotes: request.adminNotes,
        autoActivate: request.autoActivate
      });

      // Send notification to shop owner if requested
      if (request.notifyOwner && shop.owner_id) {
        await this.sendApprovalNotification(shop.owner_id, request.action, request.reason);
      }

      const result: ShopApprovalResult = {
        success: true,
        shop: {
          id: shop.id,
          name: shop.name,
          previousStatus,
          newStatus,
          previousVerificationStatus,
          newVerificationStatus,
          updatedAt: new Date().toISOString()
        },
        action: {
          type: request.action === 'approve' ? 'approval' : 'rejection',
          reason: request.reason,
          adminNotes: request.adminNotes,
          verificationNotes: request.verificationNotes,
          performedBy: adminId,
          performedAt: new Date().toISOString()
        }
      };

      logger.info('Shop approval processed successfully', { 
        adminId, 
        shopId, 
        action: request.action,
        previousStatus,
        newStatus 
      });

      return result;
    } catch (error) {
      logger.error('Shop approval processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        shopId,
        request
      });
      throw error;
    }
  }

  /**
   * Perform bulk approval/rejection actions
   */
  async performBulkApproval(
    request: ShopBulkApprovalRequest, 
    adminId: string
  ): Promise<ShopBulkApprovalResponse> {
    try {
      logger.info('Admin performing bulk shop approval', { adminId, action: request.action, shopCount: request.shopIds.length });

      const results: Array<{ shopId: string; success: boolean; error?: string }> = [];
      let successful = 0;
      let failed = 0;

      for (const shopId of request.shopIds) {
        try {
          await this.processShopApproval(shopId, {
            action: request.action,
            reason: request.reason,
            adminNotes: request.adminNotes,
            autoActivate: request.autoActivate,
            notifyOwner: false // Don't notify during bulk operations
          }, adminId);

          results.push({ shopId, success: true });
          successful++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({ shopId, success: false, error: errorMessage });
          failed++;
        }
      }

      // Log bulk action
      await this.logAdminAction(adminId, 'shop_bulk_approval', {
        action: request.action,
        shopIds: request.shopIds,
        reason: request.reason,
        results: { successful, failed }
      });

      const response: ShopBulkApprovalResponse = {
        success: true,
        results,
        summary: {
          total: request.shopIds.length,
          successful,
          failed
        }
      };

      logger.info('Bulk shop approval completed', { 
        adminId, 
        action: request.action,
        successful,
        failed 
      });

      return response;
    } catch (error) {
      logger.error('Bulk shop approval failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        request
      });
      throw error;
    }
  }

  /**
   * Get shop verification statistics
   */
  async getShopVerificationStatistics(adminId: string): Promise<ShopVerificationStatistics> {
    try {
      logger.info('Getting shop verification statistics', { adminId });

      // Get basic counts
      const { count: totalShops } = await this.supabase
        .from('shops')
        .select('*', { count: 'exact' });

      const { count: pendingShops } = await this.supabase
        .from('shops')
        .select('*', { count: 'exact' })
        .eq('verification_status', 'pending');

      const { count: approvedShops } = await this.supabase
        .from('shops')
        .select('*', { count: 'exact' })
        .eq('verification_status', 'verified');

      const { count: rejectedShops } = await this.supabase
        .from('shops')
        .select('*', { count: 'exact' })
        .eq('verification_status', 'rejected');

      const { count: verifiedShops } = await this.supabase
        .from('shops')
        .select('*', { count: 'exact' })
        .eq('shop_status', 'active')
        .eq('verification_status', 'verified');

      // Get new shops this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: newShopsThisMonth } = await this.supabase
        .from('shops')
        .select('*', { count: 'exact' })
        .gte('created_at', startOfMonth.toISOString());

      // Get new shops this week
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - 7);

      const { count: newShopsThisWeek } = await this.supabase
        .from('shops')
        .select('*', { count: 'exact' })
        .gte('created_at', startOfWeek.toISOString());

      // Get shops by category
      const { data: categoryStats } = await this.supabase
        .from('shops')
        .select('main_category');

      const shopsByCategory = (categoryStats || []).reduce((acc, shop) => {
        acc[shop.main_category] = (acc[shop.main_category] || 0) + 1;
        return acc;
      }, {} as Record<ServiceCategory, number>);

      // Get shops by status
      const { data: statusStats } = await this.supabase
        .from('shops')
        .select('shop_status');

      const shopsByStatus = (statusStats || []).reduce((acc, shop) => {
        acc[shop.shop_status] = (acc[shop.shop_status] || 0) + 1;
        return acc;
      }, {} as Record<ShopStatus, number>);

      // Get shops by verification status
      const { data: verificationStats } = await this.supabase
        .from('shops')
        .select('verification_status');

      const shopsByVerificationStatus = (verificationStats || []).reduce((acc, shop) => {
        acc[shop.verification_status] = (acc[shop.verification_status] || 0) + 1;
        return acc;
      }, {} as Record<ShopVerificationStatus, number>);

      // Calculate average approval time
      const { data: approvalTimes } = await this.supabase
        .from('shop_verification_history')
        .select('created_at, reviewed_at')
        .eq('action', 'approve')
        .not('reviewed_at', 'is', null);

      const averageApprovalTime = approvalTimes && approvalTimes.length > 0
        ? approvalTimes.reduce((sum, record) => {
            const created = new Date(record.created_at);
            const reviewed = new Date(record.reviewed_at);
            return sum + Math.floor((reviewed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
          }, 0) / approvalTimes.length
        : 0;

      // Get top categories
      const topCategories = Object.entries(shopsByCategory)
        .map(([category, count]) => ({
          category: category as ServiceCategory,
          count,
          percentage: (count / (totalShops || 1)) * 100
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Get recent approvals
      const { data: recentApprovals } = await this.supabase
        .from('shop_verification_history')
        .select(`
          id,
          action,
          reviewed_at,
          shops!shop_verification_history_shop_id_fkey(name),
          users!shop_verification_history_reviewed_by_fkey(name)
        `)
        .order('reviewed_at', { ascending: false })
        .limit(10);

      const statistics: ShopVerificationStatistics = {
        totalShops: totalShops || 0,
        pendingShops: pendingShops || 0,
        approvedShops: approvedShops || 0,
        rejectedShops: rejectedShops || 0,
        verifiedShops: verifiedShops || 0,
        newShopsThisMonth: newShopsThisMonth || 0,
        newShopsThisWeek: newShopsThisWeek || 0,
        shopsByCategory,
        shopsByStatus,
        shopsByVerificationStatus,
        averageApprovalTime,
        topCategories,
        recentApprovals: (recentApprovals || []).map(approval => ({
          id: approval.id,
          shopName: (approval as any).shops?.name || 'Unknown',
          action: approval.action,
          adminName: (approval as any).users?.name || 'Unknown',
          timestamp: approval.reviewed_at
        }))
      };

      logger.info('Shop verification statistics retrieved', { adminId });

      return statistics;
    } catch (error) {
      logger.error('Failed to get shop verification statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId
      });
      throw error;
    }
  }

  /**
   * Log admin action
   */
  private async logAdminAction(adminId: string, action: string, metadata: any): Promise<void> {
    try {
      await this.supabase
        .from('admin_actions')
        .insert({
          admin_id: adminId,
          action_type: action,
          target_type: 'shop',
          metadata,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Error logging admin action', { error, adminId, action });
    }
  }

  /**
   * Send approval notification to shop owner
   */
  private async sendApprovalNotification(ownerId: string, action: string, reason?: string): Promise<void> {
    try {
      // Determine notification template based on action
      const templateId = action === 'approve' ? 'shop_approved' : 'shop_rejected';
      
      // Prepare custom data for the notification
      const customData: Record<string, string> = {
        action: action,
        timestamp: new Date().toISOString()
      };
      
      // Add reason if provided
      if (reason) {
        customData.reason = reason;
      }
      
      // Send notification using the notification service
      const notificationResult = await notificationService.sendTemplateNotification(
        ownerId,
        templateId,
        customData
      );
      
      logger.info('Shop approval notification sent successfully', {
        ownerId,
        action,
        reason,
        notificationId: notificationResult.id,
        templateId
      });
      
    } catch (error) {
      logger.error('Error sending shop approval notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ownerId,
        action,
        reason
      });
      // Don't fail the approval process if notification fails
    }
  }
}

export const adminShopApprovalService = new AdminShopApprovalService(); 