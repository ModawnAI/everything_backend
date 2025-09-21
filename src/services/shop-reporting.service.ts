import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../utils/error-handler';
import { moderationActionsService } from './moderation-actions.service';

export interface ShopReport {
  id: string;
  shop_id: string;
  reporter_id: string;
  report_type: 'inappropriate_content' | 'spam' | 'fake_listing' | 'harassment' | 'other';
  title: string;
  description: string;
  evidence_urls?: string[];
  status: 'pending' | 'under_review' | 'resolved' | 'dismissed';
  admin_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateShopReportRequest {
  report_type: 'inappropriate_content' | 'spam' | 'fake_listing' | 'harassment' | 'other';
  title: string;
  description: string;
  evidence_urls?: string[];
}

export interface ShopReportResponse {
  id: string;
  shop_id: string;
  report_type: string;
  title: string;
  description: string;
  evidence_urls?: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

class ShopReportingService {
  /**
   * Check if user has exceeded daily report limit
   */
  async checkDailyReportLimit(userId: string): Promise<boolean> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data, error } = await getSupabaseClient()
        .from('shop_reports')
        .select('id')
        .eq('reporter_id', userId)
        .gte('created_at', today.toISOString())
        .limit(6); // Check for 6 to see if limit exceeded

      if (error) {
        logger.error('Failed to check daily report limit', { error, userId });
        throw new CustomError('Failed to check report limit', 500);
      }

      return (data?.length || 0) < 5;
    } catch (error) {
      logger.error('Error checking daily report limit', { error, userId });
      throw error;
    }
  }

  /**
   * Check if shop exists and is active
   */
  async validateShopExists(shopId: string): Promise<boolean> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('shops')
        .select('id, status')
        .eq('id', shopId)
        .eq('status', 'active')
        .single();

      if (error) {
        logger.error('Failed to validate shop exists', { error, shopId });
        return false;
      }

      return !!data;
    } catch (error) {
      logger.error('Error validating shop exists', { error, shopId });
      return false;
    }
  }

  /**
   * Check if user has already reported this shop
   */
  async checkDuplicateReport(userId: string, shopId: string): Promise<boolean> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('shop_reports')
        .select('id')
        .eq('reporter_id', userId)
        .eq('shop_id', shopId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" error
        logger.error('Failed to check duplicate report', { error, userId, shopId });
        throw new CustomError('Failed to check duplicate report', 500);
      }

      return !!data;
    } catch (error) {
      logger.error('Error checking duplicate report', { error, userId, shopId });
      throw error;
    }
  }

  /**
   * Create a new shop report
   */
  async createShopReport(
    shopId: string,
    userId: string,
    reportData: CreateShopReportRequest
  ): Promise<ShopReportResponse> {
    try {
      // Validate shop exists
      const shopExists = await this.validateShopExists(shopId);
      if (!shopExists) {
        throw new CustomError('Shop not found or inactive', 404);
      }

      // Check daily report limit
      const withinLimit = await this.checkDailyReportLimit(userId);
      if (!withinLimit) {
        throw new CustomError('Daily report limit exceeded. You can submit maximum 5 reports per day.', 429);
      }

      // Check for duplicate report
      const isDuplicate = await this.checkDuplicateReport(userId, shopId);
      if (isDuplicate) {
        throw new CustomError('You have already reported this shop', 409);
      }

      // Create the report
      const { data, error } = await getSupabaseClient()
        .from('shop_reports')
        .insert({
          shop_id: shopId,
          reporter_id: userId,
          report_type: reportData.report_type,
          title: reportData.title,
          description: reportData.description,
          evidence_urls: reportData.evidence_urls || [],
          status: 'pending'
        })
        .select(`
          id,
          shop_id,
          report_type,
          title,
          description,
          evidence_urls,
          status,
          created_at,
          updated_at
        `)
        .single();

      if (error) {
        logger.error('Failed to create shop report', { error, shopId, userId });
        throw new CustomError('Failed to create report', 500);
      }

      logger.info('Shop report created successfully', {
        reportId: data.id,
        shopId,
        userId,
        reportType: reportData.report_type
      });

      // Process the report with automated moderation
      try {
        await moderationActionsService.processShopReport(data.id);
        logger.info('Shop report processed with automated moderation', { reportId: data.id });
      } catch (moderationError) {
        logger.error('Failed to process report with automated moderation', {
          error: moderationError instanceof Error ? moderationError.message : 'Unknown error',
          reportId: data.id
        });
        // Don't fail the report creation if moderation fails
      }

      return data;
    } catch (error) {
      logger.error('Error creating shop report', { error, shopId, userId });
      throw error;
    }
  }

  /**
   * Get user's reports
   */
  async getUserReports(userId: string, limit: number = 20, offset: number = 0): Promise<{
    reports: ShopReportResponse[];
    total: number;
  }> {
    try {
      // Get reports with pagination
      const { data: reports, error: reportsError } = await getSupabaseClient()
        .from('shop_reports')
        .select(`
          id,
          shop_id,
          report_type,
          title,
          description,
          evidence_urls,
          status,
          created_at,
          updated_at
        `)
        .eq('reporter_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (reportsError) {
        logger.error('Failed to fetch user reports', { error: reportsError, userId });
        throw new CustomError('Failed to fetch reports', 500);
      }

      // Get total count
      const { count, error: countError } = await getSupabaseClient()
        .from('shop_reports')
        .select('*', { count: 'exact', head: true })
        .eq('reporter_id', userId);

      if (countError) {
        logger.error('Failed to fetch user reports count', { error: countError, userId });
        throw new CustomError('Failed to fetch reports count', 500);
      }

      return {
        reports: reports || [],
        total: count || 0
      };
    } catch (error) {
      logger.error('Error fetching user reports', { error, userId });
      throw error;
    }
  }

  /**
   * Get a specific report by ID (for the reporter)
   */
  async getReportById(reportId: string, userId: string): Promise<ShopReportResponse | null> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('shop_reports')
        .select(`
          id,
          shop_id,
          report_type,
          title,
          description,
          evidence_urls,
          status,
          created_at,
          updated_at
        `)
        .eq('id', reportId)
        .eq('reporter_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Report not found or not owned by user
        }
        logger.error('Failed to fetch report', { error, reportId, userId });
        throw new CustomError('Failed to fetch report', 500);
      }

      return data;
    } catch (error) {
      logger.error('Error fetching report', { error, reportId, userId });
      throw error;
    }
  }

  /**
   * Update a report (limited fields for the reporter)
   */
  async updateReport(
    reportId: string,
    userId: string,
    updateData: Partial<Pick<CreateShopReportRequest, 'title' | 'description' | 'evidence_urls'>>
  ): Promise<ShopReportResponse> {
    try {
      // Only allow updates to pending reports
      const { data: existingReport, error: fetchError } = await getSupabaseClient()
        .from('shop_reports')
        .select('status')
        .eq('id', reportId)
        .eq('reporter_id', userId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          throw new CustomError('Report not found', 404);
        }
        logger.error('Failed to fetch report for update', { error: fetchError, reportId, userId });
        throw new CustomError('Failed to fetch report', 500);
      }

      if (existingReport.status !== 'pending') {
        throw new CustomError('Only pending reports can be updated', 400);
      }

      // Update the report
      const { data, error } = await getSupabaseClient()
        .from('shop_reports')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId)
        .eq('reporter_id', userId)
        .select(`
          id,
          shop_id,
          report_type,
          title,
          description,
          evidence_urls,
          status,
          created_at,
          updated_at
        `)
        .single();

      if (error) {
        logger.error('Failed to update report', { error, reportId, userId });
        throw new CustomError('Failed to update report', 500);
      }

      logger.info('Report updated successfully', { reportId, userId });

      return data;
    } catch (error) {
      logger.error('Error updating report', { error, reportId, userId });
      throw error;
    }
  }

  /**
   * Delete a report (only if pending)
   */
  async deleteReport(reportId: string, userId: string): Promise<void> {
    try {
      // Check if report exists and is pending
      const { data: existingReport, error: fetchError } = await getSupabaseClient()
        .from('shop_reports')
        .select('status')
        .eq('id', reportId)
        .eq('reporter_id', userId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          throw new CustomError('Report not found', 404);
        }
        logger.error('Failed to fetch report for deletion', { error: fetchError, reportId, userId });
        throw new CustomError('Failed to fetch report', 500);
      }

      if (existingReport.status !== 'pending') {
        throw new CustomError('Only pending reports can be deleted', 400);
      }

      // Delete the report
      const { error } = await getSupabaseClient()
        .from('shop_reports')
        .delete()
        .eq('id', reportId)
        .eq('reporter_id', userId);

      if (error) {
        logger.error('Failed to delete report', { error, reportId, userId });
        throw new CustomError('Failed to delete report', 500);
      }

      logger.info('Report deleted successfully', { reportId, userId });
    } catch (error) {
      logger.error('Error deleting report', { error, reportId, userId });
      throw error;
    }
  }
}

export const shopReportingService = new ShopReportingService();
