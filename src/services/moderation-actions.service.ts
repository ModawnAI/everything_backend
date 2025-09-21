import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { CustomError } from '../utils/error-handler';
import { contentModerationService, ContentAnalysisResult } from './content-moderation.service';
import { shopModerationIntegrationService } from './shop-moderation-integration.service';

export interface ModerationAction {
  id: string;
  shop_id: string;
  report_id?: string;
  action_type: 'auto_block' | 'auto_flag' | 'manual_review' | 'approve' | 'reject' | 'warning';
  reason: string;
  details: string;
  moderator_id?: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface ModerationActionRequest {
  action_type: 'auto_block' | 'auto_flag' | 'manual_review' | 'approve' | 'reject' | 'warning';
  reason: string;
  details: string;
  moderator_id?: string;
}

export interface ShopModerationStatus {
  shop_id: string;
  status: 'active' | 'flagged' | 'blocked' | 'under_review' | 'suspended';
  moderation_score: number;
  last_moderated: string;
  violation_count: number;
  warning_count: number;
}

class ModerationActionsService {
  /**
   * Create a moderation action
   */
  async createModerationAction(
    shopId: string,
    actionData: ModerationActionRequest,
    reportId?: string
  ): Promise<ModerationAction> {
    try {
      const { data, error } = await getSupabaseClient()
        .from('moderation_actions')
        .insert({
          shop_id: shopId,
          report_id: reportId,
          action_type: actionData.action_type,
          reason: actionData.reason,
          details: actionData.details,
          moderator_id: actionData.moderator_id,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create moderation action', { error, shopId, actionData });
        throw new CustomError('Failed to create moderation action', 500);
      }

      logger.info('Moderation action created', {
        actionId: data.id,
        shopId,
        actionType: actionData.action_type,
        reportId
      });

      return data;
    } catch (error) {
      logger.error('Error creating moderation action', { error, shopId, actionData });
      throw error;
    }
  }

  /**
   * Execute automated moderation based on content analysis
   */
  async executeAutomatedModeration(
    shopId: string,
    analysisResult: ContentAnalysisResult,
    reportId?: string
  ): Promise<ModerationAction | null> {
    try {
      let actionType: 'auto_block' | 'auto_flag' | 'manual_review' | null = null;
      let reason = '';
      let details = '';

      // Determine action based on analysis result
      switch (analysisResult.suggestedAction) {
        case 'block':
          actionType = 'auto_block';
          reason = 'Content violates community guidelines';
          details = `Automated block due to ${analysisResult.severity} severity content violations. Score: ${analysisResult.score}/100`;
          break;
        case 'flag':
          actionType = 'auto_flag';
          reason = 'Content flagged for review';
          details = `Automated flag due to ${analysisResult.severity} severity content violations. Score: ${analysisResult.score}/100`;
          break;
        case 'review':
          actionType = 'manual_review';
          reason = 'Content requires manual review';
          details = `Manual review recommended due to ${analysisResult.severity} severity content violations. Score: ${analysisResult.score}/100`;
          break;
        default:
          // No action needed
          return null;
      }

      if (!actionType) {
        return null;
      }

      // Create moderation action
      const action = await this.createModerationAction(shopId, {
        action_type: actionType,
        reason,
        details,
      }, reportId);

      // Execute the action
      await this.executeModerationAction(action);

      logger.info('Automated moderation executed', {
        shopId,
        actionType,
        score: analysisResult.score,
        severity: analysisResult.severity
      });

      return action;
    } catch (error) {
      logger.error('Error executing automated moderation', { error, shopId });
      throw error;
    }
  }

  /**
   * Execute a moderation action
   */
  async executeModerationAction(action: ModerationAction): Promise<void> {
    try {
      // Map action types to shop moderation integration service actions
      let integrationActionType: 'suspend' | 'activate' | 'flag' | 'block' | 'warn' | 'approve';
      
      switch (action.action_type) {
        case 'auto_block':
          integrationActionType = 'block';
          break;
        case 'auto_flag':
          integrationActionType = 'flag';
          break;
        case 'warning':
          integrationActionType = 'warn';
          break;
        case 'approve':
          integrationActionType = 'activate';
          break;
        case 'reject':
          integrationActionType = 'block';
          break;
        default:
          logger.warn('Unknown moderation action type', { actionType: action.action_type });
          return;
      }

      // Execute the moderation action through the integration service
      await shopModerationIntegrationService.executeModerationAction(action.shop_id, {
        action_type: integrationActionType,
        reason: action.reason,
        moderator_id: action.moderator_id || 'system',
        report_id: action.report_id,
        notify_owner: true,
        notify_customers: integrationActionType === 'block' || integrationActionType === 'warn'
      });

      // Update action status
      await this.updateModerationActionStatus(action.id, 'completed');
    } catch (error) {
      logger.error('Error executing moderation action', { error, actionId: action.id });
      await this.updateModerationActionStatus(action.id, 'failed');
      throw error;
    }
  }


  /**
   * Update moderation action status
   */
  async updateModerationActionStatus(actionId: string, status: 'pending' | 'completed' | 'failed'): Promise<void> {
    try {
      const { error } = await getSupabaseClient()
        .from('moderation_actions')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', actionId);

      if (error) {
        logger.error('Failed to update moderation action status', { error, actionId, status });
        throw new CustomError('Failed to update moderation action status', 500);
      }

      logger.info('Moderation action status updated', { actionId, status });
    } catch (error) {
      logger.error('Error updating moderation action status', { error, actionId });
      throw error;
    }
  }

  /**
   * Get moderation actions for a shop
   */
  async getShopModerationActions(shopId: string, limit: number = 20, offset: number = 0): Promise<{
    actions: ModerationAction[];
    total: number;
  }> {
    try {
      const { data: actions, error: actionsError } = await getSupabaseClient()
        .from('moderation_actions')
        .select('*')
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (actionsError) {
        logger.error('Failed to fetch shop moderation actions', { error: actionsError, shopId });
        throw new CustomError('Failed to fetch moderation actions', 500);
      }

      const { count, error: countError } = await getSupabaseClient()
        .from('moderation_actions')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shopId);

      if (countError) {
        logger.error('Failed to fetch shop moderation actions count', { error: countError, shopId });
        throw new CustomError('Failed to fetch moderation actions count', 500);
      }

      return {
        actions: actions || [],
        total: count || 0,
      };
    } catch (error) {
      logger.error('Error fetching shop moderation actions', { error, shopId });
      throw error;
    }
  }

  /**
   * Get shop moderation status
   */
  async getShopModerationStatus(shopId: string): Promise<ShopModerationStatus | null> {
    try {
      const { data: shop, error: shopError } = await getSupabaseClient()
        .from('shops')
        .select('status, warning_count, updated_at')
        .eq('id', shopId)
        .single();

      if (shopError) {
        if (shopError.code === 'PGRST116') {
          return null; // Shop not found
        }
        logger.error('Failed to fetch shop for moderation status', { error: shopError, shopId });
        throw new CustomError('Failed to fetch shop', 500);
      }

      const { count: violationCount, error: violationError } = await getSupabaseClient()
        .from('shop_reports')
        .select('*', { count: 'exact', head: true })
        .eq('shop_id', shopId)
        .eq('status', 'resolved');

      if (violationError) {
        logger.error('Failed to fetch shop violation count', { error: violationError, shopId });
        throw new CustomError('Failed to fetch violation count', 500);
      }

      return {
        shop_id: shopId,
        status: shop.status as any,
        moderation_score: 0, // This could be calculated based on recent reports
        last_moderated: shop.updated_at,
        violation_count: violationCount || 0,
        warning_count: shop.warning_count || 0,
      };
    } catch (error) {
      logger.error('Error fetching shop moderation status', { error, shopId });
      throw error;
    }
  }

  /**
   * Process a new shop report with automated moderation
   */
  async processShopReport(reportId: string): Promise<ModerationAction | null> {
    try {
      // Get the report details
      const { data: report, error: reportError } = await getSupabaseClient()
        .from('shop_reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (reportError) {
        logger.error('Failed to fetch report for moderation', { error: reportError, reportId });
        throw new CustomError('Failed to fetch report', 500);
      }

      // Get shop content for analysis
      const { data: shop, error: shopError } = await getSupabaseClient()
        .from('shops')
        .select('name, description, profile_content')
        .eq('id', report.shop_id)
        .single();

      if (shopError) {
        logger.error('Failed to fetch shop for content analysis', { error: shopError, shopId: report.shop_id });
        throw new CustomError('Failed to fetch shop content', 500);
      }

      // Analyze shop content
      const analysisResult = await contentModerationService.analyzeShopContent({
        name: shop.name,
        description: shop.description,
        profile_content: shop.profile_content,
      });

      // Execute automated moderation if needed
      const moderationAction = await this.executeAutomatedModeration(
        report.shop_id,
        analysisResult.overallResult,
        reportId
      );

      // Update report status based on moderation action
      if (moderationAction) {
        const newStatus = moderationAction.action_type === 'auto_block' ? 'resolved' : 'under_review';
        await getSupabaseClient()
          .from('shop_reports')
          .update({ status: newStatus })
          .eq('id', reportId);
      }

      logger.info('Shop report processed with automated moderation', {
        reportId,
        shopId: report.shop_id,
        moderationAction: moderationAction?.action_type || 'none',
        analysisScore: analysisResult.overallResult.score
      });

      return moderationAction;
    } catch (error) {
      logger.error('Error processing shop report with automated moderation', { error, reportId });
      throw error;
    }
  }
}

export const moderationActionsService = new ModerationActionsService();
