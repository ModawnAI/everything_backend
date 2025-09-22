/**
 * Admin Financial Service
 * 
 * Core business logic for admin financial management:
 * - Financial data aggregation and analysis
 * - Report generation and export
 * - Payout calculations with commission management
 * - Point system oversight and adjustments
 * - Audit trail management
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export interface FinancialSummary {
  totalRevenue: number;
  totalTransactions: number;
  totalRefunds: number;
  totalRefundAmount: number;
  totalPointsIssued: number;
  totalPointsUsed: number;
  totalCommissionEarned: number;
  activeShops: number;
  activeUsers: number;
  avgTransactionValue: number;
  refundRate: number;
  pointRedemptionRate: number;
}

export interface AdminActionStatistics {
  action: string;
  actionCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgProcessingTimeMs: number;
  lastPerformedAt: string;
}

export interface PayoutCalculationRequest {
  shopId: string;
  startDate: string;
  endDate: string;
  commissionRate?: number;
  includeRefunds?: boolean;
}

export interface PayoutCalculationResult {
  shopId: string;
  period: {
    startDate: string;
    endDate: string;
  };
  revenue: {
    grossRevenue: number;
    totalTransactions: number;
    averageTransactionValue: number;
  };
  commissions: {
    platformCommissionRate: number;
    platformCommissionAmount: number;
    paymentProcessingFee: number;
    totalDeductions: number;
  };
  refunds: {
    totalRefunds: number;
    refundAmount: number;
  };
  netPayoutAmount: number;
  breakdown: Array<{
    date: string;
    transactions: number;
    revenue: number;
    commissions: number;
    refunds: number;
    netAmount: number;
  }>;
}

export interface ReportGenerationRequest {
  reportType: 'summary' | 'detailed' | 'shop_breakdown' | 'point_analysis';
  startDate: string;
  endDate: string;
  shopIds?: string[];
  includeRefunds?: boolean;
  includePoints?: boolean;
  format?: 'json' | 'csv' | 'excel';
  adminId: string;
}

export interface ReportGenerationResult {
  reportId: string;
  reportType: string;
  generationStatus: 'pending' | 'generating' | 'completed' | 'failed';
  reportData?: any;
  filePath?: string;
  downloadUrl?: string;
  expiresAt: string;
}

export class AdminFinancialService {
  private supabase = getSupabaseClient();

  /**
   * Get comprehensive financial summary for admin dashboard
   */
  async getFinancialSummary(
    startDate?: string,
    endDate?: string,
    shopId?: string
  ): Promise<FinancialSummary> {
    try {
      logger.info('Fetching financial summary', { startDate, endDate, shopId });

      const { data: summary, error } = await this.supabase
        .rpc('get_admin_financial_summary', {
          p_start_date: startDate || null,
          p_end_date: endDate || null,
          p_shop_id: shopId || null
        });

      if (error) {
        throw new Error(`Failed to fetch financial summary: ${error.message}`);
      }

      const result = summary?.[0] || {};

      return {
        totalRevenue: Number(result.total_revenue || 0),
        totalTransactions: Number(result.total_transactions || 0),
        totalRefunds: Number(result.total_refunds || 0),
        totalRefundAmount: Number(result.total_refund_amount || 0),
        totalPointsIssued: Number(result.total_points_issued || 0),
        totalPointsUsed: Number(result.total_points_used || 0),
        totalCommissionEarned: Number(result.total_commission_earned || 0),
        activeShops: Number(result.active_shops || 0),
        activeUsers: Number(result.active_users || 0),
        avgTransactionValue: Number(result.avg_transaction_value || 0),
        refundRate: Number(result.refund_rate || 0),
        pointRedemptionRate: Number(result.point_redemption_rate || 0)
      };

    } catch (error) {
      logger.error('Failed to get financial summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
        startDate,
        endDate,
        shopId
      });
      throw error;
    }
  }

  /**
   * Get admin action statistics for monitoring
   */
  async getAdminActionStatistics(
    adminId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<AdminActionStatistics[]> {
    try {
      logger.info('Fetching admin action statistics', { adminId, startDate, endDate });

      const { data: statistics, error } = await this.supabase
        .rpc('get_admin_action_statistics', {
          p_admin_id: adminId || null,
          p_start_date: startDate || null,
          p_end_date: endDate || null
        });

      if (error) {
        throw new Error(`Failed to fetch admin action statistics: ${error.message}`);
      }

      return (statistics || []).map((stat: any) => ({
        action: stat.action,
        actionCount: Number(stat.action_count),
        successCount: Number(stat.success_count),
        failureCount: Number(stat.failure_count),
        successRate: Number(stat.success_rate),
        avgProcessingTimeMs: Number(stat.avg_processing_time_ms || 0),
        lastPerformedAt: stat.last_performed_at
      }));

    } catch (error) {
      logger.error('Failed to get admin action statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        startDate,
        endDate
      });
      throw error;
    }
  }

  /**
   * Calculate detailed shop payout with commission management
   */
  async calculateShopPayout(request: PayoutCalculationRequest): Promise<PayoutCalculationResult> {
    try {
      logger.info('Calculating shop payout', request);

      const { shopId, startDate, endDate, commissionRate = 0.05, includeRefunds = true } = request;

      // Get shop payments for the period
      const { data: payments, error: paymentsError } = await this.supabase
        .from('payments')
        .select(`
          *,
          reservations!inner(shop_id)
        `)
        .eq('reservations.shop_id', shopId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .in('payment_status', ['deposit_paid', 'final_payment_paid', 'fully_paid']);

      if (paymentsError) {
        throw new Error(`Failed to fetch shop payments: ${paymentsError.message}`);
      }

      // Calculate revenue metrics
      const grossRevenue = (payments || []).reduce((sum, p) => sum + p.amount, 0);
      const totalTransactions = payments?.length || 0;
      const averageTransactionValue = totalTransactions > 0 ? grossRevenue / totalTransactions : 0;

      // Calculate commission and fees
      const platformCommissionAmount = Math.round(grossRevenue * commissionRate);
      const paymentProcessingFee = Math.round(grossRevenue * 0.029 + (totalTransactions * 30)); // 2.9% + 30 KRW per transaction
      const totalDeductions = platformCommissionAmount + paymentProcessingFee;

      // Get refunds if included
      let refundAmount = 0;
      let totalRefunds = 0;

      if (includeRefunds) {
        const { data: refunds, error: refundsError } = await this.supabase
          .from('refunds')
          .select(`
            *,
            reservations!inner(shop_id)
          `)
          .eq('reservations.shop_id', shopId)
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .eq('refund_status', 'completed');

        if (refundsError) {
          throw new Error(`Failed to fetch shop refunds: ${refundsError.message}`);
        }

        refundAmount = (refunds || []).reduce((sum, r) => sum + r.refunded_amount, 0);
        totalRefunds = refunds?.length || 0;
      }

      // Calculate net payout
      const netPayoutAmount = grossRevenue - totalDeductions - refundAmount;

      // Generate daily breakdown
      const breakdown = await this.generatePayoutBreakdown(
        shopId,
        startDate,
        endDate,
        commissionRate,
        includeRefunds
      );

      return {
        shopId,
        period: {
          startDate,
          endDate
        },
        revenue: {
          grossRevenue,
          totalTransactions,
          averageTransactionValue
        },
        commissions: {
          platformCommissionRate: commissionRate,
          platformCommissionAmount,
          paymentProcessingFee,
          totalDeductions
        },
        refunds: {
          totalRefunds,
          refundAmount
        },
        netPayoutAmount,
        breakdown
      };

    } catch (error) {
      logger.error('Failed to calculate shop payout', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request
      });
      throw error;
    }
  }

  /**
   * Generate financial report with specified parameters
   */
  async generateFinancialReport(request: ReportGenerationRequest): Promise<ReportGenerationResult> {
    try {
      logger.info('Generating financial report', request);

      const reportId = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Reports expire after 7 days

      // Create report record
      const { error: insertError } = await this.supabase
        .from('admin_financial_reports')
        .insert({
          id: reportId,
          admin_id: request.adminId,
          report_type: request.reportType,
          report_name: `${request.reportType}_${new Date().toISOString().split('T')[0]}`,
          report_parameters: {
            startDate: request.startDate,
            endDate: request.endDate,
            shopIds: request.shopIds,
            includeRefunds: request.includeRefunds,
            includePoints: request.includePoints,
            format: request.format
          },
          generation_status: 'generating',
          generation_started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        });

      if (insertError) {
        throw new Error(`Failed to create report record: ${insertError.message}`);
      }

      // Generate report data based on type
      let reportData: any = {};

      try {
        switch (request.reportType) {
          case 'summary':
            reportData = await this.generateSummaryReportData(request);
            break;
          case 'detailed':
            reportData = await this.generateDetailedReportData(request);
            break;
          case 'shop_breakdown':
            reportData = await this.generateShopBreakdownReportData(request);
            break;
          case 'point_analysis':
            reportData = await this.generatePointAnalysisReportData(request);
            break;
          default:
            throw new Error(`Unsupported report type: ${request.reportType}`);
        }

        // Update report with generated data
        const { error: updateError } = await this.supabase
          .from('admin_financial_reports')
          .update({
            report_data: reportData,
            generation_status: 'completed',
            generation_completed_at: new Date().toISOString(),
            generation_time_ms: Date.now() - new Date().getTime()
          })
          .eq('id', reportId);

        if (updateError) {
          throw new Error(`Failed to update report: ${updateError.message}`);
        }

        return {
          reportId,
          reportType: request.reportType,
          generationStatus: 'completed',
          reportData,
          expiresAt: expiresAt.toISOString()
        };

      } catch (generationError) {
        // Update report with error status
        await this.supabase
          .from('admin_financial_reports')
          .update({
            generation_status: 'failed',
            error_message: generationError instanceof Error ? generationError.message : 'Unknown error',
            generation_completed_at: new Date().toISOString()
          })
          .eq('id', reportId);

        throw generationError;
      }

    } catch (error) {
      logger.error('Failed to generate financial report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request
      });
      throw error;
    }
  }

  /**
   * Create shop payout record for processing
   */
  async createShopPayoutRecord(
    payoutCalculation: PayoutCalculationResult,
    adminId: string
  ): Promise<string> {
    try {
      logger.info('Creating shop payout record', {
        shopId: payoutCalculation.shopId,
        netAmount: payoutCalculation.netPayoutAmount,
        adminId
      });

      const payoutId = crypto.randomUUID();

      const { error } = await this.supabase
        .from('shop_payouts')
        .insert({
          id: payoutId,
          shop_id: payoutCalculation.shopId,
          admin_id: adminId,
          period_start_date: payoutCalculation.period.startDate,
          period_end_date: payoutCalculation.period.endDate,
          gross_revenue: payoutCalculation.revenue.grossRevenue,
          total_transactions: payoutCalculation.revenue.totalTransactions,
          platform_commission_rate: payoutCalculation.commissions.platformCommissionRate,
          platform_commission_amount: payoutCalculation.commissions.platformCommissionAmount,
          payment_processing_fee: payoutCalculation.commissions.paymentProcessingFee,
          total_deductions: payoutCalculation.commissions.totalDeductions,
          refund_amount: payoutCalculation.refunds.refundAmount,
          refund_count: payoutCalculation.refunds.totalRefunds,
          net_payout_amount: payoutCalculation.netPayoutAmount,
          payout_status: 'calculated',
          calculation_details: payoutCalculation,
          breakdown_data: { breakdown: payoutCalculation.breakdown }
        });

      if (error) {
        throw new Error(`Failed to create payout record: ${error.message}`);
      }

      return payoutId;

    } catch (error) {
      logger.error('Failed to create shop payout record', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: payoutCalculation.shopId,
        adminId
      });
      throw error;
    }
  }

  /**
   * Log admin action for audit trail
   */
  async logAdminAction(
    adminId: string,
    action: string,
    details: any,
    success: boolean = true,
    errorMessage?: string,
    processingTimeMs?: number,
    affectedUserId?: string,
    affectedShopId?: string,
    affectedResourceType?: string,
    affectedResourceId?: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('admin_audit_logs')
        .insert({
          admin_id: adminId,
          action,
          details,
          success,
          error_message: errorMessage,
          processing_time_ms: processingTimeMs,
          affected_user_id: affectedUserId,
          affected_shop_id: affectedShopId,
          affected_resource_type: affectedResourceType,
          affected_resource_id: affectedResourceId
        });

    } catch (error) {
      logger.error('Failed to log admin action', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        action
      });
      // Don't throw - logging failure shouldn't break the main operation
    }
  }

  /**
   * Clean up old audit logs and reports
   */
  async cleanupOldRecords(retentionDays: number = 365): Promise<{
    auditLogsDeleted: number;
    reportsDeleted: number;
  }> {
    try {
      logger.info('Cleaning up old admin records', { retentionDays });

      // Clean up old audit logs
      const { data: auditResult, error: auditError } = await this.supabase
        .rpc('cleanup_old_admin_audit_logs', {
          p_retention_days: retentionDays
        });

      if (auditError) {
        throw new Error(`Failed to cleanup audit logs: ${auditError.message}`);
      }

      // Clean up expired reports
      const { data: expiredReports, error: reportsError } = await this.supabase
        .from('admin_financial_reports')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id');

      if (reportsError) {
        throw new Error(`Failed to cleanup expired reports: ${reportsError.message}`);
      }

      const result = {
        auditLogsDeleted: auditResult || 0,
        reportsDeleted: expiredReports?.length || 0
      };

      logger.info('Cleanup completed', result);
      return result;

    } catch (error) {
      logger.error('Failed to cleanup old records', {
        error: error instanceof Error ? error.message : 'Unknown error',
        retentionDays
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private async generatePayoutBreakdown(
    shopId: string,
    startDate: string,
    endDate: string,
    commissionRate: number,
    includeRefunds: boolean
  ): Promise<Array<{
    date: string;
    transactions: number;
    revenue: number;
    commissions: number;
    refunds: number;
    netAmount: number;
  }>> {
    // Simplified implementation - in a real system, this would generate daily breakdown
    const breakdown: Array<{
      date: string;
      transactions: number;
      revenue: number;
      commissions: number;
      refunds: number;
      netAmount: number;
    }> = [];

    // For now, return empty array - implement actual daily breakdown as needed
    return breakdown;
  }

  private async generateSummaryReportData(request: ReportGenerationRequest): Promise<any> {
    const summary = await this.getFinancialSummary(
      request.startDate,
      request.endDate,
      request.shopIds?.[0]
    );

    return {
      summary,
      period: {
        startDate: request.startDate,
        endDate: request.endDate
      },
      generatedAt: new Date().toISOString()
    };
  }

  private async generateDetailedReportData(request: ReportGenerationRequest): Promise<any> {
    // Implement detailed report generation
    return {
      reportType: 'detailed',
      message: 'Detailed report data would be generated here',
      period: {
        startDate: request.startDate,
        endDate: request.endDate
      }
    };
  }

  private async generateShopBreakdownReportData(request: ReportGenerationRequest): Promise<any> {
    // Implement shop breakdown report generation
    return {
      reportType: 'shop_breakdown',
      message: 'Shop breakdown report data would be generated here',
      period: {
        startDate: request.startDate,
        endDate: request.endDate
      }
    };
  }

  private async generatePointAnalysisReportData(request: ReportGenerationRequest): Promise<any> {
    // Implement point analysis report generation
    return {
      reportType: 'point_analysis',
      message: 'Point analysis report data would be generated here',
      period: {
        startDate: request.startDate,
        endDate: request.endDate
      }
    };
  }
}

export const adminFinancialService = new AdminFinancialService();

