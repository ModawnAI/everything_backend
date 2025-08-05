import { Request, Response } from 'express';
import { adminShopApprovalService } from '../services/admin-shop-approval.service';
import { adminAuthService } from '../services/admin-auth.service';
import { logger } from '../utils/logger';
import { ShopStatus, ShopVerificationStatus, ServiceCategory } from '../types/database.types';

// Create validation arrays for type checking
const VALID_SHOP_STATUSES: ShopStatus[] = ['active', 'inactive', 'pending_approval', 'suspended', 'deleted'];
const VALID_VERIFICATION_STATUSES: ShopVerificationStatus[] = ['pending', 'verified', 'rejected'];
const VALID_SERVICE_CATEGORIES: ServiceCategory[] = ['nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair'];

export class AdminShopApprovalController {
  /**
   * GET /api/admin/shops/approval
   * Get shops for approval with filtering
   */
  async getShopsForApproval(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Authorization token is required'
        });
        return;
      }

      // Validate admin session
      const validation = await adminAuthService.validateAdminSession(token, ipAddress);
      if (!validation.isValid || !validation.admin) {
        res.status(401).json({
          success: false,
          error: validation.error || 'Invalid admin session'
        });
        return;
      }

      // Extract and validate query parameters
      const {
        status,
        verificationStatus,
        category,
        search,
        startDate,
        endDate,
        hasBusinessLicense,
        isFeatured,
        sortBy,
        sortOrder,
        page = '1',
        limit = '20'
      } = req.query;

      // Validate status if provided
      if (status && !VALID_SHOP_STATUSES.includes(status as ShopStatus)) {
        res.status(400).json({
          success: false,
          error: 'Invalid shop status'
        });
        return;
      }

      // Validate verification status if provided
      if (verificationStatus && !VALID_VERIFICATION_STATUSES.includes(verificationStatus as ShopVerificationStatus)) {
        res.status(400).json({
          success: false,
          error: 'Invalid verification status'
        });
        return;
      }

      // Validate category if provided
      if (category && !VALID_SERVICE_CATEGORIES.includes(category as ServiceCategory)) {
        res.status(400).json({
          success: false,
          error: 'Invalid service category'
        });
        return;
      }

      // Validate sort order
      if (sortOrder && !['asc', 'desc'].includes(sortOrder as string)) {
        res.status(400).json({
          success: false,
          error: 'Invalid sort order. Must be "asc" or "desc"'
        });
        return;
      }

      const filters = {
        status: status as ShopStatus,
        verificationStatus: verificationStatus as ShopVerificationStatus,
        category: category as ServiceCategory,
        search: search as string,
        startDate: startDate as string,
        endDate: endDate as string,
        hasBusinessLicense: hasBusinessLicense === 'true' ? true : hasBusinessLicense === 'false' ? false : undefined,
        isFeatured: isFeatured === 'true' ? true : isFeatured === 'false' ? false : undefined,
        sortBy: sortBy as any,
        sortOrder: sortOrder as 'asc' | 'desc',
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10)
      };

      const result = await adminShopApprovalService.getShopsForApproval(filters, validation.admin.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Admin get shops for approval failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get shops for approval'
      });
    }
  }

  /**
   * PUT /api/admin/shops/:id/approval
   * Approve or reject a shop
   */
  async processShopApproval(req: Request, res: Response): Promise<void> {
    try {
      const { id: shopId } = req.params;
      const { action, reason, adminNotes, verificationNotes, notifyOwner, autoActivate } = req.body;
      const token = req.headers.authorization?.replace('Bearer ', '');
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Authorization token is required'
        });
        return;
      }

      // Validate admin session
      const validation = await adminAuthService.validateAdminSession(token, ipAddress);
      if (!validation.isValid || !validation.admin) {
        res.status(401).json({
          success: false,
          error: validation.error || 'Invalid admin session'
        });
        return;
      }

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: 'Shop ID is required'
        });
        return;
      }

      if (!action || !['approve', 'reject'].includes(action)) {
        res.status(400).json({
          success: false,
          error: 'Valid action is required (approve or reject)'
        });
        return;
      }

      const request = {
        action,
        reason,
        adminNotes,
        verificationNotes,
        notifyOwner: notifyOwner === true,
        autoActivate: autoActivate === true
      };

      const result = await adminShopApprovalService.processShopApproval(shopId, request, validation.admin.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Admin shop approval failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.id,
        ipAddress: req.ip
      });

      const errorMessage = error instanceof Error ? error.message : 'Failed to process shop approval';
      
      res.status(500).json({
        success: false,
        error: errorMessage.includes('Shop not found') ? 'Shop not found' : 'Failed to process shop approval'
      });
    }
  }

  /**
   * POST /api/admin/shops/bulk-approval
   * Perform bulk approval/rejection actions
   */
  async performBulkApproval(req: Request, res: Response): Promise<void> {
    try {
      const { shopIds, action, reason, adminNotes, autoActivate } = req.body;
      const token = req.headers.authorization?.replace('Bearer ', '');
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Authorization token is required'
        });
        return;
      }

      // Validate admin session
      const validation = await adminAuthService.validateAdminSession(token, ipAddress);
      if (!validation.isValid || !validation.admin) {
        res.status(401).json({
          success: false,
          error: validation.error || 'Invalid admin session'
        });
        return;
      }

      if (!shopIds || !Array.isArray(shopIds) || shopIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Shop IDs array is required'
        });
        return;
      }

      if (!action || !['approve', 'reject'].includes(action)) {
        res.status(400).json({
          success: false,
          error: 'Valid action is required (approve or reject)'
        });
        return;
      }

      const request = {
        shopIds,
        action,
        reason,
        adminNotes,
        autoActivate: autoActivate === true
      };

      const result = await adminShopApprovalService.performBulkApproval(request, validation.admin.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Admin bulk shop approval failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to perform bulk shop approval'
      });
    }
  }

  /**
   * GET /api/admin/shops/approval/statistics
   * Get shop verification statistics
   */
  async getShopVerificationStatistics(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Authorization token is required'
        });
        return;
      }

      // Validate admin session
      const validation = await adminAuthService.validateAdminSession(token, ipAddress);
      if (!validation.isValid || !validation.admin) {
        res.status(401).json({
          success: false,
          error: validation.error || 'Invalid admin session'
        });
        return;
      }

      const statistics = await adminShopApprovalService.getShopVerificationStatistics(validation.admin.id);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      logger.error('Admin get shop verification statistics failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get shop verification statistics'
      });
    }
  }

  /**
   * GET /api/admin/shops/:id/approval/details
   * Get detailed shop approval information
   */
  async getShopApprovalDetails(req: Request, res: Response): Promise<void> {
    try {
      const { id: shopId } = req.params;
      const token = req.headers.authorization?.replace('Bearer ', '');
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Authorization token is required'
        });
        return;
      }

      // Validate admin session
      const validation = await adminAuthService.validateAdminSession(token, ipAddress);
      if (!validation.isValid || !validation.admin) {
        res.status(401).json({
          success: false,
          error: validation.error || 'Invalid admin session'
        });
        return;
      }

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: 'Shop ID is required'
        });
        return;
      }

      // Get shop with detailed information
      const { data: shop, error } = await adminShopApprovalService['supabase']
        .from('shops')
        .select(`
          *,
          owner:users!shops_owner_id_fkey(
            id,
            name,
            email,
            phone_number,
            user_status,
            created_at
          ),
          verification_history:shop_verification_history(
            id,
            action,
            reason,
            admin_notes,
            verification_notes,
            reviewed_by,
            reviewed_at,
            created_at
          ),
          shop_services:shop_services(
            id,
            name,
            category,
            price_min,
            price_max,
            is_available
          ),
          shop_images:shop_images(
            id,
            image_url,
            alt_text,
            is_primary,
            display_order
          )
        `)
        .eq('id', shopId)
        .single();

      if (error || !shop) {
        res.status(404).json({
          success: false,
          error: 'Shop not found'
        });
        return;
      }

      // Get admin information for verification history
      const adminIds = shop.verification_history?.map((h: any) => h.reviewed_by).filter(Boolean) || [];
      let adminInfo: any = {};
      
      if (adminIds.length > 0) {
        const { data: admins } = await adminShopApprovalService['supabase']
          .from('users')
          .select('id, name, email')
          .in('id', adminIds);
        
        adminInfo = (admins || []).reduce((acc: any, admin: any) => {
          acc[admin.id] = admin;
          return acc;
        }, {});
      }

      // Calculate document completeness
      const requiredDocuments = [
        'business_license_number',
        'business_license_image_url',
        'name',
        'address',
        'main_category',
        'phone_number'
      ];

      const completedDocuments = requiredDocuments.filter(doc => shop[doc]);
      const documentCompleteness = (completedDocuments.length / requiredDocuments.length) * 100;

      // Enrich verification history with admin names
      const enrichedHistory = (shop.verification_history || []).map((history: any) => ({
        id: history.id,
        action: history.action,
        reason: history.reason,
        adminNotes: history.admin_notes,
        verificationNotes: history.verification_notes,
        reviewedBy: history.reviewed_by,
        adminName: adminInfo[history.reviewed_by]?.name || 'Unknown',
        adminEmail: adminInfo[history.reviewed_by]?.email,
        reviewedAt: history.reviewed_at,
        createdAt: history.created_at
      }));

      const shopDetails = {
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
          userStatus: shop.owner.user_status,
          joinedAt: shop.owner.created_at
        } : undefined,
        // Services
        services: (shop.shop_services || []).map((service: any) => ({
          id: service.id,
          name: service.name,
          category: service.category,
          priceMin: service.price_min,
          priceMax: service.price_max,
          isAvailable: service.is_available
        })),
        // Images
        images: (shop.shop_images || []).map((image: any) => ({
          id: image.id,
          imageUrl: image.image_url,
          altText: image.alt_text,
          isPrimary: image.is_primary,
          displayOrder: image.display_order
        })),
        // Verification history
        verificationHistory: enrichedHistory,
        // Approval analysis
        approvalAnalysis: {
          documentCompleteness,
          completedDocuments,
          missingDocuments: requiredDocuments.filter(doc => !shop[doc]),
          daysSinceSubmission: Math.floor((new Date().getTime() - new Date(shop.created_at).getTime()) / (1000 * 60 * 60 * 24)),
          isUrgent: shop.verification_status === 'pending' && 
                   Math.floor((new Date().getTime() - new Date(shop.created_at).getTime()) / (1000 * 60 * 60 * 24)) > 7,
          hasCompleteDocuments: documentCompleteness >= 80,
          recommendation: this.generateApprovalRecommendation(shop, documentCompleteness)
        }
      };

      res.json({
        success: true,
        data: shopDetails
      });
    } catch (error) {
      logger.error('Admin get shop approval details failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.id,
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get shop approval details'
      });
    }
  }

  /**
   * Generate approval recommendation based on shop data
   */
  private generateApprovalRecommendation(shop: any, documentCompleteness: number): string {
    if (shop.verification_status === 'verified') {
      return 'Shop is already verified';
    }

    if (shop.verification_status === 'rejected') {
      return 'Shop was previously rejected';
    }

    if (documentCompleteness < 60) {
      return 'Reject - Insufficient documentation';
    }

    if (documentCompleteness < 80) {
      return 'Request additional documents';
    }

    if (!shop.business_license_number || !shop.business_license_image_url) {
      return 'Request business license documentation';
    }

    if (!shop.phone_number || !shop.email) {
      return 'Request contact information';
    }

    return 'Approve - All requirements met';
  }
}

export const adminShopApprovalController = new AdminShopApprovalController(); 