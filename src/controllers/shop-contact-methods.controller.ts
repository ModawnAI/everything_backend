import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { shopContactMethodsService } from '../services/shop-contact-methods.service';
import { contactMethodValidationService } from '../services/contact-method-validation.service';

/**
 * Controller for managing shop contact methods
 */
export class ShopContactMethodsController {
  /**
   * Update shop contact methods
   * PUT /api/shop/contact-methods
   */
  public async updateShopContactMethods(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { contactMethods } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required to update shop contact methods'
        });
        return;
      }

      if (!contactMethods || !Array.isArray(contactMethods)) {
        res.status(400).json({
          success: false,
          error: 'INVALID_INPUT',
          message: 'Contact methods must be provided as an array'
        });
        return;
      }

      // Get shop ID from the authenticated user (assuming user owns the shop)
      // This would typically come from the shop context or user's shop association
      const shopId = (req as any).shopId || (req as any).user?.shopId;
      
      if (!shopId) {
        res.status(400).json({
          success: false,
          error: 'SHOP_NOT_FOUND',
          message: 'User is not associated with any shop'
        });
        return;
      }

      logger.info('ShopContactMethodsController.updateShopContactMethods: Updating contact methods', {
        userId,
        shopId,
        contactMethodsCount: contactMethods.length
      });

      // Validate contact methods
      contactMethodValidationService.validateMultipleContactMethods(contactMethods.map(cm => ({
        type: cm.method_type,
        value: cm.value
      })));

      // Update contact methods
      const updatedContactMethods = await shopContactMethodsService.updateShopContactMethods(
        shopId,
        contactMethods
      );

      logger.info('ShopContactMethodsController.updateShopContactMethods: Successfully updated contact methods', {
        userId,
        shopId,
        updatedCount: updatedContactMethods.length
      });

      res.status(200).json({
        success: true,
        message: 'Shop contact methods updated successfully',
        data: {
          contactMethods: updatedContactMethods
        }
      });

    } catch (error: any) {
      logger.error('ShopContactMethodsController.updateShopContactMethods: Error updating contact methods', {
        error: error.message,
        stack: error.stack,
        userId: (req as any).user?.id,
        shopId: (req as any).shopId
      });

      // Handle validation errors
      if (error.code === 'INVALID_CONTACT_METHOD_TYPE' || 
          error.code === 'INVALID_CONTACT_METHOD_VALUE' ||
          error.code === 'INVALID_CONTACT_METHODS_ARRAY' ||
          error.code === 'MULTIPLE_PRIMARY_METHODS') {
        res.status(400).json({
          success: false,
          error: error.code,
          message: error.message
        });
        return;
      }

      // Handle database errors
      if (error.code === 'DATABASE_ERROR') {
        res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: 'Failed to update shop contact methods'
        });
        return;
      }

      // Generic error
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while updating contact methods'
      });
    }
  }

  /**
   * Get shop contact methods
   * GET /api/shop/contact-methods
   */
  public async getShopContactMethods(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const shopId = (req as any).shopId || (req as any).user?.shopId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required to view shop contact methods'
        });
        return;
      }

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: 'SHOP_NOT_FOUND',
          message: 'User is not associated with any shop'
        });
        return;
      }

      logger.info('ShopContactMethodsController.getShopContactMethods: Retrieving contact methods', {
        userId,
        shopId
      });

      const contactMethods = await shopContactMethodsService.getShopContactMethods(shopId);

      res.status(200).json({
        success: true,
        message: 'Shop contact methods retrieved successfully',
        data: {
          contactMethods
        }
      });

    } catch (error: any) {
      logger.error('ShopContactMethodsController.getShopContactMethods: Error retrieving contact methods', {
        error: error.message,
        stack: error.stack,
        userId: (req as any).user?.id,
        shopId: (req as any).shopId
      });

      if (error.code === 'DATABASE_ERROR') {
        res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: 'Failed to retrieve shop contact methods'
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while retrieving contact methods'
      });
    }
  }

  /**
   * Delete a specific contact method
   * DELETE /api/shop/contact-methods/:contactMethodId
   */
  public async deleteShopContactMethod(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { contactMethodId } = req.params;
      const shopId = (req as any).shopId || (req as any).user?.shopId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Authentication required to delete shop contact methods'
        });
        return;
      }

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: 'SHOP_NOT_FOUND',
          message: 'User is not associated with any shop'
        });
        return;
      }

      if (!contactMethodId) {
        res.status(400).json({
          success: false,
          error: 'INVALID_INPUT',
          message: 'Contact method ID is required'
        });
        return;
      }

      logger.info('ShopContactMethodsController.deleteShopContactMethod: Deleting contact method', {
        userId,
        shopId,
        contactMethodId
      });

      await shopContactMethodsService.deleteShopContactMethod(shopId, contactMethodId);

      res.status(200).json({
        success: true,
        message: 'Contact method deleted successfully'
      });

    } catch (error: any) {
      logger.error('ShopContactMethodsController.deleteShopContactMethod: Error deleting contact method', {
        error: error.message,
        stack: error.stack,
        userId: (req as any).user?.id,
        shopId: (req as any).shopId,
        contactMethodId: req.params.contactMethodId
      });

      if (error.code === 'DATABASE_ERROR') {
        res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: 'Failed to delete contact method'
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while deleting contact method'
      });
    }
  }

  /**
   * Get public contact information for a shop
   * GET /api/shops/:shopId/contact-info
   */
  public async getPublicShopContactInfo(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: 'INVALID_INPUT',
          message: 'Shop ID is required'
        });
        return;
      }

      logger.info('ShopContactMethodsController.getPublicShopContactInfo: Retrieving public contact info', {
        shopId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      const contactMethods = await shopContactMethodsService.getPublicShopContactInfo(shopId);

      // Set cache headers for public contact info
      res.set({
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'ETag': `"shop-${shopId}-contact-info-${Date.now()}"`
      });

      res.status(200).json({
        success: true,
        message: 'Public contact information retrieved successfully',
        data: {
          shopId,
          contactMethods: contactMethods.map(cm => ({
            method_type: cm.method_type,
            value: cm.value,
            description: cm.description,
            display_order: cm.display_order
          }))
        }
      });

    } catch (error: any) {
      logger.error('ShopContactMethodsController.getPublicShopContactInfo: Error retrieving public contact info', {
        error: error.message,
        stack: error.stack,
        shopId: req.params.shopId,
        ip: req.ip
      });

      if (error.message.includes('Failed to retrieve public shop contact information')) {
        res.status(500).json({
          success: false,
          error: 'DATABASE_ERROR',
          message: 'Failed to retrieve shop contact information'
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while retrieving contact information'
      });
    }
  }
}

export const shopContactMethodsController = new ShopContactMethodsController();
