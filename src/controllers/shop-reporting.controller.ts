import { Request, Response } from 'express';
import { shopReportingService, CreateShopReportRequest } from '../services/shop-reporting.service';
import { AuthenticatedRequest } from '../types/auth.types';
import { logger } from '../utils/logger';
import { CustomError } from '../utils/error-handler';
import { responseFormatter } from '../utils/response-formatter';

class ShopReportingController {
  /**
   * Create a new shop report
   * POST /api/shops/:shopId/report
   */
  async createShopReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.sendUnauthorized('User authentication required');
        return;
      }

      if (!shopId) {
        res.sendBadRequest('Shop ID is required');
        return;
      }

      const reportData: CreateShopReportRequest = req.body;

      // Validate required fields
      if (!reportData.report_type || !reportData.title || !reportData.description) {
        res.sendBadRequest('Report type, title, and description are required');
        return;
      }

      // Validate report type
      const validReportTypes = ['inappropriate_content', 'spam', 'fake_listing', 'harassment', 'other'];
      if (!validReportTypes.includes(reportData.report_type)) {
        res.sendBadRequest('Invalid report type');
        return;
      }

      // Validate string lengths
      if (reportData.title.length > 200) {
        res.sendBadRequest('Title must be 200 characters or less');
        return;
      }

      if (reportData.description.length > 1000) {
        res.sendBadRequest('Description must be 1000 characters or less');
        return;
      }

      // Validate evidence URLs if provided
      if (reportData.evidence_urls && Array.isArray(reportData.evidence_urls)) {
        if (reportData.evidence_urls.length > 5) {
          res.sendBadRequest('Maximum 5 evidence URLs allowed');
          return;
        }

        const urlPattern = /^https?:\/\/.+/;
        const invalidUrls = reportData.evidence_urls.filter(url => 
          typeof url !== 'string' || url.length > 500 || !urlPattern.test(url)
        );

        if (invalidUrls.length > 0) {
          res.sendBadRequest('Invalid evidence URLs provided');
          return;
        }
      }

      const report = await shopReportingService.createShopReport(shopId, userId, reportData);

      res.sendSuccess({
        report
      }, 'Report submitted successfully');

      logger.info('Shop report created', {
        reportId: report.id,
        shopId,
        userId,
        reportType: reportData.report_type
      });
    } catch (error) {
      logger.error('Error creating shop report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.shopId,
        userId: req.user?.id
      });

      if (error instanceof CustomError) {
        res.sendError(error.message, error.message, error.statusCode);
      } else {
        res.sendInternalServerError('Failed to create report');
      }
    }
  }

  /**
   * Get user's reports
   * GET /api/shops/reports
   */
  async getUserReports(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.sendUnauthorized('User authentication required');
        return;
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      const result = await shopReportingService.getUserReports(userId, limit, offset);

      res.sendSuccess({
        reports: result.reports,
        pagination: {
          limit,
          offset,
          total: result.total,
          hasMore: offset + limit < result.total
        }
      });
    } catch (error) {
      logger.error('Error fetching user reports', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      if (error instanceof CustomError) {
        res.sendError(error.message, error.message, error.statusCode);
      } else {
        res.sendInternalServerError('Failed to fetch reports');
      }
    }
  }

  /**
   * Get a specific report by ID
   * GET /api/shops/reports/:reportId
   */
  async getReportById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.sendUnauthorized('User authentication required');
        return;
      }

      if (!reportId) {
        res.sendBadRequest('Report ID is required');
        return;
      }

      const report = await shopReportingService.getReportById(reportId, userId);

      if (!report) {
        res.sendNotFound('Report not found');
        return;
      }

      res.sendSuccess({ report });
    } catch (error) {
      logger.error('Error fetching report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: req.params.reportId,
        userId: req.user?.id
      });

      if (error instanceof CustomError) {
        res.sendError(error.message, error.message, error.statusCode);
      } else {
        res.sendInternalServerError('Failed to fetch report');
      }
    }
  }

  /**
   * Update a report
   * PUT /api/shops/reports/:reportId
   */
  async updateReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.sendUnauthorized('User authentication required');
        return;
      }

      if (!reportId) {
        res.sendBadRequest('Report ID is required');
        return;
      }

      const updateData = req.body;

      // Validate fields if provided
      if (updateData.title && updateData.title.length > 200) {
        res.sendBadRequest('Title must be 200 characters or less');
        return;
      }

      if (updateData.description && updateData.description.length > 1000) {
        res.sendBadRequest('Description must be 1000 characters or less');
        return;
      }

      // Validate evidence URLs if provided
      if (updateData.evidence_urls && Array.isArray(updateData.evidence_urls)) {
        if (updateData.evidence_urls.length > 5) {
          res.sendBadRequest('Maximum 5 evidence URLs allowed');
          return;
        }

        const urlPattern = /^https?:\/\/.+/;
        const invalidUrls = updateData.evidence_urls.filter((url: string) => 
          typeof url !== 'string' || url.length > 500 || !urlPattern.test(url)
        );

        if (invalidUrls.length > 0) {
          res.sendBadRequest('Invalid evidence URLs provided');
          return;
        }
      }

      const report = await shopReportingService.updateReport(reportId, userId, updateData);

      res.sendSuccess({ report }, 'Report updated successfully');

      logger.info('Shop report updated', {
        reportId,
        userId
      });
    } catch (error) {
      logger.error('Error updating report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: req.params.reportId,
        userId: req.user?.id
      });

      if (error instanceof CustomError) {
        res.sendError(error.message, error.message, error.statusCode);
      } else {
        res.sendInternalServerError('Failed to update report');
      }
    }
  }

  /**
   * Delete a report
   * DELETE /api/shops/reports/:reportId
   */
  async deleteReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.sendUnauthorized('User authentication required');
        return;
      }

      if (!reportId) {
        res.sendBadRequest('Report ID is required');
        return;
      }

      await shopReportingService.deleteReport(reportId, userId);

      res.sendSuccess(null, 'Report deleted successfully');

      logger.info('Shop report deleted', {
        reportId,
        userId
      });
    } catch (error) {
      logger.error('Error deleting report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: req.params.reportId,
        userId: req.user?.id
      });

      if (error instanceof CustomError) {
        res.sendError(error.message, error.message, error.statusCode);
      } else {
        res.sendInternalServerError('Failed to delete report');
      }
    }
  }
}

export const shopReportingController = new ShopReportingController();
