import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';
import { moderationActionsService } from '../services/moderation-actions.service';
import { moderationRulesService } from '../services/moderation-rules.service';
import { contentModerationService } from '../services/content-moderation.service';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

class AdminModerationController {
  /**
   * Get all shop reports with filtering and pagination
   * GET /api/admin/shop-reports
   */
  async getShopReports(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { message: 'Admin authentication required' }
        });
        return;
      }

      // Extract query parameters
      const {
        status,
        report_type,
        shop_id,
        reporter_id,
        limit = '20',
        offset = '0',
        sort_by = 'created_at',
        sort_order = 'desc',
        search
      } = req.query;

      const limitNum = Math.min(parseInt(limit as string) || 20, 100);
      const offsetNum = Math.max(parseInt(offset as string) || 0, 0);

      // Build query
      let query = getSupabaseClient()
        .from('shop_reports')
        .select(`
          *,
          shops!inner(
            id, name, description, status, owner_id, created_at
          ),
          users!shop_reports_reporter_id_fkey(
            id, email, username, created_at
          )
        `);

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (report_type) {
        query = query.eq('report_type', report_type);
      }

      if (shop_id) {
        query = query.eq('shop_id', shop_id);
      }

      if (reporter_id) {
        query = query.eq('reporter_id', reporter_id);
      }

      // Apply search
      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      // Apply sorting
      const sortField = sort_by as string;
      const sortDirection = sort_order === 'asc' ? { ascending: true } : { ascending: false };
      query = query.order(sortField, sortDirection);

      // Apply pagination
      query = query.range(offsetNum, offsetNum + limitNum - 1);

      const { data: reports, error: reportsError } = await query;

      if (reportsError) {
        logger.error('Failed to fetch shop reports', { error: reportsError, userId });
        res.status(500).json({
          success: false,
          error: { message: 'Failed to fetch shop reports' }
        });
        return;
      }

      // Get total count for pagination
      let countQuery = getSupabaseClient()
        .from('shop_reports')
        .select('*', { count: 'exact', head: true });

      // Apply same filters for count
      if (status) countQuery = countQuery.eq('status', status);
      if (report_type) countQuery = countQuery.eq('report_type', report_type);
      if (shop_id) countQuery = countQuery.eq('shop_id', shop_id);
      if (reporter_id) countQuery = countQuery.eq('reporter_id', reporter_id);
      if (search) countQuery = countQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

      const { count, error: countError } = await countQuery;

      if (countError) {
        logger.error('Failed to fetch shop reports count', { error: countError, userId });
        res.status(500).json({
          success: false,
          error: { message: 'Failed to fetch shop reports count' }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          reports: reports || [],
          pagination: {
            limit: limitNum,
            offset: offsetNum,
            total: count || 0,
            hasMore: offsetNum + limitNum < (count || 0)
          },
          filters: {
            status,
            report_type,
            shop_id,
            reporter_id,
            search
          }
        }
      });

      logger.info('Admin fetched shop reports', {
        userId,
        reportCount: reports?.length || 0,
        totalCount: count || 0,
        filters: { status, report_type, shop_id, reporter_id, search }
      });
    } catch (error) {
      logger.error('Error fetching shop reports', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch shop reports' }
      });
    }
  }

  /**
   * Get a specific shop report by ID
   * GET /api/admin/shop-reports/:reportId
   */
  async getShopReportById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { reportId } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { message: 'Admin authentication required' }
        });
        return;
      }

      if (!reportId) {
        res.status(400).json({
          success: false,
          error: { message: 'Report ID is required' }
        });
        return;
      }

      const { data: report, error } = await getSupabaseClient()
        .from('shop_reports')
        .select(`
          *,
          shops!inner(
            id, name, description, status, owner_id, created_at, updated_at
          ),
          users!shop_reports_reporter_id_fkey(
            id, email, username, created_at
          )
        `)
        .eq('id', reportId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          res.status(404).json({
            success: false,
            error: { message: 'Report not found' }
          });
          return;
        }
        logger.error('Failed to fetch shop report', { error, reportId, userId });
        res.status(500).json({
          success: false,
          error: { message: 'Failed to fetch shop report' }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { report }
      });

      logger.info('Admin fetched shop report', { userId, reportId });
    } catch (error) {
      logger.error('Error fetching shop report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: req.params.reportId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch shop report' }
      });
    }
  }

  /**
   * Update shop report status and resolution
   * PUT /api/admin/shop-reports/:reportId
   */
  async updateShopReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { reportId } = req.params;
      const { status, admin_notes, action_type, reason } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { message: 'Admin authentication required' }
        });
        return;
      }

      if (!reportId) {
        res.status(400).json({
          success: false,
          error: { message: 'Report ID is required' }
        });
        return;
      }

      // Validate status
      const validStatuses = ['pending', 'under_review', 'resolved', 'dismissed'];
      if (status && !validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid status value' }
        });
        return;
      }

      // Validate action_type if provided
      const validActionTypes = ['block', 'flag', 'warn', 'approve', 'reject', 'dismiss'];
      if (action_type && !validActionTypes.includes(action_type)) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid action type' }
        });
        return;
      }

      // Get the report first
      const { data: existingReport, error: fetchError } = await getSupabaseClient()
        .from('shop_reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          res.status(404).json({
            success: false,
            error: { message: 'Report not found' }
          });
          return;
        }
        logger.error('Failed to fetch report for update', { error: fetchError, reportId, userId });
        res.status(500).json({
          success: false,
          error: { message: 'Failed to fetch report' }
        });
        return;
      }

      // Update the report
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (status) updateData.status = status;
      if (admin_notes !== undefined) updateData.admin_notes = admin_notes;

      const { data: updatedReport, error: updateError } = await getSupabaseClient()
        .from('shop_reports')
        .update(updateData)
        .eq('id', reportId)
        .select()
        .single();

      if (updateError) {
        logger.error('Failed to update shop report', { error: updateError, reportId, userId });
        res.status(500).json({
          success: false,
          error: { message: 'Failed to update shop report' }
        });
        return;
      }

      // Execute moderation action if provided
      if (action_type && reason) {
        try {
          const moderationAction = await moderationActionsService.createModerationAction(
            existingReport.shop_id,
            {
              action_type: action_type as any,
              reason,
              details: `Admin action taken on report ${reportId}: ${reason}`,
              moderator_id: userId
            },
            reportId
          );

          await moderationActionsService.executeModerationAction(moderationAction);
        } catch (moderationError) {
          logger.error('Failed to execute moderation action', {
            error: moderationError instanceof Error ? moderationError.message : 'Unknown error',
            reportId,
            userId,
            actionType: action_type
          });
          // Don't fail the report update if moderation action fails
        }
      }

      res.status(200).json({
        success: true,
        data: { report: updatedReport },
        message: 'Report updated successfully'
      });

      logger.info('Admin updated shop report', {
        userId,
        reportId,
        status,
        actionType: action_type,
        reason
      });
    } catch (error) {
      logger.error('Error updating shop report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: req.params.reportId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: { message: 'Failed to update shop report' }
      });
    }
  }

  /**
   * Get moderation history for a specific shop
   * GET /api/admin/shops/:shopId/moderation-history
   */
  async getShopModerationHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { shopId } = req.params;
      const { limit = '20', offset = '0' } = req.query;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { message: 'Admin authentication required' }
        });
        return;
      }

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: { message: 'Shop ID is required' }
        });
        return;
      }

      const limitNum = Math.min(parseInt(limit as string) || 20, 100);
      const offsetNum = Math.max(parseInt(offset as string) || 0, 0);

      // Get moderation actions
      const moderationHistory = await moderationActionsService.getShopModerationActions(
        shopId,
        limitNum,
        offsetNum
      );

      // Get shop reports
      const { data: reports, error: reportsError } = await getSupabaseClient()
        .from('shop_reports')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .range(offsetNum, offsetNum + limitNum - 1);

      if (reportsError) {
        logger.error('Failed to fetch shop reports for moderation history', {
          error: reportsError,
          shopId,
          userId
        });
        res.status(500).json({
          success: false,
          error: { message: 'Failed to fetch shop reports' }
        });
        return;
      }

      // Get shop moderation status
      const moderationStatus = await moderationActionsService.getShopModerationStatus(shopId);

      if (!moderationStatus) {
        res.status(404).json({
          success: false,
          error: { message: 'Shop not found' }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          shop_id: shopId,
          moderation_status: moderationStatus,
          moderation_actions: moderationHistory.actions,
          reports: reports || [],
          pagination: {
            limit: limitNum,
            offset: offsetNum,
            total: moderationHistory.total + (reports?.length || 0)
          }
        }
      });

      logger.info('Admin fetched shop moderation history', {
        userId,
        shopId,
        actionCount: moderationHistory.actions.length,
        reportCount: reports?.length || 0
      });
    } catch (error) {
      logger.error('Error fetching shop moderation history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.shopId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch shop moderation history' }
      });
    }
  }

  /**
   * Execute bulk actions on multiple reports
   * POST /api/admin/shop-reports/bulk-action
   */
  async executeBulkAction(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { report_ids, action_type, reason } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { message: 'Admin authentication required' }
        });
        return;
      }

      if (!report_ids || !Array.isArray(report_ids) || report_ids.length === 0) {
        res.status(400).json({
          success: false,
          error: { message: 'Report IDs array is required' }
        });
        return;
      }

      if (!action_type || !reason) {
        res.status(400).json({
          success: false,
          error: { message: 'Action type and reason are required' }
        });
        return;
      }

      // Validate action_type
      const validActionTypes = ['block', 'flag', 'warn', 'approve', 'reject', 'dismiss'];
      if (!validActionTypes.includes(action_type)) {
        res.status(400).json({
          success: false,
          error: { message: 'Invalid action type' }
        });
        return;
      }

      const results = {
        successful: [],
        failed: [],
        total: report_ids.length
      };

      // Process each report
      for (const reportId of report_ids) {
        try {
          // Get the report
          const { data: report, error: fetchError } = await getSupabaseClient()
            .from('shop_reports')
            .select('*')
            .eq('id', reportId)
            .single();

          if (fetchError) {
            results.failed.push({ report_id: reportId, error: 'Report not found' });
            continue;
          }

          // Create moderation action
          const moderationAction = await moderationActionsService.createModerationAction(
            report.shop_id,
            {
              action_type: action_type as any,
              reason,
              details: `Bulk admin action taken on report ${reportId}: ${reason}`,
              moderator_id: userId
            },
            reportId
          );

          // Execute the action
          await moderationActionsService.executeModerationAction(moderationAction);

          // Update report status
          let newStatus = 'resolved';
          if (action_type === 'dismiss') {
            newStatus = 'dismissed';
          } else if (action_type === 'approve') {
            newStatus = 'resolved';
          }

          await getSupabaseClient()
            .from('shop_reports')
            .update({
              status: newStatus,
              admin_notes: reason,
              updated_at: new Date().toISOString()
            })
            .eq('id', reportId);

          results.successful.push({ report_id: reportId, action_id: moderationAction.id });
        } catch (error) {
          logger.error('Failed to process report in bulk action', {
            error: error instanceof Error ? error.message : 'Unknown error',
            reportId,
            userId,
            actionType: action_type
          });
          results.failed.push({
            report_id: reportId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      res.status(200).json({
        success: true,
        data: {
          results,
          summary: {
            total: results.total,
            successful: results.successful.length,
            failed: results.failed.length,
            success_rate: ((results.successful.length / results.total) * 100).toFixed(1) + '%'
          }
        },
        message: 'Bulk action completed'
      });

      logger.info('Admin executed bulk action on shop reports', {
        userId,
        actionType: action_type,
        totalReports: report_ids.length,
        successful: results.successful.length,
        failed: results.failed.length
      });
    } catch (error) {
      logger.error('Error executing bulk action', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: { message: 'Failed to execute bulk action' }
      });
    }
  }

  /**
   * Get moderation statistics and analytics
   * GET /api/admin/moderation/stats
   */
  async getModerationStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { message: 'Admin authentication required' }
        });
        return;
      }

      const { date_from, date_to } = req.query;

      // Build date filter
      let dateFilter = '';
      if (date_from || date_to) {
        if (date_from && date_to) {
          dateFilter = `created_at.gte.${date_from},created_at.lte.${date_to}`;
        } else if (date_from) {
          dateFilter = `created_at.gte.${date_from}`;
        } else if (date_to) {
          dateFilter = `created_at.lte.${date_to}`;
        }
      }

      // Get report statistics
      let reportQuery = getSupabaseClient()
        .from('shop_reports')
        .select('*', { count: 'exact' });

      if (dateFilter) {
        const [field, operator, value] = dateFilter.split('.');
        if (operator === 'gte') {
          reportQuery = reportQuery.gte(field, value);
        } else if (operator === 'lte') {
          reportQuery = reportQuery.lte(field, value);
        }
      }

      const { data: reports, count: totalReports } = await reportQuery;

      // Get status breakdown
      const statusBreakdown = {
        pending: 0,
        under_review: 0,
        resolved: 0,
        dismissed: 0
      };

      reports?.forEach(report => {
        statusBreakdown[report.status as keyof typeof statusBreakdown]++;
      });

      // Get type breakdown
      const typeBreakdown = {
        inappropriate_content: 0,
        spam: 0,
        fake_listing: 0,
        harassment: 0,
        other: 0
      };

      reports?.forEach(report => {
        typeBreakdown[report.report_type as keyof typeof typeBreakdown]++;
      });

      // Get moderation action statistics
      let actionQuery = getSupabaseClient()
        .from('moderation_actions')
        .select('*', { count: 'exact' });

      if (dateFilter) {
        const [field, operator, value] = dateFilter.split('.');
        if (operator === 'gte') {
          actionQuery = actionQuery.gte(field, value);
        } else if (operator === 'lte') {
          actionQuery = actionQuery.lte(field, value);
        }
      }

      const { data: actions, count: totalActions } = await actionQuery;

      // Get action type breakdown
      const actionBreakdown = {
        auto_block: 0,
        auto_flag: 0,
        manual_review: 0,
        approve: 0,
        reject: 0,
        warning: 0
      };

      actions?.forEach(action => {
        actionBreakdown[action.action_type as keyof typeof actionBreakdown]++;
      });

      res.status(200).json({
        success: true,
        data: {
          reports: {
            total: totalReports || 0,
            status_breakdown: statusBreakdown,
            type_breakdown: typeBreakdown
          },
          actions: {
            total: totalActions || 0,
            type_breakdown: actionBreakdown
          },
          date_range: {
            from: date_from,
            to: date_to
          }
        }
      });

      logger.info('Admin fetched moderation statistics', {
        userId,
        totalReports: totalReports || 0,
        totalActions: totalActions || 0,
        dateRange: { from: date_from, to: date_to }
      });
    } catch (error) {
      logger.error('Error fetching moderation statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: { message: 'Failed to fetch moderation statistics' }
      });
    }
  }

  /**
   * Analyze shop content for moderation
   * POST /api/admin/shops/:shopId/analyze-content
   */
  async analyzeShopContent(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { shopId } = req.params;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: { message: 'Admin authentication required' }
        });
        return;
      }

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: { message: 'Shop ID is required' }
        });
        return;
      }

      // Get shop content
      const { data: shop, error: shopError } = await getSupabaseClient()
        .from('shops')
        .select('name, description, profile_content')
        .eq('id', shopId)
        .single();

      if (shopError) {
        if (shopError.code === 'PGRST116') {
          res.status(404).json({
            success: false,
            error: { message: 'Shop not found' }
          });
          return;
        }
        logger.error('Failed to fetch shop for content analysis', { error: shopError, shopId, userId });
        res.status(500).json({
          success: false,
          error: { message: 'Failed to fetch shop content' }
        });
        return;
      }

      // Analyze content
      const analysisResult = await contentModerationService.analyzeShopContent({
        name: shop.name,
        description: shop.description,
        profile_content: shop.profile_content
      });

      res.status(200).json({
        success: true,
        data: {
          shop_id: shopId,
          analysis: analysisResult
        }
      });

      logger.info('Admin analyzed shop content', {
        userId,
        shopId,
        overallScore: analysisResult.overallResult.score,
        severity: analysisResult.overallResult.severity
      });
    } catch (error) {
      logger.error('Error analyzing shop content', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.shopId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: { message: 'Failed to analyze shop content' }
      });
    }
  }
}

export const adminModerationController = new AdminModerationController();